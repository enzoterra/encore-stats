'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { usePaused } from './connect-provider';
import { MediaRow } from './media-row';
import { useNow, useRecent } from './queries';
import { ConnectSection, RowsSkeleton, SectionError, SectionPaused } from './section';
import { useConnectFormat } from './use-connect-format';

const PREVIEW = 8;

/** Tocadas recentemente (RF-17): as últimas 50, com refetch ao voltar para a aba. */
export function RecentSection() {
  const t = useTranslations('Connect.recent');
  const query = useRecent();
  const paused = usePaused();
  const format = useConnectFormat();
  const now = useNow(60_000);
  const [expanded, setExpanded] = useState(false);
  const items = query.data ?? [];
  const visible = expanded ? items : items.slice(0, PREVIEW);

  return (
    <ConnectSection id="connect-recent" title={t('title')} testId="connect-recent">
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
          <ol aria-label={t('listLabel', { count: visible.length })} className="flex flex-col">
            {visible.map((entry) => (
              <MediaRow
                showLabel
                key={`${entry.playedAt}-${entry.track.id}`}
                name={entry.track.name}
                sub={entry.track.artists.map((a) => a.name).join(', ')}
                image={entry.track.album.image}
                url={entry.track.url}
                action="play"
                trailing={
                  <time dateTime={entry.playedAt} className="text-caption">
                    {format.played(entry.playedAt, now)}
                  </time>
                }
              />
            ))}
          </ol>
        )
      ) : paused ? (
        <SectionPaused />
      ) : (
        <RowsSkeleton rows={5} />
      )}
      {items.length > PREVIEW ? (
        <Button
          variant="ghost"
          className="self-start"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t('less') : t('more', { count: items.length })}
        </Button>
      ) : null}
    </ConnectSection>
  );
}
