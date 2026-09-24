'use client';

import { CircleAlert, Pause, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';

import { isBffError } from './bff-client';
import { useConnectBundle } from './connect-provider';
import { useNow } from './queries';
import { SpotifyLogo } from './spotify-brand';

/**
 * Seção do dashboard Conectar: título + logo completo do Spotify no cabeçalho (10-design.md §10,
 * item 4), exceto no Demo, que não tem metadado real.
 */
export function ConnectSection({
  id,
  title,
  subtitle,
  badge,
  children,
  className,
  testId,
}: {
  id: string;
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const { source } = useConnectBundle();
  return (
    <section
      aria-labelledby={`${id}-title`}
      data-testid={testId}
      className={cn('flex min-w-0 flex-col gap-3', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`${id}-title`} className="font-display text-h2 lg:text-h2-lg">
              {title}
            </h2>
            {badge}
          </div>
          {subtitle ? <p className="text-body-sm text-fg-muted">{subtitle}</p> : null}
        </div>
        {source.kind === 'live' ? <SpotifyLogo className="mt-1.5" /> : null}
      </div>
      {children}
    </section>
  );
}

/** Skeleton de linhas de ranking (§8.15), com o texto de carregando para o leitor de tela. */
export function RowsSkeleton({ rows = 5, cover = true }: { rows?: number; cover?: boolean }) {
  const t = useTranslations('Common');
  return (
    <div aria-busy="true" className="flex flex-col">
      <p className="sr-only" role="status">
        {t('loading')}
      </p>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex min-h-16 items-center gap-3 border-b border-line py-2">
          <Skeleton className="h-5 w-6 rounded-xs" />
          {cover ? <Skeleton className="size-12 rounded-xs" /> : null}
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/5 rounded-xs" />
            <Skeleton className="h-3 w-2/5 rounded-xs" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Contagem regressiva do 429 (§8.12): o leitor de tela ouve só o anúncio inicial e o final;
 * no zero a seção tenta de novo sozinha, e "Tentar agora" fica desabilitado até lá.
 */
function RateLimited({ seconds, onRetry }: { seconds: number; onRetry: () => void }) {
  const t = useTranslations('Connect.rateLimited');
  const [until] = useState(() => Date.now() + seconds * 1000);
  const now = useNow(1000);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  const fired = useRef(false);
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      onRetry();
    }
  }, [left, onRetry]);
  return (
    <Alert
      tone="warning"
      icon="clock"
      titleAs="h3"
      title={t('title')}
      actions={
        <Button variant="secondary" size="sm" disabled={left > 0} onClick={onRetry}>
          <RotateCcw aria-hidden="true" />
          {t('now')}
        </Button>
      }
    >
      <p aria-hidden="true" className="tabular-nums">
        {left > 0 ? t.rich('body', { seconds: left, b: (chunk) => <b>{chunk}</b> }) : t('retrying')}
      </p>
      <p className="sr-only" role="status">
        {left > 0 ? t('announce', { seconds }) : t('retrying')}
      </p>
    </Alert>
  );
}

/** Erro de uma seção: nunca derruba as outras (RNF-05). */
export function SectionError({
  error,
  onRetry,
  errorKey,
}: {
  error: unknown;
  onRetry: () => void;
  /** Muda a cada novo erro (ex.: `errorUpdatedAt`), para reiniciar a contagem do 429. */
  errorKey?: number;
}) {
  const t = useTranslations('Connect.sectionError');
  if (isBffError(error) && error.code === 'RATE_LIMITED') {
    return <RateLimited key={errorKey} seconds={error.retryAfter ?? 5} onRetry={onRetry} />;
  }
  // 401/403/QUOTA viram estados da página inteira ou o banner global; a seção só espera.
  if (isBffError(error) && ['UNAUTHENTICATED', 'NOT_ALLOWLISTED', 'QUOTA'].includes(error.code)) {
    return <SectionPaused />;
  }
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-line bg-surface p-4 sm:p-6"
    >
      <div className="flex items-center gap-2">
        <CircleAlert aria-hidden="true" className="size-5 shrink-0 text-danger" />
        <h3 className="text-h4">{t('title')}</h3>
      </div>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RotateCcw aria-hidden="true" />
        {t('retry')}
      </Button>
    </div>
  );
}

/** Seção sem dados enquanto a pausa global por `QUOTA` vale (o banner explica). */
export function SectionPaused() {
  const t = useTranslations('Connect.quota');
  return (
    <p className="flex items-center gap-2 rounded-lg border border-dashed border-line px-4 py-6 text-body-sm text-fg-muted">
      <Pause aria-hidden="true" className="size-4 shrink-0" />
      {t('sectionPaused')}
    </p>
  );
}
