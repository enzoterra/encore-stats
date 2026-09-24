import { FLAG_SKIPPED, FLAG_VALID, type Dataset } from '../history/dataset';
import type { PlatformCode } from '../history/platform';
import { dayToIsoDate, localIndex } from '../time';
import { periodIndexRange, type Period } from './period';

/**
 * Regras (RF-06, RF-08, RF-09):
 * - **play** = registro de música com `ms_played ≥ 30 s` (flag `FLAG_VALID`);
 * - **minutos** = soma de `ms_played` de todos os registros de música do período, inclusive
 *   os < 30 s (a UI converte `ms` em minutos);
 * - **stream** = qualquer registro de música (base da taxa de pulo);
 * - tops ordenados por plays, depois ms, depois nome; só entra quem tem ≥ 1 play;
 * - distintos (artistas, músicas, álbuns) e dias contam só registros com play válido.
 */
export type Totals = {
  ms: number;
  plays: number;
  streams: number;
  artists: number;
  tracks: number;
  albums: number;
  /** Dias locais distintos com pelo menos um play. */
  days: number;
};

export type RankedArtist = { artist: number; name: string; plays: number; ms: number };
export type RankedTrack = {
  track: number;
  name: string;
  artist: string;
  album: string;
  uri: string;
  plays: number;
  ms: number;
};
export type RankedAlbum = {
  album: number;
  name: string;
  artist: string;
  plays: number;
  ms: number;
};

/**
 * Heatmap 7×24 (RF-10) no fuso local. Índice = weekday × 24 + hora, com weekday ISO
 * (0 = segunda … 6 = domingo); a UI localiza os rótulos. `plays` conta plays válidos e
 * `ms` soma todo o tempo ouvido.
 */
export type Heatmap = { plays: number[]; ms: number[]; maxPlays: number; maxMs: number };

export type PlatformShare = { platform: PlatformCode; plays: number; ms: number; share: number };

/**
 * Métricas "você por você" (RF-11), sempre comparando o usuário consigo mesmo.
 * - `topArtist.fanSince`: primeiro play válido do artista nº 1 do período em **todo** o
 *   histórico (epoch s e data local);
 * - `topArtist.shareOfPlays`: plays do artista nº 1 ÷ plays do período (0–1);
 * - `topArtist.distinctDays`: dias locais distintos do período com play do artista nº 1;
 * - `mostSkipped`: faixa com mais pulos no período (regra de pulo em `isSkip`); empate →
 *   maior taxa de pulo (pulos ÷ streams), depois ordem do dicionário;
 * - `mostMusicalDay`: dia local com mais tempo ouvido no período; empate → o mais antigo.
 */
export type SelfMetrics = {
  topArtist: {
    artist: number;
    name: string;
    fanSince: number;
    fanSinceDate: string;
    shareOfPlays: number;
    distinctDays: number;
  } | null;
  mostSkipped: {
    track: number;
    name: string;
    artist: string;
    skips: number;
    streams: number;
    skipRate: number;
  } | null;
  mostMusicalDay: { date: string; ms: number; plays: number } | null;
};

export type UploadStats = {
  /** Intervalo resolvido [from, to) em epoch (s). */
  range: { from: number; to: number };
  totals: Totals;
  top: { artists: RankedArtist[]; tracks: RankedTrack[]; albums: RankedAlbum[] };
  heatmap: Heatmap;
  /** Por tempo ouvido, decrescente; `platforms[0]` é a mais usada. */
  platforms: PlatformShare[];
  self: SelfMetrics;
};

export type StatsOptions = { limit?: number };

const DEFAULT_LIMIT = 10;

function byRank(
  plays: ArrayLike<number>,
  ms: ArrayLike<number>,
  name: (i: number) => string,
): (a: number, b: number) => number {
  return (a, b) =>
    plays[b]! - plays[a]! ||
    ms[b]! - ms[a]! ||
    (name(a) < name(b) ? -1 : name(a) > name(b) ? 1 : a - b);
}

function topIndices(
  count: number,
  plays: ArrayLike<number>,
  ms: ArrayLike<number>,
  name: (i: number) => string,
  limit: number,
): number[] {
  const candidates: number[] = [];
  for (let i = 0; i < count; i++) if (plays[i]! > 0) candidates.push(i);
  return candidates.sort(byRank(plays, ms, name)).slice(0, limit);
}

/**
 * Todas as stats do dashboard de Upload/Demo para `(dataset, period, tz)` em uma passada
 * O(registros do período + tamanho dos dicionários). Função pura.
 */
export function computeStats(
  dataset: Dataset,
  period: Period,
  tz: string,
  options: StatsOptions = {},
): UploadStats {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const { artists, tracks, albums, platforms } = dataset.dict;
  const { ms, track, platform, flags } = dataset.cols;
  const { start, end, from, to } = periodIndexRange(dataset, period, tz);
  const local = localIndex(dataset, tz);

  const trackPlays = new Uint32Array(tracks.length);
  const trackMs = new Float64Array(tracks.length);
  const trackStreams = new Uint32Array(tracks.length);
  const trackSkips = new Uint32Array(tracks.length);
  const heatPlays = new Array<number>(168).fill(0);
  const heatMs = new Array<number>(168).fill(0);
  const platformPlays = new Array<number>(platforms.length).fill(0);
  const platformMs = new Array<number>(platforms.length).fill(0);
  const dayMs = new Map<number, number>();
  const dayPlays = new Map<number, number>();
  let totalMs = 0;
  let totalPlays = 0;

  for (let i = start; i < end; i++) {
    const t = track[i]!;
    const m = ms[i]!;
    const f = flags[i]!;
    const valid = f & FLAG_VALID ? 1 : 0;
    const wh = local.weekHour[i]!;
    const p = platform[i]!;
    const d = local.day[i]!;
    trackMs[t]! += m;
    trackStreams[t]!++;
    trackPlays[t]! += valid;
    if (f & FLAG_SKIPPED) trackSkips[t]!++;
    heatMs[wh]! += m;
    heatPlays[wh]! += valid;
    platformMs[p]! += m;
    platformPlays[p]! += valid;
    dayMs.set(d, (dayMs.get(d) ?? 0) + m);
    if (valid) dayPlays.set(d, (dayPlays.get(d) ?? 0) + 1);
    totalMs += m;
    totalPlays += valid;
  }

  const artistPlays = new Float64Array(artists.length);
  const artistMs = new Float64Array(artists.length);
  const albumPlays = new Float64Array(albums.length);
  const albumMs = new Float64Array(albums.length);
  let distinctTracks = 0;
  for (let t = 0; t < tracks.length; t++) {
    const info = tracks[t]!;
    artistMs[info.artist]! += trackMs[t]!;
    albumMs[info.album]! += trackMs[t]!;
    if (trackPlays[t]! === 0) continue;
    distinctTracks++;
    artistPlays[info.artist]! += trackPlays[t]!;
    albumPlays[info.album]! += trackPlays[t]!;
  }
  const countPositive = (values: Float64Array) => values.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);

  const topArtistIdx = topIndices(artists.length, artistPlays, artistMs, (i) => artists[i]!, limit);
  const topTrackIdx = topIndices(tracks.length, trackPlays, trackMs, (i) => tracks[i]!.name, limit);
  const topAlbumIdx = topIndices(albums.length, albumPlays, albumMs, (i) => albums[i]!.name, limit);

  const platformShares: PlatformShare[] = platforms
    .map((code, i) => ({
      platform: code,
      plays: platformPlays[i]!,
      ms: platformMs[i]!,
      share: totalMs > 0 ? platformMs[i]! / totalMs : 0,
    }))
    .filter((p) => p.ms > 0)
    .sort((a, b) => b.ms - a.ms || platforms.indexOf(a.platform) - platforms.indexOf(b.platform));

  return {
    range: { from, to },
    totals: {
      ms: totalMs,
      plays: totalPlays,
      streams: end - start,
      artists: countPositive(artistPlays),
      tracks: distinctTracks,
      albums: countPositive(albumPlays),
      days: dayPlays.size,
    },
    top: {
      artists: topArtistIdx.map((a) => ({
        artist: a,
        name: artists[a]!,
        plays: artistPlays[a]!,
        ms: artistMs[a]!,
      })),
      tracks: topTrackIdx.map((t) => {
        const info = tracks[t]!;
        return {
          track: t,
          name: info.name,
          artist: artists[info.artist]!,
          album: albums[info.album]!.name,
          uri: info.uri,
          plays: trackPlays[t]!,
          ms: trackMs[t]!,
        };
      }),
      albums: topAlbumIdx.map((a) => ({
        album: a,
        name: albums[a]!.name,
        artist: artists[albums[a]!.artist]!,
        plays: albumPlays[a]!,
        ms: albumMs[a]!,
      })),
    },
    heatmap: {
      plays: heatPlays,
      ms: heatMs,
      maxPlays: Math.max(0, ...heatPlays),
      maxMs: Math.max(0, ...heatMs),
    },
    platforms: platformShares,
    self: {
      topArtist:
        topArtistIdx[0] === undefined
          ? null
          : topArtistMetrics(dataset, tz, start, end, topArtistIdx[0], artistPlays, totalPlays),
      mostSkipped: mostSkipped(dataset, trackSkips, trackStreams),
      mostMusicalDay: mostMusicalDay(dayMs, dayPlays),
    },
  };
}

function topArtistMetrics(
  dataset: Dataset,
  tz: string,
  start: number,
  end: number,
  artist: number,
  artistPlays: Float64Array,
  totalPlays: number,
): NonNullable<SelfMetrics['topArtist']> {
  const { tracks, artists } = dataset.dict;
  const { track, flags, ts } = dataset.cols;
  const local = localIndex(dataset, tz);
  const isHit = (i: number) => flags[i]! & FLAG_VALID && tracks[track[i]!]!.artist === artist;

  // O artista nº 1 tem play no período, então o laço sempre encontra um índice < end.
  let first = 0;
  while (!isHit(first)) first++;

  const days = new Set<number>();
  for (let i = start; i < end; i++) if (isHit(i)) days.add(local.day[i]!);

  return {
    artist,
    name: artists[artist]!,
    fanSince: ts[first]!,
    fanSinceDate: dayToIsoDate(local.day[first]!),
    shareOfPlays: artistPlays[artist]! / totalPlays,
    distinctDays: days.size,
  };
}

function mostSkipped(
  dataset: Dataset,
  skips: Uint32Array,
  streams: Uint32Array,
): SelfMetrics['mostSkipped'] {
  let best = -1;
  for (let t = 0; t < skips.length; t++) {
    if (skips[t]! === 0) continue;
    if (
      best < 0 ||
      skips[t]! > skips[best]! ||
      (skips[t]! === skips[best]! && skips[t]! * streams[best]! > skips[best]! * streams[t]!)
    ) {
      best = t;
    }
  }
  if (best < 0) return null;
  const info = dataset.dict.tracks[best]!;
  return {
    track: best,
    name: info.name,
    artist: dataset.dict.artists[info.artist]!,
    skips: skips[best]!,
    streams: streams[best]!,
    skipRate: skips[best]! / streams[best]!,
  };
}

function mostMusicalDay(
  dayMs: Map<number, number>,
  dayPlays: Map<number, number>,
): SelfMetrics['mostMusicalDay'] {
  let bestDay: number | null = null;
  let bestMs = 0;
  for (const [day, value] of dayMs) {
    if (value > bestMs || (value === bestMs && bestDay !== null && day < bestDay)) {
      bestDay = day;
      bestMs = value;
    }
  }
  if (bestDay === null) return null;
  return { date: dayToIsoDate(bestDay), ms: bestMs, plays: dayPlays.get(bestDay) ?? 0 };
}
