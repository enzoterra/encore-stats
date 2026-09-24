import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { DemoView } from '@/features/demo/demo-view';
import { routing } from '@/i18n/routing';
import { getServerEnv } from '@/server/env';

export async function generateMetadata({ params }: PageProps<'/[locale]/demo'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('demoTitle') };
}

/** Modo Demo (RF-12): histórico fictício determinístico gerado no navegador. */
export default async function DemoPage({ params }: PageProps<'/[locale]/demo'>) {
  const { locale } = await params;
  setRequestLocale(hasLocale(routing.locales, locale) ? locale : routing.defaultLocale);
  const repoUrl = getServerEnv().repoUrl;
  return (
    <>
      <SiteHeader mode="demo" repoUrl={repoUrl} />
      <main id="main">
        <DemoView repoUrl={repoUrl} />
      </main>
      <SiteFooter repoUrl={repoUrl} />
    </>
  );
}
