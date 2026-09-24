'use client';

import { useTranslations } from 'next-intl';

import { InfoTip } from '@/components/ui/info-tip';
import type { Totals } from '@/domain/stats';

import { type Format } from './use-format';
import { useCountUp } from './use-count-up';

/** Totais do período (RF-09): minutos em destaque + plays, artistas e músicas distintos. */
export function TotalsSection({ totals, format }: { totals: Totals; format: Format }) {
  const t = useTranslations('Dashboard.totals');
  const minutes = Math.round(totals.ms / 60_000);
  const shownMinutes = useCountUp(minutes);
  const fullDays = Math.floor(minutes / 1440);
  const context =
    fullDays >= 1
      ? t('minutesContextDays', { days: fullDays })
      : t('minutesContextHours', { hours: Math.max(1, Math.round(minutes / 60)) });

  const compact = [
    { key: 'plays', value: totals.plays },
    { key: 'artists', value: totals.artists },
    { key: 'tracks', value: totals.tracks },
  ] as const;

  return (
    <section aria-labelledby="totals-title" className="flex flex-col gap-3">
      <h2 id="totals-title" className="sr-only">
        {t('heading')}
      </h2>
      <div
        data-testid="metric-minutes"
        className="flex flex-col gap-1 rounded-lg bg-primary p-5 text-on-vibrant shadow-glow"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-overline uppercase">{t('minutes')}</p>
          <InfoTip label={t('ruleLabel')} className="text-on-vibrant hover:text-on-vibrant">
            {t('rule')}
          </InfoTip>
        </div>
        <p className="font-display text-[48px] leading-none font-extrabold tracking-[-0.02em] tabular-nums lg:text-[56px]">
          <span aria-hidden="true">{format.number(shownMinutes)}</span>
          <span className="sr-only">{format.number(minutes)}</span>
        </p>
        <p className="text-body-sm font-semibold">{context}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        {compact.map(({ key, value }) => (
          <div
            key={key}
            className="flex min-w-0 flex-col-reverse rounded-lg border border-line bg-surface p-3 sm:p-4 lg:p-3"
          >
            <dt className="text-caption text-fg-muted">{t(key)}</dt>
            <dd
              data-testid={`total-${key}`}
              className="font-display text-[20px] leading-[1.05] font-bold [overflow-wrap:anywhere] tabular-nums min-[400px]:text-[22px] sm:text-metric-sm lg:text-[20px]"
            >
              {format.number(value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
