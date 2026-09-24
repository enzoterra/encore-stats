import 'server-only';

import type { z } from 'zod';

import { errorResponse, toApiError } from './api-errors';
import {
  cookieName,
  readCookie,
  serializeClearedCookie,
  serializeCookie,
  SESSION_COOKIE,
} from './cookies';
import { getConnectConfig, type SpotifyConfig } from './env';
import { log } from './logger';
import {
  openSession,
  sealSession,
  sessionRemainingSeconds,
  type SessionData,
  type SessionSecrets,
} from './session';
import { SpotifyUserClient } from './spotify-client';
import type { Reduced } from './spotify-mappers';

/**
 * Esqueleto comum das rotas `GET /api/spotify/*` (03, "Convenções do BFF"), com negação por
 * padrão, nesta ordem:
 * 1. Conectar desabilitado → 404 `CONNECT_DISABLED`;
 * 2. sem cookie → 401; cookie adulterado, de outra chave ou expirado → 401 e o cookie é apagado;
 * 3. parâmetros validados com Zod (objeto estrito) → 400 `BAD_REQUEST`;
 * 4. chamada ao Spotify, redução e validação da resposta;
 * 5. `Cache-Control: private, max-age=N` + `Vary: Cookie` no sucesso, `private, no-store` nos
 *    erros; nunca `public` nem `s-maxage` (RNF-06);
 * 6. cookie resselado se houve refresh, ou apagado se a sessão morreu (`invalid_grant`).
 */

export const TTL = {
  me: 24 * 60 * 60,
  top: 6 * 60 * 60,
  recent: 60,
  saved: 12 * 60 * 60,
  artist: 7 * 24 * 60 * 60,
} as const;

export function cacheHeaders(maxAge: number): Record<string, string> {
  return { 'Cache-Control': `private, max-age=${maxAge}`, Vary: 'Cookie' };
}

export function secretsOf(config: {
  sessionSecret: string;
  sessionSecretPrevious: string | undefined;
}): SessionSecrets {
  return { current: config.sessionSecret, previous: config.sessionSecretPrevious };
}

export async function sessionSetCookie(
  spotify: SpotifyConfig,
  session: SessionData,
  secrets: SessionSecrets,
): Promise<string> {
  return serializeCookie(
    cookieName(SESSION_COOKIE, spotify.secureCookies),
    await sealSession(session, secrets),
    { maxAge: sessionRemainingSeconds(session), secure: spotify.secureCookies },
  );
}

export function clearSessionCookie(spotify: SpotifyConfig): string {
  return serializeClearedCookie(
    cookieName(SESSION_COOKIE, spotify.secureCookies),
    spotify.secureCookies,
  );
}

/** Lê e abre a sessão da requisição. `present` diz se havia cookie (para apagá-lo se inválido). */
export async function readSession(
  request: Request,
  spotify: SpotifyConfig,
  secrets: SessionSecrets,
): Promise<{ present: boolean; session: SessionData | null }> {
  const raw = readCookie(request, cookieName(SESSION_COOKIE, spotify.secureCookies));
  if (raw === undefined) return { present: false, session: null };
  return { present: true, session: await openSession(raw, secrets) };
}

export type RouteParamsInput = { query: Record<string, string>; path: Record<string, string> };

type SpotifyRouteOptions<P> = {
  /** Nome da rota para o log (sem valores: ex. `/api/spotify/artist/[id]`). */
  route: string;
  maxAge: number;
  params: z.ZodType<P, RouteParamsInput>;
  handler: (client: SpotifyUserClient, params: P) => Promise<Reduced<unknown>>;
};

function queryObject(url: URL): Record<string, string> | null {
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    if (key in query) return null; // parâmetro repetido: rejeita em vez de escolher um
    query[key] = value;
  }
  return query;
}

export function createSpotifyRoute<P>(options: SpotifyRouteOptions<P>) {
  return async (
    request: Request,
    context?: { params?: Promise<Record<string, string | string[]>> },
  ): Promise<Response> => {
    const started = performance.now();
    const finish = (response: Response, fields: Record<string, unknown> = {}) => {
      log(response.status >= 500 ? 'error' : 'info', 'bff.request', {
        route: options.route,
        method: 'GET',
        status: response.status,
        durationMs: performance.now() - started,
        ...fields,
      });
      return response;
    };

    const config = getConnectConfig();
    if (!config) return finish(errorResponse('CONNECT_DISABLED'), { code: 'CONNECT_DISABLED' });
    const { spotify } = config;
    const secrets = secretsOf(config);

    const { present, session } = await readSession(request, spotify, secrets);
    if (!session) {
      const headers = present ? { 'Set-Cookie': clearSessionCookie(spotify) } : undefined;
      return finish(errorResponse('UNAUTHENTICATED', { headers }), {
        code: 'UNAUTHENTICATED',
        reason: present ? 'invalid_cookie' : 'no_cookie',
        cleared: present,
      });
    }

    const query = queryObject(new URL(request.url));
    const rawPath = (await context?.params) ?? {};
    const path = Object.fromEntries(
      Object.entries(rawPath).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
    const params = query ? options.params.safeParse({ query, path }) : undefined;
    if (!params?.success) {
      return finish(errorResponse('BAD_REQUEST'), { code: 'BAD_REQUEST' });
    }

    const client = new SpotifyUserClient(spotify, session);
    try {
      const { data, dropped } = await options.handler(client, params.data);
      const headers = new Headers(cacheHeaders(options.maxAge));
      if (client.sessionChanged) {
        headers.append('Set-Cookie', await sessionSetCookie(spotify, client.session, secrets));
      }
      return finish(Response.json(data, { status: 200, headers }), {
        refreshed: client.sessionChanged,
        dropped,
      });
    } catch (caught) {
      const error = toApiError(caught);
      const headers = new Headers();
      if (error.clearSession) {
        headers.append('Set-Cookie', clearSessionCookie(spotify));
      } else if (client.sessionChanged) {
        // O refresh deu certo e a falha foi depois: guarda os tokens novos mesmo assim.
        headers.append('Set-Cookie', await sessionSetCookie(spotify, client.session, secrets));
      }
      return finish(errorResponse(error.code, { retryAfter: error.retryAfter, headers }), {
        code: error.code,
        reason: error.reason,
        upstreamStatus: error.upstreamStatus,
        retryAfter: error.retryAfter,
        refreshed: client.sessionChanged,
        cleared: error.clearSession,
      });
    }
  };
}
