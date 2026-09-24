'use client';

import { queryOptions, useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { computeWindowTrends, type Trends } from '@/domain/api-stats';
import type { Artist, Me, Recent, TimeRange, Track } from '@/domain/spotify-types';

import { connectKeys, TTL } from './connect-client';
import { useConnectBundle, useConnectStatus } from './connect-provider';
import { createLimiter } from './limiter';

export type TopKind = 'artists' | 'tracks';

/** A sessão está ativa e não há pausa por `QUOTA`. */
function useCanFetch(): boolean {
  return useConnectStatus((state) => state.session === 'active' && state.pausedUntil === null);
}

/**
 * `me` é a **primeira** chamada da sessão, sozinha (docs/api.md): se o access token venceu, só ela
 * renova. As demais só disparam depois que `me` respondeu.
 */
export function useMe(): UseQueryResult<Me> {
  const { source } = useConnectBundle();
  const canFetch = useCanFetch();
  return useQuery({
    queryKey: connectKeys.me(source.kind),
    queryFn: ({ signal }) => source.me({ signal }),
    staleTime: TTL.me,
    gcTime: TTL.me,
    enabled: canFetch,
  });
}

function useReady(): boolean {
  const me = useMe();
  return useCanFetch() && me.isSuccess;
}

type Source = ReturnType<typeof useConnectBundle>['source'];

/** Mesma chave de cache para quem pedir o mesmo top (dedupe entre seções). */
function topOptions(source: Source, type: TopKind, range: TimeRange, enabled: boolean) {
  return queryOptions<(Artist | Track)[]>({
    queryKey: connectKeys.top(source.kind, type, range),
    queryFn: ({ signal }) =>
      type === 'artists'
        ? source.topArtists(range, { signal })
        : source.topTracks(range, { signal }),
    staleTime: TTL.top,
    gcTime: TTL.top,
    enabled,
  });
}

export function useTopArtists(range: TimeRange, enabled = true): UseQueryResult<Artist[]> {
  const { source } = useConnectBundle();
  const ready = useReady();
  return useQuery(topOptions(source, 'artists', range, ready && enabled)) as UseQueryResult<
    Artist[]
  >;
}

export function useTopTracks(range: TimeRange, enabled = true): UseQueryResult<Track[]> {
  const { source } = useConnectBundle();
  const ready = useReady();
  return useQuery(topOptions(source, 'tracks', range, ready && enabled)) as UseQueryResult<Track[]>;
}

/** Tocadas recentemente: TTL de 60 s e refetch ao voltar para a aba (03-arquitetura). */
export function useRecent(): UseQueryResult<Recent[]> {
  const { source } = useConnectBundle();
  const ready = useReady();
  return useQuery({
    queryKey: connectKeys.recent(source.kind),
    queryFn: ({ signal }) => source.recent({ signal }),
    staleTime: TTL.recent,
    gcTime: 10 * TTL.recent,
    refetchOnWindowFocus: true,
    enabled: ready,
  });
}

export type TrendsResult<T> = {
  status: 'pending' | 'error' | 'success';
  error: unknown;
  trends?: Trends<T> & { baseline: 'medium_term' | 'long_term' };
  refetch: () => void;
};

/**
 * Tendências (RF-16): 4 semanas contra 6 meses via `computeWindowTrends`. A janela de 1 ano só é
 * pedida se a de 6 meses vier vazia (conta nova).
 */
export function useTrends<T extends Artist | Track>(
  type: TopKind,
  enabled = true,
): TrendsResult<T> {
  const { source } = useConnectBundle();
  const ready = useReady() && enabled;
  const [short, medium] = useQueries({
    queries: (['short_term', 'medium_term'] as const).map((range) =>
      topOptions(source, type, range, ready),
    ),
  });
  const needLong = medium?.isSuccess === true && medium.data.length === 0;
  const long = useQuery(topOptions(source, type, 'long_term', ready && needLong));

  const involved = needLong ? [short!, medium!, long] : [short!, medium!];
  const failed = involved.find((q) => q.isError);
  const pending = involved.some((q) => q.isPending);
  const shortData = short?.data as T[] | undefined;
  const mediumData = medium?.data as T[] | undefined;
  const longData = long.data as T[] | undefined;

  const trends = useMemo(() => {
    if (!shortData || !mediumData || (needLong && !longData)) return undefined;
    return computeWindowTrends<T>({
      short_term: shortData,
      medium_term: mediumData,
      long_term: longData ?? [],
    });
  }, [shortData, mediumData, longData, needLong]);

  return {
    status: failed ? 'error' : pending || !trends ? 'pending' : 'success',
    error: failed?.error,
    trends,
    refetch: () => {
      for (const q of involved) if (q.isError) void q.refetch();
    },
  };
}

/** `/artist/:id` com concorrência 2 (03-arquitetura), só para os curtidos fora do top. */
const artistLimiter = createLimiter(2);

export function useArtists(ids: readonly string[]): Map<string, Artist> {
  const { source } = useConnectBundle();
  const ready = useReady();
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: connectKeys.artist(source.kind, id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        artistLimiter(() => source.artist(id, { signal })),
      staleTime: TTL.artist,
      gcTime: TTL.artist,
      retry: false,
      enabled: ready,
    })),
  });
  const map = new Map<string, Artist>();
  for (const result of results) if (result.data) map.set(result.data.id, result.data);
  return map;
}

/** Relógio que avança a cada `intervalMs` (tempos relativos e contagens regressivas). */
export function useNow(intervalMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, active]);
  return now;
}
