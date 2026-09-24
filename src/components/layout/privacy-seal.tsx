'use client';

import { CodeXml, Database, Lock, ShieldCheck, WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Popover } from 'radix-ui';

import { cn } from '@/components/ui/cn';
import { Link } from '@/i18n/navigation';

export type SealMode = 'upload' | 'connect' | 'demo';

/** Selo expandido (10-design.md §8.16): card com borda superior `success` e 4 itens. */
export function PrivacySealPanel({
  mode,
  repoUrl,
  headingLevel = 'h3',
  className,
}: {
  mode: SealMode;
  repoUrl?: string;
  headingLevel?: 'h2' | 'h3';
  className?: string;
}) {
  const t = useTranslations('Seal');
  const Heading = headingLevel;
  const first =
    mode === 'connect' ? t('localConnect') : mode === 'demo' ? t('localDemo') : t('local');
  return (
    <div
      className={cn(
        'rounded-lg border border-t-[3px] border-line border-t-success bg-surface p-5 sm:p-6',
        className,
      )}
    >
      <Heading className="mb-3 font-display text-h3">{t('title')}</Heading>
      <ul className="flex flex-col gap-3 text-body-sm text-fg">
        <li className="flex gap-3">
          <ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-success" />
          <span>{first}</span>
        </li>
        <li className="flex gap-3">
          <span aria-hidden="true" className="relative size-5 shrink-0 text-success">
            <Database className="size-5" />
            <span className="absolute top-1/2 left-[-2px] h-0.5 w-6 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
          </span>
          <span>{t('noDatabase')}</span>
        </li>
        <li className="flex gap-3">
          <WifiOff aria-hidden="true" className="size-5 shrink-0 text-success" />
          <span>{t('offline')}</span>
        </li>
        <li className="flex gap-3">
          <CodeXml aria-hidden="true" className="size-5 shrink-0 text-success" />
          {repoUrl ? (
            <span>
              {t('openSource')}{' '}
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-fg underline decoration-1 underline-offset-[3px] hover:decoration-2"
              >
                {t('openSourceLink')}
              </a>
              .
            </span>
          ) : (
            <span>{t('openSourceSoon')}</span>
          )}
        </li>
      </ul>
      <Link
        href="/privacy"
        className="mt-4 inline-block text-body-sm font-semibold text-primary-fg underline decoration-1 underline-offset-[3px] hover:decoration-2"
      >
        {t('policy')}
      </Link>
    </div>
  );
}

/**
 * Selo compacto (pílula de 32 px com área de toque de 44 px) que abre o expandido num popover.
 */
export function PrivacySealCompact({
  mode,
  repoUrl,
  className,
}: {
  mode: SealMode;
  repoUrl?: string;
  className?: string;
}) {
  const t = useTranslations('Seal');
  const label = t(`compact.${mode}`);
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={t('openLabel', { label })}
        className={cn(
          'touch-target inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-line-strong bg-surface px-3 text-caption font-semibold whitespace-nowrap text-fg',
          'transition-colors duration-(--duration-fast) hover:bg-surface-2 data-[state=open]:bg-surface-2',
          className,
        )}
      >
        <Lock aria-hidden="true" className="size-4 text-success" />
        <span aria-hidden="true">{label}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 w-[min(24rem,calc(100vw-2rem))] shadow-e2 motion-safe:animate-fade-in"
        >
          <PrivacySealPanel mode={mode} repoUrl={repoUrl} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
