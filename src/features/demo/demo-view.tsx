'use client';

import { useTranslations } from 'next-intl';
import { Tabs } from 'radix-ui';
import { useEffect, useMemo, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { useHydrated } from '@/components/ui/use-hydrated';
import { createConnectBundle } from '@/features/connect/connect-client';
import { ConnectDashboard } from '@/features/connect/connect-dashboard';
import { ConnectProvider } from '@/features/connect/connect-provider';
import { createDemoSource } from '@/features/connect/demo-source';
import { EXTRA_PERIOD_KIND, type WindowExtra } from '@/features/connect/window-extras';
import { Dashboard } from '@/features/dashboard/dashboard';
import { LikedBoard, LikedSection } from '@/features/dashboard/liked-board';
import { useDatasetStore } from '@/features/dataset/store';

/**
 * Modo Demo (RF-12, US-07): `generateDemo()` é carregado sob demanda (chunk próprio) e roda no
 * navegador, sem rede. A Visão Upload mostra também o quadro de curtidas
 * (`generateDemo().library`, as mesmas curtidas da Visão Conectar). As abas separam as visões Upload e Conectar; a visão Conectar reaproveita
 * o dashboard do modo Conectar sobre `generateDemo().api` (+ `demoSavedPage`/`demoArtist`), com
 * um cliente de queries próprio e sem nenhum link ou marca do Spotify (`api.demo === true`).
 */
export function DemoView({ repoUrl }: { repoUrl?: string }) {
  const t = useTranslations('Dashboard');
  const demo = useDatasetStore((state) => state.demo);
  const setDemo = useDatasetStore((state) => state.setDemo);
  const hydrated = useHydrated();
  const [tab, setTab] = useState<DemoTab>('upload');
  // Atalho "Desde o começo"/"Selecionar período" da Visão Conectar: abre a Visão Upload já no
  // modo equivalente. Some ao trocar de aba à mão, para não roubar o foco depois.
  const [uploadStart, setUploadStart] = useState<'all' | 'range' | null>(null);
  // Um cliente de queries por Demo carregado: trocar de aba e voltar reaproveita o cache.
  const connectBundle = useMemo(
    () => (demo ? createConnectBundle(createDemoSource(demo.api)) : null),
    [demo],
  );

  useEffect(() => {
    if (demo) return;
    let active = true;
    void import('@/domain/demo').then(({ generateDemo }) => {
      if (active) setDemo(generateDemo());
    });
    return () => {
      active = false;
    };
  }, [demo, setDemo]);

  // As abas só existem no cliente: o Radix Tabs gera `style` no SSR, que a CSP bloquearia.
  if (!hydrated) return <DemoSkeleton />;

  const changeTab = (next: string) => {
    setUploadStart(null);
    setTab(next as DemoTab);
  };
  const openUpload = (extra: WindowExtra) => {
    setUploadStart(EXTRA_PERIOD_KIND[extra]);
    setTab('upload');
  };

  return (
    <Tabs.Root value={tab} onValueChange={changeTab} className="flex flex-col">
      <div className="border-b border-line">
        <Tabs.List
          aria-label={t('tabs.label')}
          className="mx-auto flex max-w-page gap-6 overflow-x-auto px-4 sm:px-6 lg:px-8"
        >
          {(['upload', 'connect'] as const).map((value) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className="relative h-12 shrink-0 text-body font-semibold text-fg-muted transition-colors hover:text-fg data-[state=active]:text-fg data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:bottom-0 data-[state=active]:after:h-[3px] data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary"
            >
              {t(`tabs.${value}`)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </div>
      <Tabs.Content value="upload" className="outline-none">
        {demo ? (
          <Dashboard
            mode="demo"
            dataset={demo.dataset}
            timeZone={demo.timeZone}
            repoUrl={repoUrl}
            initialPeriodKind={uploadStart ?? undefined}
            liked={
              <LikedSection>
                <LikedBoard library={demo.library} />
              </LikedSection>
            }
          />
        ) : (
          <DemoSkeleton />
        )}
      </Tabs.Content>
      <Tabs.Content value="connect" className="outline-none">
        {connectBundle ? (
          <ConnectProvider bundle={connectBundle}>
            <ConnectDashboard repoUrl={repoUrl} onOpenUpload={openUpload} />
          </ConnectProvider>
        ) : (
          <DemoSkeleton />
        )}
      </Tabs.Content>
    </Tabs.Root>
  );
}

type DemoTab = 'upload' | 'connect';

function DemoSkeleton() {
  const t = useTranslations('Dashboard');
  return (
    <div
      aria-busy="true"
      className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8"
    >
      <p className="sr-only" role="status">
        {t('demoLoading')}
      </p>
      <Skeleton className="h-10 w-2/3 max-w-sm" />
      <Skeleton className="h-11 w-full max-w-2xl rounded-full" />
      <Skeleton className="h-36 w-full" />
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
