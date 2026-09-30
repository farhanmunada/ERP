const ACCESS_TOKEN_KEY = 'erp.accessToken';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
  else localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details: readonly { field: string; issue: string }[];
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: readonly { field: string; issue: string }[] = [],
  ) {
    super(message);
  }
}

interface RequestOptions {
  readonly method?: string;
  readonly body?: unknown;
  readonly idempotencyKey?: string;
  readonly companyId?: string;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  if (options.companyId) headers['X-Company-Id'] = options.companyId;

  const response = await fetch(`/api/v1${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = payload?.error ?? { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan', details: [] };
    throw new ApiClientError(response.status, err.code, err.message, err.details ?? []);
  }

  return (payload?.data ?? payload) as T;
}
