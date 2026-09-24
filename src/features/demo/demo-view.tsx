'use client';

import { Radio } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tabs } from 'radix-ui';
import { useEffect } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { useHydrated } from '@/components/ui/use-hydrated';
import { Dashboard } from '@/features/dashboard/dashboard';
import { useDatasetStore } from '@/features/dataset/store';

/**
 * Modo Demo (RF-12, US-07): `generateDemo()` é carregado sob demanda (chunk próprio) e roda no
 * navegador, sem rede. As abas já separam as visões Upload e Conectar; a visão Conectar do demo
 * usa `api` de `DemoData` na Sprint 5.
 */
export function DemoView({ repoUrl }: { repoUrl?: string }) {
  const t = useTranslations('Dashboard');
  const demo = useDatasetStore((state) => state.demo);
  const setDemo = useDatasetStore((state) => state.setDemo);
  const hydrated = useHydrated();

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

  return (
    <Tabs.Root defaultValue="upload" className="flex flex-col">
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
          />
        ) : (
          <DemoSkeleton />
        )}
      </Tabs.Content>
      <Tabs.Content value="connect" className="outline-none">
        <div className="mx-auto flex max-w-page flex-col items-start gap-3 px-4 py-12 sm:px-6 lg:px-8">
          <Radio aria-hidden="true" className="size-10 text-fg-muted" />
          <p className="max-w-prose text-body-lg text-fg-muted">{t('tabs.connectSoon')}</p>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}

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
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
