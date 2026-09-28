import { useTranslations } from 'next-intl';

import { Logo } from '@/components/brand/logo';
import { cn } from '@/components/ui/cn';
import { Link } from '@/i18n/navigation';

const link =
  'rounded-sm text-fg-muted underline decoration-1 underline-offset-[3px] hover:text-fg hover:decoration-2';

/** Rodapé (10-design.md §8.18, §10 item 15): não afiliação + Privacidade, Código, onboarding. */
export function SiteFooter({ repoUrl, className }: { repoUrl?: string; className?: string }) {
  const t = useTranslations('Footer');
  return (
    <footer className={cn('border-t border-line', className)}>
      <div className="mx-auto flex max-w-page flex-col gap-4 px-4 py-8 text-body-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex flex-col gap-1">
          <p className="py-1">
            <Logo id="footer" height={12} />
            <span className="sr-only">Encore</span>
          </p>
          <p className="text-fg-muted">{t('tagline')}</p>
          <p className="text-caption text-fg-subtle">{t('notAffiliated')}</p>
        </div>
        <nav aria-label="Encore">
          <ul className="flex flex-wrap gap-x-6 gap-y-3">
            <li>
              <Link href="/privacy" className={link}>
                {t('privacy')}
              </Link>
            </li>
            <li>
              <Link href="/onboarding" className={link}>
                {t('howTo')}
              </Link>
            </li>
            {repoUrl ? (
              <li>
                <a href={repoUrl} target="_blank" rel="noopener noreferrer" className={link}>
                  {t('code')}
                </a>
              </li>
            ) : null}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
