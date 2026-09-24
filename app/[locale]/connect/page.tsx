import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { AccountMenu } from '@/features/connect/account-menu';
import { NotAllowlisted } from '@/features/connect/account-states';
import { ConnectDashboard } from '@/features/connect/connect-dashboard';
import { ConnectLanding, type LandingError } from '@/features/connect/connect-landing';
import { ConnectProvider } from '@/features/connect/connect-provider';
import { routing } from '@/i18n/routing';
import { CONNECT_ERRORS, type ConnectError } from '@/server/auth-shared';
import { getConnectState } from '@/server/connect-state';
import { getServerEnv } from '@/server/env';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/connect'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Connect' });
  return { title: t('title') };
}

/**
 * Modo Conectar (RF-13..RF-19, US-08..US-10). É também o destino do callback do OAuth
 * (`/{locale}/connect`, com `?error=` nos desfechos ruins):
 * - sem credenciais no ambiente → entrada com o botão desabilitado e o motivo;
 * - sem sessão → entrada com "Entrar com o Spotify" (e o erro do callback, se houver);
 * - `?error=not_allowlisted` → tela da allowlist (limite de 5 contas);
 * - com sessão → dashboard, que busca os dados no BFF pelo navegador.
 */
export default async function ConnectPage({
  params,
  searchParams,
}: PageProps<'/[locale]/connect'>) {
  const { locale } = await params;
  const current = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  setRequestLocale(current);

  const query = await searchParams;
  // Só códigos conhecidos: o valor da URL nunca é exibido nem interpretado como texto.
  const error = CONNECT_ERRORS.find((code): code is ConnectError => code === query.error);
  const loggedOut = query.status === 'logged_out';
  const state = await getConnectState();
  const repoUrl = getServerEnv().repoUrl;

  if (state === 'connected') {
    return (
      <ConnectProvider>
        <SiteHeader mode="connect" repoUrl={repoUrl} actions={<AccountMenu />} />
        <main id="main">
          <ConnectDashboard repoUrl={repoUrl} />
        </main>
        <SiteFooter repoUrl={repoUrl} />
      </ConnectProvider>
    );
  }

  return (
    <>
      <SiteHeader seal="connect" repoUrl={repoUrl} />
      <main id="main">
        {error === 'not_allowlisted' ? (
          <NotAllowlisted />
        ) : (
          <ConnectLanding
            enabled={state !== 'disabled'}
            error={error as LandingError | undefined}
            loggedOut={loggedOut && !error}
            repoUrl={repoUrl}
          />
        )}
      </main>
      <SiteFooter repoUrl={repoUrl} />
    </>
  );
}
