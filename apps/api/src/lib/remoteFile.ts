import { lookup } from 'node:dns/promises';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';
import ipaddr from 'ipaddr.js';

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

/**
 * True for every address that must never be fetched. Only public unicast addresses are
 * allowed. `ipaddr.process` unwraps IPv4-mapped IPv6 in any notation (`::ffff:7f00:1`), and
 * NAT64, 6to4, Teredo, site-local, carrier-grade NAT and the rest are refused because their
 * range isn't `unicast` (H1).
 */
export function isPrivateAddress(ip: string): boolean {
  if (!ipaddr.isValid(ip)) return true;
  return ipaddr.process(ip).range() !== 'unicast';
}

export class RemoteFileError extends Error {}

type ResolveHost = (host: string) => Promise<string[]>;

const defaultResolveHost: ResolveHost = async (host) =>
  (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);

/** Resolves a host and refuses it unless every address is public. */
async function publicAddresses(host: string, resolveHost: ResolveHost): Promise<string[]> {
  const addresses = isIP(host) ? [host] : await resolveHost(host);
  if (addresses.length === 0) throw new RemoteFileError("the website can't be found");
  if (addresses.some(isPrivateAddress))
    throw new RemoteFileError('links to private networks are not allowed');
  return addresses;
}

/**
 * A `fetch` for https GETs whose connection goes to an address checked at connect time.
 * The socket's own DNS lookup runs the public-address check, so a host can't pass the check
 * with a public address and then connect to a private one (DNS rebinding, H1).
 */
export function pinnedFetch(resolveHost: ResolveHost = defaultResolveHost): typeof fetch {
  const pinnedLookup = ((hostname, options, callback) => {
    publicAddresses(hostname, resolveHost).then(
      (addresses) => {
        if (options.all) {
          callback(
            null,
            addresses.map((address) => ({ address, family: isIP(address) })),
          );
        } else {
          callback(null, addresses[0]!, isIP(addresses[0]!));
        }
      },
      (err: Error) => callback(err, '', 4),
    );
  }) as LookupFunction;

  return (input, init) =>
    new Promise<Response>((resolve, reject) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const req = https.request(
        url,
        {
          method: 'GET',
          lookup: pinnedLookup,
          signal: init?.signal ?? undefined,
          headers: { 'user-agent': 'RealEstateAdmin/1.0 (photo import)', accept: 'image/*' },
        },
        (res) => {
          const headers = new Headers();
          for (const [key, value] of Object.entries(res.headers)) {
            if (value === undefined) continue;
            for (const v of Array.isArray(value) ? value : [value]) headers.append(key, v);
          }
          const status = res.statusCode ?? 502;
          const noBody = status === 204 || status === 304 || (status >= 300 && status < 400);
          if (noBody) res.resume();
          resolve(
            new Response(noBody ? null : (Readable.toWeb(res) as ReadableStream<Uint8Array>), {
              status: status < 200 || status > 599 ? 502 : status,
              headers,
            }),
          );
        },
      );
      req.on('error', reject);
      req.end();
    });
}

/**
 * Downloads a file from a public https URL (for photo links in bulk import). Refuses
 * non-https links and hosts on private networks: checked before each request and again on
 * the connection itself (pinned lookup), and after every redirect. Stops after `maxBytes`
 * and gives up after 10 seconds.
 */
export async function downloadPublicFile(
  rawUrl: string,
  {
    maxBytes,
    resolveHost = defaultResolveHost,
    fetchImpl = pinnedFetch(resolveHost),
  }: {
    maxBytes: number;
    /** Host name → IP addresses (tests replace it). */
    resolveHost?: ResolveHost;
    /** Tests replace it; the default connects only to checked public addresses. */
    fetchImpl?: typeof fetch;
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
    await publicAddresses(url.hostname.replace(/^\[|\]$/g, ''), resolveHost);

    let res: Response;
    try {
      res = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      if (err instanceof RemoteFileError) throw err;
      const cause = (err as { cause?: unknown }).cause;
      if (cause instanceof RemoteFileError) throw cause;
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
