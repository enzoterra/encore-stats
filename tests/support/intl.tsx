import { render, type RenderResult } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { type ReactElement } from 'react';

import en from '@/i18n/messages/en.json';
import ptBR from '@/i18n/messages/pt-BR.json';

export const messages = { 'pt-BR': ptBR, en } as const;

/** Renderiza com o provider do next-intl (fuso fixo para datas determinísticas). */
export function renderWithIntl(ui: ReactElement, locale: 'pt-BR' | 'en' = 'pt-BR'): RenderResult {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages[locale]}
      timeZone="America/Sao_Paulo"
    >
      {ui}
    </NextIntlClientProvider>,
  );
}
