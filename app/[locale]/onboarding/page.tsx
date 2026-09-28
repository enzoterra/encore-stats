import { ArrowRight, ExternalLink, Heart } from 'lucide-react';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { type ReactNode } from 'react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { Alert } from '@/components/ui/alert';
import { Button, buttonClasses } from '@/components/ui/button';
import { ReminderButton } from '@/features/onboarding/reminder-button';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getConnectStatus, getServerEnv } from '@/server/env';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/onboarding'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('onboardingTitle') };
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4 rounded-lg border border-line bg-surface p-5 sm:gap-5 sm:p-6">
      <span
        aria-hidden="true"
        className="w-8 shrink-0 font-display text-[32px] leading-none font-extrabold text-accent tabular-nums"
      >
        {n}
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <h3 className="font-display text-h3">{title}</h3>
        <div className="text-body text-fg-muted">{children}</div>
      </div>
    </li>
  );
}

const linkClass =
  'inline-flex items-center gap-1 font-semibold text-primary-fg underline decoration-1 underline-offset-[3px] hover:decoration-2';

/** Onboarding "Como pedir seu histórico" (RF-02, US-02, 10-design.md §8.17). */
export default async function OnboardingPage({ params }: PageProps<'/[locale]/onboarding'>) {
  const { locale } = await params;
  const current = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  setRequestLocale(current);
  const t = await getTranslations('Onboarding');
  const tc = await getTranslations('Common');
  const repoUrl = getServerEnv().repoUrl;
  const connectEnabled = getConnectStatus().enabled;
  const likedSteps = t.raw('liked.steps') as string[];

  return (
    <>
      <SiteHeader repoUrl={repoUrl} />
      <main
        id="main"
        className="mx-auto grid max-w-page gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[640px_1fr] lg:gap-16 lg:px-8 lg:py-16"
      >
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-4">
            <p className="text-overline text-info uppercase">{t('overline')}</p>
            <h1 className="font-display text-h1 lg:text-h1-lg">{t('title')}</h1>
            <p className="text-body-lg text-fg-muted">{t('lead')}</p>
          </header>

          <Alert tone="warning" icon="clock" title={t('waitTitle')} titleAs="p" role="note">
            {t('wait')}
          </Alert>

          <section aria-labelledby="steps-title" className="flex flex-col gap-4">
            <h2 id="steps-title" className="sr-only">
              {t('stepsLabel')}
            </h2>
            <ol className="flex flex-col gap-3">
              <Step n={1} title={t('steps.open.title')}>
                <p>{t('steps.open.body')}</p>
                <a
                  href="https://www.spotify.com/account/privacy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${linkClass} mt-2`}
                >
                  {t('steps.open.link')}
                  <ExternalLink aria-hidden="true" className="size-4" />
                  <span className="sr-only">{tc('externalLink')}</span>
                </a>
              </Step>
              <Step n={2} title={t('steps.select.title')}>
                <p>
                  {t('steps.select.bodyBefore')}{' '}
                  <strong className="font-semibold text-fg">{t('steps.select.bodyStrong')}</strong>{' '}
                  {t('steps.select.bodyAfter')}
                </p>
              </Step>
              <Step n={3} title={t('steps.confirm.title')}>
                <p>{t('steps.confirm.body')}</p>
              </Step>
              <Step n={4} title={t('steps.return.title')}>
                <p>{t('steps.return.body')}</p>
                <Link href="/upload" className={`${linkClass} mt-2`}>
                  {t('steps.return.link')}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Step>
            </ol>
          </section>

          <ReminderButton />

          <section
            id="dados-da-conta"
            aria-labelledby="liked-title"
            data-testid="onboarding-liked"
            className="flex scroll-mt-20 flex-col gap-4 rounded-lg border border-t-[3px] border-line border-t-primary bg-surface p-5 sm:p-6"
          >
            <div className="flex flex-col gap-2">
              <p className="inline-flex items-center gap-2 text-overline text-primary-fg uppercase">
                <Heart aria-hidden="true" className="size-4" />
                {t('liked.overline')}
              </p>
              <h2 id="liked-title" className="font-display text-h2">
                {t('liked.title')}
              </h2>
              <p className="text-body text-fg-muted">{t('liked.lead')}</p>
            </div>
            <ol aria-label={t('liked.stepsLabel')} className="flex flex-col gap-3">
              {likedSteps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-body-sm font-bold text-accent tabular-nums"
                  >
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1 pt-0.5 text-body text-fg-muted">
                    <p>{step}</p>
                    {index === 0 ? (
                      <a
                        href="https://www.spotify.com/account/privacy/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClass}
                      >
                        {t('steps.open.link')}
                        <ExternalLink aria-hidden="true" className="size-4" />
                        <span className="sr-only">{tc('externalLink')}</span>
                      </a>
                    ) : null}
                    {index === likedSteps.length - 1 ? (
                      <Link href="/upload" className={linkClass}>
                        {t('steps.return.link')}
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside aria-labelledby="meanwhile-title" className="flex flex-col gap-4 lg:pt-40">
          <h2 id="meanwhile-title" className="font-display text-h2">
            {t('meanwhile.title')}
          </h2>
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 sm:p-6">
            <h3 className="text-h4">{t('meanwhile.demoTitle')}</h3>
            <p className="text-body-sm text-fg-muted">{t('meanwhile.demoBody')}</p>
            <Link href="/demo" className={buttonClasses({ variant: 'primary', block: true })}>
              {t('meanwhile.demoCta')}
            </Link>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 sm:p-6">
            <h3 className="text-h4">{t('meanwhile.connectTitle')}</h3>
            <p className="text-body-sm text-fg-muted">{t('meanwhile.connectBody')}</p>
            {connectEnabled ? (
              <Link
                href="/connect"
                className={buttonClasses({ variant: 'secondary', block: true })}
              >
                {t('meanwhile.connectCta')}
              </Link>
            ) : (
              <>
                <Button variant="secondary" block disabled aria-describedby="meanwhile-connect-why">
                  {t('meanwhile.connectCta')}
                </Button>
                <p id="meanwhile-connect-why" className="text-caption text-fg-muted">
                  {t('meanwhile.connectDisabled')}
                </p>
              </>
            )}
          </div>
        </aside>
      </main>
      <SiteFooter repoUrl={repoUrl} />
    </>
  );
}
