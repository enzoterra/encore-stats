// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateDemo } from '@/domain/demo';
import { json, makeArtist, mockBff } from '../../../tests/support/bff';

import { BffError, getJson, liveSource } from './bff-client';
import { createConnectBundle, shouldRetry } from './connect-client';
import { createDemoSource } from './demo-source';
import { createLimiter, runPool, sleep } from './limiter';
import {
  clearAllSession,
  clearConnectSession,
  readSession,
  removeSession,
  writeSession,
} from './session-cache';

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe('bff-client', () => {
  it('valida a resposta de novo com o schema do domínio', async () => {
    mockBff({
      me: () => json(200, { id: 'u', displayName: 'X', image: 'https://evil.example/a.png' }),
    });
    await expect(liveSource.me()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    mockBff({ me: () => new Response('não é json', { status: 200 }) });
    await expect(liveSource.me()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('traduz o erro tipado do BFF, com retryAfter do corpo ou do cabeçalho', async () => {
    mockBff({
      recent: () => json(429, { error: { code: 'RATE_LIMITED', retryAfter: 12 } }),
      me: () => json(503, { error: { code: 'QUOTA' } }),
      saved: () => new Response('', { status: 429, headers: { 'Retry-After': '7' } }),
      top: () => json(418, { error: { code: 'TEAPOT' } }),
      artist: () => json(500, { nada: true }),
    });
    await expect(liveSource.recent()).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfter: 12,
    });
    await expect(liveSource.me()).rejects.toMatchObject({ code: 'QUOTA', retryAfter: 900 });
    await expect(liveSource.saved(0, 1)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfter: 7,
    });
    await expect(liveSource.topArtists('short_term')).rejects.toMatchObject({ code: 'INTERNAL' });
    await expect(liveSource.artist(makeArtist(1).id)).rejects.toMatchObject({ code: 'UPSTREAM' });
  });

  it('limita retryAfter absurdo e usa padrões', async () => {
    mockBff({
      recent: () => json(429, { error: { code: 'RATE_LIMITED', retryAfter: 999_999 } }),
      me: () => json(401, {}),
      saved: () => json(403, {}),
      top: () => json(400, {}),
      artist: () => json(404, {}),
    });
    await expect(liveSource.recent()).rejects.toMatchObject({ retryAfter: 3600 });
    await expect(liveSource.me()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(liveSource.saved(0, 50)).rejects.toMatchObject({ code: 'NOT_ALLOWLISTED' });
    await expect(liveSource.topTracks('long_term')).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(liveSource.artist(makeArtist(2).id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('erro de rede vira NETWORK; abort é repassado; fresh usa no-cache', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    await expect(liveSource.me()).rejects.toMatchObject({ code: 'NETWORK' });
    const controller = new AbortController();
    controller.abort();
    await expect(
      getJson('/api/spotify/me', {} as never, { signal: controller.signal }),
    ).rejects.toBeInstanceOf(TypeError);
    const { calls } = mockBff();
    await liveSource.saved(50, 50, { fresh: true });
    expect(calls[0]).toMatchObject({
      path: '/api/spotify/saved?offset=50&limit=50',
      cache: 'no-cache',
    });
  });
});

describe('política de retry e erros globais', () => {
  it('nunca repete 4xx, QUOTA ou 429; repete 1 vez rede e 5xx', () => {
    expect(shouldRetry(0, new BffError('UNAUTHENTICATED', 401))).toBe(false);
    expect(shouldRetry(0, new BffError('RATE_LIMITED', 429, 3))).toBe(false);
    expect(shouldRetry(0, new BffError('QUOTA', 503, 900))).toBe(false);
    expect(shouldRetry(0, new BffError('BAD_REQUEST', 400))).toBe(false);
    expect(shouldRetry(0, new BffError('UPSTREAM', 502))).toBe(true);
    expect(shouldRetry(0, new BffError('NETWORK', 0))).toBe(true);
    expect(shouldRetry(0, new BffError('INTERNAL', 500))).toBe(true);
    expect(shouldRetry(1, new BffError('UPSTREAM', 502))).toBe(false);
    expect(shouldRetry(0, new Error('x'))).toBe(false);
  });

  it('report: 401 expira, 403 bloqueia, QUOTA pausa (sem encurtar pausa maior)', () => {
    const bundle = createConnectBundle(liveSource);
    bundle.report(new Error('ignorado'));
    bundle.report(new BffError('QUOTA', 503, 60));
    const first = bundle.status.getState().pausedUntil!;
    bundle.report(new BffError('QUOTA', 503, 10));
    expect(bundle.status.getState().pausedUntil).toBe(first);
    bundle.report(new BffError('NOT_ALLOWLISTED', 403));
    expect(bundle.status.getState().session).toBe('forbidden');
    bundle.report(new BffError('UNAUTHENTICATED', 401));
    expect(bundle.status.getState().session).toBe('expired');
    bundle.status.getState().resume();
    expect(window.sessionStorage.getItem('encore.connect.pause')).toBeNull();
    bundle.status.getState().reset();
    expect(bundle.status.getState()).toMatchObject({ session: 'active', pausedUntil: null });
  });

  it('a pausa guardada no sessionStorage sobrevive a recarregar a página', () => {
    writeSession('pause', Date.now() + 60_000, 60_000);
    expect(createConnectBundle(liveSource).status.getState().pausedUntil).toBeGreaterThan(
      Date.now(),
    );
    // O Demo não lê nem grava storage.
    expect(
      createConnectBundle(createDemoSource(generateDemo({ days: 30 }).api)).status.getState()
        .pausedUntil,
    ).toBeNull();
  });
});

describe('session-cache (só sessionStorage, com TTL)', () => {
  it('lê dentro do prazo, expira depois e limpa só o prefixo do Conectar', () => {
    writeSession('a', { x: 1 }, 1000, 0);
    expect(readSession('a', 999)).toEqual({ x: 1 });
    expect(readSession('a', 1000)).toBeUndefined();
    expect(window.sessionStorage.getItem('encore.connect.a')).toBeNull();
    window.sessionStorage.setItem('encore.connect.bad', '{');
    expect(readSession('bad')).toBeUndefined();
    window.sessionStorage.setItem('encore.connect.old', JSON.stringify({ v: 0 }));
    expect(readSession('old')).toBeUndefined();
    writeSession('b', 1, 1000);
    window.sessionStorage.setItem('outro', '1');
    removeSession('nada');
    clearConnectSession();
    expect(readSession('b')).toBeUndefined();
    expect(window.sessionStorage.getItem('outro')).toBe('1');
    clearAllSession();
    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.length).toBe(0);
  });
});

describe('limiter', () => {
  it('createLimiter respeita a concorrência', async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    const task = async () => {
      active++;
      peak = Math.max(peak, active);
      await sleep(5);
      active--;
      return 1;
    };
    const results = await Promise.all(Array.from({ length: 6 }, () => limit(task)));
    expect(results).toEqual([1, 1, 1, 1, 1, 1]);
    expect(peak).toBe(2);
    await expect(limit(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
  });

  it('runPool para no primeiro erro e sleep é cancelável', async () => {
    const seen: number[] = [];
    await expect(
      runPool([1, 2, 3, 4, 5, 6], 2, async (n) => {
        seen.push(n);
        if (n === 2) throw new Error('falhou');
        await sleep(1);
      }),
    ).rejects.toThrow('falhou');
    expect(seen.length).toBeLessThan(6);
    await runPool([], 3, async () => undefined);
    const controller = new AbortController();
    const pending = sleep(10_000, controller.signal);
    controller.abort(new Error('parou'));
    await expect(pending).rejects.toThrow('parou');
    await expect(sleep(1, controller.signal)).rejects.toThrow('parou');
  });
});

describe('fonte do Demo', () => {
  it('responde no formato do BFF, sem rede, e 404 para artista desconhecido', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { api } = generateDemo({ days: 120 });
    const source = createDemoSource(api, { pageDelayMs: 0 });
    expect(await source.me()).toEqual(api.me);
    expect(await source.topArtists('short_term')).toBe(api.top.artists.short_term);
    expect(await source.topTracks('long_term')).toBe(api.top.tracks.long_term);
    expect(await source.recent()).toBe(api.recent);
    const page = await source.saved(0, 50);
    expect(page.total).toBe(api.saved.length);
    expect((await source.saved(0, 1)).items.length).toBeLessThanOrEqual(1);
    expect(await source.artist(api.artists[0]!.id)).toEqual(api.artists[0]);
    await expect(source.artist('0000000000000000000000')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const controller = new AbortController();
    controller.abort(new Error('abortado'));
    await expect(source.me({ signal: controller.signal })).rejects.toThrow('abortado');
    await expect(
      createDemoSource(api, { pageDelayMs: 5 }).saved(0, 50, { signal: controller.signal }),
    ).rejects.toThrow('abortado');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(api.demo).toBe(true);
  });
});
