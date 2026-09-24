import 'server-only';

/**
 * Erros tipados do BFF: `{ error: { code, retryAfter? } }` (03-arquitetura, "Convenções do BFF").
 * Nunca há stack trace, mensagem do Spotify ou detalhe interno na resposta.
 */
export const API_ERROR_STATUS = {
  /** Sem sessão, sessão inválida ou `invalid_grant` (reconectar). */
  UNAUTHENTICATED: 401,
  /** Conta fora da allowlist do app em Development Mode (403 do Spotify). */
  NOT_ALLOWLISTED: 403,
  /** 429 comum do Spotify que passou do teto de espera; `retryAfter` em segundos. */
  RATE_LIMITED: 429,
  /** 429 com `reason: QUOTA_EXCEEDED`: terminal; o cliente pausa por `retryAfter` segundos. */
  QUOTA: 503,
  /** Falha do Spotify (5xx, timeout, rede, resposta fora do schema). */
  UPSTREAM: 502,
  /** Parâmetros inválidos. */
  BAD_REQUEST: 400,
  /** Recurso inexistente no Spotify (ex.: artista). */
  NOT_FOUND: 404,
  /** Modo Conectar desabilitado neste ambiente (sem credenciais). */
  CONNECT_DISABLED: 404,
  /** Requisição de outra origem (CSRF) no logout. */
  FORBIDDEN: 403,
  /** Erro inesperado no próprio BFF. */
  INTERNAL: 500,
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_STATUS;

export type ApiErrorBody = { error: { code: ApiErrorCode; retryAfter?: number } };

/** Pausa sugerida ao cliente quando a quota do app acaba (03: "pausa as queries por 15 min"). */
export const QUOTA_RETRY_AFTER_S = 15 * 60;

export type ApiErrorOptions = {
  retryAfter?: number | undefined;
  /** O cookie de sessão deve ser apagado (sessão irrecuperável). */
  clearSession?: boolean | undefined;
  upstreamStatus?: number | undefined;
  /** Motivo curto para o log (nunca vai ao cliente). */
  reason?: string | undefined;
};

export class ApiError extends Error {
  readonly status: number;
  readonly retryAfter: number | undefined;
  readonly clearSession: boolean;
  readonly upstreamStatus: number | undefined;
  readonly reason: string | undefined;

  constructor(
    readonly code: ApiErrorCode,
    options: ApiErrorOptions = {},
  ) {
    super(code);
    this.name = 'ApiError';
    this.status = API_ERROR_STATUS[code];
    this.retryAfter = options.retryAfter;
    this.clearSession = options.clearSession ?? false;
    this.upstreamStatus = options.upstreamStatus;
    this.reason = options.reason;
  }
}

export function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError('INTERNAL', { reason: 'unexpected' });
}

/** Cabeçalhos de toda resposta de erro do BFF: nada é cacheável. */
export const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } as const;

export function errorResponse(
  code: ApiErrorCode,
  options: { retryAfter?: number | undefined; headers?: HeadersInit } = {},
): Response {
  const body: ApiErrorBody = {
    error: options.retryAfter === undefined ? { code } : { code, retryAfter: options.retryAfter },
  };
  const headers = new Headers(options.headers);
  for (const [key, value] of Object.entries(NO_STORE_HEADERS)) headers.set(key, value);
  if (options.retryAfter !== undefined) headers.set('Retry-After', String(options.retryAfter));
  return Response.json(body, { status: API_ERROR_STATUS[code], headers });
}
