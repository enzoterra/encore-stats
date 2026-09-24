import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ConnectStatus } from '@/features/home/connect-status';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getConnectStatus } from '@/server/env';

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  const current = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  setRequestLocale(current);
  const t = await getTranslations('Home');
  const otherLocale = current === 'pt-BR' ? 'en' : 'pt-BR';

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-5xl font-bold tracking-tight">{t('title')}</h1>
      <p className="text-lg text-neutral-200">{t('tagline')}</p>
      <p className="text-sm text-neutral-400">{t('status')}</p>
      <ConnectStatus enabled={getConnectStatus().enabled} />
      <Link
        href="/"
        locale={otherLocale}
        className="w-fit text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        {t('switchLanguage')}
      </Link>
    </main>
  );
}
