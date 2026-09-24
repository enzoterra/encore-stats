import { demoArtist, demoSavedPage, type DemoApi } from '@/domain/demo';

import { BffError, type ConnectSource, type FetchOptions } from './bff-client';
import { sleep } from './limiter';

/**
 * Fonte do modo Demo: as respostas fictícias de `generateDemo().api`, no mesmo formato do BFF,
 * sem nenhuma requisição de rede. `pageDelayMs` simula a latência de cada página de curtidas.
 */
export function createDemoSource(api: DemoApi, { pageDelayMs = 90 } = {}): ConnectSource {
  const now = async <T>(value: T, options?: FetchOptions): Promise<T> => {
    if (options?.signal?.aborted) throw options.signal.reason;
    return value;
  };
  return {
    kind: 'demo',
    me: (options) => now(api.me, options),
    topArtists: (range, options) => now(api.top.artists[range], options),
    topTracks: (range, options) => now(api.top.tracks[range], options),
    recent: (options) => now(api.recent, options),
    saved: async (offset, limit, options) => {
      if (limit > 1 && pageDelayMs > 0) await sleep(pageDelayMs, options?.signal);
      return now(demoSavedPage(api, offset, limit), options);
    },
    artist: async (id, options) => {
      const artist = demoArtist(api, id);
      if (!artist) throw new BffError('NOT_FOUND', 404);
      return now(artist, options);
    },
  };
}
