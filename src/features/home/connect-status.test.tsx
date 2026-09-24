import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import en from '@/i18n/messages/en.json';
import ptBR from '@/i18n/messages/pt-BR.json';

import { ConnectStatus } from './connect-status';

function renderWith(locale: 'pt-BR' | 'en', enabled: boolean) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ptBR}>
      <ConnectStatus enabled={enabled} />
    </NextIntlClientProvider>,
  );
}

describe('<ConnectStatus />', () => {
  it('avisa em PT-BR que o Conectar está indisponível', () => {
    renderWith('pt-BR', false);
    expect(screen.getByRole('status')).toHaveTextContent(ptBR.Home.connectDisabled);
  });

  it('avisa em EN que o Conectar está disponível', () => {
    renderWith('en', true);
    expect(screen.getByRole('status')).toHaveTextContent(en.Home.connectEnabled);
  });
});

describe('mensagens', () => {
  it('PT-BR e EN têm as mesmas chaves', () => {
    const keys = (value: object, prefix = ''): string[] =>
      Object.entries(value).flatMap(([key, child]) =>
        typeof child === 'object' && child !== null
          ? keys(child as object, `${prefix}${key}.`)
          : [`${prefix}${key}`],
      );
    expect(keys(en).sort()).toEqual(keys(ptBR).sort());
  });
});
