import { describe, expect, it } from 'vitest';
import { TEST_ENV_VARS } from '../test/helpers';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('accepts a valid configuration and applies defaults', () => {
    const env = parseEnv({ ...TEST_ENV_VARS });
    expect(env.PORT).toBe(4000);
    expect(env.UPLOAD_DIR).toBe('./uploads');
    expect(env.EMAIL_PROVIDER).toBe('console');
  });

  it('lists every missing or invalid variable', () => {
    let message = '';
    try {
      parseEnv({
        ...TEST_ENV_VARS,
        JWT_ACCESS_SECRET: 'short',
        ADMIN_ORIGIN: 'not-a-url',
        MONGODB_URI: '',
      });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain('Invalid environment configuration');
    expect(message).toContain('MONGODB_URI is required');
    expect(message).toContain('JWT_ACCESS_SECRET must be at least 32 characters');
    expect(message).toContain('ADMIN_ORIGIN must be a URL');
  });

  it('requires RESEND_API_KEY when the resend provider is selected', () => {
    expect(() => parseEnv({ ...TEST_ENV_VARS, EMAIL_PROVIDER: 'resend' })).toThrowError(
      /RESEND_API_KEY/,
    );
    expect(
      parseEnv({ ...TEST_ENV_VARS, EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_123' })
        .RESEND_API_KEY,
    ).toBe('re_123');
  });
});
