'use client';

import { Info, RotateCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PrivacySealCompact } from '@/components/layout/privacy-seal';
import { Button } from '@/components/ui/button';
import { useToasts } from '@/components/ui/toast';
import type { Dataset, ProcessReport } from '@/domain/history';
import { availableMonths, computeStats, type Period } from '@/domain/stats';
import { uploadShareInput } from '@/features/cards/share-input';
import { ShareButton, useShareLauncher } from '@/features/cards/share-launcher';

import { HeatmapSection } from './heatmap';
import { PeriodSelector } from './period-selector';
import {
  clampDates,
  datasetBounds,
  daysBetween,
  defaultPeriod,
  periodDates,
  samePeriod,
} from './period-utils';
import { PlatformsSection } from './platforms';
import { RankingSection } from './ranking';
import { SelfMetricsSection } from './self-metrics';
import { TotalsSection } from './totals';
import { type Format, useFormat } from './use-format';

export type DashboardMode = 'upload' | 'demo';

const BANNER_KEY = 'encore.reloadBannerDismissed';

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(BANNER_KEY) === '1';
  } catch {
    return false;
  }
}

function periodLabel(period: Period, format: Format, allLabel: string): string {
  switch (period.kind) {
    case 'year':
      return String(period.year);
    case 'month':
      return format.monthYearShort(period.year, period.month);
    case 'all':
      return allLabel;
    case 'range':
      return format.dateRange(period.from, period.to);
  }
}

function initialPeriod(
  fallback: Period,
  bounds: { min: string; max: string },
  kind: 'all' | 'range' | undefined,
): Period {
  if (kind === 'all') return { kind: 'all' };
  if (kind === 'range')
    return { kind: 'range', ...clampDates(periodDates(fallback, bounds), bounds) };
  return fallback;
}

/**
 * Dashboard dos modos Upload e Demo (RF-07..RF-11, 10-design.md §8.3–§8.9 e mockup A).
 * Tudo é calculado no navegador por `computeStats` (função pura); a troca de período é um
 * `useMemo` sobre o Dataset em memória (meta < 200 ms, RNF-03).
 */
export function Dashboard({
  dataset,
  timeZone,
  mode,
  report,
  elapsedMs,
  onReset,
  repoUrl,
  focusOnMount = false,
  initialPeriodKind,
}: {
  dataset: Dataset;
  timeZone: string;
  mode: DashboardMode;
  report?: ProcessReport;
  elapsedMs?: number;
  onReset?: () => void;
  repoUrl?: string;
  focusOnMount?: boolean;
  /**
   * Abre já em "Sempre" ou "Intervalo" e leva o foco ao seletor de período (Demo: atalho da
   * Visão Conectar, Iteração 8b.4).
   */
  initialPeriodKind?: 'all' | 'range';
}) {
  const t = useTranslations('Dashboard');
  const tUpload = useTranslations('Upload');
  const tCards = useTranslations('Cards');
  const format = useFormat(timeZone);
  const months = useMemo(() => availableMonths(dataset, timeZone), [dataset, timeZone]);
  const bounds = useMemo(() => datasetBounds(dataset, timeZone), [dataset, timeZone]);
  const [period, setPeriod] = useState<Period>(() =>
    initialPeriod(defaultPeriod(months), bounds, initialPeriodKind),
  );
  const [announcement, setAnnouncement] = useState('');
  const [bannerOpen, setBannerOpen] = useState(() => mode === 'demo' || !readDismissed());
  const title = useRef<HTMLHeadingElement>(null);
  const periodBox = useRef<HTMLDivElement>(null);
  const setRaised = useToasts((state) => state.setRaised);

  const stats = useMemo(
    () => computeStats(dataset, period, timeZone, { limit: 50 }),
    [dataset, period, timeZone],
  );

  useEffect(() => {
    if (focusOnMount) title.current?.focus();
  }, [focusOnMount]);

  // Só na montagem: quem chegou pelo atalho cai no seletor, no modo já escolhido.
  const startedAt = useRef(initialPeriodKind);
  useEffect(() => {
    if (!startedAt.current) return;
    const checked = periodBox.current?.querySelector<HTMLElement>(
      '[role="radio"][aria-checked="true"]',
    );
    periodBox.current?.scrollIntoView({ block: 'center' });
    checked?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    setRaised(true);
    return () => setRaised(false);
  }, [setRaised]);

  const label = periodLabel(period, format, t('period.allLabel'));
  const dates = clampDates(periodDates(period, bounds), bounds);
  const days = daysBetween(dates.from, dates.to);
  const summary = t('period.summary', {
    range: format.dateRange(dates.from, dates.to),
    days,
    plays: stats.totals.plays,
  });
  const heading =
    period.kind === 'year'
      ? t('title.year', { year: String(period.year) })
      : period.kind === 'month'
        ? t('title.month', { month: format.monthYearLong(period.year, period.month) })
        : t(`title.${period.kind}`);
  const empty = stats.totals.streams === 0;
  const shareable = stats.totals.plays > 0 && stats.top.artists.length > 0;

  // O card usa exatamente o período selecionado agora (US-11).
  const buildShare = useCallback(
    () =>
      uploadShareInput({
        stats,
        period,
        periodLabel: format.cap(label),
        mode,
        format,
        t: (key, values) => tCards(key as never, values as never),
      }),
    [stats, period, label, mode, format, tCards],
  );
  const share = useShareLauncher(buildShare);

  const changePeriod = (next: Period) => {
    if (samePeriod(next, period)) return;
    setPeriod(next);
    setAnnouncement(t('period.live', { label: periodLabel(next, format, t('period.allLabel')) }));
  };

  const closeBanner = () => {
    setBannerOpen(false);
    if (mode === 'upload') {
      try {
        window.sessionStorage.setItem(BANNER_KEY, '1');
      } catch {
        /* sessionStorage indisponível: o aviso só volta na próxima visita */
      }
    }
  };

  const goToPeriod = () => {
    periodBox.current?.scrollIntoView({ block: 'center' });
    periodBox.current?.querySelector<HTMLElement>('[role="radio"]')?.focus({ preventScroll: true });
  };

  return (
    <div
      data-testid="dashboard"
      data-mode={mode}
      className="mx-auto flex max-w-page flex-col gap-8 px-4 pt-4 pb-8 sm:px-6 lg:gap-12 lg:px-8 lg:pt-8 lg:pb-16"
    >
      {bannerOpen ? (
        <div
          role="note"
          className="flex items-start gap-3 rounded-md border border-l-4 border-line border-l-info bg-surface py-3 pr-2 pl-3 text-body-sm"
        >
          <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info" />
          <p className="flex-1 py-0.5">{mode === 'upload' ? t('reloadBanner') : t('demoBanner')}</p>
          <button
            type="button"
            onClick={closeBanner}
            aria-label={t('reloadBannerClose')}
            className="-my-1.5 grid size-9 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3">
          <p className="text-overline text-info uppercase">{t(`overline.${mode}`)}</p>
          <h1
            ref={title}
            tabIndex={-1}
            className="font-display text-h1 outline-none lg:text-h1-lg"
            data-testid="dashboard-title"
          >
            {heading}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="sm:hidden">
              <PrivacySealCompact mode={mode} repoUrl={repoUrl} />
            </span>
            {onReset ? (
              <Button variant="ghost" size="sm" onClick={onReset}>
                <RotateCcw aria-hidden="true" />
                {tUpload('reset')}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="hidden lg:block">
          <ShareButton
            onOpen={(from) => void share.open(from)}
            pending={share.pending}
            disabled={!shareable}
          />
        </div>
      </div>

      <section
        aria-labelledby="period-title"
        className="flex flex-col gap-3 lg:rounded-lg lg:border lg:border-line lg:bg-surface/60 lg:p-4"
      >
        <h2 id="period-title" className="sr-only">
          {t('period.heading')}
        </h2>
        <div ref={periodBox} className="lg:max-w-2xl">
          <PeriodSelector
            period={period}
            months={months}
            bounds={bounds}
            onChange={changePeriod}
            format={format}
          />
        </div>
        <p className="text-body-sm text-fg-muted tabular-nums" data-testid="period-summary">
          {summary}
        </p>
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </section>

      {empty ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-line bg-surface p-6">
          <h2 className="font-display text-h3">{t('empty.title')}</h2>
          <p className="text-body-sm text-fg-muted">
            {t('empty.body', {
              from: format.dateShort(bounds.min),
              to: format.dateShort(bounds.max),
            })}
          </p>
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 md:gap-x-8 lg:grid-cols-12 lg:items-start lg:gap-x-8 lg:gap-y-12 xl:gap-x-10 [&>*]:min-w-0">
          <div className="md:col-span-2 lg:col-span-4 lg:col-start-9 lg:row-start-1">
            <TotalsSection totals={stats.totals} format={format} />
          </div>
          <div className="lg:col-span-4 lg:col-start-9 lg:row-start-2">
            <SelfMetricsSection self={stats.self} format={format} />
          </div>
          <div className="lg:col-span-8 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <RankingSection top={stats.top} format={format} />
          </div>
          <div className="md:col-span-2 lg:col-span-8 lg:col-start-1 lg:row-start-3">
            <HeatmapSection heatmap={stats.heatmap} format={format} periodLabel={label} />
          </div>
          <div className="md:col-span-2 lg:col-span-4 lg:col-start-9 lg:row-start-3">
            <PlatformsSection platforms={stats.platforms} format={format} />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1 border-t border-line pt-4 text-center text-caption text-fg-subtle">
        <p>{mode === 'upload' ? t('footer.upload') : t('footer.demo')}</p>
        {report && elapsedMs !== undefined ? (
          <p data-testid="upload-report">
            {t('footer.report', {
              music: report.music,
              files: report.files,
              seconds: format.number(Math.round(elapsedMs / 100) / 10),
              nonMusic: report.nonMusic,
            })}
          </p>
        ) : null}
      </div>

      <div
        data-bottom-bar
        className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-line bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
      >
        <button
          type="button"
          onClick={goToPeriod}
          aria-label={t('period.barLabel', { label })}
          className="min-h-11 min-w-0 flex-1 rounded-sm text-left"
        >
          <b className="block truncate font-display text-[18px] leading-tight font-bold">{label}</b>
          <span className="block truncate text-caption text-fg-muted tabular-nums">
            {`${format.minutes(stats.totals.ms)} min · ${format.number(stats.totals.plays)} plays`}
          </span>
        </button>
        <ShareButton
          onOpen={(from) => void share.open(from)}
          pending={share.pending}
          disabled={!shareable}
        />
      </div>
      {share.dialog}
    </div>
  );
}
