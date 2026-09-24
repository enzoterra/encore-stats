import { defineRouting } from 'next-intl/routing';

export const locales = ['pt-BR', 'en'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'pt-BR',
  // URLs sempre com prefixo: /pt-BR e /en. A raiz redireciona pelo Accept-Language.
  localePrefix: 'always',
});
