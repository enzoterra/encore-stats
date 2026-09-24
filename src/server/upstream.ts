import 'server-only';

import { ApiError, QUOTA_RETRY_AFTER_S } from './api-errors';

/**
 * HTTP com o Spotify: timeout de 10 s por tentativa, corpo limitado e retry só em 429/5xx
 * (RNF-05, 03-arquitetura "Integração Spotify").
 *
 * - 429 com `reason: QUOTA_EXCEEDED` → `QUOTA`, terminal, sem retry.
 * - 429 comum → espera `Retry-After` + jitter (sem o cabeçalho, 1 s e depois 2 s), até 2 novas
 *   tentativas e no máximo 30 s de espera somada; se passar do teto, `RATE_LIMITED` com
 *   `retryAfter` para o cliente.
 * - 5xx → 1 nova tentativa (dentro do mesmo limite de 2). Timeout e erro de rede não repetem.
 */

export const UPSTREAM_TIMEOUT_MS = 10_000;
export const MAX_RETRIES = 2;
export const MAX_TOTAL_WAIT_MS = 30_000;
const DEFAULT_BACKOFF_S = 1;
const MAX_JITTER_MS = 500;
const SERVER_ERROR_BACKOFF_MS = 300;
/** As respostas usadas têm dezenas de kB; 2 MiB é folga ampla contra uma resposta anômala. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

export type UpstreamResponse = { status: number; headers: Headers; body: unknown };

/** Dependências trocáveis nos testes (tempo e aleatoriedade). */
export const upstreamDeps = {
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  random: () => Math.random(),
};

/** Uma requisição com timeout que cobre também a leitura do corpo. Corpo não-JSON vira `undefined`. */
export async function upstreamFetch(url: URL, init: RequestInit): Promise<UpstreamResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: 'error',
      cache: 'no-store',
    });
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > MAX_BODY_BYTES) throw new ApiError('UPSTREAM', { reason: 'body_too_large' });
    const text = await response.text();
    if (text.length > MAX_BODY_BYTES) throw new ApiError('UPSTREAM', { reason: 'body_too_large' });
    return { status: response.status, headers: response.headers, body: parseJson(text) };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('UPSTREAM', { reason: controller.signal.aborted ? 'timeout' : 'network' });
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text: string): unknown {
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** `Retry-After` em segundos (inteiro ou data HTTP); `undefined` se ausente ou inválido. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  // Data HTTP (ex.: "Thu, 24 Sep 2026 12:00:05 GMT"); `Date.parse` aceitaria até "-3".
  if (!/^[A-Za-z]{3}, /.test(trimmed)) return undefined;
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - now) / 1000));
}

/** O Spotify sinaliza fim de quota no corpo do 429 (`error.reason` ou `reason`). */
export function isQuotaExceeded(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const record = body as { reason?: unknown; error?: unknown };
  if (record.reason === 'QUOTA_EXCEEDED') return true;
  const nested = record.error;
  return (
    typeof nested === 'object' &&
    nested !== null &&
    (nested as { reason?: unknown }).reason === 'QUOTA_EXCEEDED'
  );
}

/** Executa `attempt` aplicando a política de retry acima. */
export async function withRetry(
  attempt: () => Promise<UpstreamResponse>,
): Promise<UpstreamResponse> {
  let retries = 0;
  let waitedMs = 0;
  let retriedServerError = false;

  for (;;) {
    const response = await attempt();

    if (response.status === 429) {
      if (isQuotaExceeded(response.body)) {
        throw new ApiError('QUOTA', {
          retryAfter: QUOTA_RETRY_AFTER_S,
          upstreamStatus: 429,
          reason: 'quota_exceeded',
        });
      }
      const retryAfterS =
        parseRetryAfter(response.headers.get('retry-after')) ?? DEFAULT_BACKOFF_S * 2 ** retries;
      const waitMs = retryAfterS * 1000 + Math.floor(upstreamDeps.random() * MAX_JITTER_MS);
      if (retries >= MAX_RETRIES || waitedMs + waitMs > MAX_TOTAL_WAIT_MS) {
        throw new ApiError('RATE_LIMITED', {
          retryAfter: Math.max(1, Math.ceil(retryAfterS)),
          upstreamStatus: 429,
          reason: 'rate_limited',
        });
      }
      await upstreamDeps.sleep(waitMs);
      waitedMs += waitMs;
      retries += 1;
      continue;
    }

    if (response.status >= 500) {
      if (retriedServerError || retries >= MAX_RETRIES) {
        throw new ApiError('UPSTREAM', { upstreamStatus: response.status, reason: 'server_error' });
      }
      retriedServerError = true;
      retries += 1;
      await upstreamDeps.sleep(
        SERVER_ERROR_BACKOFF_MS + Math.floor(upstreamDeps.random() * MAX_JITTER_MS),
      );
      continue;
    }

    return response;
  }
}
