import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openSession } from '@/server/session';

import {
  APP_ORIGIN,
  captureLogs,
  cookieValue,
  hang,
  installSpotifyMock,
  json,
  nowS,
  OTHER_SECRET,
  PREVIOUS_SECRET,
  rawArtist,
  rawMe,
  rawRecent,
  rawSaved,
  rawTop,
  SECRET,
  sessionCookie,
  sessionData,
  setCookie,
  spotifyId,
  stubRetryTiming,
  tokenResponse,
  useConnectEnv,
  useDisabledEnv,
} from '../../../tests/mocks/spotify';

import { GET as artistRoute } from './artist/[id]/route';
import { GET as meRoute } from './me/route';
import { GET as recentRoute } from './recent/route';
import { GET as savedRoute } from './saved/route';
import { GET as topRoute } from './top/route';

type Mock = ReturnType<typeof installSpotifyMock>;

const ARTIST_ID = spotifyId('artist', 7);

/** Cada rota: como chamá-la, o que mockar no Spotify e o TTL esperado (03, "Cache"). */
const ROUTES = [
  {
    name: 'me',
    call: (headers: HeadersInit, query = '') =>
      meRoute(new Request(`${APP_ORIGIN}/api/spotify/me${query}`, { headers })),
    mock: (mock: Mock) => mock.api('/me', json(rawMe)),
    upstream: '/v1/me',
    maxAge: 86_400,
    badQueries: ['?x=1'],
  },
  {
    name: 'top',
    call: (headers: HeadersInit, query = '?type=artists&range=short_term') =>
      topRoute(new Request(`${APP_ORIGIN}/api/spotify/top${query}`, { headers })),
    mock: (mock: Mock) => mock.api('/me/top/artists', json(rawTop('artists'))),
    upstream: '/v1/me/top/artists',
    maxAge: 21_600,
    badQueries: [
      '',
      '?type=artists',
      '?type=albums&range=short_term',
      '?type=artists&range=forever',
      '?type=artists&range=short_term&limit=10',
      '?type=artists&type=tracks&range=short_term',
      '?type=../../users/x&range=short_term',
    ],
  },
  {
    name: 'recent',
    call: (headers: HeadersInit, query = '') =>
      recentRoute(new Request(`${APP_ORIGIN}/api/spotify/recent${query}`, { headers })),
    mock: (mock: Mock) => mock.api('/me/player/recently-played', json(rawRecent())),
    upstream: '/v1/me/player/recently-played',
    maxAge: 60,
    badQueries: ['?before=1'],
  },
  {
    name: 'saved',
    call: (headers: HeadersInit, query = '?offset=50') =>
      savedRoute(new Request(`${APP_ORIGIN}/api/spotify/saved${query}`, { headers })),
    mock: (mock: Mock) => mock.api('/me/tracks', json(rawSaved(50))),
    upstream: '/v1/me/tracks',
    maxAge: 43_200,
    badQueries: [
      '?offset=-50',
      '?offset=25',
      '?offset=100050',
      '?offset=1e3',
      '?offset=050',
      '?offset=abc',
      '?limit=20',
      '?offset=0&extra=1',
    ],
  },
  {
    name: 'artist',
    call: (headers: HeadersInit, query = '', id = ARTIST_ID) =>
      artistRoute(new Request(`${APP_ORIGIN}/api/spotify/artist/${id}${query}`, { headers }), {
        params: Promise.resolve({ id }),
      }),
    mock: (mock: Mock) => mock.api(`/artists/${ARTIST_ID}`, json(rawArtist(7))),
    upstream: `/v1/artists/${ARTIST_ID}`,
    maxAge: 604_800,
    badQueries: ['?market=BR'],
  },
] as const;

let logs: ReturnType<typeof captureLogs>;
let timing: ReturnType<typeof stubRetryTiming>;
/** Todas as respostas dos testes, para as garantias globais de cache. */
const responses: Response[] = [];

async function track(promise: Promise<Response>): Promise<Response> {
  const response = await promise;
  responses.push(response);
  return response;
}

beforeEach(() => {
  useConnectEnv();
  logs = captureLogs();
  timing = stubRetryTiming();
});

afterEach(() => {
  const serialized = JSON.stringify(logs.records);
  for (const secret of ['access-token', 'refresh-token', 'Artista', 'Música', 'usuario-teste']) {
    expect(serialized).not.toContain(secret);
  }
  logs.restore();
  timing.restore();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function errorOf(response: Response) {
  return ((await response.clone().json()) as { error: { code: string; retryAfter?: number } })
    .error;
}

describe.each(ROUTES)('GET /api/spotify/$name', (route) => {
  it('sucesso: resposta reduzida, Cache-Control private com o TTL e Vary: Cookie', async () => {
    const mock = installSpotifyMock();
    route.mock(mock);
    const response = await track(route.call({ cookie: await sessionCookie() }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(`private, max-age=${route.maxAge}`);
    expect(response.headers.get('Vary')).toBe('Cookie');
    expect(response.headers.getSetCookie()).toEqual([]);
    const body = JSON.stringify(await response.json());
    for (const removed of ['popularity', 'followers', 'email', 'uri', 'href', 'external_urls']) {
      expect(body).not.toContain(`"${removed}"`);
    }
    const [call] = mock.callsTo(route.upstream);
    expect(call?.headers.get('authorization')).toBe('Bearer access-token-original');
    expect(call?.url.origin).toBe('https://api.spotify.com');
  });

  it('sem sessão: 401 sem chamar o Spotify', async () => {
    const mock = installSpotifyMock();
    const response = await track(route.call({}));
    expect(response.status).toBe(401);
    await expect(errorOf(response)).resolves.toEqual({ code: 'UNAUTHENTICATED' });
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(mock.calls).toHaveLength(0);
  });

  it('cookie adulterado ou de outra chave: 401 e o cookie é apagado', async () => {
    const mock = installSpotifyMock();
    const valid = await sessionCookie();
    for (const cookie of [
      `${valid.slice(0, -4)}AAAA`,
      await sessionCookie(sessionData(), OTHER_SECRET),
      'encore_session=lixo',
    ]) {
      const response = await track(route.call({ cookie }));
      expect(response.status).toBe(401);
      expect(setCookie(response, 'encore_session')).toMatch(/Max-Age=0/);
    }
    expect(mock.calls).toHaveLength(0);
  });

  it('token de usuário vindo do cliente é ignorado (só o cookie autentica)', async () => {
    const mock = installSpotifyMock();
    const response = await track(route.call({ authorization: 'Bearer token-do-cliente' }));
    expect(response.status).toBe(401);
    expect(mock.calls).toHaveLength(0);
  });

  it('parâmetros inválidos: 400 BAD_REQUEST sem chamar o Spotify', async () => {
    const mock = installSpotifyMock();
    const cookie = await sessionCookie();
    for (const query of route.badQueries) {
      const response = await track(route.call({ cookie }, query));
      expect(response.status, query).toBe(400);
      await expect(errorOf(response)).resolves.toEqual({ code: 'BAD_REQUEST' });
    }
    expect(mock.calls).toHaveLength(0);
  });

  it('403 do Spotify (fora da allowlist): 403 NOT_ALLOWLISTED', async () => {
    const mock = installSpotifyMock();
    mock.api(
      route.upstream.replace('/v1', ''),
      new Response(
        'Check settings on developer.spotify.com/dashboard, the user may not be registered.',
        {
          status: 403,
        },
      ),
    );
    const response = await track(route.call({ cookie: await sessionCookie() }));
    expect(response.status).toBe(403);
    await expect(errorOf(response)).resolves.toEqual({ code: 'NOT_ALLOWLISTED' });
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('Conectar desabilitado: 404 CONNECT_DISABLED', async () => {
    useDisabledEnv();
    const response = await track(route.call({ cookie: await sessionCookie() }));
    expect(response.status).toBe(404);
    await expect(errorOf(response)).resolves.toEqual({ code: 'CONNECT_DISABLED' });
  });
});

describe('parâmetros específicos', () => {
  it('top: repassa type, range e limit=50 fixos', async () => {
    const mock = installSpotifyMock();
    mock.api('/me/top/tracks', json(rawTop('tracks')));
    const response = await track(
      topRoute(
        new Request(`${APP_ORIGIN}/api/spotify/top?type=tracks&range=long_term`, {
          headers: { cookie: await sessionCookie() },
        }),
      ),
    );
    expect(response.status).toBe(200);
    const [call] = mock.callsTo('/v1/me/top/tracks');
    expect(Object.fromEntries(call?.url.searchParams ?? [])).toEqual({
      time_range: 'long_term',
      limit: '50',
    });
    const body = (await response.json()) as { items: { url: string }[] };
    expect(body.items).toHaveLength(3);
    expect(body.items[0]?.url).toMatch(/^https:\/\/open\.spotify\.com\/track\//);
  });

  it('saved: offset padrão 0 e limit=1 para validar o cache', async () => {
    const mock = installSpotifyMock();
    mock.api('/me/tracks', json(rawSaved(0, 1)));
    const cookie = await sessionCookie();
    const request = (query: string) =>
      track(
        savedRoute(new Request(`${APP_ORIGIN}/api/spotify/saved${query}`, { headers: { cookie } })),
      );
    expect((await request('')).status).toBe(200);
    expect((await request('?offset=100000&limit=1')).status).toBe(200);
    expect(mock.calls.map((call) => call.url.search)).toEqual([
      '?offset=0&limit=50',
      '?offset=100000&limit=1',
    ]);
  });

  it('artist: id fora do formato base62/22 é 400 (nada de caminho livre)', async () => {
    const mock = installSpotifyMock();
    const cookie = await sessionCookie();
    for (const id of ['curto', `${ARTIST_ID}x`, '..%2F..%2Fme', 'a'.repeat(21) + '!']) {
      const response = await track(
        artistRoute(new Request(`${APP_ORIGIN}/api/spotify/artist/x`, { headers: { cookie } }), {
          params: Promise.resolve({ id }),
        }),
      );
      expect(response.status).toBe(400);
    }
    expect(mock.calls).toHaveLength(0);
  });

  it('artist: 404 do Spotify vira NOT_FOUND', async () => {
    const mock = installSpotifyMock();
    mock.api(`/artists/${ARTIST_ID}`, json({ error: { status: 404, message: 'not found' } }, 404));
    const response = await track(ROUTES[4].call({ cookie: await sessionCookie() }));
    expect(response.status).toBe(404);
    await expect(errorOf(response)).resolves.toEqual({ code: 'NOT_FOUND' });
  });
});

describe('limites da API (RF-25, RNF-05)', () => {
  const callMe = async () =>
    track(
      meRoute(
        new Request(`${APP_ORIGIN}/api/spotify/me`, { headers: { cookie: await sessionCookie() } }),
      ),
    );

  it('429 com Retry-After curto: espera e responde 200', async () => {
    const mock = installSpotifyMock();
    mock.api('/me', json({}, 429, { 'Retry-After': '2' }), json(rawMe));
    const response = await callMe();
    expect(response.status).toBe(200);
    expect(timing.sleep).toHaveBeenCalledWith(2000);
    expect(mock.calls).toHaveLength(2);
  });

  it('429 sem Retry-After esgotando as tentativas: 429 RATE_LIMITED com retryAfter', async () => {
    const mock = installSpotifyMock();
    mock.api('/me', json({ error: { status: 429, message: 'API rate limit exceeded' } }, 429));
    const response = await callMe();
    expect(response.status).toBe(429);
    await expect(errorOf(response)).resolves.toEqual({ code: 'RATE_LIMITED', retryAfter: 4 });
    expect(response.headers.get('Retry-After')).toBe('4');
    expect(mock.calls).toHaveLength(3);
  });

  it('429 com Retry-After acima de 30 s: repassa na hora', async () => {
    const mock = installSpotifyMock();
    mock.api('/me', json({}, 429, { 'Retry-After': '120' }));
    const response = await callMe();
    expect(response.status).toBe(429);
    await expect(errorOf(response)).resolves.toEqual({ code: 'RATE_LIMITED', retryAfter: 120 });
    expect(timing.sleep).not.toHaveBeenCalled();
  });

  it('429 QUOTA_EXCEEDED: 503 QUOTA, sem retry', async () => {
    const mock = installSpotifyMock();
    mock.api('/me', json({ error: { status: 429, reason: 'QUOTA_EXCEEDED' } }, 429));
    const response = await callMe();
    expect(response.status).toBe(503);
    await expect(errorOf(response)).resolves.toEqual({ code: 'QUOTA', retryAfter: 900 });
    expect(mock.calls).toHaveLength(1);
  });

  it('5xx: 1 retry; se persistir, 502 UPSTREAM', async () => {
    let mock = installSpotifyMock();
    mock.api('/me', json({}, 502), json(rawMe));
    expect((await callMe()).status).toBe(200);
    expect(mock.calls).toHaveLength(2);

    mock = installSpotifyMock();
    mock.api('/me', json({}, 500));
    const response = await callMe();
    expect(response.status).toBe(502);
    await expect(errorOf(response)).resolves.toEqual({ code: 'UPSTREAM' });
    expect(mock.calls).toHaveLength(2);
  });

  it('timeout de 10 s: 502 UPSTREAM', async () => {
    const cookie = await sessionCookie();
    vi.useFakeTimers();
    const mock = installSpotifyMock();
    // Avança o relógio só quando o fetch já começou (o timer do timeout já existe).
    mock.api('/me', (request) => {
      const reply = hang(request);
      void vi.advanceTimersByTimeAsync(10_000);
      return reply;
    });
    const response = await track(
      meRoute(new Request(`${APP_ORIGIN}/api/spotify/me`, { headers: { cookie } })),
    );
    expect(response.status).toBe(502);
    expect(logs.records.at(-1)).toMatchObject({ code: 'UPSTREAM', reason: 'timeout' });
  });

  it('resposta fora do schema: 502 UPSTREAM', async () => {
    const mock = installSpotifyMock();
    mock.api('/me', json({ nome: 'sem id' }), new Response('<html>'));
    expect((await callMe()).status).toBe(502);
    expect((await callMe()).status).toBe(502);
  });

  it('outros 4xx do Spotify: 502 UPSTREAM', async () => {
    const mock = installSpotifyMock();
    mock.api('/me', json({ error: { status: 400, message: 'bad' } }, 400));
    expect((await callMe()).status).toBe(502);
  });
});

describe('refresh e sessão', () => {
  const expiring = () => sessionData({ exp: nowS() + 30 });
  const callMe = async (cookie: string) =>
    track(meRoute(new Request(`${APP_ORIGIN}/api/spotify/me`, { headers: { cookie } })));

  it('faltando < 60 s: renova, usa o token novo e ressela o cookie; novo refresh_token substitui', async () => {
    const mock = installSpotifyMock();
    mock.token(json(tokenResponse()));
    mock.api('/me', json(rawMe));
    const original = expiring();
    const response = await callMe(await sessionCookie(original));
    expect(response.status).toBe(200);

    const [refreshCall] = mock.callsTo('/api/token');
    expect(Object.fromEntries(new URLSearchParams(refreshCall?.body))).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'refresh-token-original',
    });
    expect(mock.callsTo('/v1/me')[0]?.headers.get('authorization')).toBe('Bearer access-token-new');

    const cookie = setCookie(response, 'encore_session');
    expect(cookie).toMatch(/HttpOnly; SameSite=Lax$/);
    const opened = await openSession(cookieValue(cookie) ?? '', { current: SECRET });
    expect(opened).toMatchObject({
      at: 'access-token-new',
      rt: 'refresh-token-new',
      authAt: original.authAt,
    });
    // O Max-Age respeita o teto absoluto de 30 dias desde o login.
    expect(Number(/Max-Age=(\d+)/.exec(cookie ?? '')?.[1])).toBeLessThanOrEqual(30 * 86_400 - 60);
    expect(logs.records.at(-1)).toMatchObject({ refreshed: true, status: 200 });
  });

  it('refresh sem refresh_token novo mantém o anterior', async () => {
    const mock = installSpotifyMock();
    mock.token(json(tokenResponse({ refresh_token: undefined })));
    mock.api('/me', json(rawMe));
    const response = await callMe(await sessionCookie(expiring()));
    const opened = await openSession(cookieValue(setCookie(response, 'encore_session')) ?? '', {
      current: SECRET,
    });
    expect(opened).toMatchObject({ at: 'access-token-new', rt: 'refresh-token-original' });
  });

  it('invalid_grant com o token já expirado: 401 e o cookie é apagado', async () => {
    const mock = installSpotifyMock();
    mock.token(json({ error: 'invalid_grant', error_description: 'Refresh token revoked' }, 400));
    const response = await callMe(await sessionCookie(sessionData({ exp: nowS() - 10 })));
    expect(response.status).toBe(401);
    await expect(errorOf(response)).resolves.toEqual({ code: 'UNAUTHENTICATED' });
    expect(setCookie(response, 'encore_session')).toMatch(/Max-Age=0/);
    expect(mock.callsTo('/v1/me')).toHaveLength(0);
  });

  it('invalid_grant com o token ainda válido (refresh paralelo): segue com o token atual', async () => {
    const mock = installSpotifyMock();
    mock.token(json({ error: 'invalid_grant' }, 400));
    mock.api('/me', json(rawMe));
    const response = await callMe(await sessionCookie(expiring()));
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(mock.callsTo('/v1/me')[0]?.headers.get('authorization')).toBe(
      'Bearer access-token-original',
    );
  });

  it('401 da API: renova uma vez e repete; 401 de novo apaga a sessão', async () => {
    let mock = installSpotifyMock();
    mock.token(json(tokenResponse()));
    mock.api('/me', json({ error: { status: 401 } }, 401), json(rawMe));
    let response = await callMe(await sessionCookie());
    expect(response.status).toBe(200);
    expect(setCookie(response, 'encore_session')).toBeDefined();

    mock = installSpotifyMock();
    mock.token(json(tokenResponse()));
    mock.api('/me', json({ error: { status: 401 } }, 401));
    response = await callMe(await sessionCookie());
    expect(response.status).toBe(401);
    expect(setCookie(response, 'encore_session')).toMatch(/Max-Age=0/);
    expect(mock.callsTo('/api/token')).toHaveLength(1);
  });

  it('refresh que falha por indisponibilidade: 502 e a sessão fica', async () => {
    const mock = installSpotifyMock();
    mock.token(json({}, 503));
    const response = await callMe(await sessionCookie(sessionData({ exp: nowS() - 10 })));
    expect(response.status).toBe(502);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('refresh deu certo mas a chamada falhou: guarda os tokens novos mesmo assim', async () => {
    const mock = installSpotifyMock();
    mock.token(json(tokenResponse()));
    mock.api('/me', json({}, 500));
    const response = await callMe(await sessionCookie(expiring()));
    expect(response.status).toBe(502);
    const opened = await openSession(cookieValue(setCookie(response, 'encore_session')) ?? '', {
      current: SECRET,
    });
    expect(opened?.at).toBe('access-token-new');
  });

  it('rotação de chave: cookie selado com a chave anterior abre e é resselado com a atual', async () => {
    useConnectEnv({ SESSION_SECRET_PREVIOUS: PREVIOUS_SECRET });
    const mock = installSpotifyMock();
    mock.token(json(tokenResponse()));
    mock.api('/me', json(rawMe));
    const oldCookie = await sessionCookie(sessionData(), PREVIOUS_SECRET);
    expect((await callMe(oldCookie)).status).toBe(200);

    const refreshed = await callMe(await sessionCookie(expiring(), PREVIOUS_SECRET));
    const value = cookieValue(setCookie(refreshed, 'encore_session')) ?? '';
    await expect(openSession(value, { current: SECRET })).resolves.not.toBeNull();

    // Sem o SESSION_SECRET_PREVIOUS, o cookie antigo deixa de valer.
    useConnectEnv();
    expect((await callMe(oldCookie)).status).toBe(401);
  });

  it('sessão com mais de 30 dias: 401', async () => {
    installSpotifyMock();
    const response = await callMe(
      await sessionCookie(sessionData({ authAt: nowS() - 31 * 86_400 })),
    );
    expect(response.status).toBe(401);
  });

  it('em HTTPS o cookie é __Host-encore_session com Secure', async () => {
    useConnectEnv({
      SPOTIFY_REDIRECT_URI: 'https://encore.example/api/auth/callback',
      NEXT_PUBLIC_SITE_URL: 'https://encore.example',
    });
    const mock = installSpotifyMock();
    mock.token(json(tokenResponse()));
    mock.api('/me', json(rawMe));
    // O nome sem prefixo não autentica em HTTPS (evita cookie plantado por subdomínio).
    const plain = await sessionCookie(expiring());
    expect((await callMe(plain)).status).toBe(401);
    const response = await callMe(await sessionCookie(expiring(), SECRET, '__Host-encore_session'));
    expect(response.status).toBe(200);
    expect(setCookie(response, '__Host-encore_session')).toMatch(/HttpOnly; SameSite=Lax; Secure$/);
  });

  it('usa a base de API configurada (mock em loopback)', async () => {
    useConnectEnv({ SPOTIFY_API_BASE: 'http://127.0.0.1:4010/v1' });
    const fetchMock = vi.fn(async () => json(rawMe));
    vi.stubGlobal('fetch', fetchMock);
    const response = await callMe(await sessionCookie());
    expect(response.status).toBe(200);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe('http://127.0.0.1:4010/v1/me');
  });
});

describe('garantias de cache em todas as respostas do BFF (RNF-06)', () => {
  it('nunca public nem s-maxage; sempre private e Vary: Cookie', () => {
    expect(responses.length).toBeGreaterThan(40);
    for (const response of responses) {
      const cacheControl = response.headers.get('Cache-Control') ?? '';
      expect(cacheControl).toMatch(/^private, (max-age=\d+|no-store)$/);
      expect(cacheControl).not.toMatch(/public|s-maxage/);
      expect(response.headers.get('Vary')).toBe('Cookie');
      if (response.status !== 200) expect(cacheControl).toBe('private, no-store');
    }
  });
});
