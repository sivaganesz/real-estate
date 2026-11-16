/**
 * The token from an emailed link (`?token=…`). Tokens are base64url, so only those
 * characters are kept: anything a terminal, email app or copy-paste glued onto the end
 * (a quote, a full stop, an escaped "\n") is dropped instead of making a valid link fail.
 */
export function linkToken(params: URLSearchParams): string {
  return /^[A-Za-z0-9_-]+/.exec(params.get('token') ?? '')?.[0] ?? '';
}
