import { escapeHtml, renderEmailLayout } from './layout';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function button(url: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#2b2b2b;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></p>
<p style="font-size:12px;color:#777777">If the button doesn't work, copy this link into your browser:<br>${escapeHtml(url)}</p>`;
}

export function passwordResetEmail(input: {
  companyName: string;
  name: string;
  resetUrl: string;
  expiresMinutes: number;
}): RenderedEmail {
  const subject = `Reset your password | ${input.companyName}`;
  const html = renderEmailLayout({
    companyName: input.companyName,
    title: 'Reset your password',
    bodyHtml: `<p>Hi ${escapeHtml(input.name)},</p>
<p>We received a request to reset your password. This link expires in ${input.expiresMinutes} minutes and can be used once.</p>
${button(input.resetUrl, 'Set a new password')}
<p>If you didn't ask for this, you can ignore this email. Your password won't change.</p>`,
  });
  const text = `Hi ${input.name},

We received a request to reset your password. Open this link to set a new one (expires in ${input.expiresMinutes} minutes, single use):
${input.resetUrl}

If you didn't ask for this, you can ignore this email.`;
  return { subject, html, text };
}

export function inviteEmail(input: {
  companyName: string;
  name: string;
  invitedBy: string | null;
  roleLabel: string;
  acceptUrl: string;
  expiresHours: number;
}): RenderedEmail {
  const subject = `You're invited to the admin portal | ${input.companyName}`;
  const who = input.invitedBy ? `${input.invitedBy} has invited you` : "You've been invited";
  const html = renderEmailLayout({
    companyName: input.companyName,
    title: "You're invited",
    bodyHtml: `<p>Hi ${escapeHtml(input.name)},</p>
<p>${escapeHtml(who)} to the ${escapeHtml(input.companyName)} admin portal as <strong>${escapeHtml(input.roleLabel)}</strong>.</p>
<p>Set your password to activate your account. This link expires in ${input.expiresHours} hours.</p>
${button(input.acceptUrl, 'Set password and sign in')}`,
  });
  const text = `Hi ${input.name},

${who} to the ${input.companyName} admin portal as ${input.roleLabel}.
Set your password to activate your account (link expires in ${input.expiresHours} hours):
${input.acceptUrl}`;
  return { subject, html, text };
}

export function passwordChangedEmail(input: { companyName: string; name: string }): RenderedEmail {
  const subject = `Your password was changed | ${input.companyName}`;
  const html = renderEmailLayout({
    companyName: input.companyName,
    title: 'Your password was changed',
    bodyHtml: `<p>Hi ${escapeHtml(input.name)},</p>
<p>Your password was just changed and you've been signed out on all devices.</p>
<p>If this wasn't you, contact your administrator right away.</p>`,
  });
  const text = `Hi ${input.name},

Your password was just changed and you've been signed out on all devices.
If this wasn't you, contact your administrator right away.`;
  return { subject, html, text };
}
