import { z } from 'zod';

import { ApiError, errorResponse } from '@/server/api-errors';
import {
  clearOAuthCookie,
  connectPageUrl,
  NO_STORE,
  resolveLocale,
  type ConnectError,
} from '@/server/auth-shared';
import { secretsOf, sessionSetCookie } from '@/server/bff';
import { cookieName, OAUTH_COOKIE, readCookie } from '@/server/cookies';
import { getConnectConfig } from '@/server/env';
import { log } from '@/server/logger';
import { openOAuth } from '@/server/session';
import { SpotifyUserClient } from '@/server/spotify-client';
import { constantTimeEqual, exchangeCode, hasRequiredScopes } from '@/server/spotify-auth';

export const dynamic = 'force-dynamic';

/** Query do callback. Campos extras são ignorados; nada daqui é logado. */
const callbackQuerySchema = z.object({
  code: z.string().min(1).max(2048).optional(),
  state: z.string().min(1).max(512).optional(),
  error: z.string().min(1).max(256).optional(),
});

/**
 * Retorno do Spotify: `GET /api/auth/callback?code&state` (ou `?error=access_denied&state`).
 *
 * 1. Abre o cookie temporário (10 min) e o apaga em qualquer desfecho.
 * 2. Compara o `state` em tempo constante (login CSRF).
 * 3. Troca o `code` (com o `code_verifier` e o client secret) pelos tokens.
 * 4. Confere os escopos e chama `/me`: 403 ali = conta fora da allowlist, e nenhuma sessão é
 *    criada.
 * 5. Grava a sessão e redireciona para `/{locale}/connect` (com `?error=` nos desfechos ruins).
 */
export async function GET(request: Request): Promise<Response> {
  const config = getConnectConfig();
  if (!config) return errorResponse('CONNECT_DISABLED');
  const { spotify } = config;
  const secrets = secretsOf(config);
  const started = performance.now();

  const rawOAuth = readCookie(request, cookieName(OAUTH_COOKIE, spotify.secureCookies));
  const oauth = rawOAuth ? await openOAuth(rawOAuth, secrets) : null;
  const locale = resolveLocale(oauth?.locale);

  const finish = (error: ConnectError | undefined, sessionCookie?: string) => {
    log(error ? 'warn' : 'info', 'auth.callback', {
      route: '/api/auth/callback',
      status: 302,
      outcome: error ?? 'success',
      durationMs: performance.now() - started,
    });
    const headers = new Headers({ Location: connectPageUrl(spotify, locale, error), ...NO_STORE });
    headers.append('Set-Cookie', clearOAuthCookie(spotify));
    if (sessionCookie) headers.append('Set-Cookie', sessionCookie);
    return new Response(null, { status: 302, headers });
  };

  const url = new URL(request.url);
  const query = callbackQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!oauth || !query.success || !query.data.state) return finish('state');
  if (!constantTimeEqual(query.data.state, oauth.state)) return finish('state');

  if (query.data.error) return finish(query.data.error === 'access_denied' ? 'denied' : 'oauth');
  if (!query.data.code) return finish('oauth');

  try {
    const tokens = await exchangeCode(spotify, query.data.code, oauth.verifier);
    if (!hasRequiredScopes(tokens.scope)) return finish('scope');

    const now = Math.floor(Date.now() / 1000);
    const session = {
      at: tokens.access_token,
      rt: tokens.refresh_token,
      exp: now + tokens.expires_in,
      authAt: now,
    };

    // O cliente pode renovar o token já aqui (validade curta); grava a sessão que ele terminou
    // usando, senão o cookie ficaria com um refresh token que o Spotify já trocou.
    const client = new SpotifyUserClient(spotify, session);
    try {
      await client.get('/me');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NOT_ALLOWLISTED') {
        return finish('not_allowlisted');
      }
      // Outras falhas do `/me` não impedem o login: as rotas tratam depois.
    }

    return finish(undefined, await sessionSetCookie(spotify, client.session, secrets));
  } catch (error) {
    const code = error instanceof ApiError ? error.code : 'INTERNAL';
    return finish(code === 'UNAUTHENTICATED' ? 'oauth' : 'upstream');
  }
}
