export interface ApiMeta {
  readonly page?: number;
  readonly limit?: number;
  readonly total?: number;
  readonly totalPages?: number;
}

export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details: readonly { field: string; issue: string }[];
  };
}

export function ok<T>(data: T, meta?: ApiMeta): { data: T; meta?: ApiMeta } {
  return meta ? { data, meta } : { data };
}

export function errorBody(
  code: string,
  message: string,
  details: readonly { field: string; issue: string }[] = [],
): ApiErrorBody {
  return { error: { code, message, details } };
}
