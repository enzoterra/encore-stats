/**
 * O que cada dashboard entrega ao modal de compartilhar: o recorte **atualmente selecionado**
 * (período no Upload/Demo, janela no Conectar), já traduzido e formatado. Funções puras, com o
 * tradutor injetado, para testar a atribuição por modo sem React.
 */
import type { GenreSummary } from '@/domain/api-stats';
import type { Period, UploadStats } from '@/domain/stats';
import type { Artist, TimeRange, Track } from '@/domain/spotify-types';

import type { CardMode, CardTrack } from './model';

export const MAX_CARD_ARTISTS = 25;

export type ShareInput = {
  mode: CardMode;
  /** Chip do período e base do nome do arquivo. */
  periodLabel: string;
  topArtists: string[];
  topTracks: CardTrack[];
  heroSub?: string;
  stat?: { value: string; label: string };
  stats: string[];
  /** Capa da música nº 1 (só Conectar real; o Demo não tem capas). */
  coverUrl?: string;
};

/** Tradutor do namespace `Cards` (o `t` do next-intl). */
export type CardsTranslator = (key: string, values?: Record<string, string | number>) => string;

export type NumberFormat = {
  number: (n: number) => string;
  minutes: (ms: number) => string;
  instantMonthYear: (epochSeconds: number) => string;
};

/** Upload e Demo (visão Upload): `computeStats` do período do dashboard. */
export function uploadShareInput({
  stats,
  period,
  periodLabel,
  mode,
  format,
  t,
}: {
  stats: UploadStats;
  period: Period;
  periodLabel: string;
  mode: 'upload' | 'demo';
  format: NumberFormat;
  t: CardsTranslator;
}): ShareInput | null {
  const first = stats.top.artists[0];
  if (!first || stats.totals.plays === 0) return null;
  const self = stats.self.topArtist;
  const heroSub =
    self && self.artist === first.artist
      ? t('heroSub.upload', { plays: first.plays, since: format.instantMonthYear(self.fanSince) })
      : t('heroSub.uploadPlays', { plays: first.plays });
  const statLabel =
    period.kind === 'all'
      ? t('stat.minutesAll')
      : period.kind === 'range'
        ? t('stat.minutesRange')
        : t('stat.minutesIn', { label: periodLabel });
  const minutes = format.minutes(stats.totals.ms);
  return {
    mode,
    periodLabel,
    topArtists: stats.top.artists.slice(0, MAX_CARD_ARTISTS).map((a) => a.name),
    topTracks: stats.top.tracks.slice(0, 5).map((track) => ({
      name: track.name,
      artist: track.artist,
    })),
    heroSub,
    stat: { value: minutes, label: statLabel },
    stats: [
      t('stats.minutes', { value: minutes }),
      t('stats.plays', { count: stats.totals.plays }),
      t('stats.artists', { count: stats.totals.artists }),
    ],
  };
}

export type LikedTop = { id: string; name: string; count: number };

/**
 * Conectar (real ou visão Conectar do Demo): tops da janela selecionada.
 * - Sub-herói: tendência do nº 1 (janela de 4 semanas contra 6 meses) ou os gêneros dele;
 * - destaque do Básico (§9.6): curtidas do nº 1 (se a varredura rodou), senão o gênero nº 1
 *   (se houver ≥ 3), senão nada;
 * - Festival: "TOP N ARTISTAS · {JANELA}".
 */
export function connectShareInput({
  range,
  artists,
  tracks,
  trend,
  genres,
  liked,
  demo,
  format,
  t,
}: {
  range: TimeRange;
  artists: readonly Artist[];
  tracks: readonly Track[];
  /** Movimento do artista nº 1 entre as janelas, quando conhecido. */
  trend?: { kind: 'rising'; delta: number } | { kind: 'entered' };
  genres?: GenreSummary;
  liked?: readonly LikedTop[];
  demo: boolean;
  format: Pick<NumberFormat, 'number'>;
  t: CardsTranslator;
}): ShareInput | null {
  const first = artists[0];
  if (!first) return null;
  const windowLabel = t(`window.${range}`);
  const heroSub = trend
    ? trend.kind === 'rising'
      ? t('heroSub.rising', { delta: trend.delta })
      : t('heroSub.entered')
    : first.genres.length > 0
      ? t('heroSub.genres', { genres: first.genres.slice(0, 2).join(' · ') })
      : undefined;
  const likedFirst = liked?.find((entry) => entry.id === first.id);
  const topGenre = genres?.visible ? genres.genres[0]?.genre : undefined;
  const stat = likedFirst
    ? { value: format.number(likedFirst.count), label: t('stat.liked', { artist: first.name }) }
    : topGenre
      ? { value: topGenre, label: t('stat.genre') }
      : undefined;
  const top = artists.slice(0, MAX_CARD_ARTISTS);
  return {
    mode: demo ? 'demo' : 'connect',
    periodLabel: windowLabel,
    topArtists: top.map((a) => a.name),
    topTracks: tracks.slice(0, 5).map((track) => ({
      name: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
    })),
    heroSub,
    stat,
    stats: [t('stats.topArtists', { count: top.length }), windowLabel],
    coverUrl: demo ? undefined : tracks[0]?.album.image,
  };
}
