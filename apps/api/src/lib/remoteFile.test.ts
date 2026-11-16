import { describe, expect, it, vi } from 'vitest';
import { downloadPublicFile, isPrivateAddress, RemoteFileError } from './remoteFile';

const publicHost = async () => ['93.184.216.34'];

describe('downloadPublicFile', () => {
  it('knows private and special addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.5',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:10.0.0.1',
      // Bypasses of the v1 check (H1): mapped IPv4 in hex, NAT64, 6to4, Teredo, site-local
      '::ffff:7f00:1',
      '::ffff:a9fe:a9fe',
      '64:ff9b::a00:1',
      '2002:7f00:1::',
      '2001::1',
      'fec0::1',
      '198.18.0.1',
      '255.255.255.255',
      'not-an-ip',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700::1111', '::ffff:8.8.8.8'])
      expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it('checks the address again on the connection itself (DNS rebinding)', async () => {
    // The first lookup (the pre-check) answers a public address, the second (the socket's
    // own lookup) a private one: the pinned fetch must refuse to connect.
    const answers = [['93.184.216.34'], ['127.0.0.1']];
    const resolveHost = vi.fn(async () => answers.shift() ?? ['127.0.0.1']);
    await expect(
      downloadPublicFile('https://rebind.example.com/a.jpg', { maxBytes: 100, resolveHost }),
    ).rejects.toThrow('private networks');
    expect(resolveHost).toHaveBeenCalledTimes(2);
  });

  it('refuses IPv6 literals that wrap private IPv4 addresses', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      downloadPublicFile('https://[::ffff:7f00:1]/a.jpg', { maxBytes: 5, fetchImpl }),
    ).rejects.toThrow('private networks');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('downloads a public https file', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(Buffer.from('jpeg-bytes')));
    const file = await downloadPublicFile('https://cdn.example.com/photos/Front%20view.jpg', {
      maxBytes: 100,
      fetchImpl,
      resolveHost: publicHost,
    });
    expect(file).toEqual({ data: Buffer.from('jpeg-bytes'), fileName: 'Front view.jpg' });
    expect(fetchImpl.mock.calls[0]![1]).toMatchObject({ redirect: 'manual' });
  });

  it('refuses http, private hosts (also after a redirect) and large files', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const get = (url: string, opts: Partial<Parameters<typeof downloadPublicFile>[1]> = {}) =>
      downloadPublicFile(url, { maxBytes: 5, fetchImpl, resolveHost: publicHost, ...opts });

    await expect(get('http://cdn.example.com/a.jpg')).rejects.toThrow(
      'only https links are allowed',
    );
    await expect(get('https://127.0.0.1/a.jpg')).rejects.toThrow('private networks');
    await expect(
      get('https://intranet.local/a.jpg', { resolveHost: async () => ['10.0.0.8'] }),
    ).rejects.toThrow('private networks');

    fetchImpl.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'https://169.254.169.254/latest' } }),
    );
    await expect(get('https://cdn.example.com/a.jpg')).rejects.toThrow('private networks');

    fetchImpl.mockResolvedValueOnce(new Response(Buffer.alloc(50)));
    await expect(get('https://cdn.example.com/big.jpg')).rejects.toThrow('the file is too large');

    fetchImpl.mockResolvedValueOnce(new Response('nope', { status: 404 }));
    await expect(get('https://cdn.example.com/gone.jpg')).rejects.toBeInstanceOf(RemoteFileError);
  });
});
