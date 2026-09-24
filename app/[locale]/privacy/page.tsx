import { ExternalLink, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { type ReactNode } from 'react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { routing } from '@/i18n/routing';
import { getServerEnv } from '@/server/env';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/privacy'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('privacyTitle') };
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-display text-h2">
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-body-lg text-fg-muted">{children}</div>
    </section>
  );
}

const external =
  'inline-flex items-center gap-1 text-primary-fg underline decoration-1 underline-offset-[3px] hover:decoration-2';

/**
 * Página de privacidade (RF-24, US-13): quem é o controlador e como falar com ele, o que é tratado,
 * onde, por quanto tempo, base legal e como revogar. Controlador e contato vêm do ambiente
 * (`NEXT_PUBLIC_PRIVACY_CONTROLLER`/`_CONTACT`, obrigatórios em produção: LGPD, art. 9º).
 */
export default async function PrivacyPage({ params }: PageProps<'/[locale]/privacy'>) {
  const { locale } = await params;
  const current = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  setRequestLocale(current);
  const t = await getTranslations('Privacy');
  const tc = await getTranslations('Common');
  const { repoUrl, privacy } = getServerEnv();
  const summary = t.raw('summary') as string[];
  const howLong = t.raw('howLong.items') as string[];
  const rights = t.raw('rights.items') as string[];

  return (
    <>
      <SiteHeader repoUrl={repoUrl} />
      <main
        id="main"
        className="mx-auto flex max-w-page flex-col px-4 py-10 sm:px-6 lg:px-8 lg:py-16"
      >
        <div className="flex max-w-prose flex-col gap-10">
          <header className="flex flex-col gap-4">
            <p className="text-overline text-info uppercase">{t('overline')}</p>
            <h1 className="font-display text-h1 lg:text-h1-lg">{t('title')}</h1>
            <p className="text-body-lg text-fg-muted">{t('lead')}</p>
            <p className="text-caption text-fg-subtle">{t('updated')}</p>
          </header>

          <section
            aria-labelledby="summary"
            className="rounded-lg border border-t-[3px] border-line border-t-success bg-surface p-5 sm:p-6"
          >
            <h2 id="summary" className="mb-3 font-display text-h3">
              {t('summaryTitle')}
            </h2>
            <ul className="flex flex-col gap-3 text-body text-fg">
              {summary.map((item) => (
                <li key={item} className="flex gap-3">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <Section id="controller" title={t('controller.title')}>
            <p>
              {privacy.controller
                ? t('controller.controller', { name: privacy.controller })
                : t('controller.controllerUnset')}
            </p>
            {privacy.contact ? (
              <p>
                {t('controller.contact')}{' '}
                <a href={`mailto:${privacy.contact}`} className={external}>
                  {privacy.contact}
                </a>
              </p>
            ) : repoUrl ? (
              <p>
                {t('controller.contactRepo')}{' '}
                <a href={repoUrl} target="_blank" rel="noopener noreferrer" className={external}>
                  {repoUrl.replace(/^https?:\/\//, '')}
                  <ExternalLink aria-hidden="true" className="size-4" />
                  <span className="sr-only">{tc('externalLink')}</span>
                </a>
              </p>
            ) : (
              <p>{t('controller.contactUnset')}</p>
            )}
          </Section>

          <Section id="what" title={t('what.title')}>
            <h3 className="text-h4 text-fg">{t('what.uploadTitle')}</h3>
            <p>{t('what.upload')}</p>
            <p>{t('what.uploadDiscarded')}</p>
            <h3 className="text-h4 text-fg">{t('what.connectTitle')}</h3>
            <p>{t('what.connect')}</p>
            <h3 className="text-h4 text-fg">{t('what.demoTitle')}</h3>
            <p>{t('what.demo')}</p>
          </Section>

          <Section id="where" title={t('where.title')}>
            <p>{t('where.body')}</p>
          </Section>

          <Section id="how-long" title={t('howLong.title')}>
            <ul className="flex list-disc flex-col gap-2 pl-6 marker:text-primary">
              {howLong.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Section>

          <Section id="legal" title={t('legal.title')}>
            <p>{t('legal.body')}</p>
          </Section>

          <Section id="sharing" title={t('sharing.title')}>
            <p>{t('sharing.body')}</p>
          </Section>

          <Section id="rights" title={t('rights.title')}>
            <ul className="flex list-disc flex-col gap-2 pl-6 marker:text-primary">
              {rights.map((item, i) => (
                <li key={item}>
                  {item}
                  {i === rights.length - 1 ? (
                    <>
                      {' '}
                      <a
                        href="https://www.spotify.com/account/apps/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={external}
                      >
                        {t('rights.revokeLink')}
                        <ExternalLink aria-hidden="true" className="size-4" />
                        <span className="sr-only">{tc('externalLink')}</span>
                      </a>
                      .
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>

          <Section id="cookies" title={t('cookies.title')}>
            <p>{t('cookies.body')}</p>
          </Section>
        </div>
      </main>
      <SiteFooter repoUrl={repoUrl} />
    </>
  );
}
