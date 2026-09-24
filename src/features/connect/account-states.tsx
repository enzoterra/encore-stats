import { Lock, ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode } from 'react';

import { buttonClasses } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Link } from '@/i18n/navigation';

/** URL de login do BFF (same-origin). O `locale` só escolhe o idioma da volta. */
export function loginHref(locale: string): string {
  return `/api/auth/login?locale=${encodeURIComponent(locale)}`;
}

function FullState({
  icon,
  title,
  body,
  children,
  testId,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children: ReactNode;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center sm:py-24"
    >
      {icon}
      <h1 className="font-display text-h1 lg:text-h1-lg" tabIndex={-1}>
        {title}
      </h1>
      <p className="max-w-prose text-body-lg text-fg-muted">{body}</p>
      <div className="mt-2 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
        {children}
      </div>
    </div>
  );
}

/** 401 / `invalid_grant` (10-design.md §8.12): página inteira, pede para conectar de novo. */
export function SessionExpired() {
  const t = useTranslations('Connect.expired');
  const locale = useLocale();
  return (
    <FullState
      testId="connect-expired"
      icon={<Lock aria-hidden="true" className="size-10 text-fg-muted" />}
      title={t('title')}
      body={t('body')}
    >
      <a href={loginHref(locale)} className={buttonClasses({ variant: 'primary', size: 'lg' })}>
        {t('action')}
      </a>
    </FullState>
  );
}

/**
 * Fora da allowlist (403, RF-14, US-08): explica o limite de 5 contas do Spotify e manda para
 * Upload ou Demo, que funcionam sem convite.
 */
export function NotAllowlisted({ className }: { className?: string }) {
  const t = useTranslations('Connect.forbidden');
  const locale = useLocale();
  return (
    <div className={cn(className)}>
      <FullState
        testId="connect-forbidden"
        icon={<ShieldCheck aria-hidden="true" className="size-10 text-info" />}
        title={t('title')}
        body={t('body')}
      >
        <Link href="/upload" className={buttonClasses({ variant: 'primary', size: 'lg' })}>
          {t('upload')}
        </Link>
        <Link href="/demo" className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
          {t('demo')}
        </Link>
      </FullState>
      <p className="-mt-8 pb-12 text-center sm:-mt-16">
        <a
          href={loginHref(locale)}
          className="text-body-sm font-semibold text-primary-fg underline decoration-1 underline-offset-[3px] hover:decoration-2"
        >
          {t('otherAccount')}
        </a>
      </p>
    </div>
  );
}
