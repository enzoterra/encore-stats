import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ToastViewport } from '@/components/ui/toast';
import { routing } from '@/i18n/routing';
import { getServerEnv } from '@/server/env';

import '../globals.css';

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return {
    metadataBase: new URL(getServerEnv().siteUrl),
    title: t('title'),
    description: t('description'),
    alternates: { languages: { 'pt-BR': '/pt-BR', en: '/en' } },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0e0b1a',
  colorScheme: 'dark',
};

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Common' });

  // Ler o cabeçalho torna a rota dinâmica: a CSP com nonce exige render por requisição,
  // para que o Next aplique o nonce aos próprios scripts.
  await headers();

  return (
    <html lang={locale}>
      <head>
        {/* 10-design.md §13: preload só do Inter; a Bricolage entra com font-display: swap. */}
        <link
          rel="preload"
          href="/fonts/Inter-VF-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-dvh bg-background font-sans text-body text-fg">
        <NextIntlClientProvider>
          <a
            href="#main"
            className="sr-only z-50 rounded-full bg-accent px-4 py-2 font-semibold text-on-vibrant focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
          >
            {t('skipToContent')}
          </a>
          {children}
          <ToastViewport />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
