import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { UploadView } from '@/features/upload/upload-view';
import { routing } from '@/i18n/routing';
import { getServerEnv } from '@/server/env';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/upload'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('uploadTitle') };
}

/** Modo Upload (US-03..US-06): o arquivo é lido num Web Worker e nunca sai do navegador. */
export default async function UploadPage({ params }: PageProps<'/[locale]/upload'>) {
  const { locale } = await params;
  setRequestLocale(hasLocale(routing.locales, locale) ? locale : routing.defaultLocale);
  const repoUrl = getServerEnv().repoUrl;
  return (
    <>
      <SiteHeader mode="upload" repoUrl={repoUrl} />
      <main id="main">
        <UploadView repoUrl={repoUrl} />
      </main>
      <SiteFooter repoUrl={repoUrl} />
    </>
  );
}
