'use client';

import { useTranslations } from 'next-intl';

import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

import { useConnectStatus } from './connect-provider';
import { useNow } from './queries';

/**
 * `QUOTA` (503, RF-25, 10-design.md §8.12): banner global de largura total; todas as queries
 * ficam pausadas até `pausedUntil` (15 min por padrão). Upload e Demo seguem funcionando.
 */
export function QuotaBanner() {
  const pausedUntil = useConnectStatus((state) => state.pausedUntil);
  // Montado só durante a pausa, para o relógio começar junto com ela.
  return pausedUntil === null ? null : <Banner key={pausedUntil} until={pausedUntil} />;
}

function Banner({ until: pausedUntil }: { until: number }) {
  const t = useTranslations('Connect.quota');
  const now = useNow(30_000);
  const minutes = Math.max(1, Math.ceil((pausedUntil - now) / 60_000));
  return (
    <div data-testid="quota-banner">
      <Alert
        tone="warning"
        role="alert"
        title={t('title')}
        actions={
          <>
            <Link href="/upload" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              {t('upload')}
            </Link>
            <Link href="/demo" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              {t('demo')}
            </Link>
          </>
        }
      >
        {t('body', { minutes })}
      </Alert>
    </div>
  );
}
