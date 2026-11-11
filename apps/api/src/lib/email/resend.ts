import { Resend } from 'resend';
import type { EmailMessage, EmailProvider } from './types';
import { EmailSendError } from './types';

/** Sends real emails through Resend (https://resend.com). */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly client: Resend;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.client = new Resend(apiKey);
    this.from = from;
  }

  async send(message: EmailMessage): Promise<{ id?: string }> {
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      ...(message.text && { text: message.text }),
      ...(message.replyTo && { replyTo: message.replyTo }),
    });
    if (error) throw new EmailSendError(error.message);
    return { id: data?.id };
  }
}
