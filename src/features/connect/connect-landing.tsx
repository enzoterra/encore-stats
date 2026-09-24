import { Clock, Heart, LogIn, Radio, ShieldCheck, Trophy } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { PrivacySealPanel } from '@/components/layout/privacy-seal';
import { Alert, type AlertTone } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

import { loginHref } from './account-states';

/** Erros de `?error=` que a tela de entrada mostra (o `not_allowlisted` tem tela própria). */
export type LandingError = 'denied' | 'state' | 'oauth' | 'scope' | 'upstream';

const TONES: Record<LandingError, AlertTone> = {
  denied: 'info',
  state: 'warning',
  oauth: 'danger',
  scope: 'warning',
  upstream: 'danger',
};

/**
 * Entrada do modo Conectar (RF-13, US-08): o que o modo mostra, o que pedimos ao Spotify, o limite
 * de convites e o botão "Entrar com o Spotify" (desabilitado, com o motivo, se não houver
 * credenciais). Os desfechos ruins do callback aparecem num alerta acima do botão.
 */
export function ConnectLanding({
  enabled,
  error,
  loggedOut = false,
  repoUrl,
}: {
  enabled: boolean;
  error?: LandingError;
  loggedOut?: boolean;
  repoUrl?: string;
}) {
  const t = useTranslations('Connect');
  const locale = useLocale();

  return (
    <div className="stage-glow">
      <div className="mx-auto grid max-w-page gap-10 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:py-16">
        <div className="flex flex-col gap-5 lg:col-span-7">
          <p className="flex items-center gap-2 text-overline text-info uppercase">
            <Radio aria-hidden="true" className="size-4" />
            {t('landing.overline')}
          </p>
          <h1 className="font-display text-h1 lg:text-h1-lg">{t('title')}</h1>
          <p className="max-w-prose text-body-lg text-fg-muted">{t('landing.lead')}</p>

          {loggedOut ? (
            <Alert tone="success" role="status" titleAs="p" title={t('loggedOut')} />
          ) : null}
          {error ? (
            <Alert
              tone={TONES[error]}
              role="alert"
              title={t(`errors.${error}.title`)}
              className="max-w-2xl"
            >
              {t(`errors.${error}.body`)}
            </Alert>
          ) : null}

          {enabled ? (
            <div className="flex flex-col items-start gap-2">
              <a
                href={loginHref(locale)}
                className={buttonClasses({ variant: 'primary', size: 'lg' })}
                data-testid="connect-login"
              >
                <LogIn aria-hidden="true" />
                {t('landing.login')}
              </a>
              <p className="text-caption text-fg-subtle">{t('landing.loginHint')}</p>
            </div>
          ) : (
            <div className="flex max-w-2xl flex-col items-start gap-3 rounded-lg border border-line bg-surface p-4 sm:p-6">
              <button
                type="button"
                disabled
                aria-describedby="connect-disabled-why"
                className={buttonClasses({ variant: 'primary', size: 'lg' })}
              >
                <LogIn aria-hidden="true" />
                {t('landing.login')}
              </button>
              <p id="connect-disabled-why" className="text-body-sm text-fg-muted">
                <strong className="block font-semibold text-fg">{t('disabledTitle')}</strong>
                {t('disabled')} {t('disabledWhy')}
              </p>
            </div>
          )}

          <div className="flex max-w-2xl flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:p-6">
            <h2 className="flex items-center gap-2 text-h4">
              <ShieldCheck aria-hidden="true" className="size-5 text-info" />
              {t('landing.limitedTitle')}
            </h2>
            <p className="text-body-sm text-fg-muted">{t('landing.limitedBody')}</p>
            <p className="text-body-sm font-semibold">{t('landing.alternatives')}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/upload" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                {t('landing.upload')}
              </Link>
              <Link href="/demo" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                {t('landing.demo')}
              </Link>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-6 lg:col-span-5">
          <div className="rounded-lg border border-line bg-surface p-5 sm:p-6">
            <h2 className="mb-4 font-display text-h3">{t('landing.scopesTitle')}</h2>
            <ul className="flex flex-col gap-3 text-body-sm">
              <li className="flex gap-3">
                <Trophy aria-hidden="true" className="size-5 shrink-0 text-accent" />
                {t('landing.scopes.top')}
              </li>
              <li className="flex gap-3">
                <Clock aria-hidden="true" className="size-5 shrink-0 text-accent" />
                {t('landing.scopes.recent')}
              </li>
              <li className="flex gap-3">
                <Heart aria-hidden="true" className="size-5 shrink-0 text-accent" />
                {t('landing.scopes.library')}
              </li>
            </ul>
            <p className="mt-4 text-caption text-fg-subtle">{t('landing.scopesNote')}</p>
          </div>
          <PrivacySealPanel mode="connect" repoUrl={repoUrl} />
          <Link
            href="/"
            className="w-fit text-body-sm text-primary-fg underline decoration-1 underline-offset-[3px] hover:decoration-2"
          >
            {t('back')}
          </Link>
        </aside>
      </div>
    </div>
  );
}
