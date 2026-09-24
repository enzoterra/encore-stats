import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hang, installSpotifyMock, json, stubRetryTiming } from '../../tests/mocks/spotify';

import { ApiError } from './api-errors';
import {
  isQuotaExceeded,
  parseRetryAfter,
  UPSTREAM_TIMEOUT_MS,
  upstreamDeps,
  upstreamFetch,
  withRetry,
} from './upstream';

const URL_ME = new URL('https://api.spotify.com/v1/me');
let timing: ReturnType<typeof stubRetryTiming>;

beforeEach(() => {
  timing = stubRetryTiming();
});

afterEach(() => {
  timing.restore();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('esperava um ApiError');
}

describe('parseRetryAfter', () => {
  it('lê segundos e datas HTTP', () => {
    expect(parseRetryAfter('7')).toBe(7);
    expect(parseRetryAfter(' 0 ')).toBe(0);
    const now = Date.parse('2026-09-24T12:00:00Z');
    expect(parseRetryAfter('Thu, 24 Sep 2026 12:00:05 GMT', now)).toBe(5);
    expect(parseRetryAfter('Thu, 24 Sep 2026 11:00:00 GMT', now)).toBe(0);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('depois')).toBeUndefined();
    expect(parseRetryAfter('-3')).toBeUndefined();
  });
});

describe('isQuotaExceeded', () => {
  it('reconhece reason no topo ou dentro de error', () => {
    expect(isQuotaExceeded({ error: { status: 429, reason: 'QUOTA_EXCEEDED' } })).toBe(true);
    expect(isQuotaExceeded({ reason: 'QUOTA_EXCEEDED' })).toBe(true);
    expect(isQuotaExceeded({ error: { status: 429, message: 'API rate limit exceeded' } })).toBe(
      false,
    );
    expect(isQuotaExceeded({ error: 'x' })).toBe(false);
    expect(isQuotaExceeded(undefined)).toBe(false);
  });
});

describe('upstreamFetch', () => {
  it('aborta em 10 s e responde UPSTREAM/timeout', async () => {
    vi.useFakeTimers();
    const mock = installSpotifyMock();
    mock.api('/me', hang);
    const pending = caught(upstreamFetch(URL_ME, { method: 'GET' }));
    await vi.advanceTimersByTimeAsync(UPSTREAM_TIMEOUT_MS);
    await expect(pending).resolves.toMatchObject({ code: 'UPSTREAM', reason: 'timeout' });
  });

  it('erro de rede vira UPSTREAM/network', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('fetch failed'))),
    );
    await expect(caught(upstreamFetch(URL_ME, {}))).resolves.toMatchObject({
      code: 'UPSTREAM',
      reason: 'network',
    });
  });

  it('recusa corpo grande demais e tolera corpo não-JSON', async () => {
    const mock = installSpotifyMock();
    mock.api(
      '/me',
      new Response('x', { headers: { 'content-length': String(3 * 1024 * 1024) } }),
      new Response('x'.repeat(2 * 1024 * 1024 + 1)),
      new Response('<html>'),
    );
    await expect(caught(upstreamFetch(URL_ME, {}))).resolves.toMatchObject({
      reason: 'body_too_large',
    });
    await expect(caught(upstreamFetch(URL_ME, {}))).resolves.toMatchObject({
      reason: 'body_too_large',
    });
    await expect(upstreamFetch(URL_ME, {})).resolves.toMatchObject({
      status: 200,
      body: undefined,
    });
  });

  it('não segue redirecionamentos nem usa cache', async () => {
    const mock = installSpotifyMock();
    mock.api('/me', json({}));
    await upstreamFetch(URL_ME, {});
    expect(mock.fetchMock.mock.calls[0]?.[1]).toMatchObject({
      redirect: 'error',
      cache: 'no-store',
    });
  });
});

describe('withRetry', () => {
  const run = (...replies: Response[]) => {
    const mock = installSpotifyMock();
    mock.api('/me', ...replies);
    return { mock, result: withRetry(() => upstreamFetch(URL_ME, {})) };
  };

  it('429 com Retry-After: espera e tenta de novo', async () => {
    const { mock, result } = run(json({}, 429, { 'Retry-After': '3' }), json({ ok: 1 }));
    await expect(result).resolves.toMatchObject({ status: 200, body: { ok: 1 } });
    expect(timing.sleep).toHaveBeenCalledWith(3000);
    expect(mock.calls).toHaveLength(2);
  });

  it('429 sem Retry-After: 1 s, depois 2 s, e repassa na terceira', async () => {
    const { mock, result } = run(json({}, 429));
    await expect(caught(result)).resolves.toMatchObject({ code: 'RATE_LIMITED', retryAfter: 4 });
    expect(timing.sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000]);
    expect(mock.calls).toHaveLength(3);
  });

  it('Retry-After acima do teto de 30 s: repassa 429 sem esperar', async () => {
    const { mock, result } = run(json({}, 429, { 'Retry-After': '31' }));
    await expect(caught(result)).resolves.toMatchObject({ code: 'RATE_LIMITED', retryAfter: 31 });
    expect(timing.sleep).not.toHaveBeenCalled();
    expect(mock.calls).toHaveLength(1);
  });

  it('a espera somada não passa de 30 s', async () => {
    const { mock, result } = run(json({}, 429, { 'Retry-After': '20' }));
    await expect(caught(result)).resolves.toMatchObject({ code: 'RATE_LIMITED', retryAfter: 20 });
    expect(timing.sleep).toHaveBeenCalledTimes(1);
    expect(mock.calls).toHaveLength(2);
  });

  it('aplica jitter sobre o Retry-After', async () => {
    upstreamDeps.random = () => 0.5;
    const { result } = run(json({}, 429, { 'Retry-After': '1' }), json({}));
    await result;
    expect(timing.sleep).toHaveBeenCalledWith(1250);
  });

  it('QUOTA_EXCEEDED é terminal: 503 QUOTA sem retry', async () => {
    const { mock, result } = run(
      json({ error: { status: 429, message: 'quota', reason: 'QUOTA_EXCEEDED' } }, 429, {
        'Retry-After': '1',
      }),
    );
    await expect(caught(result)).resolves.toMatchObject({
      code: 'QUOTA',
      status: 503,
      retryAfter: 900,
    });
    expect(mock.calls).toHaveLength(1);
  });

  it('5xx: uma nova tentativa só', async () => {
    const ok = run(json({}, 503), json({ ok: 1 }));
    await expect(ok.result).resolves.toMatchObject({ status: 200 });
    expect(ok.mock.calls).toHaveLength(2);

    const fail = run(json({}, 500), json({}, 502), json({}));
    await expect(caught(fail.result)).resolves.toMatchObject({
      code: 'UPSTREAM',
      upstreamStatus: 502,
    });
    expect(fail.mock.calls).toHaveLength(2);
  });

  it('no máximo 2 novas tentativas somando 429 e 5xx', async () => {
    const { mock, result } = run(
      json({}, 429, { 'Retry-After': '0' }),
      json({}, 429),
      json({}, 500),
    );
    await expect(caught(result)).resolves.toMatchObject({ code: 'UPSTREAM', upstreamStatus: 500 });
    expect(mock.calls).toHaveLength(3);
  });
});
