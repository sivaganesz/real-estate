import { permissionsFor } from '@real-estate/shared';
import type { AuthUser, Role } from '@real-estate/shared';
import type { Env } from '../../config/env';
import { newId } from '../../db/ids';
import type { EmailProvider } from '../../lib/email';
import { passwordChangedEmail, passwordResetEmail, trySendEmail } from '../../lib/email';
import { AppError, badRequest, unauthenticated } from '../../lib/errors';
import type { Logger } from '../../lib/logger';
import { hashPassword, verifyPassword } from '../../lib/password';
import { getCompanyName } from '../settings/settings.service';
import { UserModel } from '../users/user.model';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  LOCK_MINUTES,
  MAX_FAILED_LOGINS,
  PASSWORD_RESET_TTL_MINUTES,
  REFRESH_REUSE_GRACE_SECONDS,
  SESSION_IDLE_MINUTES,
  SESSION_MAX_DAYS,
} from './auth.constants';
import { AuthTokenModel } from './authToken.model';
import { RefreshTokenModel } from './refreshToken.model';
import { AccessTokens, hashToken, randomToken } from './tokens';

const MINUTE = 60_000;
const INVALID_CREDENTIALS = 'Email or password is incorrect';
const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';

export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

export interface Session {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: AuthUser;
}

interface UserLike {
  _id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
}

export function toAuthUser(user: UserLike): AuthUser {
  const role = user.role as Role;
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role,
    permissions: [...permissionsFor(role)],
  };
}

// A real hash to verify against when the email doesn't exist, so response time doesn't
// reveal which emails have accounts.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword('dummy-password-for-timing-1'));

export class AuthService {
  private readonly env: Env;
  private readonly email: EmailProvider;
  private readonly logger: Logger;
  readonly accessTokens: AccessTokens;

  constructor(deps: { env: Env; email: EmailProvider; logger: Logger }) {
    this.env = deps.env;
    this.email = deps.email;
    this.logger = deps.logger;
    this.accessTokens = new AccessTokens(deps.env.JWT_ACCESS_SECRET);
  }

  // ---------------------------------------------------------------- login

  async login(email: string, password: string, client: ClientInfo): Promise<Session> {
    const user = await UserModel.findOne({ email }).select('+passwordHash');

    if (!user?.passwordHash) {
      await verifyPassword(await getDummyHash(), password);
      throw new AppError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / MINUTE);
      throw new AppError(
        423,
        'ACCOUNT_LOCKED',
        `Account locked after too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'} or ask your Super Admin to unlock it.`,
      );
    }

    if (!(await verifyPassword(user.passwordHash, password))) {
      await this.recordFailedLogin(user._id);
      throw new AppError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
    }

    if (user.status !== 'active') {
      throw new AppError(
        403,
        'ACCOUNT_INACTIVE',
        'Your account is not active. Contact your administrator.',
      );
    }

    return this.signIn(user, client);
  }

  /** Starts a new session for an already-verified user (login, accepted invite). */
  async signIn(user: UserLike, client: ClientInfo): Promise<Session> {
    const now = new Date();
    await UserModel.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: now, failedLoginCount: 0, lockedUntil: null } },
    );
    const { session } = await this.startSession(user, client, {
      familyId: newId(),
      sessionStartedAt: now,
    });
    return session;
  }

  private async recordFailedLogin(userId: string): Promise<void> {
    const updated = await UserModel.findOneAndUpdate(
      { _id: userId },
      { $inc: { failedLoginCount: 1 } },
      { returnDocument: 'after' },
    );
    if (updated && updated.failedLoginCount >= MAX_FAILED_LOGINS) {
      await UserModel.updateOne(
        { _id: userId },
        {
          $set: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * MINUTE) },
        },
      );
      this.logger.warn({ userId }, 'Account locked after repeated failed logins');
    }
  }

  // ---------------------------------------------------------------- sessions

  private async startSession(
    user: UserLike,
    client: ClientInfo,
    family: { familyId: string; sessionStartedAt: Date },
  ): Promise<{ session: Session; recordId: string }> {
    const refreshToken = randomToken();
    const refreshExpiresAt = new Date(
      family.sessionStartedAt.getTime() + SESSION_MAX_DAYS * 24 * 60 * MINUTE,
    );
    const record = await RefreshTokenModel.create({
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      familyId: family.familyId,
      sessionStartedAt: family.sessionStartedAt,
      expiresAt: refreshExpiresAt,
      userAgent: client.userAgent?.slice(0, 300),
      ip: client.ip,
    });
    const accessToken = await this.accessTokens.sign(user._id, user.role as Role);
    return {
      session: {
        accessToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        refreshToken,
        refreshExpiresAt,
        user: toAuthUser(user),
      },
      recordId: record._id,
    };
  }

  /**
   * Exchanges a refresh token for a new access token and a new refresh token (rotation).
   * - Reusing an already-replaced token revokes the whole session family (token theft).
   * - No refresh for SESSION_IDLE_MINUTES = signed out for inactivity.
   */
  async refresh(rawToken: string | undefined, client: ClientInfo): Promise<Session> {
    if (!rawToken) throw unauthenticated(SESSION_EXPIRED);
    const now = new Date();
    const token = await RefreshTokenModel.findOne({ tokenHash: hashToken(rawToken) });
    if (!token) throw unauthenticated(SESSION_EXPIRED);

    if (token.revokedAt) {
      const withinGrace =
        now.getTime() - token.revokedAt.getTime() < REFRESH_REUSE_GRACE_SECONDS * 1000;
      if (!withinGrace) {
        await this.revokeFamily(token.familyId, now);
        this.logger.warn(
          { userId: token.userId, familyId: token.familyId },
          'Refresh token reuse detected',
        );
      }
      throw unauthenticated(SESSION_EXPIRED);
    }

    const idleSince = token.createdAt ?? token.sessionStartedAt;
    if (
      token.expiresAt <= now ||
      now.getTime() - idleSince.getTime() > SESSION_IDLE_MINUTES * MINUTE
    ) {
      await this.revokeFamily(token.familyId, now);
      throw unauthenticated(SESSION_EXPIRED);
    }

    const user = await UserModel.findById(token.userId).lean();
    if (!user || user.status !== 'active') {
      await this.revokeFamily(token.familyId, now);
      throw unauthenticated(SESSION_EXPIRED);
    }

    // Revoke atomically so two concurrent refreshes can't both succeed.
    const claimed = await RefreshTokenModel.findOneAndUpdate(
      { _id: token._id, revokedAt: null },
      { $set: { revokedAt: now } },
    );
    if (!claimed) throw unauthenticated(SESSION_EXPIRED);

    const { session, recordId } = await this.startSession(user, client, {
      familyId: token.familyId,
      sessionStartedAt: token.sessionStartedAt,
    });
    await RefreshTokenModel.updateOne({ _id: token._id }, { $set: { replacedBy: recordId } });
    return session;
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const token = await RefreshTokenModel.findOne({ tokenHash: hashToken(rawToken) });
    if (token) await this.revokeFamily(token.familyId, new Date());
  }

  private async revokeFamily(familyId: string, at: Date): Promise<void> {
    await RefreshTokenModel.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: at } });
  }

  /** Signs the user out everywhere (password reset, deactivation, role change). */
  async revokeAllSessions(userId: string): Promise<void> {
    await RefreshTokenModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await UserModel.findById(userId).lean();
    if (!user || user.status !== 'active') throw unauthenticated();
    return toAuthUser(user);
  }

  // ---------------------------------------------------------------- passwords

  /** Always succeeds from the caller's view, so it doesn't reveal which emails exist. */
  async forgotPassword(email: string): Promise<void> {
    const user = await UserModel.findOne({ email }).lean();
    if (!user || user.status !== 'active') return;
    await this.sendPasswordResetEmail(user);
  }

  /**
   * Creates a 1-hour reset link (replacing any earlier one) and emails it.
   * Returns false if the email provider failed. Used by forgot-password and by admins.
   */
  async sendPasswordResetEmail(user: {
    _id: string;
    name: string;
    email: string;
  }): Promise<boolean> {
    await AuthTokenModel.updateMany(
      { userId: user._id, type: 'password_reset', usedAt: null },
      { $set: { usedAt: new Date() } },
    );
    const token = randomToken();
    await AuthTokenModel.create({
      userId: user._id,
      type: 'password_reset',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * MINUTE),
    });

    const resetUrl = `${this.env.APP_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
    const companyName = await getCompanyName();
    const message = passwordResetEmail({
      companyName,
      name: user.name,
      resetUrl,
      expiresMinutes: PASSWORD_RESET_TTL_MINUTES,
    });
    const result = await trySendEmail(this.email, { to: user.email, ...message }, this.logger);
    return result.sent;
  }

  async resetPassword(rawToken: string, password: string): Promise<void> {
    const now = new Date();
    const token = await AuthTokenModel.findOneAndUpdate(
      {
        tokenHash: hashToken(rawToken),
        type: 'password_reset',
        usedAt: null,
        expiresAt: { $gt: now },
      },
      { $set: { usedAt: now } },
    );
    if (!token) {
      throw badRequest('This link is invalid or has expired. Please request a new one.');
    }

    const user = await UserModel.findOneAndUpdate(
      { _id: token.userId },
      {
        $set: {
          passwordHash: await hashPassword(password),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      },
      { returnDocument: 'after' },
    ).lean();
    if (!user) throw badRequest('This link is invalid or has expired. Please request a new one.');

    await this.revokeAllSessions(user._id);
    const companyName = await getCompanyName();
    await trySendEmail(
      this.email,
      { to: user.email, ...passwordChangedEmail({ companyName, name: user.name }) },
      this.logger,
    );
  }
}
