import { ROLE_LABELS } from '@real-estate/shared';
import type {
  AuthUser,
  InviteInfo,
  ListUsersQuery,
  PageMeta,
  Role,
  User,
  UserStats,
} from '@real-estate/shared';
import type { Env } from '../../config/env';
import type { EmailProvider } from '../../lib/email';
import { inviteEmail, trySendEmail } from '../../lib/email';
import { AppError, badRequest, businessRule, conflict, notFound } from '../../lib/errors';
import { pageMeta, pageSkip, parseSort } from '../../lib/http';
import type { Logger } from '../../lib/logger';
import { hashPassword } from '../../lib/password';
import { INVITE_TTL_HOURS } from '../auth/auth.constants';
import type { AuthService, ClientInfo, Session } from '../auth/auth.service';
import { AuthTokenModel } from '../auth/authToken.model';
import { hashToken, randomToken } from '../auth/tokens';
import { diffFields, recordChange } from '../changeLogs/changeLog.service';
import { getCompanyName } from '../settings/settings.service';
import type { UserDoc } from './user.model';
import { UserModel } from './user.model';

const HOUR = 60 * 60_000;
const INVALID_INVITE =
  'This invite link is invalid or has expired. Ask your administrator to send a new one.';
const SORTABLE = ['name', 'email', 'role', 'createdAt', 'lastLoginAt'] as const;

type StoredUser = UserDoc & { _id: string; createdAt: Date; updatedAt: Date };

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null);

export function toUserDto(user: StoredUser, inviteExpiresAt: Date | null = null): User {
  const lockedUntil = user.lockedUntil && user.lockedUntil > new Date() ? user.lockedUntil : null;
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role as Role,
    status: user.status as User['status'],
    locked: Boolean(lockedUntil),
    lockedUntil: iso(lockedUntil),
    failedLoginCount: user.failedLoginCount ?? 0,
    lastLoginAt: iso(user.lastLoginAt),
    inviteExpiresAt: iso(inviteExpiresAt),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Staff user management (PRD ADM-USR, TRD §8). Every change is written to the change log.
 */
export class UsersService {
  private readonly env: Env;
  private readonly email: EmailProvider;
  private readonly logger: Logger;
  private readonly auth: AuthService;

  constructor(deps: { env: Env; email: EmailProvider; logger: Logger; auth: AuthService }) {
    this.env = deps.env;
    this.email = deps.email;
    this.logger = deps.logger;
    this.auth = deps.auth;
  }

  // ---------------------------------------------------------------- reading

  async list(query: ListUsersQuery): Promise<{ items: User[]; meta: PageMeta }> {
    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.status === 'locked') {
      filter.status = 'active';
      filter.lockedUntil = { $gt: new Date() };
    } else if (query.status) {
      filter.status = query.status;
    }
    if (query.q) {
      const pattern = new RegExp(escapeRegex(query.q), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }];
    }

    const sort = parseSort(query.sort, SORTABLE, { createdAt: 1 });
    const [docs, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ ...sort, _id: 1 })
        .skip(pageSkip(query.page, query.limit))
        .limit(query.limit)
        .lean<StoredUser[]>(),
      UserModel.countDocuments(filter),
    ]);

    const invites = await this.inviteExpiryByUser(
      docs.filter((u) => u.status === 'invited').map((u) => u._id),
    );
    return {
      items: docs.map((u) => toUserDto(u, invites.get(u._id) ?? null)),
      meta: pageMeta(total, query.page, query.limit),
    };
  }

  async stats(): Promise<UserStats> {
    const now = new Date();
    const [active, invited, inactive, locked] = await Promise.all([
      UserModel.countDocuments({ status: 'active' }),
      UserModel.countDocuments({ status: 'invited' }),
      UserModel.countDocuments({ status: 'inactive' }),
      UserModel.countDocuments({ status: 'active', lockedUntil: { $gt: now } }),
    ]);
    return { active, invited, inactive, locked };
  }

  async get(id: string): Promise<User> {
    const user = await this.findOrThrow(id);
    const invites = await this.inviteExpiryByUser(user.status === 'invited' ? [user._id] : []);
    return toUserDto(user, invites.get(user._id) ?? null);
  }

  private async findOrThrow(id: string): Promise<StoredUser> {
    const user = await UserModel.findById(id).lean<StoredUser>();
    if (!user) throw notFound('User not found');
    return user;
  }

  private async inviteExpiryByUser(userIds: string[]): Promise<Map<string, Date>> {
    if (userIds.length === 0) return new Map();
    const tokens = await AuthTokenModel.find({
      userId: { $in: userIds },
      type: 'invite',
      usedAt: null,
    })
      .sort({ expiresAt: 1 })
      .lean();
    return new Map(tokens.map((t) => [t.userId, t.expiresAt]));
  }

  // ---------------------------------------------------------------- invites

  async invite(
    actor: AuthUser,
    input: { name: string; email: string; phone?: string; role: Role },
  ): Promise<{ user: User; emailSent: boolean }> {
    if (await UserModel.exists({ email: input.email })) {
      throw conflict('A user with this email already exists.', 'DUPLICATE');
    }
    const created = await UserModel.create({
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: input.role,
      status: 'invited',
      createdBy: actor.id,
      updatedBy: actor.id,
    });
    await recordChange({
      actorId: actor.id,
      entity: 'user',
      entityId: created._id,
      action: 'invited',
    });

    const { emailSent, expiresAt } = await this.sendInvite(created._id, actor.name);
    const user = await this.findOrThrow(created._id);
    return { user: toUserDto(user, expiresAt), emailSent };
  }

  async resendInvite(actor: AuthUser, id: string): Promise<{ user: User; emailSent: boolean }> {
    const user = await this.findOrThrow(id);
    if (user.status !== 'invited')
      throw businessRule('Only invited users can be sent a new invite.');
    const { emailSent, expiresAt } = await this.sendInvite(user._id, actor.name);
    await recordChange({
      actorId: actor.id,
      entity: 'user',
      entityId: user._id,
      action: 'invite_resent',
    });
    return { user: toUserDto(user, expiresAt), emailSent };
  }

  /** Replaces any open invite with a new 72-hour link and emails it. */
  private async sendInvite(
    userId: string,
    invitedBy: string,
  ): Promise<{ emailSent: boolean; expiresAt: Date }> {
    const user = await this.findOrThrow(userId);
    await AuthTokenModel.updateMany(
      { userId, type: 'invite', usedAt: null },
      { $set: { usedAt: new Date() } },
    );
    const token = randomToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * HOUR);
    await AuthTokenModel.create({ userId, type: 'invite', tokenHash: hashToken(token), expiresAt });

    const companyName = await getCompanyName();
    const message = inviteEmail({
      companyName,
      name: user.name,
      invitedBy,
      roleLabel: ROLE_LABELS[user.role as Role],
      acceptUrl: `${this.env.APP_BASE_URL}/accept-invite?token=${encodeURIComponent(token)}`,
      expiresHours: INVITE_TTL_HOURS,
    });
    const result = await trySendEmail(this.email, { to: user.email, ...message }, this.logger);
    return { emailSent: result.sent, expiresAt };
  }

  private async findOpenInvite(rawToken: string) {
    return AuthTokenModel.findOne({
      tokenHash: hashToken(rawToken),
      type: 'invite',
      usedAt: null,
      expiresAt: { $gt: new Date() },
    }).lean();
  }

  /** Public: details for the "Welcome, …" accept-invite screen. */
  async getInviteInfo(rawToken: string): Promise<InviteInfo> {
    const token = await this.findOpenInvite(rawToken);
    const user = token ? await UserModel.findById(token.userId).lean<StoredUser>() : null;
    if (!token || !user || user.status !== 'invited') throw badRequest(INVALID_INVITE);
    const inviter = user.createdBy
      ? await UserModel.findById(user.createdBy).lean<StoredUser>()
      : null;
    return {
      name: user.name,
      email: user.email,
      role: user.role as Role,
      invitedBy: inviter?.name ?? null,
    };
  }

  /** Public: sets the password, activates the account and signs the user in. */
  async acceptInvite(rawToken: string, password: string, client: ClientInfo): Promise<Session> {
    const now = new Date();
    const token = await AuthTokenModel.findOneAndUpdate(
      { tokenHash: hashToken(rawToken), type: 'invite', usedAt: null, expiresAt: { $gt: now } },
      { $set: { usedAt: now } },
    );
    if (!token) throw badRequest(INVALID_INVITE);

    const user = await UserModel.findOneAndUpdate(
      { _id: token.userId, status: 'invited' },
      { $set: { status: 'active', passwordHash: await hashPassword(password) } },
      { returnDocument: 'after' },
    ).lean<StoredUser>();
    if (!user) throw badRequest(INVALID_INVITE);

    await recordChange({
      actorId: user._id,
      entity: 'user',
      entityId: user._id,
      action: 'invite_accepted',
    });
    return this.auth.signIn(user, client);
  }

  // ---------------------------------------------------------------- changes

  async update(
    actor: AuthUser,
    id: string,
    input: { name?: string; phone?: string | null; role?: Role },
  ): Promise<User> {
    const user = await this.findOrThrow(id);

    if (input.role && input.role !== user.role) {
      if (user._id === actor.id) throw businessRule("You can't change your own role.");
      if (user.role === 'super_admin') await this.assertNotLastSuperAdmin(user);
    }

    const set: Record<string, unknown> = { updatedBy: actor.id };
    const unset: Record<string, 1> = {};
    if (input.name !== undefined) set.name = input.name;
    if (input.role !== undefined) set.role = input.role;
    if (input.phone === null) unset.phone = 1;
    else if (input.phone !== undefined) set.phone = input.phone;

    const updated = await UserModel.findOneAndUpdate(
      { _id: id },
      { $set: set, ...(Object.keys(unset).length > 0 && { $unset: unset }) },
      { returnDocument: 'after' },
    ).lean<StoredUser>();
    if (!updated) throw notFound('User not found');

    const changes = diffFields(user, updated, ['name', 'phone', 'role']);
    if (Object.keys(changes).length > 0) {
      await recordChange({
        actorId: actor.id,
        entity: 'user',
        entityId: id,
        action: changes.role ? 'role_changed' : 'updated',
        changes,
      });
    }
    return this.get(id);
  }

  async deactivate(actor: AuthUser, id: string): Promise<User> {
    const user = await this.findOrThrow(id);
    if (user._id === actor.id) throw businessRule("You can't deactivate your own account.");
    if (user.status === 'inactive') return this.get(id);
    if (user.role === 'super_admin') await this.assertNotLastSuperAdmin(user);

    await UserModel.updateOne({ _id: id }, { $set: { status: 'inactive', updatedBy: actor.id } });
    await this.auth.revokeAllSessions(id);
    await AuthTokenModel.updateMany({ userId: id, usedAt: null }, { $set: { usedAt: new Date() } });
    await recordChange({
      actorId: actor.id,
      entity: 'user',
      entityId: id,
      action: 'deactivated',
      changes: { status: [user.status, 'inactive'] },
    });
    return this.get(id);
  }

  /** Users who had set a password become active again; others return to "invited". */
  async reactivate(actor: AuthUser, id: string): Promise<User> {
    const user = await UserModel.findById(id).select('+passwordHash').lean<StoredUser>();
    if (!user) throw notFound('User not found');
    if (user.status !== 'inactive') return this.get(id);

    const status = user.passwordHash ? 'active' : 'invited';
    await UserModel.updateOne(
      { _id: id },
      { $set: { status, updatedBy: actor.id, failedLoginCount: 0, lockedUntil: null } },
    );
    await recordChange({
      actorId: actor.id,
      entity: 'user',
      entityId: id,
      action: 'reactivated',
      changes: { status: ['inactive', status] },
    });
    return this.get(id);
  }

  async sendPasswordReset(actor: AuthUser, id: string): Promise<{ emailSent: boolean }> {
    const user = await this.findOrThrow(id);
    if (user.status !== 'active') {
      throw businessRule('Password reset emails can only be sent to active users.');
    }
    const emailSent = await this.auth.sendPasswordResetEmail(user);
    await recordChange({
      actorId: actor.id,
      entity: 'user',
      entityId: id,
      action: 'password_reset_sent',
    });
    return { emailSent };
  }

  async unlock(actor: AuthUser, id: string): Promise<User> {
    await this.findOrThrow(id);
    await UserModel.updateOne(
      { _id: id },
      { $set: { failedLoginCount: 0, lockedUntil: null, updatedBy: actor.id } },
    );
    await recordChange({ actorId: actor.id, entity: 'user', entityId: id, action: 'unlocked' });
    return this.get(id);
  }

  /** There must always be at least one active Super Admin. */
  private async assertNotLastSuperAdmin(user: StoredUser): Promise<void> {
    if (user.status !== 'active') return;
    const others = await UserModel.countDocuments({
      _id: { $ne: user._id },
      role: 'super_admin',
      status: 'active',
    });
    if (others === 0) {
      throw new AppError(
        422,
        'LAST_SUPER_ADMIN',
        'There must always be at least one active Super Admin.',
      );
    }
  }
}
