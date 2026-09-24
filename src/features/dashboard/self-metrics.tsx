'use client';

import { CalendarDays, Heart, Percent, SkipForward, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';

import type { SelfMetrics } from '@/domain/stats';

import { MetricCard } from './metric-card';
import { type Format } from './use-format';

/** "Mais pulada" só aparece com um mínimo de pulos no período (10-design.md §8.4). */
export const MIN_SKIPS = 5;

/** Métricas "você por você" (RF-11, US-06), sempre rotuladas como comparação consigo mesmo. */
export function SelfMetricsSection({ self, format }: { self: SelfMetrics; format: Format }) {
  const t = useTranslations('Dashboard.self');
  const common = { badge: t('badge'), howLabel: t('howLabel') };
  const top = self.topArtist;
  const skipped = self.mostSkipped && self.mostSkipped.skips >= MIN_SKIPS ? self.mostSkipped : null;
  const day = self.mostMusicalDay;
  const strong = (chunks: ReactNode) => <strong className="font-semibold text-fg">{chunks}</strong>;

  return (
    <section aria-labelledby="self-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="self-title" className="font-display text-h2 lg:text-h2-lg">
          {t('title')}
        </h2>
        <p className="text-body-sm text-fg-muted">{t('lead')}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          {...common}
          wide
          icon={<Heart />}
          label={t('fanSince.label')}
          value={top ? format.cap(format.instantMonthYear(top.fanSince)) : '—'}
          empty={!top}
          context={top ? t.rich('fanSince.context', { artist: top.name, b: strong }) : t('fewData')}
          how={t('fanSince.how')}
        />
        <MetricCard
          {...common}
          icon={<Percent />}
          label={t('share.label')}
          value={top ? format.percent(top.shareOfPlays) : '—'}
          empty={!top}
          context={top ? t.rich('share.context', { artist: top.name, b: strong }) : t('fewData')}
          how={t('share.how')}
        />
        <MetricCard
          {...common}
          icon={<CalendarDays />}
          label={t('days.label')}
          value={top ? format.number(top.distinctDays) : '—'}
          empty={!top}
          context={top ? t.rich('days.context', { artist: top.name, b: strong }) : t('fewData')}
          how={t('days.how')}
        />
        <MetricCard
          {...common}
          nameValue
          icon={<SkipForward />}
          label={t('skipped.label')}
          value={skipped ? skipped.name : '—'}
          empty={!skipped}
          context={
            skipped
              ? t('skipped.context', { artist: skipped.artist, skips: skipped.skips })
              : `${t('fewData')}. ${t('skipped.empty')}`
          }
          how={t('skipped.how')}
        />
        <MetricCard
          {...common}
          nameValue
          icon={<Sun />}
          label={t('day.label')}
          value={day ? format.dateShort(day.date) : '—'}
          empty={!day}
          context={day ? t('day.context', { duration: format.duration(day.ms) }) : t('fewData')}
          how={t('day.how')}
        />
      </div>
    </section>
  );
}
