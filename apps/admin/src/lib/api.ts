import type { PageMeta, SessionResponse } from '@real-estate/shared';

/**
 * API client for the admin portal.
 * - The access token lives only in memory (never in localStorage).
 * - The refresh token is an httpOnly cookie the browser sends to /api/v1/auth/*.
 * - When the access token expires, the client refreshes once and retries the request.
 */

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: ApiErrorDetail[],
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

/** In development the Vite proxy forwards /api to the API, so the base URL is empty. */
const BASE_URL: string = import.meta.env.VITE_API_URL ?? '';
const API_PREFIX = '/api/v1';

let accessToken: string | null = null;
let sessionExpiredHandler: (() => void) | null = null;
let refreshInFlight: Promise<SessionResponse | null> | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
};

/** Called when the session can't be refreshed (e.g. idle too long); the app signs out. */
export function onSessionExpired(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send the access token and refresh it when expired. Default true. */
  auth?: boolean;
  /** Return the whole { data, meta } envelope instead of just `data` (list endpoints). */
  envelope?: boolean;
}

async function send(
  path: string,
  { method = 'GET', body, auth = true }: RequestOptions,
): Promise<Response> {
  const headers: Record<string, string> = { 'x-requested-with': 'XMLHttpRequest' };
  if (body !== undefined && !(body instanceof FormData))
    headers['content-type'] = 'application/json';
  if (auth && accessToken) headers.authorization = `Bearer ${accessToken}`;

  return fetch(`${BASE_URL}${API_PREFIX}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
}

async function parse<T>(res: Response, envelope = false): Promise<T> {
  if (res.status === 204) return undefined as T;
  const payload = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { code?: string; message?: string; details?: ApiErrorDetail[]; requestId?: string };
  } | null;
  if (!res.ok) {
    const error = payload?.error;
    throw new ApiError(
      res.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `Request failed (${res.status})`,
      error?.details,
      error?.requestId,
    );
  }
  return (envelope ? payload : payload?.data) as T;
}

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers share one
 * request. Returns null when there is no valid session.
 */
export function refreshSession(): Promise<SessionResponse | null> {
  refreshInFlight ??= (async () => {
    try {
      const session = await parse<SessionResponse>(
        await send('/auth/refresh', { method: 'POST', auth: false }),
      );
      accessToken = session.accessToken;
      return session;
    } catch {
      accessToken = null;
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const auth = options.auth ?? true;
  const res = await send(path, options);

  if (res.status === 401 && auth) {
    const session = await refreshSession();
    if (session) return parse<T>(await send(path, options), options.envelope);
    sessionExpiredHandler?.();
  }
  return parse<T>(res, options.envelope);
}

/**
 * Multipart upload that reports progress (0–1). Uses XMLHttpRequest because fetch can't
 * report upload progress. Like other requests, it refreshes an expired session once.
 */
export async function uploadWithProgress<T>(
  path: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
): Promise<T> {
  const attempt = () =>
    new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}${API_PREFIX}${path}`);
      xhr.withCredentials = true;
      xhr.setRequestHeader('x-requested-with', 'XMLHttpRequest');
      if (accessToken) xhr.setRequestHeader('authorization', `Bearer ${accessToken}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded / event.total);
      };
      xhr.onload = () =>
        resolve(
          new Response(xhr.status === 204 ? null : xhr.responseText, {
            status: xhr.status,
            headers: { 'content-type': 'application/json' },
          }),
        );
      xhr.onerror = () => reject(new TypeError('Network error'));
      xhr.send(form);
    });

  let res = await attempt();
  if (res.status === 401) {
    const session = await refreshSession();
    if (session) res = await attempt();
    else sessionExpiredHandler?.();
  }
  return parse<T>(res);
}

export interface ListResult<T> {
  items: T[];
  meta: PageMeta;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  /** List endpoints: returns the rows and the pagination meta. */
  list: async <T>(path: string): Promise<ListResult<T>> => {
    const { data, meta } = await apiRequest<{ data: T[]; meta: PageMeta }>(path, {
      envelope: true,
    });
    return { items: data, meta };
  },
  post: <T>(path: string, body?: unknown, opts: { auth?: boolean } = {}) =>
    apiRequest<T>(path, { method: 'POST', body, ...opts }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
