import { z } from 'zod';

import '../zod-config';

import { compareLikedCounts } from '../api-stats/liked';
import { MAX_INVALID_RATIO, MAX_NAME_LENGTH } from './constants';
import { displayName, fail } from './errors';

/**
 * Uma curtida (`tracks[]`) do `YourLibrary.json` do export "Dados da conta":
 * `{ "artist", "album", "track", "uri" }` (o `uri` só existe nos exports recentes).
 *
 * Só os campos usados estão aqui; `z.object` descarta (strip) o resto. `artist` é o único dado
 * que sobrevive à leitura; `album`, `track` e `uri` servem só para não contar duas vezes a mesma
 * música e são descartados em seguida (minimização de dados, 08-seguranca.md).
 */
export const libraryTrackSchema = z.object({
  artist: z.string().max(MAX_NAME_LENGTH).nullish(),
  album: z.string().max(MAX_NAME_LENGTH).nullish(),
  track: z.string().max(MAX_NAME_LENGTH).nullish(),
  uri: z.string().max(256).nullish(),
});

export type LibraryTrack = z.infer<typeof libraryTrackSchema>;

/**
 * Chaves de topo de um `YourLibrary.json` (conferidas em exports de 2024–2026). Só `tracks` é
 * lida; as demais (álbuns, artistas seguidos, podcasts, episódios, banidos…) ficam fora do
 * schema e são descartadas logo depois do `JSON.parse`.
 */
const LIBRARY_KEYS = [
  'tracks',
  'albums',
  'artists',
  'shows',
  'episodes',
  'bannedTracks',
  'bannedArtists',
  'other',
] as const;

/** Raiz: objeto com `tracks` (array de itens ainda não validados). */
const libraryRootSchema = z.object({ tracks: z.array(z.unknown()).optional() });

export type LikedArtist = { name: string; count: number };

/**
 * Curtidas por artista do upload (quadro "Curtidas por artista").
 *
 * - `total`: músicas curtidas distintas que têm artista;
 * - `artists`: todos os artistas com ao menos uma curtida, por `count` decrescente e, no empate,
 *   por nome (`localeCompare` em inglês, depois ordem de código), como no Conectar.
 *
 * **Não depende do período:** o `YourLibrary.json` não traz a data da curtida; o quadro mostra
 * sempre a biblioteca inteira, no momento em que o export foi gerado.
 */
export type LikedByArtist = { total: number; artists: LikedArtist[] };

export type LibraryParseCounts = {
  /** Itens em `tracks`. */
  total: number;
  /** Itens que falharam na validação do schema. */
  invalid: number;
  /** Itens válidos sem nome de artista (não entram na contagem). */
  withoutArtist: number;
};

const decoder = new TextDecoder();

/**
 * Nome do artista normalizado para agrupar: Unicode NFC, espaços colapsados e aparados.
 *
 * Não há ID de artista no `YourLibrary.json`. Por isso o agrupamento é pelo nome **exato**
 * depois dessa normalização: não ignora caixa, acentos nem pontuação, para não juntar artistas
 * diferentes ("MØ" e "Mo", "Ñu" e "Nu"). Dois artistas com o mesmo nome exato (homônimos) caem
 * no mesmo grupo: é a mesma regra do top de artistas do histórico, que também agrupa por nome.
 */
export function normalizeArtistName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Ordem do quadro: contagem, nome e, por fim, ordem de código (total e determinística). */
function compareArtists(a: LikedArtist, b: LikedArtist): number {
  return compareLikedCounts(a, b) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}

/**
 * Agrega curtidas por artista (função pura). Cada item conta uma vez para o artista, pelo nome
 * normalizado (`normalizeArtistName`); itens sem artista são ignorados. Quem chama entrega itens
 * já sem repetição (o leitor deduplica por `uri`).
 */
export function likedByArtist(tracks: Iterable<{ artist: string }>): LikedByArtist {
  const counts = new Map<string, LikedArtist>();
  let total = 0;
  for (const { artist } of tracks) {
    const name = normalizeArtistName(artist);
    if (name === '') continue;
    total++;
    const entry = counts.get(name);
    if (entry) entry.count++;
    else counts.set(name, { name, count: 1 });
  }
  return { total, artists: [...counts.values()].sort(compareArtists) };
}

export type LikedSummary = {
  /** Músicas curtidas contadas. */
  total: number;
  /** Artistas distintos com curtidas. */
  artistCount: number;
  /** Os `limit` primeiros; `top[0]` é o artista com mais curtidas. */
  top: LikedArtist[];
};

/** Resumo para o quadro da UI (função pura). */
export function topLikedArtists(library: LikedByArtist, limit = 10): LikedSummary {
  return {
    total: library.total,
    artistCount: library.artists.length,
    top: library.artists.slice(0, Math.max(0, limit)).map((artist) => ({ ...artist })),
  };
}

/** Chave de repetição: o `uri` do Spotify, ou artista + álbum + faixa nos exports sem `uri`. */
function trackKey(item: LibraryTrack, artist: string): string {
  if (item.uri && /^spotify:(?:track|local):/.test(item.uri)) return item.uri;
  return `${artist}\u0000${item.album ?? ''}\u0000${item.track ?? ''}`;
}

/**
 * Lê um `YourLibrary.json` e entrega ao `onTrack` só `{ artist, key }` de cada curtida
 * (`key` = chave de repetição). Regras, iguais às do histórico:
 * - JSON malformado → `INVALID_JSON`;
 * - raiz que não é objeto do `YourLibrary`, `tracks` que não é array, ou `tracks` em que nenhum
 *   item é válido → `UNEXPECTED_FORMAT`;
 * - mais de 5% de itens inválidos → `INVALID_RECORDS`.
 * Todos com `source: 'library'`. O resto do objeto (álbuns, episódios, banidos…) não é validado
 * nem guardado: some com o objeto do `JSON.parse` ao fim da função.
 */
export function parseLibraryJson(
  entry: string,
  bytes: Uint8Array,
  onTrack: (track: { artist: string; key: string }) => void,
): LibraryParseCounts {
  const shown = displayName(entry);
  let data: unknown;
  try {
    data = JSON.parse(decoder.decode(bytes));
  } catch {
    fail({ code: 'INVALID_JSON', entry: shown, source: 'library' });
  }
  const isLibraryObject =
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data) &&
    LIBRARY_KEYS.some((key) => key in data);
  const root = isLibraryObject ? libraryRootSchema.safeParse(data) : null;
  if (!root?.success) fail({ code: 'UNEXPECTED_FORMAT', entry: shown, source: 'library' });

  const items = root.data.tracks ?? [];
  const counts: LibraryParseCounts = { total: items.length, invalid: 0, withoutArtist: 0 };
  for (const item of items) {
    const parsed = libraryTrackSchema.safeParse(item);
    if (!parsed.success) {
      counts.invalid++;
      continue;
    }
    const artist = normalizeArtistName(parsed.data.artist ?? '');
    if (artist === '') {
      counts.withoutArtist++;
      continue;
    }
    onTrack({ artist, key: trackKey(parsed.data, artist) });
  }

  if (counts.total > 0 && counts.invalid === counts.total) {
    fail({ code: 'UNEXPECTED_FORMAT', entry: shown, source: 'library' });
  }
  if (counts.invalid > counts.total * MAX_INVALID_RATIO) {
    fail({
      code: 'INVALID_RECORDS',
      entry: shown,
      invalid: counts.invalid,
      total: counts.total,
      source: 'library',
    });
  }
  return counts;
}

/**
 * Junta as curtidas de um ou mais `YourLibrary.json` (ex.: o zip e o JSON solto do mesmo export)
 * sem contar a mesma música duas vezes. Guarda só o nome do artista de cada curtida e as chaves
 * de repetição; `build()` devolve a agregação e libera tudo.
 */
export class LibraryAccumulator {
  private seen = new Set<string>();
  private artists: { artist: string }[] = [];
  private files = 0;
  private counted = 0;

  /** Curtidas distintas encontradas até agora (vale também depois de `build()`). */
  get size(): number {
    return this.counted;
  }

  /** `YourLibrary.json` lidos. */
  get fileCount(): number {
    return this.files;
  }

  addFile(entry: string, bytes: Uint8Array): LibraryParseCounts {
    const counts = parseLibraryJson(entry, bytes, ({ artist, key }) => {
      if (this.seen.has(key)) return;
      this.seen.add(key);
      this.artists.push({ artist });
      this.counted++;
    });
    this.files++;
    return counts;
  }

  /** Agrega e libera os nomes e as chaves guardados. */
  build(): LikedByArtist {
    const result = likedByArtist(this.artists);
    this.seen = new Set();
    this.artists = [];
    return result;
  }
}
