import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AUTHOR } from '@/config/author';

import { renderWithIntl } from '../../../tests/support/intl';
import { SiteFooter } from './site-footer';

describe('<SiteFooter /> (Iteração 8c.4: contatos do autor)', () => {
  it('pt-BR: "Feito por Enzo Terra" e os três contatos, com rótulos acessíveis', () => {
    renderWithIntl(<SiteFooter repoUrl="https://github.com/enzoterra/encore" />);
    const block = screen.getByTestId('footer-author');
    expect(block).toHaveTextContent('Feito por Enzo Terra');
    expect(within(block).getByText('Enzo Terra').tagName).toBe('STRONG');

    const nav = screen.getByRole('navigation', { name: 'Fale comigo' });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(3);

    const email = within(nav).getByRole('link', { name: 'E-mail: enzoterra18@gmail.com' });
    expect(email).toHaveAttribute('href', 'mailto:enzoterra18@gmail.com');
    expect(email).not.toHaveAttribute('target');
    expect(email).not.toHaveAttribute('rel');

    const github = within(nav).getByRole('link', {
      name: 'GitHub: enzoterra (abre em nova aba)',
    });
    expect(github).toHaveAttribute('href', 'https://github.com/enzoterra');
    expect(github).toHaveAttribute('target', '_blank');
    expect(github).toHaveAttribute('rel', 'noopener noreferrer');

    const site = within(nav).getByRole('link', {
      name: 'Site pessoal: enzoterra.dev.br (abre em nova aba)',
    });
    expect(site).toHaveAttribute('href', 'https://enzoterra.dev.br');
    expect(site).toHaveAttribute('target', '_blank');
    expect(site).toHaveAttribute('rel', 'noopener noreferrer');

    // Alvo de toque de 44 px e ícones decorativos.
    for (const link of links) {
      expect(link.className).toContain('min-h-11');
      const icon = link.querySelector('svg')!;
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('en: "Made by Enzo Terra" e rótulos em inglês', () => {
    renderWithIntl(<SiteFooter />, 'en');
    expect(screen.getByTestId('footer-author')).toHaveTextContent('Made by Enzo Terra');
    const nav = screen.getByRole('navigation', { name: 'Get in touch' });
    expect(within(nav).getByRole('link', { name: 'Email: enzoterra18@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:enzoterra18@gmail.com',
    );
    expect(
      within(nav).getByRole('link', { name: 'GitHub: enzoterra (opens in a new tab)' }),
    ).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      within(nav).getByRole('link', { name: 'Website: enzoterra.dev.br (opens in a new tab)' }),
    ).toHaveAttribute('href', 'https://enzoterra.dev.br');
  });

  it('mantém não afiliação, Privacidade, onboarding e o link do código', () => {
    renderWithIntl(<SiteFooter repoUrl="https://github.com/enzoterra/encore" />);
    expect(screen.getByText('Encore não é afiliado nem endossado pelo Spotify.')).toBeVisible();
    const nav = screen.getByRole('navigation', { name: 'Encore' });
    expect(within(nav).getByRole('link', { name: 'Privacidade' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(within(nav).getByRole('link', { name: 'Código do site' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('os contatos vêm do módulo de constantes (dado público e fixo)', () => {
    expect(AUTHOR).toEqual({
      name: 'Enzo Terra',
      email: 'enzoterra18@gmail.com',
      githubUser: 'enzoterra',
      githubUrl: 'https://github.com/enzoterra',
      siteHost: 'enzoterra.dev.br',
      siteUrl: 'https://enzoterra.dev.br',
    });
  });
});
