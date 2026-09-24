import { errorResponse } from '@/server/api-errors';
import { NO_STORE, resolveLocale } from '@/server/auth-shared';
import { secretsOf } from '@/server/bff';
import { cookieName, OAUTH_COOKIE, serializeCookie } from '@/server/cookies';
import { getConnectConfig } from '@/server/env';
import { log } from '@/server/logger';
import { OAUTH_MAX_AGE_S, sealOAuth } from '@/server/session';
import { buildAuthorizeUrl, randomToken } from '@/server/spotify-auth';

export const dynamic = 'force-dynamic';

/**
 * Início do login: `GET /api/auth/login?locale=pt-BR|en`.
 * Gera `state` e `code_verifier` (32 bytes cada), guarda os dois selados num cookie de 10 min
 * e redireciona (302) para o `/authorize` do Spotify com PKCE S256.
 */
export async function GET(request: Request): Promise<Response> {
  const config = getConnectConfig();
  if (!config) return errorResponse('CONNECT_DISABLED');
  const { spotify } = config;
  const url = new URL(request.url);
  const locale = resolveLocale(url.searchParams.get('locale'));

  // Os cookies vivem na origem da redirect URI: se o usuário abriu outro host (ex.: `localhost`
  // em vez de `127.0.0.1`), recomeça lá. O destino vem da configuração, nunca da requisição.
  const appHost = new URL(spotify.appOrigin).host;
  const requestHost = request.headers.get('host') ?? url.host;
  if (requestHost !== appHost) {
    const canonical = new URL('/api/auth/login', spotify.appOrigin);
    canonical.searchParams.set('locale', locale);
    return new Response(null, {
      status: 307,
      headers: { Location: canonical.toString(), ...NO_STORE },
    });
  }

  const state = randomToken();
  const verifier = randomToken();
  const sealed = await sealOAuth(
    { state, verifier, locale, iat: Math.floor(Date.now() / 1000) },
    secretsOf(config),
  );

  log('info', 'auth.login', { route: '/api/auth/login', status: 302 });
  const headers = new Headers({
    Location: buildAuthorizeUrl(spotify, state, verifier).toString(),
    ...NO_STORE,
  });
  headers.append(
    'Set-Cookie',
    serializeCookie(cookieName(OAUTH_COOKIE, spotify.secureCookies), sealed, {
      maxAge: OAUTH_MAX_AGE_S,
      secure: spotify.secureCookies,
    }),
  );
  return new Response(null, { status: 302, headers });
}
