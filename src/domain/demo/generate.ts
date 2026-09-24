import { DatasetBuilder, FLAG_VALID, type Dataset } from '../history/dataset';
import { PLATFORMS, type PlatformCode } from '../history/platform';
import type { Artist, Me, Recent, SavedItem, SavedPage, TimeRange, Track } from '../spotify-types';
import { computeStats, type Period } from '../stats';
import { dayToIsoDate, SECONDS_PER_DAY } from '../time';
import { DEMO_ARTISTS, demoAlbumTitle, demoTitle, type DemoLang } from './catalog';
import { createRandom, cumulate, type Random } from './prng';

/** Seed fixa do modo Demo: a mesma em todo navegador e nos testes. */
export const DEMO_SEED = 20_260_924;
/** Primeiro dia (UTC) do histórico fictício; ~3 anos. */
export const DEMO_START_DAY = Date.UTC(2023, 6, 1) / 1000 / SECONDS_PER_DAY;
export const DEMO_DAYS = 1096;
/** Fuso do "usuário" fictício (UTC−3, sem horário de verão desde 2019). */
export const DEMO_TIME_ZONE = 'America/Sao_Paulo';
const DEMO_UTC_OFFSET = -3 * 3600;

/** Tamanho dos tops fictícios da API (o BFF real devolve até 50). */
const DEMO_TOP_LIMIT = 25;

/** Link genérico: o Demo não tem entidades reais no Spotify; a UI esconde "Abrir no Spotify". */
const DEMO_URL = 'https://open.spotify.com/';

export type DemoOptions = { seed?: number; days?: number };

export type DemoApi = {
  /** Sempre `true`: a UI usa para não exibir atribuição/links do Spotify. */
  demo: true;
  me: Me;
  top: { artists: Record<TimeRange, Artist[]>; tracks: Record<TimeRange, Track[]> };
  /** Últimas 50, da mais recente para a mais antiga. */
  recent: Recent[];
  /** Curtidas, da mais recente para a mais antiga (como `/me/tracks`). */
  saved: SavedItem[];
  /** Todos os artistas do catálogo, para o equivalente a `/artists/{id}`. */
  artists: Artist[];
};

export type DemoData = { dataset: Dataset; api: DemoApi; timeZone: string };

type CatalogTrack = {
  id: string;
  name: string;
  artist: number;
  albumId: string;
  album: string;
  uri: string;
  durationMs: number;
  skipProne: boolean;
};

type CatalogArtist = {
  id: string;
  name: string;
  lang: DemoLang;
  genres: readonly string[];
  base: number;
  center: number;
  width: number;
  evergreen: boolean;
  /** Dia (relativo ao início) em que o artista "surge" para o usuário; antes disso, peso 0. */
  debut: number;
  tracks: number[];
  trackWeights: Float64Array;
};

/** Pesos por hora local (0–23): madrugada baixa, picos no trajeto, almoço e noite. */
const HOUR_WEIGHTS = cumulate([
  1, 0.6, 0.3, 0.2, 0.2, 0.4, 1.5, 4, 6, 4, 3, 3, 4.5, 4, 3, 3, 3.5, 5, 6, 5.5, 6, 6, 4.5, 2.5,
]);
const WEEKDAY_FACTOR = [0.95, 0.95, 1, 1, 1.1, 1.35, 1.2]; // seg … dom

function platformWeights(hour: number): Float64Array {
  // android, ios, desktop, web, tv, other
  if (hour >= 9 && hour < 18) return cumulate([3, 0.4, 4, 1.5, 0.1, 0.2]);
  if (hour >= 19 && hour < 23) return cumulate([4, 0.5, 1.5, 0.5, 1.5, 0.5]);
  return cumulate([6, 0.6, 0.8, 0.3, 0.2, 0.3]);
}

function buildCatalog(
  random: Random,
  days: number,
): { artists: CatalogArtist[]; tracks: CatalogTrack[] } {
  const tracks: CatalogTrack[] = [];
  const order = random.permutation(DEMO_ARTISTS.length);
  const popularity = new Map(order.map((artist, rank) => [artist, 1 / (rank + 1) ** 0.75]));
  // Duas descobertas recentes (fora do topo histórico) garantem "entrou" nas tendências.
  const discoveries = new Set(order.slice(-6, -4));
  const artists = DEMO_ARTISTS.map((spec, index): CatalogArtist => {
    const artist: CatalogArtist = {
      id: random.id(),
      name: spec.name,
      lang: spec.lang,
      genres: spec.genres,
      base: popularity.get(index)!,
      center: random.range(-200, days + 200),
      width: random.range(120, 500),
      evergreen: random.chance(0.25),
      debut: 0,
      tracks: [],
      trackWeights: new Float64Array(0),
    };
    if (discoveries.has(index)) {
      Object.assign(artist, { debut: days - 45, center: days, width: 90, evergreen: false });
      artist.base *= 6;
    }
    const titles = new Set<string>();
    const albums = random.range(2, 4);
    for (let a = 0; a < albums; a++) {
      const albumId = random.id();
      const album = demoAlbumTitle(spec.lang, random.pick);
      const size = random.range(5, 11);
      for (let t = 0; t < size; t++) {
        let name = demoTitle(spec.lang, random.pick);
        if (titles.has(name)) name = `${name} (${spec.lang === 'pt' ? 'ao vivo' : 'live'})`;
        if (titles.has(name)) name = `${name} ${a + 1}.${t + 1}`;
        titles.add(name);
        artist.tracks.push(tracks.length);
        const id = random.id();
        tracks.push({
          id,
          name,
          artist: index,
          albumId,
          album,
          uri: `spotify:track:${id}`,
          durationMs: random.range(140, 330) * 1000,
          skipProne: random.chance(0.06),
        });
      }
    }
    const weights = artist.tracks.map(() => 0);
    random
      .permutation(weights.length)
      .forEach((trackIndex, rank) => (weights[trackIndex] = 1 / (rank + 1) ** 0.7));
    artist.trackWeights = cumulate(weights);
    return artist;
  });
  return { artists, tracks };
}

function artistWeightsForDay(artists: readonly CatalogArtist[], day: number): Float64Array {
  return cumulate(
    artists.map((a) => {
      if (day < a.debut) return 0;
      if (a.evergreen) return a.base;
      const z = (day - a.center) / a.width;
      return a.base * (0.12 + Math.exp(-z * z));
    }),
  );
}

/** Simula ~3 anos de escuta e devolve o Dataset (mesmo formato do upload). */
function simulate(
  random: Random,
  artists: readonly CatalogArtist[],
  tracks: readonly CatalogTrack[],
  days: number,
): Dataset {
  const builder = new DatasetBuilder();
  let weights = artistWeightsForDay(artists, 0);
  for (let d = 0; d < days; d++) {
    if (d % 7 === 0) weights = artistWeightsForDay(artists, d);
    if (random.chance(0.03)) continue; // dia sem música (viagem, doença…)
    const absoluteDay = DEMO_START_DAY + d;
    const weekday = (((absoluteDay + 3) % 7) + 7) % 7;
    const growth = 0.85 + (0.3 * d) / days;
    const target = Math.round(
      30 * WEEKDAY_FACTOR[weekday]! * growth * (0.45 + random.next() * 1.1),
    );
    const sessions = random.range(1, 3);
    let produced = 0;
    for (let s = 0; s < sessions && produced < target; s++) {
      const hour = random.weighted(HOUR_WEIGHTS);
      const platform: PlatformCode = PLATFORMS[random.weighted(platformWeights(hour))]!;
      const shuffle = random.chance(0.45);
      const length =
        s === sessions - 1 ? target - produced : random.range(3, Math.max(3, target - produced));
      // Horário local → UTC com deslocamento fixo do fuso demo.
      let clock = absoluteDay * SECONDS_PER_DAY + hour * 3600 + random.int(3600) - DEMO_UTC_OFFSET;
      let artist = random.weighted(weights);
      for (let i = 0; i < length; i++) {
        if (!random.chance(0.45)) artist = random.weighted(weights);
        const a = artists[artist]!;
        const track = tracks[a.tracks[random.weighted(a.trackWeights)]!]!;
        const roll = random.next();
        const skipChance = track.skipProne ? 0.55 : 0.14;
        let ms: number;
        let skipped = false;
        if (roll < skipChance) {
          ms = random.range(1_500, 25_000);
          skipped = true;
        } else if (roll < skipChance + 0.07) {
          ms = random.range(30_000, track.durationMs);
        } else {
          ms = track.durationMs - random.int(2_000);
        }
        builder.add({
          ts: clock,
          ms,
          track: track.name,
          artist: a.name,
          album: track.album,
          uri: track.uri,
          platform,
          skipped,
          shuffle,
        });
        clock += Math.ceil(ms / 1000) + random.int(20);
      }
      produced += length;
    }
  }
  return builder.build();
}

function iso(ts: number): string {
  return new Date(ts * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function buildApi(
  random: Random,
  dataset: Dataset,
  artists: readonly CatalogArtist[],
  tracks: readonly CatalogTrack[],
): DemoApi {
  const artistByName = new Map(artists.map((a) => [a.name, a]));
  const trackByUri = new Map(tracks.map((t) => [t.uri, t]));
  const toArtist = (a: CatalogArtist): Artist => ({
    id: a.id,
    name: a.name,
    genres: [...a.genres],
    url: DEMO_URL,
  });
  const toTrack = (t: CatalogTrack): Track => {
    const artist = artists[t.artist]!;
    return {
      id: t.id,
      name: t.name,
      artists: [{ id: artist.id, name: artist.name }],
      album: { id: t.albumId, name: t.album },
      url: DEMO_URL,
    };
  };

  const endDay = Math.floor(dataset.range.to / SECONDS_PER_DAY);
  const window = (days: number): Period => ({
    kind: 'range',
    from: dayToIsoDate(endDay - days + 1),
    to: dayToIsoDate(endDay),
  });
  const periods: Record<TimeRange, Period> = {
    short_term: window(28),
    medium_term: window(182),
    long_term: { kind: 'all' },
  };
  const top = {
    artists: {} as Record<TimeRange, Artist[]>,
    tracks: {} as Record<TimeRange, Track[]>,
  };
  for (const range of Object.keys(periods) as TimeRange[]) {
    const stats = computeStats(dataset, periods[range], 'UTC', { limit: DEMO_TOP_LIMIT });
    top.artists[range] = stats.top.artists.map((a) => toArtist(artistByName.get(a.name)!));
    top.tracks[range] = stats.top.tracks.map((t) => toTrack(trackByUri.get(t.uri)!));
  }

  const { ts, ms, track, flags } = dataset.cols;
  const recent: Recent[] = [];
  for (let i = ts.length - 1; i >= 0 && recent.length < 50; i--) {
    if (!(flags[i]! & FLAG_VALID)) continue;
    const t = trackByUri.get(dataset.dict.tracks[track[i]!]!.uri)!;
    recent.push({ playedAt: iso(ts[i]! + Math.ceil(ms[i]! / 1000)), track: toTrack(t) });
  }

  // Curtidas: faixas ouvidas com frequência têm mais chance de estar salvas.
  const plays = new Uint32Array(dataset.dict.tracks.length);
  const firstPlay = new Uint32Array(dataset.dict.tracks.length);
  for (let i = 0; i < ts.length; i++) {
    if (!(flags[i]! & FLAG_VALID)) continue;
    const t = track[i]!;
    if (plays[t] === 0) firstPlay[t] = ts[i]!;
    plays[t]!++;
  }
  const saved: { addedAt: number; item: SavedItem }[] = [];
  dataset.dict.tracks.forEach((info, t) => {
    if (plays[t]! === 0 || !random.chance(Math.min(0.9, plays[t]! / 40))) return;
    const catalogTrack = trackByUri.get(info.uri)!;
    const addedAt = Math.min(dataset.range.to, firstPlay[t]! + random.int(60 * SECONDS_PER_DAY));
    const artist = artists[catalogTrack.artist]!;
    saved.push({
      addedAt,
      item: {
        addedAt: iso(addedAt),
        track: { id: catalogTrack.id, artists: [{ id: artist.id, name: artist.name }] },
      },
    });
  });
  saved.sort((a, b) => b.addedAt - a.addedAt || (a.item.track.id < b.item.track.id ? -1 : 1));

  return {
    demo: true,
    me: { id: 'encore-demo', displayName: 'Demo' },
    top,
    recent,
    saved: saved.map((s) => s.item),
    artists: artists.map(toArtist),
  };
}

/**
 * Gera o modo Demo (RF-12): Dataset de ~3 anos + respostas fictícias no formato reduzido do
 * BFF. Determinístico (mesma seed → mesmo resultado), sem rede, sem `Date.now()`.
 */
export function generateDemo(options: DemoOptions = {}): DemoData {
  const seed = options.seed ?? DEMO_SEED;
  const days = options.days ?? DEMO_DAYS;
  const random = createRandom(seed);
  const { artists, tracks } = buildCatalog(random, days);
  const dataset = simulate(random, artists, tracks, days);
  const api = buildApi(createRandom(seed ^ 0x9e3779b9), dataset, artists, tracks);
  return { dataset, api, timeZone: DEMO_TIME_ZONE };
}

/** Uma página de curtidas do Demo, no formato de `/api/spotify/saved?offset`. */
export function demoSavedPage(api: DemoApi, offset: number, limit = 50): SavedPage {
  return { total: api.saved.length, offset, items: api.saved.slice(offset, offset + limit) };
}

/** Equivalente a `/api/spotify/artist/:id` no Demo. */
export function demoArtist(api: DemoApi, id: string): Artist | undefined {
  return api.artists.find((artist) => artist.id === id);
}
