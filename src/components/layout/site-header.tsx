import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';

import { Logo } from '@/components/brand/logo';
import { Badge, DemoTag } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';

import { LanguageSwitcher } from './language-switcher';
import { PrivacySealCompact, type SealMode } from './privacy-seal';

/**
 * Cabeçalho (10-design.md §8.18): 56 px, sticky, fundo a 85% com blur e borda `line`.
 * logo · badge do modo · espaçador · selo compacto (≥ 640 px) · idioma · ações.
 */
export function SiteHeader({
  mode,
  seal = 'upload',
  repoUrl,
  actions,
}: {
  /** Badge do modo; ausente na landing e nas páginas institucionais. */
  mode?: SealMode;
  seal?: SealMode;
  repoUrl?: string;
  actions?: ReactNode;
}) {
  const t = useTranslations('Common');
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-page items-center gap-2 pr-2 pl-4 sm:pr-4 sm:pl-6 lg:px-8">
        <Link
          href="/"
          aria-label={t('home')}
          data-testid="header-logo"
          className="-ml-1 inline-flex items-center rounded-sm px-1 py-2"
        >
          {/* 22 px de corpo = 12 px de altura (design/logo/LOGO.md). */}
          <Logo id="header" height={12} />
        </Link>
        {mode === 'demo' ? <DemoTag label={t('demoTag')} /> : null}
        {mode && mode !== 'demo' ? <Badge>{t(`modeBadge.${mode}`)}</Badge> : null}
        <span className="flex-1" />
        <span className="hidden sm:inline-flex">
          <PrivacySealCompact mode={mode ?? seal} repoUrl={repoUrl} />
        </span>
        <LanguageSwitcher />
        {actions}
      </div>
    </header>
  );
}
