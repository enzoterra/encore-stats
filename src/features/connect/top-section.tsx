'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import type { TimeRange } from '@/domain/spotify-types';

import { usePaused } from './connect-provider';
import { MediaRow } from './media-row';
import { useTopArtists, useTopTracks, type TopKind } from './queries';
import { ConnectSection, RowsSkeleton, SectionError, SectionPaused } from './section';

const KINDS: readonly TopKind[] = ['artists', 'tracks'];

/** Top artistas e músicas da janela (RF-15, 10-design.md §8.5): 10 → 50. */
export function TopSection({ range }: { range: TimeRange }) {
  const t = useTranslations('Connect.top');
  const [kind, setKind] = useState<TopKind>('artists');
  const [expanded, setExpanded] = useState(false);
  const artists = useTopArtists(range, kind === 'artists');
  const tracks = useTopTracks(range, kind === 'tracks');
  const paused = usePaused();
  const query = kind === 'artists' ? artists : tracks;
  const items = query.data ?? [];
  const visible = expanded ? items : items.slice(0, 10);

  return (
    <ConnectSection id="connect-top" title={t('title')} testId="connect-top">
      <Segmented
        label={t('kindLabel')}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setExpanded(false);
        }}
        options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
        className="max-w-sm"
      />
      {query.isError && !query.data ? (
        <SectionError
          error={query.error}
          errorKey={query.errorUpdatedAt}
          onRetry={() => void query.refetch()}
        />
      ) : query.data ? (
        items.length === 0 ? (
          <p className="py-6 text-body-sm text-fg-muted">{t('empty')}</p>
        ) : (
          <ol
            aria-label={t('listLabel', { count: visible.length, kind: t(`kinds.${kind}`) })}
            data-testid={`connect-top-${kind}`}
            className="flex flex-col"
          >
            {kind === 'artists'
              ? artists.data
                  ?.slice(0, visible.length)
                  .map((artist, index) => (
                    <MediaRow
                      showLabel
                      key={artist.id}
                      rank={index + 1}
                      name={artist.name}
                      sub={artist.genres.slice(0, 2).join(' · ') || undefined}
                      image={artist.image}
                      url={artist.url}
                    />
                  ))
              : tracks.data
                  ?.slice(0, visible.length)
                  .map((track, index) => (
                    <MediaRow
                      showLabel
                      key={track.id}
                      rank={index + 1}
                      name={track.name}
                      sub={`${track.artists.map((a) => a.name).join(', ')} · ${track.album.name}`}
                      image={track.album.image}
                      url={track.url}
                      action="play"
                    />
                  ))}
          </ol>
        )
      ) : paused ? (
        <SectionPaused />
      ) : (
        <RowsSkeleton rows={6} />
      )}
      {items.length > 10 ? (
        <Button
          variant="ghost"
          className="self-start"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t('less') : t('more')}
        </Button>
      ) : null}
    </ConnectSection>
  );
}
