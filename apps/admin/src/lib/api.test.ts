import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, onSessionExpired, refreshSession, tokenStore } from './api';

const session = {
  accessToken: 'new-token',
  expiresIn: 900,
  user: { id: 'u1', name: 'A', email: 'a@x.com', phone: null, role: 'admin', permissions: [] },
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('api client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokenStore.set('old-token');
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    onSessionExpired(null);
  });

  it('sends the access token, the CSRF header and cookies', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { data: { ok: true } }));
    await expect(api.get('/auth/me')).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/auth/me');
    expect(init?.credentials).toBe('include');
    expect(init?.headers).toMatchObject({
      authorization: 'Bearer old-token',
      'x-requested-with': 'XMLHttpRequest',
    });
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: 'TOKEN_EXPIRED', message: 'expired' } }))
      .mockResolvedValueOnce(json(200, { data: session }))
      .mockResolvedValueOnce(json(200, { data: { ok: true } }));

    await expect(api.get('/users')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/v1/auth/refresh');
    expect(fetchMock.mock.calls[2]![1]?.headers).toMatchObject({
      authorization: 'Bearer new-token',
    });
    expect(tokenStore.get()).toBe('new-token');
  });

  it('signs out when the refresh fails', async () => {
    const expired = vi.fn();
    onSessionExpired(expired);
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: 'TOKEN_EXPIRED', message: 'expired' } }))
      .mockResolvedValueOnce(
        json(401, { error: { code: 'UNAUTHENTICATED', message: 'no session' } }),
      );

    await expect(api.get('/users')).rejects.toBeInstanceOf(ApiError);
    expect(expired).toHaveBeenCalledOnce();
    expect(tokenStore.get()).toBeNull();
  });

  it('shares one refresh request between concurrent callers', async () => {
    fetchMock.mockResolvedValue(json(200, { data: session }));
    const [a, b] = await Promise.all([refreshSession(), refreshSession()]);
    expect(a).toEqual(session);
    expect(b).toEqual(session);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('turns API errors into ApiError with code, message and details', async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Some fields are invalid',
          details: [{ path: 'body.email', message: 'Enter a valid email address' }],
          requestId: 'req_1',
        },
      }),
    );
    const error = await api.post('/auth/login', {}, { auth: false }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', requestId: 'req_1' });
    expect((error as ApiError).details).toHaveLength(1);
  });
});
