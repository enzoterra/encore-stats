import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { CONNECT_ERRORS, type ConnectError } from '@/server/auth-shared';
import { getConnectState } from '@/server/connect-state';
import { getServerEnv } from '@/server/env';

/**
 * Página provisória do modo Conectar: destino do callback do OAuth (`/{locale}/connect`, com
 * `?error=` nos desfechos ruins). A tela completa, com o dashboard, é da Sprint 5.
 */
export default async function ConnectPage({
  params,
  searchParams,
}: PageProps<'/[locale]/connect'>) {
  const { locale } = await params;
  const current = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  setRequestLocale(current);
  const t = await getTranslations('Connect');

  const rawError = (await searchParams).error;
  const error = CONNECT_ERRORS.find((code): code is ConnectError => code === rawError);
  const state = await getConnectState();

  const repoUrl = getServerEnv().repoUrl;

  return (
    <>
      <SiteHeader seal="connect" repoUrl={repoUrl} />
      <main id="main" className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16">
        <h1 className="font-display text-h1 lg:text-h1-lg">{t('title')}</h1>
        <p className="text-body-sm text-fg-subtle">{t('intro')}</p>
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-l-4 border-line border-l-danger bg-surface p-4 text-body text-fg"
          >
            {t(`errors.${error}`)}
          </p>
        ) : null}
        {state === 'disabled' ? <p className="text-fg-muted">{t('disabled')}</p> : null}
        {state === 'connected' ? (
          <>
            <p role="status" className="text-fg-muted">
              {t('connected')}
            </p>
            <form method="post" action={`/api/auth/logout?locale=${current}`}>
              <button type="submit" className={buttonClasses({ variant: 'destructive' })}>
                {t('logout')}
              </button>
            </form>
          </>
        ) : null}
        {state === 'disconnected' ? (
          <>
            <p role="status" className="text-fg-muted">
              {t('disconnected')}
            </p>
            <a
              href={`/api/auth/login?locale=${current}`}
              className={buttonClasses({ variant: 'primary', className: 'w-fit' })}
            >
              {t('login')}
            </a>
          </>
        ) : null}
        <Link
          href="/"
          className="w-fit text-body-sm text-primary-fg underline decoration-1 underline-offset-[3px] hover:decoration-2"
        >
          {t('back')}
        </Link>
      </main>
      <SiteFooter repoUrl={repoUrl} />
    </>
  );
}
