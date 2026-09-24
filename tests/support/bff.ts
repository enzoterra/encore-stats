import { vi } from 'vitest';

import type { Artist, Recent, SavedPage, Track } from '@/domain/spotify-types';

/** ID base62 de 22 caracteres a partir de um prefixo curto (o schema exige o formato). */
export const sid = (prefix: string, n: number) => `${prefix}${n}`.padEnd(22, 'x').slice(0, 22);

export function makeArtist(
  n: number,
  genres: string[] = ['indie', n % 2 ? 'rock' : 'pop'],
): Artist {
  return {
    id: sid('artist', n),
    name: `Artista ${n}`,
    genres,
    image: `https://i.scdn.co/image/a${n}`,
    url: `https://open.spotify.com/artist/${sid('artist', n)}`,
  };
}

export function makeTrack(n: number, artist = (n % 5) + 1): Track {
  return {
    id: sid('track', n),
    name: `Faixa ${n}`,
    artists: [{ id: sid('artist', artist), name: `Artista ${artist}` }],
    album: { id: sid('album', n), name: `Disco ${n}`, image: `https://i.scdn.co/image/al${n}` },
    url: `https://open.spotify.com/track/${sid('track', n)}`,
  };
}

const ids = (list: number[]) => list;

export const TOPS = {
  short_term: ids([6, 1, 2, 7, 3, 4, 5]),
  medium_term: ids([1, 2, 3, 4, 5, 8, 9, 10]),
  long_term: ids([1, 2, 3, 4, 5]),
};

export function savedPage(offset: number, total: number, limit = 50): SavedPage {
  const count = Math.max(0, Math.min(limit, total - offset));
  return {
    total,
    offset,
    items: Array.from({ length: count }, (_, i) => {
      const n = offset + i;
      // Artista 1 em metade das faixas: vencedor claro.
      const artist = n % 2 === 0 ? 1 : (n % 4) + 2;
      return {
        addedAt: new Date(Date.UTC(2026, 0, 1) - n * 86_400_000).toISOString(),
        track: {
          id: sid('saved', n),
          artists: [{ id: sid('artist', artist), name: `Artista ${artist}` }],
        },
      };
    }),
  };
}

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

/** Respostas padrão do BFF (sucesso); cada teste troca só o que precisa. */
export function defaultHandlers(savedTotal = 120): Record<string, Handler> {
  return {
    me: () => json(200, { id: 'user-1', displayName: 'Pessoa Teste', image: undefined }),
    top: (url) => {
      const type = url.searchParams.get('type');
      const range = url.searchParams.get('range') as keyof typeof TOPS;
      const list = TOPS[range] ?? [];
      return json(200, {
        items: type === 'artists' ? list.map((n) => makeArtist(n)) : list.map((n) => makeTrack(n)),
      });
    },
    recent: () =>
      json(200, {
        items: [1, 2, 3].map((n): Recent => ({
          playedAt: new Date(Date.now() - n * 600_000).toISOString(),
          track: makeTrack(n),
        })),
      }),
    saved: (url) =>
      json(
        200,
        savedPage(
          Number(url.searchParams.get('offset') ?? 0),
          savedTotal,
          Number(url.searchParams.get('limit') ?? 50),
        ),
      ),
    artist: (url) => json(200, makeArtist(Number(/artist(\d+)/.exec(url.pathname)?.[1] ?? 1))),
    logout: () => new Response(null, { status: 204 }),
  };
}

/** Troca o `fetch` global por um roteador das rotas do BFF e registra as chamadas. */
export function mockBff(overrides: Partial<Record<string, Handler>> = {}, savedTotal = 120) {
  const handlers = { ...defaultHandlers(savedTotal), ...overrides };
  const calls: { path: string; method: string; cache?: RequestCache }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://127.0.0.1:3000');
    calls.push({
      path: url.pathname + url.search,
      method: init?.method ?? 'GET',
      cache: init?.cache,
    });
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const route = url.pathname.startsWith('/api/auth/logout')
      ? 'logout'
      : url.pathname.startsWith('/api/spotify/artist/')
        ? 'artist'
        : url.pathname.replace('/api/spotify/', '');
    const handler = handlers[route];
    if (!handler) return json(404, { error: { code: 'NOT_FOUND' } });
    return handler(url, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}
