'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { computeGenres, computeWindowTrends } from '@/domain/api-stats';
import type { Artist, TimeRange, Track } from '@/domain/spotify-types';
import { connectShareInput, type ShareInput } from '@/features/cards/share-input';

import { useConnectBundle } from './connect-provider';
import { readTop } from './queries';
import { useConnectFormat } from './use-connect-format';

/**
 * Monta o recorte do card do Conectar (real ou visão Conectar do Demo) para a janela
 * selecionada. Os tops já estão no cache na maioria das vezes; se faltarem (ex.: a aba de músicas
 * nunca foi aberta), são pedidos agora, uma vez.
 */
export function useConnectShare(range: TimeRange): () => Promise<ShareInput | null> {
  const bundle = useConnectBundle();
  const t = useTranslations('Cards');
  const format = useConnectFormat();

  return useCallback(async () => {
    const [artists, tracks] = await Promise.all([
      readTop<Artist>(bundle, 'artists', range),
      // Sem o top de músicas, o card sai do mesmo jeito: Músicas e Mix ficam desabilitados.
      readTop<Track>(bundle, 'tracks', range).catch(() => undefined),
    ]);
    if (!artists || artists.length === 0) return null;

    // Tendência do nº 1: só faz sentido na janela de 4 semanas (comparada à de 6 meses).
    let trend: { kind: 'rising'; delta: number } | { kind: 'entered' } | undefined;
    if (range === 'short_term') {
      const medium = await readTop<Artist>(bundle, 'artists', 'medium_term').catch(() => undefined);
      const long =
        medium && medium.length === 0
          ? await readTop<Artist>(bundle, 'artists', 'long_term').catch(() => undefined)
          : [];
      if (medium && long) {
        const trends = computeWindowTrends({
          short_term: artists,
          medium_term: medium,
          long_term: long,
        });
        const id = artists[0]!.id;
        const rising = trends.rising.find((item) => item.item.id === id);
        if (rising?.delta) trend = { kind: 'rising', delta: rising.delta };
        else if (trends.entered.some((item) => item.item.id === id)) trend = { kind: 'entered' };
      }
    }

    return connectShareInput({
      range,
      artists,
      tracks: tracks ?? [],
      trend,
      genres: computeGenres(artists),
      liked: bundle.likedRef.current ?? undefined,
      demo: bundle.source.kind === 'demo',
      format,
      t: (key, values) => t(key as never, values as never),
    });
  }, [bundle, range, t, format]);
}
