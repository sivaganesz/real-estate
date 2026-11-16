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
    const text = message.text ?? message.html;
    // Links on their own: inside the logged text a link is followed by an escaped "\n", which
    // a terminal Ctrl+click carries into the URL and breaks the token.
    const links = [...new Set(text.match(/https?:\/\/[^\s"<>\\]+/g) ?? [])];
    this.logger.info(
      { emailId: id, to: message.to, subject: message.subject, links, text },
      'Email (console provider, not sent)',
    );
    return { id };
  }
}
