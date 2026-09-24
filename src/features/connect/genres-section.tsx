'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { InfoTip } from '@/components/ui/info-tip';
import { Skeleton } from '@/components/ui/skeleton';
import { computeGenres } from '@/domain/api-stats';
import type { TimeRange } from '@/domain/spotify-types';

import { usePaused } from './connect-provider';
import { useTopArtists } from './queries';
import { ConnectSection } from './section';
import { useConnectFormat } from './use-connect-format';

const MAX_GENRES = 8;

/**
 * Gêneros ponderados pelo rank dos top artistas (RF-19, 10-design.md §8.7). O campo é
 * *deprecated* no Spotify: com menos de 3 gêneros, campo ausente ou erro, a seção **não é
 * renderizada** (nem card vazio nem mensagem de erro).
 */
export function GenresSection({ range }: { range: TimeRange }) {
  const t = useTranslations('Connect.genres');
  const format = useConnectFormat();
  const query = useTopArtists(range);
  const paused = usePaused();
  const summary = useMemo(
    () => (query.data ? computeGenres(query.data, { limit: MAX_GENRES }) : undefined),
    [query.data],
  );

  if (query.isError || (summary && !summary.visible) || (paused && !summary)) return null;

  const badge = (
    <span className="inline-flex items-center gap-1">
      <Badge tone="warning">
        <TriangleAlert aria-hidden="true" />
        {t('unstable')}
      </Badge>
      <InfoTip label={t('unstableLabel')}>{t('unstableTip')}</InfoTip>
    </span>
  );

  return (
    <ConnectSection id="connect-genres" title={t('title')} badge={badge} testId="connect-genres">
      {summary ? (
        <>
          <ul aria-label={t('listLabel')} className="flex flex-col gap-3">
            {summary.genres.map((genre) => {
              const max = summary.genres[0]!.share;
              return (
                <li key={genre.genre} className="flex flex-col gap-1.5">
                  <span className="flex items-baseline justify-between gap-3 text-body-sm">
                    <span className="min-w-0 font-semibold [overflow-wrap:anywhere] first-letter:uppercase">
                      {genre.genre}
                    </span>
                    <span className="shrink-0 text-fg-muted tabular-nums">
                      {format.percent(genre.share)}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-2 overflow-hidden rounded-full bg-surface-2"
                  >
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(3, Math.round((genre.share / max) * 100))}%` }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-caption text-fg-subtle">{t('note')}</p>
        </>
      ) : (
        <div aria-busy="true" className="flex flex-col gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-1/3 rounded-xs" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      )}
    </ConnectSection>
  );
}
