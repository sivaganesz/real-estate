/**
 * Email module interface (TRD §12). Business code sends emails through this interface;
 * the provider (Resend, console, …) is chosen by EMAIL_PROVIDER.
 */
export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ id?: string }>;
}

export class EmailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailSendError';
  }
}
