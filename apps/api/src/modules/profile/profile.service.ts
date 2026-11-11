import type { Profile, Role } from '@real-estate/shared';
import type { EmailProvider } from '../../lib/email';
import { passwordChangedEmail, trySendEmail } from '../../lib/email';
import { AppError, notFound } from '../../lib/errors';
import type { Logger } from '../../lib/logger';
import { hashPassword, verifyPassword } from '../../lib/password';
import type { AuthService, ClientInfo, Session } from '../auth/auth.service';
import { diffFields, recordChange } from '../changeLogs/changeLog.service';
import { getCompanyName } from '../settings/settings.service';
import { UserModel } from '../users/user.model';

interface StoredUser {
  _id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  status: string;
  lastLoginAt?: Date | null;
  createdAt: Date;
  passwordHash?: string | null;
}

function toProfile(user: StoredUser): Profile {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role as Role,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

/** The signed-in user's own account (PRD ADM-PRF). Available to every role. */
export class ProfileService {
  private readonly email: EmailProvider;
  private readonly logger: Logger;
  private readonly auth: AuthService;

  constructor(deps: { email: EmailProvider; logger: Logger; auth: AuthService }) {
    this.email = deps.email;
    this.logger = deps.logger;
    this.auth = deps.auth;
  }

  private async load(userId: string, withPassword = false): Promise<StoredUser> {
    const query = UserModel.findById(userId);
    if (withPassword) query.select('+passwordHash');
    const user = await query.lean<StoredUser>();
    if (!user) throw notFound('User not found');
    return user;
  }

  async get(userId: string): Promise<Profile> {
    return toProfile(await this.load(userId));
  }

  async update(userId: string, input: { name?: string; phone?: string | null }): Promise<Profile> {
    const before = await this.load(userId);
    const set: Record<string, unknown> = { updatedBy: userId };
    const unset: Record<string, 1> = {};
    if (input.name !== undefined) set.name = input.name;
    if (input.phone === null) unset.phone = 1;
    else if (input.phone !== undefined) set.phone = input.phone;

    const after = await UserModel.findOneAndUpdate(
      { _id: userId },
      { $set: set, ...(Object.keys(unset).length > 0 && { $unset: unset }) },
      { returnDocument: 'after' },
    ).lean<StoredUser>();
    if (!after) throw notFound('User not found');

    const changes = diffFields(
      before as unknown as Record<string, unknown>,
      after as unknown as Record<string, unknown>,
      ['name', 'phone'],
    );
    if (Object.keys(changes).length > 0) {
      await recordChange({
        actorId: userId,
        entity: 'user',
        entityId: userId,
        action: 'profile_updated',
        changes,
      });
    }
    return toProfile(after);
  }

  /**
   * Checks the current password, saves the new one, signs out every other device and
   * returns a fresh session for this device. Sends a "password changed" email.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    client: ClientInfo,
  ): Promise<Session> {
    const user = await this.load(userId, true);
    if (!user.passwordHash || !(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Your current password is incorrect.', [
        { path: 'body.currentPassword', message: 'Your current password is incorrect.' },
      ]);
    }

    await UserModel.updateOne(
      { _id: userId },
      { $set: { passwordHash: await hashPassword(newPassword), updatedBy: userId } },
    );
    await this.auth.revokeAllSessions(userId);
    await recordChange({
      actorId: userId,
      entity: 'user',
      entityId: userId,
      action: 'password_changed',
    });

    const companyName = await getCompanyName();
    await trySendEmail(
      this.email,
      { to: user.email, ...passwordChangedEmail({ companyName, name: user.name }) },
      this.logger,
    );
    return this.auth.signIn(user, client);
  }
}
