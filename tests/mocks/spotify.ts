import { vi } from 'vitest';

import { resetServerEnvCache } from '@/server/env';
import { setLogSink, type LogRecord } from '@/server/logger';
import { sealOAuth, sealSession, type OAuthData, type SessionData } from '@/server/session';
import { upstreamDeps } from '@/server/upstream';

/**
 * Mocks da API do Spotify para os testes de integração do BFF (07-estrategia-de-testes.md).
 * Substitui o `fetch` global: cada rota (`METHOD URL`) responde com uma fila de respostas (a
 * última se repete). Requisição não mockada falha o teste, para nenhuma chamada passar batida.
 */

export const SECRET = 'S'.repeat(43);
export const PREVIOUS_SECRET = 'P'.repeat(43);
export const OTHER_SECRET = 'O'.repeat(43);
export const APP_ORIGIN = 'http://127.0.0.1:3000';
export const API = 'https://api.spotify.com/v1';
export const ACCOUNTS = 'https://accounts.spotify.com';

type EnvOverrides = Record<string, string | undefined>;

/** Liga o modo Conectar no ambiente do teste (HTTP de loopback, como no dev local). */
export function useConnectEnv(overrides: EnvOverrides = {}): void {
  const env: EnvOverrides = {
    SPOTIFY_CLIENT_ID: 'test-client-id',
    SPOTIFY_CLIENT_SECRET: 'test-client-secret',
    SPOTIFY_REDIRECT_URI: `${APP_ORIGIN}/api/auth/callback`,
    SESSION_SECRET: SECRET,
    SESSION_SECRET_PREVIOUS: '',
    NEXT_PUBLIC_SITE_URL: APP_ORIGIN,
    SPOTIFY_API_BASE: '',
    SPOTIFY_ACCOUNTS_BASE: '',
    VERCEL_ENV: undefined,
    ...overrides,
  };
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  resetServerEnvCache();
}

/** Desliga o Conectar (sem credenciais). */
export function useDisabledEnv(): void {
  useConnectEnv({
    SPOTIFY_CLIENT_ID: '',
    SPOTIFY_CLIENT_SECRET: '',
    SPOTIFY_REDIRECT_URI: '',
    SESSION_SECRET: '',
  });
}

export type MockRequest = {
  url: URL;
  method: string;
  headers: Headers;
  body: string;
  signal: AbortSignal | undefined;
};
export type MockReply = Response | ((request: MockRequest) => Response | Promise<Response>);

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** Resposta que só termina quando o `fetch` é abortado (para testar o timeout). */
export const hang = ({ signal }: MockRequest): Promise<Response> =>
  new Promise<Response>((_, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });

export function installSpotifyMock() {
  const routes = new Map<string, MockReply[]>();
  const calls: MockRequest[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init.method ?? 'GET';
    const request: MockRequest = {
      url,
      method,
      headers: new Headers(init.headers),
      body: typeof init.body === 'string' ? init.body : '',
      signal: init.signal ?? undefined,
    };
    calls.push(request);
    const key = `${method} ${url.origin}${url.pathname}`;
    const queue = routes.get(key);
    if (!queue || queue.length === 0) throw new Error(`fetch não mockado: ${key}`);
    const reply = (queue.length > 1 ? queue.shift() : queue[0]) as MockReply;
    return typeof reply === 'function' ? reply(request) : reply.clone();
  });
  vi.stubGlobal('fetch', fetchMock);

  const on = (method: string, url: string, ...replies: MockReply[]) => {
    routes.set(`${method} ${url}`, replies);
  };

  return {
    calls,
    fetchMock,
    /** Mocka `GET {API}{path}`. */
    api: (path: string, ...replies: MockReply[]) => on('GET', `${API}${path}`, ...replies),
    /** Mocka `POST {ACCOUNTS}/api/token`. */
    token: (...replies: MockReply[]) => on('POST', `${ACCOUNTS}/api/token`, ...replies),
    callsTo: (path: string) => calls.filter((call) => call.url.pathname === path),
  };
}

/** Sem espera real nos retries e jitter zero; devolve o espião das esperas. */
export function stubRetryTiming() {
  const sleep = vi.fn(async (ms: number) => {
    void ms;
  });
  const original = { ...upstreamDeps };
  upstreamDeps.sleep = sleep;
  upstreamDeps.random = () => 0;
  return {
    sleep,
    restore: () => {
      Object.assign(upstreamDeps, original);
    },
  };
}

/** Captura os logs do BFF (e silencia o console). */
export function captureLogs(): { records: LogRecord[]; restore: () => void } {
  const records: LogRecord[] = [];
  setLogSink((record) => records.push(record));
  return { records, restore: () => setLogSink(undefined) };
}

export const nowS = () => Math.floor(Date.now() / 1000);

export function sessionData(overrides: Partial<SessionData> = {}): SessionData {
  return {
    at: 'access-token-original',
    rt: 'refresh-token-original',
    exp: nowS() + 3600,
    authAt: nowS() - 60,
    ...overrides,
  };
}

/** Cabeçalho `Cookie` com uma sessão selada (nome sem prefixo: ambiente HTTP de loopback). */
export async function sessionCookie(
  data: SessionData = sessionData(),
  secret = SECRET,
  name = 'encore_session',
): Promise<string> {
  return `${name}=${await sealSession(data, { current: secret })}`;
}

export async function oauthCookie(
  data: OAuthData,
  secret = SECRET,
  name = 'encore_oauth',
): Promise<string> {
  return `${name}=${await sealOAuth(data, { current: secret })}`;
}

/** Valor de um `Set-Cookie` pelo nome (ou `undefined`). */
export function setCookie(response: Response, name: string): string | undefined {
  return response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
}

export function cookieValue(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const value = header.slice(header.indexOf('=') + 1).split(';')[0];
  return value === '' ? undefined : value;
}

// ---------------------------------------------------------------------------------------------
// Respostas "cruas" do Spotify (formato da Web API, com campos que o BFF deve descartar).

/** ID base62 de 22 caracteres, determinístico. */
export function spotifyId(prefix: string, n: number): string {
  return `${prefix}${n}`.padEnd(22, 'x').slice(0, 22);
}

const images = (seed: string) => [
  { url: `https://i.scdn.co/image/${seed}640`, width: 640, height: 640 },
  { url: `https://i.scdn.co/image/${seed}300`, width: 300, height: 300 },
  { url: `https://i.scdn.co/image/${seed}64`, width: 64, height: 64 },
];

export function rawArtist(n: number) {
  const id = spotifyId('artist', n);
  return {
    id,
    name: `Artista ${n}`,
    genres: ['indie pop', 'mpb'],
    images: images(`a${n}`),
    popularity: 70,
    followers: { href: null, total: 1234 },
    external_urls: { spotify: `https://open.spotify.com/artist/${id}` },
    href: `https://api.spotify.com/v1/artists/${id}`,
    type: 'artist',
    uri: `spotify:artist:${id}`,
  };
}

export function rawTrack(n: number) {
  const id = spotifyId('track', n);
  return {
    id,
    name: `Música ${n}`,
    artists: [{ id: spotifyId('artist', n), name: `Artista ${n}`, type: 'artist' }],
    album: { id: spotifyId('album', n), name: `Álbum ${n}`, images: images(`al${n}`) },
    duration_ms: 200_000,
    explicit: false,
    popularity: 55,
    preview_url: null,
    external_urls: { spotify: `https://open.spotify.com/track/${id}` },
    is_local: false,
    type: 'track',
    uri: `spotify:track:${id}`,
  };
}

export const rawMe = {
  id: 'usuario-teste',
  display_name: 'Pessoa Teste',
  images: [{ url: 'https://i.scdn.co/image/me300', width: 300, height: 300 }],
  country: 'BR',
  email: 'pessoa@example.com',
  product: 'premium',
  followers: { total: 3 },
};

export function rawTop(kind: 'artists' | 'tracks', count = 3) {
  const items = Array.from({ length: count }, (_, i) =>
    kind === 'artists' ? rawArtist(i + 1) : rawTrack(i + 1),
  );
  return { items, total: 50, limit: 50, offset: 0, href: '', next: null, previous: null };
}

export function rawRecent(count = 2) {
  return {
    items: Array.from({ length: count }, (_, i) => ({
      track: rawTrack(i + 1),
      played_at: `2026-09-2${i}T10:00:00.000Z`,
      context: null,
    })),
    next: null,
    cursors: { after: '1', before: '0' },
    limit: 50,
  };
}

export function rawSaved(offset = 0, count = 2, total = 120) {
  return {
    href: '',
    limit: 50,
    next: null,
    offset,
    previous: null,
    total,
    items: Array.from({ length: count }, (_, i) => ({
      added_at: `2025-01-0${i + 1}T12:00:00Z`,
      track: rawTrack(offset + i + 1),
    })),
  };
}

export function tokenResponse(overrides: Record<string, unknown> = {}) {
  return {
    access_token: 'access-token-new',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'refresh-token-new',
    scope: 'user-top-read user-read-recently-played user-library-read',
    ...overrides,
  };
}
