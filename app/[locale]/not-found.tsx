import { SearchX } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { getServerEnv } from '@/server/env';

// O locale vem do `setRequestLocale` do layout (ou do cabeçalho que o next-intl põe no proxy).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('NotFound');
  return { title: t('metaTitle') };
}

/**
 * 404 localizado (pt-BR/en), acionado por `[...rest]/page.tsx`. Renderizado dentro do layout de
 * `[locale]`, que é dinâmico: os scripts do Next recebem o nonce da CSP da requisição (antes, o 404
 * estático saía sem nonce e com o JS bloqueado). O Next 16 entrega o `notFound()` de uma rota
 * dinâmica como shell de erro + render no cliente, então esta tela depende de JS, como o resto do
 * app. Não reflete a URL pedida.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations('NotFound');
  const { repoUrl } = getServerEnv();

  return (
    <>
      <SiteHeader repoUrl={repoUrl} />
      <main
        id="main"
        data-testid="not-found"
        className="mx-auto flex max-w-page flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="flex max-w-xl flex-col items-center gap-4">
          <SearchX aria-hidden="true" className="size-10 text-fg-muted" />
          <p className="text-overline text-info uppercase">{t('overline')}</p>
          <h1 className="font-display text-h1 lg:text-h1-lg">{t('title')}</h1>
          <p className="max-w-prose text-body-lg text-fg-muted">{t('body')}</p>
          <div className="mt-2 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <Link href="/" className={buttonClasses({ variant: 'primary', size: 'lg' })}>
              {t('home')}
            </Link>
            <Link href="/demo" className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
              {t('demo')}
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter repoUrl={repoUrl} />
    </>
  );
}
