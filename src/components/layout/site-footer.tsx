import { CodeXml, Globe, Mail, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId } from 'react';

import { Logo } from '@/components/brand/logo';
import { cn } from '@/components/ui/cn';
import { AUTHOR, AUTHOR_MAILTO } from '@/config/author';
import { Link } from '@/i18n/navigation';

const link =
  'rounded-sm text-fg-muted underline decoration-1 underline-offset-[3px] hover:text-fg hover:decoration-2';

/** Contato do autor: pílula `ghost` (10-design §8.1) com alvo de toque de 44 px. */
const contactLink =
  'inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg active:bg-surface-3';

type Contact = {
  key: 'email' | 'github' | 'site';
  href: string;
  /** Detalhe do nome acessível, depois do rótulo visível (WCAG 2.5.3: o rótulo vem primeiro). */
  detail: string;
  icon: LucideIcon;
  external: boolean;
};

const CONTACTS: readonly Contact[] = [
  { key: 'email', href: AUTHOR_MAILTO, detail: AUTHOR.email, icon: Mail, external: false },
  {
    key: 'github',
    href: AUTHOR.githubUrl,
    detail: AUTHOR.githubUser,
    icon: CodeXml,
    external: true,
  },
  { key: 'site', href: AUTHOR.siteUrl, detail: AUTHOR.siteHost, icon: Globe, external: true },
];

/** Bloco de autoria (Iteração 8c.4): "Feito por Enzo Terra" + e-mail, GitHub e site pessoal. */
function AuthorCredit() {
  const t = useTranslations('Footer.author');
  const tc = useTranslations('Common');
  const titleId = useId();
  return (
    <div
      data-testid="footer-author"
      className="mx-auto flex max-w-page flex-col gap-2 px-4 py-4 text-body-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:px-8"
    >
      <p className="text-fg-muted">
        {t.rich('madeBy', {
          name: AUTHOR.name,
          b: (chunks) => <strong className="font-semibold text-fg">{chunks}</strong>,
        })}
      </p>
      <nav aria-labelledby={titleId} className="flex flex-col gap-1 sm:flex-row sm:items-center">
        <p id={titleId} className="text-caption text-fg-subtle sm:mr-1">
          {t('contact')}
        </p>
        <ul className="-mx-3 flex flex-wrap gap-1 sm:ml-0">
          {CONTACTS.map(({ key, href, detail, icon: Icon, external }) => (
            <li key={key}>
              <a
                href={href}
                aria-label={`${t(key)}: ${detail}${external ? ` ${tc('externalLink')}` : ''}`}
                className={contactLink}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                <Icon aria-hidden="true" focusable="false" size={16} strokeWidth={2} />
                {t(key)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/**
 * Rodapé (10-design.md §8.18, §10 item 15): não afiliação + Privacidade, Código, onboarding e,
 * numa faixa própria abaixo, o bloco de autoria.
 */
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
      <div className="border-t border-line">
        <AuthorCredit />
      </div>
    </footer>
  );
}
