import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import { ApiError } from './api-errors';
import type { SpotifyConfig } from './env';
import type { SessionData } from './session';
import { upstreamFetch, withRetry } from './upstream';

/**
 * OAuth 2.0 Authorization Code + PKCE (S256) com o Accounts do Spotify (08-seguranca.md).
 * O client secret só é usado aqui, no servidor, na troca do `code` e no refresh.
 */

/** Escopos mínimos (03): nada de playlists nem e-mail. */
export const SPOTIFY_SCOPES = [
  'user-top-read',
  'user-read-recently-played',
  'user-library-read',
] as const;

/** 32 bytes aleatórios em base64url (43 caracteres): `state` e `code_verifier`. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** `code_challenge` S256 do PKCE (RFC 7636). */
export function codeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Comparação em tempo constante. Os dois lados passam por SHA-256 antes, para que o tamanho
 * da entrada também não vaze pelo tempo.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}

export function buildAuthorizeUrl(config: SpotifyConfig, state: string, verifier: string): URL {
  const url = new URL(`${config.accountsBase}/authorize`);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    scope: SPOTIFY_SCOPES.join(' '),
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge(verifier),
  }).toString();
  return url;
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1).max(2048),
  token_type: z.string().regex(/^bearer$/i),
  expires_in: z
    .number()
    .int()
    .positive()
    .max(24 * 60 * 60),
  refresh_token: z.string().min(1).max(2048).optional(),
  scope: z.string().max(2048).optional(),
});
export type TokenResponse = z.infer<typeof tokenResponseSchema>;

const tokenErrorSchema = z.object({ error: z.string().max(128) });

async function tokenRequest(
  config: SpotifyConfig,
  params: Record<string, string>,
): Promise<TokenResponse> {
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const response = await withRetry(() =>
    upstreamFetch(new URL(`${config.accountsBase}/api/token`), {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams(params).toString(),
    }),
  );

  if (response.status >= 200 && response.status < 300) {
    const parsed = tokenResponseSchema.safeParse(response.body);
    if (!parsed.success) throw new ApiError('UPSTREAM', { reason: 'invalid_token_response' });
    return parsed.data;
  }

  const error = tokenErrorSchema.safeParse(response.body);
  if (response.status === 400 && error.success && error.data.error === 'invalid_grant') {
    throw new ApiError('UNAUTHENTICATED', {
      clearSession: true,
      upstreamStatus: 400,
      reason: 'invalid_grant',
    });
  }
  // invalid_client, redirect_uri divergente etc.: erro de configuração, não do usuário.
  throw new ApiError('UPSTREAM', { upstreamStatus: response.status, reason: 'token_error' });
}

/** Troca o `code` do callback pelos tokens. */
export async function exchangeCode(
  config: SpotifyConfig,
  code: string,
  verifier: string,
): Promise<TokenResponse & { refresh_token: string }> {
  const tokens = await tokenRequest(config, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  });
  if (!tokens.refresh_token) throw new ApiError('UPSTREAM', { reason: 'missing_refresh_token' });
  return { ...tokens, refresh_token: tokens.refresh_token };
}

/** `true` se o Spotify concedeu todos os escopos pedidos (o campo `scope` é opcional). */
export function hasRequiredScopes(scope: string | undefined): boolean {
  if (scope === undefined) return true;
  const granted = new Set(scope.split(/\s+/));
  return SPOTIFY_SCOPES.every((required) => granted.has(required));
}

/** Renova o access token. Se vier um novo `refresh_token`, ele substitui o anterior. */
export async function refreshSession(
  config: SpotifyConfig,
  session: SessionData,
  now = Math.floor(Date.now() / 1000),
): Promise<SessionData> {
  const tokens = await tokenRequest(config, {
    grant_type: 'refresh_token',
    refresh_token: session.rt,
  });
  return {
    at: tokens.access_token,
    rt: tokens.refresh_token ?? session.rt,
    exp: now + tokens.expires_in,
    authAt: session.authAt,
  };
}
