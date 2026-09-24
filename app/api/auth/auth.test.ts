import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openOAuth, openSession } from '@/server/session';
import { codeChallenge } from '@/server/spotify-auth';

import {
  ACCOUNTS,
  APP_ORIGIN,
  captureLogs,
  cookieValue,
  installSpotifyMock,
  json,
  nowS,
  oauthCookie,
  OTHER_SECRET,
  rawMe,
  SECRET,
  sessionCookie,
  setCookie,
  stubRetryTiming,
  tokenResponse,
  useConnectEnv,
  useDisabledEnv,
} from '../../../tests/mocks/spotify';

import { GET as callback } from './callback/route';
import { GET as login } from './login/route';
import { POST as logout } from './logout/route';

const STATE = 'S'.repeat(20) + 't'.repeat(23);
const VERIFIER = 'V'.repeat(43);
const CODE = 'codigo-de-autorizacao-secreto';

let logs: ReturnType<typeof captureLogs>;
let timing: ReturnType<typeof stubRetryTiming>;

beforeEach(() => {
  useConnectEnv();
  logs = captureLogs();
  timing = stubRetryTiming();
});

afterEach(() => {
  // Nenhum log pode conter `code`, `state`, verifier ou tokens (RNF-11).
  const serialized = JSON.stringify(logs.records);
  for (const secret of [CODE, STATE, VERIFIER, 'access-token', 'refresh-token']) {
    expect(serialized).not.toContain(secret);
  }
  logs.restore();
  timing.restore();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function validOAuthCookie(overrides: { locale?: string; iat?: number } = {}) {
  return oauthCookie({
    state: STATE,
    verifier: VERIFIER,
    locale: overrides.locale ?? 'en',
    iat: overrides.iat ?? nowS(),
  });
}

function callbackRequest(query: string, cookie?: string): Request {
  return new Request(`${APP_ORIGIN}/api/auth/callback?${query}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe('GET /api/auth/login', () => {
  it('redireciona para o /authorize com PKCE S256, state e escopos mínimos', async () => {
    const response = await login(new Request(`${APP_ORIGIN}/api/auth/login?locale=en`));
    expect(response.status).toBe(302);
    expect(response.headers.get('Cache-Control')).toBe('no-store');

    const location = new URL(response.headers.get('Location') ?? '');
    expect(`${location.origin}${location.pathname}`).toBe(`${ACCOUNTS}/authorize`);
    const params = location.searchParams;
    expect(params.get('client_id')).toBe('test-client-id');
    expect(params.get('response_type')).toBe('code');
    expect(params.get('redirect_uri')).toBe(`${APP_ORIGIN}/api/auth/callback`);
    expect(params.get('scope')).toBe('user-top-read user-read-recently-played user-library-read');
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(location.toString()).not.toContain('client-secret');

    const cookie = setCookie(response, 'encore_oauth');
    expect(cookie).toMatch(/; Path=\/; Max-Age=600; HttpOnly; SameSite=Lax$/);
    const sealed = await openOAuth(cookieValue(cookie) ?? '', { current: SECRET });
    expect(sealed).toMatchObject({ state: params.get('state'), locale: 'en' });
    // O challenge enviado é o S256 do verifier guardado (e o verifier nunca sai do servidor).
    expect(params.get('code_challenge')).toBe(codeChallenge(sealed?.verifier ?? ''));
    expect(location.toString()).not.toContain(sealed?.verifier ?? '');
  });

  it('gera state e verifier novos a cada login', async () => {
    const first = await login(new Request(`${APP_ORIGIN}/api/auth/login`));
    const second = await login(new Request(`${APP_ORIGIN}/api/auth/login`));
    const state = (response: Response) =>
      new URL(response.headers.get('Location') ?? '').searchParams.get('state');
    expect(state(first)).not.toBe(state(second));
  });

  it('idioma inválido cai no padrão pt-BR', async () => {
    const response = await login(new Request(`${APP_ORIGIN}/api/auth/login?locale=../../x`));
    const sealed = await openOAuth(cookieValue(setCookie(response, 'encore_oauth')) ?? '', {
      current: SECRET,
    });
    expect(sealed?.locale).toBe('pt-BR');
  });

  it('em outro host, recomeça na origem configurada (os cookies vivem nela)', async () => {
    const response = await login(
      new Request('http://localhost:3000/api/auth/login?locale=en', {
        headers: { host: 'localhost:3000' },
      }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe(`${APP_ORIGIN}/api/auth/login?locale=en`);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('em HTTPS usa o cookie __Host- com Secure', async () => {
    useConnectEnv({
      SPOTIFY_REDIRECT_URI: 'https://encore.example/api/auth/callback',
      NEXT_PUBLIC_SITE_URL: 'https://encore.example',
    });
    const response = await login(new Request('https://encore.example/api/auth/login'));
    expect(setCookie(response, '__Host-encore_oauth')).toMatch(
      /; Path=\/; Max-Age=600; HttpOnly; SameSite=Lax; Secure$/,
    );
  });

  it('Conectar desabilitado: 404 CONNECT_DISABLED', async () => {
    useDisabledEnv();
    const response = await login(new Request(`${APP_ORIGIN}/api/auth/login`));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: { code: 'CONNECT_DISABLED' } });
  });
});

describe('GET /api/auth/callback', () => {
  const location = (response: Response) => response.headers.get('Location');

  it('sucesso: troca o code, grava a sessão e volta para /{locale}/connect', async () => {
    const mock = installSpotifyMock();
    mock.token(json(tokenResponse()));
    mock.api('/me', json(rawMe));

    const response = await callback(
      callbackRequest(`code=${CODE}&state=${STATE}`, await validOAuthCookie()),
    );
    expect(response.status).toBe(302);
    expect(location(response)).toBe(`${APP_ORIGIN}/en/connect`);
    expect(response.headers.get('Cache-Control')).toBe('no-store');

    // Troca do code: client secret em Basic, verifier do PKCE e a redirect URI exata.
    const [tokenCall] = mock.callsTo('/api/token');
    expect(tokenCall?.headers.get('authorization')).toBe(
      `Basic ${Buffer.from('test-client-id:test-client-secret').toString('base64')}`,
    );
    expect(Object.fromEntries(new URLSearchParams(tokenCall?.body))).toEqual({
      grant_type: 'authorization_code',
      code: CODE,
      redirect_uri: `${APP_ORIGIN}/api/auth/callback`,
      code_verifier: VERIFIER,
    });
    expect(mock.callsTo('/v1/me')[0]?.headers.get('authorization')).toBe('Bearer access-token-new');

    const session = setCookie(response, 'encore_session');
    expect(session).toMatch(/; Path=\/; Max-Age=259\d{4}; HttpOnly; SameSite=Lax$/);
    const opened = await openSession(cookieValue(session) ?? '', { current: SECRET });
    expect(opened).toMatchObject({ at: 'access-token-new', rt: 'refresh-token-new' });
    expect(opened?.exp).toBeGreaterThan(nowS() + 3500);
    // O cookie temporário é apagado.
    expect(setCookie(response, 'encore_oauth')).toContain('Max-Age=0');
  });

  it('token de validade curta renovado já no callback: grava o refresh token novo', async () => {
    const mock = installSpotifyMock();
    mock.token(
      json(tokenResponse({ expires_in: 30, refresh_token: 'refresh-token-1' })),
      json(tokenResponse({ access_token: 'access-token-2', refresh_token: 'refresh-token-2' })),
    );
    mock.api('/me', json(rawMe));
    const response = await callback(
      callbackRequest(`code=${CODE}&state=${STATE}`, await validOAuthCookie()),
    );
    const opened = await openSession(cookieValue(setCookie(response, 'encore_session')) ?? '', {
      current: SECRET,
    });
    expect(opened).toMatchObject({ at: 'access-token-2', rt: 'refresh-token-2' });
    expect(mock.callsTo('/api/token')).toHaveLength(2);
  });

  it('state diferente: nega sem chamar o Spotify', async () => {
    const mock = installSpotifyMock();
    const response = await callback(
      callbackRequest(`code=${CODE}&state=${'x'.repeat(43)}`, await validOAuthCookie()),
    );
    expect(location(response)).toBe(`${APP_ORIGIN}/en/connect?error=state`);
    expect(setCookie(response, 'encore_session')).toBeUndefined();
    expect(setCookie(response, 'encore_oauth')).toContain('Max-Age=0');
    expect(mock.calls).toHaveLength(0);
  });

  it('state ausente, cookie ausente, adulterado, de outra chave ou expirado: nega', async () => {
    const mock = installSpotifyMock();
    const valid = await validOAuthCookie();
    const cases = [
      callbackRequest(`code=${CODE}`, valid),
      callbackRequest(`code=${CODE}&state=${STATE}`),
      callbackRequest(`code=${CODE}&state=${STATE}`, `${valid.slice(0, -3)}abc`),
      callbackRequest(
        `code=${CODE}&state=${STATE}`,
        await oauthCookie(
          { state: STATE, verifier: VERIFIER, locale: 'en', iat: nowS() },
          OTHER_SECRET,
        ),
      ),
      callbackRequest(`code=${CODE}&state=${STATE}`, await validOAuthCookie({ iat: nowS() - 601 })),
      callbackRequest(`code=${CODE}&state=${'x'.repeat(600)}`, valid),
    ];
    for (const request of cases) {
      const response = await callback(request);
      expect(location(response)).toMatch(/\/connect\?error=state$/);
      expect(setCookie(response, 'encore_session')).toBeUndefined();
    }
    expect(mock.calls).toHaveLength(0);
  });

  it('access_denied: volta com error=denied', async () => {
    const response = await callback(
      callbackRequest(
        `error=access_denied&state=${STATE}`,
        await validOAuthCookie({ locale: 'pt-BR' }),
      ),
    );
    expect(location(response)).toBe(`${APP_ORIGIN}/pt-BR/connect?error=denied`);
    expect(setCookie(response, 'encore_session')).toBeUndefined();
  });

  it('outro erro do OAuth ou code ausente: error=oauth', async () => {
    const other = await callback(
      callbackRequest(`error=server_error&state=${STATE}`, await validOAuthCookie()),
    );
    expect(location(other)).toBe(`${APP_ORIGIN}/en/connect?error=oauth`);
    const noCode = await callback(callbackRequest(`state=${STATE}`, await validOAuthCookie()));
    expect(location(noCode)).toBe(`${APP_ORIGIN}/en/connect?error=oauth`);
  });

  it('code recusado (invalid_grant) na troca: error=oauth, sem sessão', async () => {
    const mock = installSpotifyMock();
    mock.token(
      json({ error: 'invalid_grant', error_description: 'Invalid authorization code' }, 400),
    );
    const response = await callback(
      callbackRequest(`code=${CODE}&state=${STATE}`, await validOAuthCookie()),
    );
    expect(location(response)).toBe(`${APP_ORIGIN}/en/connect?error=oauth`);
    expect(setCookie(response, 'encore_session')).toBeUndefined();
  });

  it('Spotify fora do ar na troca, resposta inválida ou sem refresh_token: error=upstream', async () => {
    for (const reply of [
      json({}, 503),
      json({ error: 'invalid_client' }, 401),
      json({ access_token: 'x' }),
      json(tokenResponse({ refresh_token: undefined })),
    ]) {
      const mock = installSpotifyMock();
      mock.token(reply);
      const response = await callback(
        callbackRequest(`code=${CODE}&state=${STATE}`, await validOAuthCookie()),
      );
      expect(location(response)).toBe(`${APP_ORIGIN}/en/connect?error=upstream`);
      expect(setCookie(response, 'encore_session')).toBeUndefined();
    }
  });

  it('escopos a menos: error=scope', async () => {
    const mock = installSpotifyMock();
    mock.token(json(tokenResponse({ scope: 'user-top-read' })));
    const response = await callback(
      callbackRequest(`code=${CODE}&state=${STATE}`, await validOAuthCookie()),
    );
    expect(location(response)).toBe(`${APP_ORIGIN}/en/connect?error=scope`);
    expect(setCookie(response, 'encore_session')).toBeUndefined();
  });

  it('conta fora da allowlist (403 no /me): error=not_allowlisted, sem sessão', async () => {
    const mock = installSpotifyMock();
    mock.token(json(tokenResponse()));
    mock.api(
      '/me',
      new Response(
        'Check settings on developer.spotify.com/dashboard, the user may not be registered.',
        {
          status: 403,
        },
      ),
    );
    const response = await callback(
      callbackRequest(`code=${CODE}&state=${STATE}`, await validOAuthCookie()),
    );
    expect(location(response)).toBe(`${APP_ORIGIN}/en/connect?error=not_allowlisted`);
    expect(setCookie(response, 'encore_session')).toBeUndefined();
  });

  it('falha passageira no /me não impede o login', async () => {
    const mock = installSpotifyMock();
    mock.token(json(tokenResponse()));
    mock.api('/me', json({}, 500));
    const response = await callback(
      callbackRequest(`code=${CODE}&state=${STATE}`, await validOAuthCookie()),
    );
    expect(location(response)).toBe(`${APP_ORIGIN}/en/connect`);
    expect(setCookie(response, 'encore_session')).toBeDefined();
  });

  it('erro inesperado vira error=upstream', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('boom');
      }),
    );
    const response = await callback(
      callbackRequest(`code=${CODE}&state=${STATE}`, await validOAuthCookie()),
    );
    expect(location(response)).toBe(`${APP_ORIGIN}/en/connect?error=upstream`);
  });

  it('nunca loga a query do callback', async () => {
    const mock = installSpotifyMock();
    mock.token(json(tokenResponse()));
    mock.api('/me', json(rawMe));
    await callback(callbackRequest(`code=${CODE}&state=${STATE}`, await validOAuthCookie()));
    expect(logs.records).toContainEqual(
      expect.objectContaining({ event: 'auth.callback', outcome: 'success', status: 302 }),
    );
    // A checagem de vazamento de code/state/tokens roda no afterEach.
  });

  it('Conectar desabilitado: 404 tipado', async () => {
    useDisabledEnv();
    const response = await callback(callbackRequest(`code=${CODE}&state=${STATE}`));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: { code: 'CONNECT_DISABLED' } });
  });
});

describe('POST /api/auth/logout', () => {
  function logoutRequest(headers: Record<string, string>, query = ''): Request {
    return new Request(`${APP_ORIGIN}/api/auth/logout${query}`, { method: 'POST', headers });
  }

  it('mesma origem via fetch: 204, apaga os cookies e o cache HTTP', async () => {
    const response = await logout(
      logoutRequest({ origin: APP_ORIGIN, cookie: await sessionCookie() }),
    );
    expect(response.status).toBe(204);
    expect(setCookie(response, 'encore_session')).toMatch(/Max-Age=0/);
    expect(setCookie(response, 'encore_oauth')).toMatch(/Max-Age=0/);
    expect(response.headers.get('Clear-Site-Data')).toBe('"cache"');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('formulário (navegação) com Origin: null do no-referrer: 303 para /{locale}/connect', async () => {
    const response = await logout(
      logoutRequest(
        { origin: 'null', 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'navigate' },
        '?locale=en',
      ),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(`${APP_ORIGIN}/en/connect`);
    expect(setCookie(response, 'encore_session')).toMatch(/Max-Age=0/);
  });

  it('sem Origin ou de outra origem: 403 FORBIDDEN e o cookie fica', async () => {
    const cases: Record<string, string>[] = [
      {},
      { origin: 'https://evil.example' },
      { origin: 'null' },
      { origin: APP_ORIGIN, 'sec-fetch-site': 'cross-site' },
    ];
    for (const headers of cases) {
      const response = await logout(logoutRequest(headers));
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: { code: 'FORBIDDEN' } });
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    }
  });

  it('Conectar desabilitado: 404 tipado', async () => {
    useDisabledEnv();
    const response = await logout(logoutRequest({ origin: APP_ORIGIN }));
    expect(response.status).toBe(404);
  });
});
