import { SignJWT, UnsecuredJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_TOKEN_TTL_SECONDS, TOKEN_AUDIENCE, TOKEN_ISSUER } from './auth.constants';
import {
  AccessTokenExpiredError,
  AccessTokenInvalidError,
  AccessTokens,
  hashToken,
  randomToken,
} from './tokens';

const SECRET = 'unit-test-secret-unit-test-secret-0001';
const USER_ID = '0192f3a4-7b1c-7e2d-9a3f-1c2b3d4e5f60';
const key = new TextEncoder().encode(SECRET);

/** A token signed with the right key but custom claims, to test each rule separately. */
const craft = (claims: { iss?: string; aud?: string; sub?: string; exp?: string }) => {
  const jwt = new SignJWT({ role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt();
  if (claims.sub !== undefined) jwt.setSubject(claims.sub);
  jwt.setIssuer(claims.iss ?? TOKEN_ISSUER).setAudience(claims.aud ?? TOKEN_AUDIENCE);
  jwt.setExpirationTime(claims.exp ?? '15m');
  return jwt.sign(key);
};

describe('access tokens', () => {
  const tokens = new AccessTokens(SECRET);
  afterEach(() => vi.useRealTimers());

  it('signs a token that verifies back to the same user', async () => {
    const token = await tokens.sign(USER_ID, 'admin');
    await expect(tokens.verify(token)).resolves.toEqual({ userId: USER_ID });
  });

  it('expires after 15 minutes', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-12T10:00:00Z') });
    const token = await tokens.sign(USER_ID, 'admin');
    vi.setSystemTime(new Date(Date.now() + (ACCESS_TOKEN_TTL_SECONDS - 5) * 1000));
    await expect(tokens.verify(token)).resolves.toEqual({ userId: USER_ID });
    vi.setSystemTime(new Date(Date.now() + 10 * 1000));
    await expect(tokens.verify(token)).rejects.toBeInstanceOf(AccessTokenExpiredError);
  });

  it('rejects tokens signed with another secret or edited after signing', async () => {
    const other = await new AccessTokens('another-secret-another-secret-0002').sign(
      USER_ID,
      'admin',
    );
    await expect(tokens.verify(other)).rejects.toBeInstanceOf(AccessTokenInvalidError);

    const [header, payload, signature] = (await tokens.sign(USER_ID, 'sales_agent')).split('.');
    const edited = JSON.parse(Buffer.from(payload!, 'base64url').toString());
    edited.role = 'super_admin';
    const forged = [header, Buffer.from(JSON.stringify(edited)).toString('base64url'), signature];
    await expect(tokens.verify(forged.join('.'))).rejects.toBeInstanceOf(AccessTokenInvalidError);
  });

  it('rejects unsigned ("alg: none") tokens and garbage', async () => {
    const unsigned = new UnsecuredJWT({ role: 'super_admin' })
      .setSubject(USER_ID)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setExpirationTime('15m')
      .encode();
    await expect(tokens.verify(unsigned)).rejects.toBeInstanceOf(AccessTokenInvalidError);
    await expect(tokens.verify('not-a-token')).rejects.toBeInstanceOf(AccessTokenInvalidError);
  });

  it('checks the issuer, the audience and the subject', async () => {
    const wrongIssuer = await craft({ sub: USER_ID, iss: 'someone-else' });
    const wrongAudience = await craft({ sub: USER_ID, aud: 'public-website' });
    const noSubject = await craft({});
    for (const token of [wrongIssuer, wrongAudience, noSubject]) {
      await expect(tokens.verify(token)).rejects.toBeInstanceOf(AccessTokenInvalidError);
    }
    await expect(tokens.verify(await craft({ sub: USER_ID }))).resolves.toEqual({
      userId: USER_ID,
    });
  });
});

describe('refresh / email-link tokens', () => {
  it('are long, URL-safe and different every time', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).toMatch(/^[\w-]{43}$/); // 32 random bytes, base64url
    expect(a).not.toBe(b);
  });

  it('are stored as a SHA-256 hash, never as the token itself', () => {
    const token = randomToken();
    const hash = hashToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashToken(token)).toBe(hash); // same token → same hash (lookup works)
    expect(hashToken(randomToken())).not.toBe(hash);
  });
});
