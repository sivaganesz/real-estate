import { randomUUID } from 'node:crypto';
import type { Logger } from '../logger';
import type { EmailMessage, EmailProvider } from './types';

/** Local development: prints emails to the log instead of sending them. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async send(message: EmailMessage): Promise<{ id?: string }> {
    const id = `console_${randomUUID()}`;
    this.logger.info(
      { emailId: id, to: message.to, subject: message.subject, text: message.text ?? message.html },
      'Email (console provider, not sent)',
    );
    return { id };
  }
}
