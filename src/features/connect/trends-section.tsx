'use client';

import { LogOut, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Segmented } from '@/components/ui/segmented';
import type { TrendItem } from '@/domain/api-stats';
import type { Artist, Track } from '@/domain/spotify-types';

import { usePaused } from './connect-provider';
import { MediaRow } from './media-row';
import { useTrends, type TopKind } from './queries';
import { ConnectSection, RowsSkeleton, SectionError, SectionPaused } from './section';

const KINDS: readonly TopKind[] = ['artists', 'tracks'];
const PER_COLUMN = 6;

/** Badge de tendência (10-design.md §8.6): sempre ícone + texto, nunca só a cor. */
function TrendBadge({ item }: { item: TrendItem<unknown> }) {
  const t = useTranslations('Connect.trends');
  switch (item.kind) {
    case 'entered':
      return (
        <Badge tone="info">
          <Sparkles aria-hidden="true" />
          {t('entered')}
        </Badge>
      );
    case 'rising':
      return (
        <Badge tone="success">
          <TrendingUp aria-hidden="true" />
          {t('rising', { n: item.delta ?? 0 })}
        </Badge>
      );
    case 'falling':
      return (
        <Badge tone="danger">
          <TrendingDown aria-hidden="true" />
          {t('falling', { n: Math.abs(item.delta ?? 0) })}
        </Badge>
      );
    case 'left':
      return (
        <Badge className="border-0 bg-surface-3 text-fg-muted">
          <LogOut aria-hidden="true" />
          {t('left')}
        </Badge>
      );
  }
}

function TrendList({
  title,
  items,
  empty,
  kind,
  testId,
}: {
  title: string;
  items: TrendItem<Artist | Track>[];
  empty: string;
  kind: TopKind;
  testId: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h3 className="text-overline text-fg-muted uppercase">{title}</h3>
      {items.length === 0 ? (
        <p className="py-4 text-body-sm text-fg-muted">{empty}</p>
      ) : (
        <ul aria-label={title} data-testid={testId} className="flex flex-col">
          {items.map((entry) => {
            const item = entry.item;
            const isTrack = kind === 'tracks' && 'album' in item;
            return (
              <MediaRow
                key={`${entry.kind}-${item.id}`}
                name={item.name}
                sub={isTrack ? item.artists.map((a) => a.name).join(', ') : undefined}
                image={isTrack ? item.album.image : 'image' in item ? item.image : undefined}
                url={item.url}
                action={isTrack ? 'play' : 'open'}
                size={40}
                trailing={<TrendBadge item={entry} />}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Tendências (RF-16, 10-design.md §8.6): entrou/subiu em "Em alta", caiu/saiu em "Em queda",
 * comparando as últimas 4 semanas com os últimos 6 meses (ou 1 ano, se 6 meses vier vazio).
 */
export function TrendsSection() {
  const t = useTranslations('Connect.trends');
  const tTop = useTranslations('Connect.top');
  const [kind, setKind] = useState<TopKind>('artists');
  const result = useTrends<Artist | Track>(kind);
  const paused = usePaused();
  const trends = result.trends;

  return (
    <ConnectSection
      id="connect-trends"
      title={t('title')}
      subtitle={trends?.baseline === 'long_term' ? t('subtitleLong') : t('subtitle')}
      testId="connect-trends"
    >
      <Segmented
        label={t('kindLabel')}
        value={kind}
        onChange={setKind}
        options={KINDS.map((k) => ({ value: k, label: tTop(`kinds.${k}`) }))}
        className="max-w-sm"
      />
      {result.status === 'error' ? (
        <SectionError error={result.error} onRetry={result.refetch} />
      ) : trends ? (
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-4 lg:gap-6">
          <TrendList
            title={t('up')}
            items={[...trends.entered, ...trends.rising].slice(0, PER_COLUMN)}
            empty={t('emptyUp')}
            kind={kind}
            testId="trends-up"
          />
          <TrendList
            title={t('down')}
            items={[...trends.falling, ...trends.left].slice(0, PER_COLUMN)}
            empty={t('emptyDown')}
            kind={kind}
            testId="trends-down"
          />
        </div>
      ) : paused ? (
        <SectionPaused />
      ) : (
        <RowsSkeleton rows={4} />
      )}
    </ConnectSection>
  );
}
