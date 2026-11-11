import { createHash, randomBytes } from 'node:crypto';
import { errors, jwtVerify, SignJWT } from 'jose';
import type { Role } from '@real-estate/shared';
import { ACCESS_TOKEN_TTL_SECONDS, TOKEN_AUDIENCE, TOKEN_ISSUER } from './auth.constants';

export class AccessTokenExpiredError extends Error {}
export class AccessTokenInvalidError extends Error {}

/** Signs and verifies short-lived access tokens (HS256 JWT). */
export class AccessTokens {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  sign(userId: string, role: Role): Promise<string> {
    return new SignJWT({ role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.key);
  }

  async verify(token: string): Promise<{ userId: string }> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
        algorithms: ['HS256'],
      });
      if (!payload.sub) throw new AccessTokenInvalidError('Token has no subject');
      return { userId: payload.sub };
    } catch (err) {
      if (err instanceof errors.JWTExpired) throw new AccessTokenExpiredError('Token expired');
      throw new AccessTokenInvalidError('Token invalid');
    }
  }
}

/** Opaque random token for refresh cookies and email links (never stored in plain text). */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hash stored in the database instead of the token itself. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
