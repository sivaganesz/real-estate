import { describe, expect, it } from 'vitest';
import { createLogger } from '../logger';
import {
  ConsoleEmailProvider,
  createEmailProvider,
  escapeHtml,
  renderEmailLayout,
  ResendEmailProvider,
  trySendEmail,
} from './index';
import type { EmailProvider } from './types';

const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'info' });
const message = { to: 'a@b.com', subject: 'Hello', html: '<p>Hi</p>' };

describe('createEmailProvider', () => {
  it('returns the console provider by default', () => {
    const provider = createEmailProvider(
      { EMAIL_PROVIDER: 'console', EMAIL_FROM: 'x <x@y.com>', RESEND_API_KEY: undefined },
      logger,
    );
    expect(provider).toBeInstanceOf(ConsoleEmailProvider);
  });

  it('returns the Resend provider when configured', () => {
    const provider = createEmailProvider(
      { EMAIL_PROVIDER: 'resend', EMAIL_FROM: 'x <x@y.com>', RESEND_API_KEY: 're_test' },
      logger,
    );
    expect(provider).toBeInstanceOf(ResendEmailProvider);
  });
});

describe('ConsoleEmailProvider', () => {
  it('logs each link on its own, ending exactly at the token (no escaped newline after it)', async () => {
    const logged: Record<string, unknown>[] = [];
    const capture = { info: (obj: Record<string, unknown>) => logged.push(obj) };
    const provider = new ConsoleEmailProvider(capture as unknown as typeof logger);
    await provider.send({
      to: 'a@b.com',
      subject: 'Reset your password',
      html: '<p>Hi</p>',
      text: "Open this link:\nhttp://localhost:5173/reset-password?token=AbC_12-x\n\nIf you didn't ask, ignore it.",
    });
    expect(logged[0]!.links).toEqual(['http://localhost:5173/reset-password?token=AbC_12-x']);
  });
});

describe('trySendEmail', () => {
  it('reports success', async () => {
    const result = await trySendEmail(new ConsoleEmailProvider(logger), message, logger);
    expect(result.sent).toBe(true);
    expect(result.id).toMatch(/^console_/);
  });

  it('reports failures without throwing', async () => {
    const failing: EmailProvider = {
      name: 'failing',
      send: async () => {
        throw new Error('provider down');
      },
    };
    const result = await trySendEmail(failing, message, logger);
    expect(result).toEqual({ sent: false, error: 'provider down' });
  });
});

describe('email layout', () => {
  it('escapes HTML', () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe(
      '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;',
    );
  });

  it('wraps the body with the company name and title', () => {
    const html = renderEmailLayout({
      companyName: 'Acme <Realty>',
      title: 'Welcome',
      bodyHtml: '<p>Hi</p>',
    });
    expect(html).toContain('Acme &lt;Realty&gt;');
    expect(html).toContain('<h1');
    expect(html).toContain('<p>Hi</p>');
  });
});
