import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PrivacySealPanel } from '@/components/layout/privacy-seal';
import en from '@/i18n/messages/en.json';
import ptBR from '@/i18n/messages/pt-BR.json';

import { renderWithIntl } from '../../../tests/support/intl';
import { ModeCards } from './mode-cards';

describe('<ModeCards /> (RF-01)', () => {
  it('Conectar desabilitado: botão desabilitado com o motivo ligado por aria-describedby', () => {
    renderWithIntl(<ModeCards connectEnabled={false} />);
    const card = screen.getByRole('article', { name: ptBR.Landing.connect.title });
    const button = within(card).getByRole('button', { name: ptBR.Landing.connect.cta });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      `${ptBR.Landing.connect.disabled}${ptBR.Landing.connect.disabledWhy}`,
    );
    expect(within(card).queryByRole('link')).toBeNull();
  });

  it('Conectar habilitado: link para /connect e aviso da allowlist', () => {
    renderWithIntl(<ModeCards connectEnabled />, 'en');
    const card = screen.getByRole('article', { name: en.Landing.connect.title });
    expect(within(card).getByRole('link', { name: en.Landing.connect.cta })).toHaveAttribute(
      'href',
      '/connect',
    );
    expect(card).toHaveTextContent(en.Landing.connect.limited);
  });

  it('Upload em destaque com o único botão primário; Demo leva a /demo', () => {
    renderWithIntl(<ModeCards connectEnabled={false} />);
    expect(screen.getByRole('link', { name: ptBR.Landing.upload.cta })).toHaveAttribute(
      'href',
      '/upload',
    );
    expect(screen.getByRole('link', { name: ptBR.Landing.upload.secondary })).toHaveAttribute(
      'href',
      '/onboarding',
    );
    expect(screen.getByRole('link', { name: ptBR.Landing.demo.cta })).toHaveAttribute(
      'href',
      '/demo',
    );
  });
});

describe('<PrivacySealPanel /> (10-design.md §8.16)', () => {
  it('com repositório: link "confira você mesmo" em nova aba, sem referrer', () => {
    renderWithIntl(<PrivacySealPanel mode="upload" repoUrl="https://github.com/exemplo/encore" />);
    const link = screen.getByRole('link', { name: ptBR.Seal.openSourceLink });
    expect(link).toHaveAttribute('href', 'https://github.com/exemplo/encore');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: ptBR.Seal.policy })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });

  it('sem repositório configurado e texto por modo', () => {
    renderWithIntl(<PrivacySealPanel mode="demo" />);
    expect(screen.getByText(ptBR.Seal.openSourceSoon)).toBeInTheDocument();
    expect(screen.getByText(ptBR.Seal.localDemo)).toBeInTheDocument();
  });

  it('modo Conectar troca o primeiro item', () => {
    renderWithIntl(<PrivacySealPanel mode="connect" />);
    expect(screen.getByText(ptBR.Seal.localConnect)).toBeInTheDocument();
  });
});
