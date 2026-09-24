import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { CONNECT_ERRORS, type ConnectError } from '@/server/auth-shared';
import { getConnectState } from '@/server/connect-state';

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

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>
      <p className="text-sm text-neutral-400">{t('intro')}</p>
      {error ? (
        <p role="alert" className="text-base text-neutral-100">
          {t(`errors.${error}`)}
        </p>
      ) : null}
      {state === 'disabled' ? <p className="text-neutral-200">{t('disabled')}</p> : null}
      {state === 'connected' ? (
        <>
          <p role="status" className="text-neutral-200">
            {t('connected')}
          </p>
          <form method="post" action={`/api/auth/logout?locale=${current}`}>
            <button
              type="submit"
              className="rounded-full border border-neutral-500 px-5 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              {t('logout')}
            </button>
          </form>
        </>
      ) : null}
      {state === 'disconnected' ? (
        <>
          <p role="status" className="text-neutral-200">
            {t('disconnected')}
          </p>
          <a
            href={`/api/auth/login?locale=${current}`}
            className="w-fit rounded-full bg-neutral-100 px-5 py-2 font-semibold text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            {t('login')}
          </a>
        </>
      ) : null}
      <Link
        href="/"
        className="w-fit text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        {t('back')}
      </Link>
    </main>
  );
}
