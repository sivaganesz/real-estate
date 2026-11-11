import type { Env } from '../../config/env';
import type { Logger } from '../logger';
import { ConsoleEmailProvider } from './console';
import { ResendEmailProvider } from './resend';
import type { EmailMessage, EmailProvider } from './types';

export * from './types';
export * from './layout';
export { ConsoleEmailProvider } from './console';
export { ResendEmailProvider } from './resend';

/** Picks the provider from EMAIL_PROVIDER. Adding a provider = one new class + one case. */
export function createEmailProvider(
  env: Pick<Env, 'EMAIL_PROVIDER' | 'RESEND_API_KEY' | 'EMAIL_FROM'>,
  logger: Logger,
): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case 'resend':
      if (!env.RESEND_API_KEY)
        throw new Error('RESEND_API_KEY is required for the resend provider');
      return new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
    case 'console':
      return new ConsoleEmailProvider(logger);
  }
}

/**
 * Sends an email without throwing. Failures are logged and reported back so the caller
 * can tell the admin (e.g. "invite email could not be sent, resend?"). No background retries.
 */
export async function trySendEmail(
  provider: EmailProvider,
  message: EmailMessage,
  logger: Logger,
): Promise<{ sent: boolean; id?: string; error?: string }> {
  try {
    const { id } = await provider.send(message);
    return { sent: true, id };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ err, provider: provider.name, subject: message.subject }, 'Email send failed');
    return { sent: false, error };
  }
}
