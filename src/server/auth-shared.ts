import 'server-only';

import { routing, type Locale } from '@/i18n/routing';

import { cookieName, OAUTH_COOKIE, serializeClearedCookie } from './cookies';
import type { SpotifyConfig } from './env';

/** Destino do fluxo de login na UI (a Sprint 5 implementa a tela). */
export const CONNECT_PAGE = 'connect';

/** Códigos de `?error=` que a página `/{locale}/connect` traduz. */
export const CONNECT_ERRORS = [
  'denied',
  'state',
  'oauth',
  'scope',
  'not_allowlisted',
  'upstream',
] as const;
export type ConnectError = (typeof CONNECT_ERRORS)[number];

export function resolveLocale(value: string | null | undefined): Locale {
  return routing.locales.find((locale) => locale === value) ?? routing.defaultLocale;
}

/** URL absoluta de `/{locale}/connect`, sempre na origem configurada (sem open redirect). */
export function connectPageUrl(
  spotify: SpotifyConfig,
  locale: Locale,
  error?: ConnectError,
): string {
  const url = new URL(`/${locale}/${CONNECT_PAGE}`, spotify.appOrigin);
  if (error) url.searchParams.set('error', error);
  return url.toString();
}

export function clearOAuthCookie(spotify: SpotifyConfig): string {
  return serializeClearedCookie(
    cookieName(OAUTH_COOKIE, spotify.secureCookies),
    spotify.secureCookies,
  );
}

export const NO_STORE = { 'Cache-Control': 'no-store' } as const;
