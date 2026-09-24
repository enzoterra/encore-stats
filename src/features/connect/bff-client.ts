import { z } from 'zod';

import {
  artistSchema,
  meSchema,
  recentResponseSchema,
  savedPageSchema,
  topArtistsResponseSchema,
  topTracksResponseSchema,
  type Artist,
  type Me,
  type Recent,
  type SavedPage,
  type TimeRange,
  type Track,
} from '@/domain/spotify-types';

/**
 * Códigos de erro do BFF (docs/api.md) mais dois do próprio cliente:
 * `NETWORK` (sem resposta) e `INVALID_RESPONSE` (corpo fora do schema).
 */
export type BffErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_ALLOWLISTED'
  | 'RATE_LIMITED'
  | 'QUOTA'
  | 'UPSTREAM'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'CONNECT_DISABLED'
  | 'FORBIDDEN'
  | 'INTERNAL'
  | 'NETWORK'
  | 'INVALID_RESPONSE';

const KNOWN_CODES = new Set<BffErrorCode>([
  'UNAUTHENTICATED',
  'NOT_ALLOWLISTED',
  'RATE_LIMITED',
  'QUOTA',
  'UPSTREAM',
  'BAD_REQUEST',
  'NOT_FOUND',
  'CONNECT_DISABLED',
  'FORBIDDEN',
  'INTERNAL',
]);

/** Pausa padrão quando o BFF não informa `retryAfter` (`QUOTA` = 15 min, 03-arquitetura). */
export const QUOTA_PAUSE_SECONDS = 900;
const DEFAULT_RATE_LIMIT_SECONDS = 5;
/** Teto de espera aceito vindo da resposta (evita pausa absurda por resposta adulterada). */
const MAX_RETRY_AFTER_SECONDS = 3600;

export class BffError extends Error {
  constructor(
    public readonly code: BffErrorCode,
    public readonly status: number,
    /** Segundos até tentar de novo (`RATE_LIMITED`/`QUOTA`). */
    public readonly retryAfter?: number,
  ) {
    super(code);
    this.name = 'BffError';
  }
}

export function isBffError(error: unknown): error is BffError {
  return error instanceof BffError;
}

const errorBodySchema = z.object({
  error: z.object({ code: z.string(), retryAfter: z.number().optional() }),
});

function fallbackCode(status: number): BffErrorCode {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'NOT_ALLOWLISTED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'QUOTA';
  if (status === 400) return 'BAD_REQUEST';
  if (status === 404) return 'NOT_FOUND';
  if (status >= 500) return 'UPSTREAM';
  return 'INTERNAL';
}

function clampSeconds(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(MAX_RETRY_AFTER_SECONDS, Math.ceil(value));
}

async function toError(response: Response): Promise<BffError> {
  let code = fallbackCode(response.status);
  let retryAfter: number | undefined;
  try {
    const parsed = errorBodySchema.safeParse(await response.json());
    if (parsed.success) {
      if (KNOWN_CODES.has(parsed.data.error.code as BffErrorCode)) {
        code = parsed.data.error.code as BffErrorCode;
      }
      retryAfter = parsed.data.error.retryAfter;
    }
  } catch {
    /* corpo vazio ou não-JSON: fica o código pelo status */
  }
  const header = Number(response.headers.get('Retry-After'));
  if (retryAfter === undefined && Number.isFinite(header) && header > 0) retryAfter = header;
  if (code === 'QUOTA') retryAfter = clampSeconds(retryAfter, QUOTA_PAUSE_SECONDS);
  if (code === 'RATE_LIMITED') retryAfter = clampSeconds(retryAfter, DEFAULT_RATE_LIMIT_SECONDS);
  return new BffError(code, response.status, retryAfter);
}

export type FetchOptions = {
  signal?: AbortSignal;
  /**
   * Ignora o cache HTTP do navegador (`cache: 'no-cache'`). Usado na varredura de curtidas,
   * cujo cache de 12 h fica no próprio resultado agregado.
   */
  fresh?: boolean;
};

/**
 * GET same-origin no BFF. O cookie de sessão vai sozinho (`same-origin`); nenhum token passa
 * pelo JS. A resposta é validada de novo com o schema do domínio (OWASP API10).
 */
export async function getJson<T>(
  path: string,
  schema: z.ZodType<T>,
  { signal, fresh = false }: FetchOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      cache: fresh ? 'no-cache' : 'default',
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new BffError('NETWORK', 0);
  }
  if (!response.ok) throw await toError(response);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new BffError('INVALID_RESPONSE', response.status);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BffError('INVALID_RESPONSE', response.status);
  return parsed.data;
}

/**
 * Fonte de dados do modo Conectar. A mesma UI roda contra o BFF (`live`) ou contra as respostas
 * fictícias do Demo (`demo`), sem rede.
 */
export type ConnectSource = {
  kind: 'live' | 'demo';
  me: (options?: FetchOptions) => Promise<Me>;
  topArtists: (range: TimeRange, options?: FetchOptions) => Promise<Artist[]>;
  topTracks: (range: TimeRange, options?: FetchOptions) => Promise<Track[]>;
  recent: (options?: FetchOptions) => Promise<Recent[]>;
  saved: (offset: number, limit: 1 | 50, options?: FetchOptions) => Promise<SavedPage>;
  artist: (id: string, options?: FetchOptions) => Promise<Artist>;
};

export const liveSource: ConnectSource = {
  kind: 'live',
  me: (options) => getJson('/api/spotify/me', meSchema, options),
  topArtists: async (range, options) =>
    (
      await getJson(
        `/api/spotify/top?type=artists&range=${range}`,
        topArtistsResponseSchema,
        options,
      )
    ).items,
  topTracks: async (range, options) =>
    (await getJson(`/api/spotify/top?type=tracks&range=${range}`, topTracksResponseSchema, options))
      .items,
  recent: async (options) =>
    (await getJson('/api/spotify/recent', recentResponseSchema, options)).items,
  saved: (offset, limit, options) =>
    getJson(`/api/spotify/saved?offset=${offset}&limit=${limit}`, savedPageSchema, options),
  artist: (id, options) =>
    getJson(`/api/spotify/artist/${encodeURIComponent(id)}`, artistSchema, options),
};
