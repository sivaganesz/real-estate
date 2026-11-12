import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

/** True for addresses that must never be fetched: loopback, private, link-local, etc. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast and reserved
    );
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === '::' || s === '::1') return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s);
  }
  return true;
}

export class RemoteFileError extends Error {}

/**
 * Downloads a file from a public https URL (for photo links in bulk import). Refuses
 * non-https links and hosts on private networks (checked again after every redirect),
 * stops after `maxBytes`, and gives up after 10 seconds.
 */
export async function downloadPublicFile(
  rawUrl: string,
  {
    maxBytes,
    fetchImpl = fetch,
    resolveHost = async (host: string) =>
      (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address),
  }: {
    maxBytes: number;
    fetchImpl?: typeof fetch;
    /** Host name → IP addresses (tests replace it). */
    resolveHost?: (host: string) => Promise<string[]>;
  },
): Promise<{ data: Buffer; fileName: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new RemoteFileError('not a valid link');
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== 'https:') throw new RemoteFileError('only https links are allowed');
    if (url.username || url.password)
      throw new RemoteFileError('links with passwords are not allowed');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = isIP(host) ? [host] : await resolveHost(host);
    if (addresses.length === 0) throw new RemoteFileError("the website can't be found");
    if (addresses.some(isPrivateAddress))
      throw new RemoteFileError('links to private networks are not allowed');

    let res: Response;
    try {
      res = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new RemoteFileError("the link didn't answer");
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location');
      if (!next) throw new RemoteFileError('the link redirects nowhere');
      url = new URL(next, url);
      continue;
    }
    if (!res.ok || !res.body) throw new RemoteFileError(`the link answered ${res.status}`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > maxBytes) throw new RemoteFileError('the file is too large');

    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RemoteFileError('the file is too large');
      }
      chunks.push(value);
    }
    const name = decodeURIComponent(url.pathname.split('/').pop() || 'photo').slice(0, 120);
    return { data: Buffer.concat(chunks), fileName: name };
  }
  throw new RemoteFileError('too many redirects');
}
