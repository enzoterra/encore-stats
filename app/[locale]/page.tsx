import { ArrowDown, CalendarRange, Clock, Share2, Sparkles } from 'lucide-react';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PrivacySealCompact, PrivacySealPanel } from '@/components/layout/privacy-seal';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { ModeCards } from '@/features/landing/mode-cards';
import { PosterTeaser } from '@/features/landing/poster';
import { routing } from '@/i18n/routing';
import { getConnectStatus, getServerEnv } from '@/server/env';

const FEATURES = [
  { key: 'tops', Icon: CalendarRange },
  { key: 'when', Icon: Clock },
  { key: 'self', Icon: Sparkles },
  { key: 'share', Icon: Share2 },
] as const;

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  const current = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  setRequestLocale(current);
  const t = await getTranslations('Landing');
  const repoUrl = getServerEnv().repoUrl;
  const connectEnabled = getConnectStatus().enabled;

  return (
    <>
      <SiteHeader repoUrl={repoUrl} />
      <main id="main" className="stage-glow">
        <section className="mx-auto grid max-w-page items-center gap-10 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.25fr_1fr] lg:gap-16 lg:px-8 lg:pt-20 lg:pb-24">
          <div className="flex flex-col items-start gap-6">
            <p className="text-overline text-info uppercase">{t('overline')}</p>
            <h1 className="font-display text-display text-balance">{t('title')}</h1>
            <p className="max-w-prose text-body-lg text-fg-muted">{t('lead')}</p>
            <div className="flex flex-wrap items-center gap-4">
              <PrivacySealCompact mode="upload" repoUrl={repoUrl} />
              <a
                href="#modes"
                className="inline-flex h-11 items-center gap-2 rounded-full px-2 text-body-sm font-semibold text-fg-muted hover:text-fg"
              >
                <ArrowDown aria-hidden="true" className="size-4" />
                {t('start')}
              </a>
            </div>
          </div>
          <PosterTeaser locale={current} />
        </section>

        <section
          id="modes"
          aria-labelledby="modes-title"
          className="mx-auto flex max-w-page flex-col gap-6 px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24"
        >
          <div className="flex flex-col gap-2">
            <h2 id="modes-title" className="font-display text-h2 lg:text-h2-lg">
              {t('modesTitle')}
            </h2>
            <p className="max-w-prose text-body text-fg-muted">{t('modesLead')}</p>
          </div>
          <ModeCards connectEnabled={connectEnabled} />
        </section>

        <section
          aria-labelledby="features-title"
          className="mx-auto flex max-w-page flex-col gap-6 px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24"
        >
          <h2 id="features-title" className="font-display text-h2 lg:text-h2-lg">
            {t('featuresTitle')}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {FEATURES.map(({ key, Icon }) => (
              <li key={key} className="flex flex-col gap-2 rounded-lg border border-line p-5">
                <Icon aria-hidden="true" className="size-6 text-neon-orange" />
                <h3 className="text-h4">{t(`features.${key}.title`)}</h3>
                <p className="text-body-sm text-fg-muted">{t(`features.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="privacy-title"
          className="mx-auto grid max-w-page gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8 lg:pb-24"
        >
          <div className="flex flex-col gap-3">
            <h2 id="privacy-title" className="font-display text-h2 lg:text-h2-lg">
              {t('privacyTitle')}
            </h2>
            <p className="max-w-prose text-body-lg text-fg-muted">{t('privacyLead')}</p>
          </div>
          <PrivacySealPanel mode="upload" repoUrl={repoUrl} />
        </section>
      </main>
      <SiteFooter repoUrl={repoUrl} />
    </>
  );
}
