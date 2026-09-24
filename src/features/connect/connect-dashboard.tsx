'use client';

import { CircleAlert, Info, RotateCcw, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { PrivacySealCompact } from '@/components/layout/privacy-seal';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { useToasts } from '@/components/ui/toast';
import { useHydrated } from '@/components/ui/use-hydrated';
import { TIME_RANGES, type TimeRange } from '@/domain/spotify-types';

import { NotAllowlisted, SessionExpired } from './account-states';
import { isBffError } from './bff-client';
import { useConnectBundle, useConnectStatus } from './connect-provider';
import { GenresSection } from './genres-section';
import { LikedSection, LikedSkeleton } from './liked-section';
import { useMe } from './queries';
import { QuotaBanner } from './quota-banner';
import { RecentSection } from './recent-section';
import { TopSection } from './top-section';
import { TrendsSection } from './trends-section';

const PAGE_ERRORS = new Set(['UNAUTHENTICATED', 'NOT_ALLOWLISTED', 'QUOTA']);

/**
 * Dashboard do modo Conectar (RF-15..RF-19, US-09/US-10), fiel ao 10-design.md: seletor de
 * janela, top artistas/músicas, tendências, tocadas recentemente, gêneros e curtidas. Cada seção
 * tem os próprios estados; a falha de uma não derruba as outras (RNF-05). No Demo, a mesma tela
 * roda sobre as respostas fictícias, sem links nem marca do Spotify.
 */
export function ConnectDashboard({ repoUrl }: { repoUrl?: string }) {
  const t = useTranslations('Connect.dashboard');
  const tMe = useTranslations('Connect.meError');
  const tSection = useTranslations('Connect.sectionError');
  const tShare = useTranslations('Dashboard');
  const { source } = useConnectBundle();
  const demo = source.kind === 'demo';
  const session = useConnectStatus((state) => state.session);
  const me = useMe();
  const [range, setRange] = useState<TimeRange>('short_term');
  const [announcement, setAnnouncement] = useState('');
  const windowBox = useRef<HTMLDivElement>(null);
  const setRaised = useToasts((state) => state.setRaised);
  const hydrated = useHydrated();

  useEffect(() => {
    setRaised(true);
    return () => setRaised(false);
  }, [setRaised]);

  // Só no cliente: o Radix ToggleGroup gera `style` no SSR, que a CSP bloquearia. Os dados vêm
  // todos do navegador, então o HTML do servidor não teria nada além dos skeletons.
  if (!hydrated) return <ConnectSkeleton />;
  if (session === 'expired') return <SessionExpired />;
  if (session === 'forbidden') return <NotAllowlisted />;

  const label = t(`windows.${range}`);
  const changeRange = (next: TimeRange) => {
    if (next === range) return;
    setRange(next);
    setAnnouncement(t('windowLive', { label: t(`windows.${next}`) }));
  };
  const goToWindow = () => {
    windowBox.current?.scrollIntoView({ block: 'center' });
    windowBox.current?.querySelector<HTMLElement>('[role="radio"]')?.focus({ preventScroll: true });
  };

  const meFailed = me.isError && !(isBffError(me.error) && PAGE_ERRORS.has(me.error.code));
  const name = me.data?.displayName;

  return (
    <div
      data-testid="connect-dashboard"
      data-mode={source.kind}
      className="mx-auto flex max-w-page flex-col gap-8 px-4 pt-4 pb-8 sm:px-6 lg:gap-12 lg:px-8 lg:pt-8 lg:pb-16"
    >
      {demo ? (
        <div
          role="note"
          className="flex items-start gap-3 rounded-md border border-l-4 border-line border-l-info bg-surface p-3 text-body-sm"
        >
          <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info" />
          <p>{t('demoBanner')}</p>
        </div>
      ) : null}
      <QuotaBanner />

      <div className="flex flex-col gap-3">
        <p className="text-overline text-info uppercase">
          {demo ? t('overlineDemo') : t('overline')}
        </p>
        <h1
          className="font-display text-h1 [overflow-wrap:anywhere] lg:text-h1-lg"
          data-testid="connect-title"
        >
          {name ? t('greeting', { name }) : t('greetingAnon')}
        </h1>
        <p className="max-w-prose text-body text-fg-muted">{demo ? t('leadDemo') : t('lead')}</p>
        <span className="sm:hidden">
          <PrivacySealCompact mode={demo ? 'demo' : 'connect'} repoUrl={repoUrl} />
        </span>
      </div>

      {meFailed ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-lg border border-line bg-surface p-6"
        >
          <div className="flex items-center gap-2">
            <CircleAlert aria-hidden="true" className="size-5 shrink-0 text-danger" />
            <h2 className="text-h4">{tMe('title')}</h2>
          </div>
          <p className="text-body-sm text-fg-muted">{tMe('body')}</p>
          <Button variant="secondary" onClick={() => void me.refetch()}>
            <RotateCcw aria-hidden="true" />
            {tSection('retry')}
          </Button>
        </div>
      ) : (
        <>
          <section
            aria-labelledby="window-title"
            className="flex flex-col gap-3 lg:rounded-lg lg:border lg:border-line lg:bg-surface/60 lg:p-4"
          >
            <h2 id="window-title" className="sr-only">
              {t('windowHeading')}
            </h2>
            <div ref={windowBox} className="w-full max-w-md">
              <Segmented
                label={t('windowLabel')}
                value={range}
                onChange={changeRange}
                options={TIME_RANGES.map((r) => ({ value: r, label: t(`windows.${r}`) }))}
              />
            </div>
            <p className="text-body-sm text-fg-muted" data-testid="window-summary">
              {t(`windowSummary.${range}`)}
            </p>
            <p className="sr-only" aria-live="polite">
              {announcement}
            </p>
          </section>

          <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-12 [&>*]:min-w-0">
            <div className="lg:col-span-7">
              <TopSection range={range} />
            </div>
            <div className="flex flex-col gap-10 lg:col-span-5">
              {/* A varredura começa já com a conta conhecida (o cache de 12 h é por conta). */}
              {me.data ? <LikedSection key={me.data.id} userId={me.data.id} /> : <LikedSkeleton />}
              <GenresSection range={range} />
            </div>
            <div className="lg:col-span-7">
              <TrendsSection />
            </div>
            <div className="lg:col-span-5">
              <RecentSection />
            </div>
          </div>
        </>
      )}

      <p className="border-t border-line pt-4 text-center text-caption text-fg-subtle">
        {demo ? t('footerDemo') : t('footer')}
      </p>

      <div
        data-bottom-bar
        className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-line bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
      >
        <button
          type="button"
          onClick={goToWindow}
          aria-label={t('barLabel', { label })}
          className="min-h-11 min-w-0 flex-1 rounded-sm text-left"
        >
          <b className="block truncate font-display text-[18px] leading-tight font-bold">{label}</b>
          <span className="block truncate text-caption text-fg-muted">
            {t(`windowSummary.${range}`)}
          </span>
        </button>
        <Button
          variant="primary"
          disabled
          title={tShare('shareSoon')}
          aria-describedby="connect-share-soon"
        >
          <Share2 aria-hidden="true" />
          {tShare('share')}
        </Button>
      </div>
      <p id="connect-share-soon" className="sr-only">
        {tShare('shareSoon')}
      </p>
    </div>
  );
}

function ConnectSkeleton() {
  const t = useTranslations('Common');
  return (
    <div
      aria-busy="true"
      className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8"
    >
      <p className="sr-only" role="status">
        {t('loading')}
      </p>
      <Skeleton className="h-4 w-40 rounded-xs" />
      <Skeleton className="h-10 w-2/3 max-w-sm" />
      <Skeleton className="h-11 w-full max-w-md rounded-full" />
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-96 lg:col-span-7" />
        <Skeleton className="h-64 lg:col-span-5" />
      </div>
    </div>
  );
}
