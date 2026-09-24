'use client';

import { Check, Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { DropdownMenu } from 'radix-ui';
import { useTransition } from 'react';

import { usePathname, useRouter } from '@/i18n/navigation';
import { locales, type Locale } from '@/i18n/routing';

const SHORT: Record<Locale, string> = { 'pt-BR': 'PT', en: 'EN' };

/**
 * Seletor de idioma (RF-23, 10-design.md §8.18): menu `ghost` com o ícone `languages`.
 * A troca é uma navegação do cliente, então o histórico carregado na memória continua lá.
 */
export function LanguageSwitcher() {
  const t = useTranslations('Common.language');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: string) => {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next as Locale, scroll: false });
    });
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t('label')}
        aria-busy={pending || undefined}
        className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-body-sm font-semibold text-fg-muted transition-colors duration-(--duration-fast) hover:bg-surface-2 hover:text-fg data-[state=open]:bg-surface-2 data-[state=open]:text-fg"
      >
        <Languages aria-hidden="true" className="size-5" />
        <span aria-hidden="true">{SHORT[locale]}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 min-w-48 rounded-md border border-line bg-surface-2 p-1 shadow-e2 motion-safe:animate-fade-in"
        >
          <DropdownMenu.Label className="px-3 py-2 text-overline text-fg-subtle uppercase">
            {t('menuTitle')}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={locale} onValueChange={change}>
            {locales.map((code) => (
              <DropdownMenu.RadioItem
                key={code}
                value={code}
                lang={code}
                className="flex h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-body-sm text-fg outline-none data-highlighted:bg-surface-3 data-[state=checked]:font-semibold"
              >
                <span className="grid size-4 place-items-center">
                  <DropdownMenu.ItemIndicator>
                    <Check aria-hidden="true" className="size-4 text-accent" />
                  </DropdownMenu.ItemIndicator>
                </span>
                {t(code)}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
