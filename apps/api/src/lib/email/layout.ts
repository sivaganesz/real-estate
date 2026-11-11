/** Escapes text for safe use inside HTML email templates. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

interface LayoutOptions {
  companyName: string;
  title: string;
  /** Already-escaped HTML for the body. */
  bodyHtml: string;
}

/** Simple, email-client-friendly wrapper used by every template. */
export function renderEmailLayout({ companyName, title, bodyHtml }: LayoutOptions): string {
  const company = escapeHtml(companyName);
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#1f1f1f">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dddddd;border-radius:8px">
      <tr><td style="padding:20px 24px;border-bottom:1px solid #eeeeee;font-weight:bold">${company}</td></tr>
      <tr><td style="padding:24px">
        <h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:16px 24px;border-top:1px solid #eeeeee;font-size:12px;color:#777777">This email was sent by ${company}.</td></tr>
    </table>
  </body>
</html>`;
}
