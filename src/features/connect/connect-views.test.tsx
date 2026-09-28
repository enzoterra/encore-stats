import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDatasetStore } from '@/features/dataset/store';
import { DemoView } from '@/features/demo/demo-view';
import en from '@/i18n/messages/en.json';
import ptBR from '@/i18n/messages/pt-BR.json';
import { renderWithIntl } from '../../../tests/support/intl';

import { NotAllowlisted } from './account-states';
import { ConnectLanding } from './connect-landing';

afterEach(() => {
  vi.unstubAllGlobals();
  useDatasetStore.setState({ upload: null, demo: null });
});

describe('<ConnectLanding />', () => {
  it('com credenciais: "Entrar com o Spotify" leva ao login do BFF no idioma atual', () => {
    renderWithIntl(<ConnectLanding enabled />, 'en');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.Connect.title);
    expect(screen.getByRole('link', { name: en.Connect.landing.login })).toHaveAttribute(
      'href',
      '/api/auth/login?locale=en',
    );
    expect(screen.getByText(en.Connect.landing.limitedBody)).toBeInTheDocument();
  });

  it('sem credenciais: botão desabilitado com o motivo', () => {
    renderWithIntl(<ConnectLanding enabled={false} />);
    const button = screen.getByRole('button', { name: ptBR.Connect.landing.login });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/ainda não está ligado neste site/);
    expect(screen.queryByRole('link', { name: ptBR.Connect.landing.login })).toBeNull();
  });

  it.each(['denied', 'state', 'oauth', 'scope', 'upstream'] as const)(
    'erro do callback "%s" vira alerta com título e explicação',
    (code) => {
      renderWithIntl(<ConnectLanding enabled error={code} />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(ptBR.Connect.errors[code].title);
      expect(alert).toHaveTextContent(ptBR.Connect.errors[code].body);
    },
  );

  it('depois do logout confirma que a sessão e o cache foram apagados', () => {
    renderWithIntl(<ConnectLanding enabled loggedOut />);
    expect(screen.getByRole('status')).toHaveTextContent(ptBR.Connect.loggedOut);
  });

  it('fora da allowlist: tela própria, com Upload e Demo', () => {
    renderWithIntl(<NotAllowlisted />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ptBR.Connect.forbidden.title,
    );
    expect(screen.getByRole('link', { name: ptBR.Connect.forbidden.otherAccount })).toHaveAttribute(
      'href',
      '/api/auth/login?locale=pt-BR',
    );
  });

  it.each([
    ['pt-BR', ptBR, /conta do dono dele tiver Premium/],
    ['en', en, /owner's account has Premium/],
  ] as const)(
    'fora da allowlist (%s): cita a outra causa do 403, o dono do app sem Premium',
    (locale, messages, premium) => {
      renderWithIntl(<NotAllowlisted />, locale);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        messages.Connect.forbidden.title,
      );
      expect(screen.getByText(messages.Connect.forbidden.body)).toBeInTheDocument();
      expect(screen.getByText(messages.Connect.forbidden.ownerPremium)).toHaveTextContent(premium);
      expect(
        screen.getByRole('link', { name: messages.Connect.forbidden.otherAccount }),
      ).toHaveAttribute('href', `/api/auth/login?locale=${locale}`);
    },
  );
});

describe('Demo · visão Conectar', () => {
  it('reaproveita o dashboard do Conectar com dados fictícios, sem rede e sem marca do Spotify', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderWithIntl(<DemoView />);
    const tab = await screen.findByRole('tab', { name: ptBR.Dashboard.tabs.connect });
    fireEvent.mouseDown(tab, { button: 0 });
    const dashboard = await screen.findByTestId('connect-dashboard', {}, { timeout: 5000 });
    expect(dashboard).toHaveAttribute('data-mode', 'demo');
    expect(await screen.findByText('Oi, Demo')).toBeInTheDocument();
    expect(await screen.findByTestId('connect-top-artists')).toBeInTheDocument();
    expect(screen.getByText(ptBR.Connect.dashboard.demoBanner)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: ptBR.Connect.liked.start }));
    const winner = await screen.findByTestId('liked-winner', {}, { timeout: 5000 });
    expect(within(winner).getByText(/músicas curtidas/)).toBeInTheDocument();

    // Dado fictício: nenhum link ou logo do Spotify (10-design.md §10, item 17).
    expect(document.querySelector('a[href*="spotify.com"]')).toBeNull();
    expect(screen.queryAllByTestId('spotify-logo')).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('"Desde o começo" leva à Visão Upload da Demo, já em "Sempre", com o foco no seletor', async () => {
    renderWithIntl(<DemoView />);
    const tab = await screen.findByRole('tab', { name: ptBR.Dashboard.tabs.connect });
    fireEvent.mouseDown(tab, { button: 0 });
    await screen.findByTestId('connect-dashboard', {}, { timeout: 5000 });
    const x = ptBR.Connect.dashboard.extras;
    fireEvent.click(screen.getByRole('button', { name: x.all_time }));
    const panel = screen.getByRole('region', { name: x.title.all_time });
    expect(within(panel).getByText(x.bodyDemo, { exact: false })).toBeInTheDocument();
    expect(within(panel).queryByRole('link', { name: x.upload })).toBeNull();
    expect(within(panel).getByRole('link', { name: x.howTo })).toHaveAttribute(
      'href',
      '/onboarding',
    );

    fireEvent.click(within(panel).getByRole('button', { name: x.demoUpload }));
    const dashboard = await screen.findByTestId('dashboard', {}, { timeout: 5000 });
    expect(dashboard).toHaveAttribute('data-mode', 'demo');
    expect(screen.getByRole('tab', { name: ptBR.Dashboard.tabs.upload })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('dashboard-title')).toHaveTextContent(ptBR.Dashboard.title.all);
    const all = screen.getByRole('radio', { name: ptBR.Dashboard.period.modes.all });
    expect(all).toHaveAttribute('aria-checked', 'true');
    expect(all).toHaveFocus();
  });

  it('"Selecionar período" abre a Visão Upload no intervalo; trocar de aba à mão volta ao padrão', async () => {
    renderWithIntl(<DemoView />, 'en');
    fireEvent.mouseDown(await screen.findByRole('tab', { name: en.Dashboard.tabs.connect }), {
      button: 0,
    });
    await screen.findByTestId('connect-dashboard', {}, { timeout: 5000 });
    const x = en.Connect.dashboard.extras;
    fireEvent.click(screen.getByRole('button', { name: x.custom }));
    fireEvent.click(screen.getByRole('button', { name: x.demoUpload }));
    await screen.findByTestId('dashboard', {}, { timeout: 5000 });
    const range = screen.getByRole('radio', { name: en.Dashboard.period.modes.range });
    expect(range).toHaveAttribute('aria-checked', 'true');
    expect(range).toHaveFocus();
    expect(screen.getByLabelText(en.Dashboard.period.from, { exact: true })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: en.Dashboard.tabs.connect }), {
      button: 0,
    });
    await screen.findByTestId('connect-dashboard');
    fireEvent.mouseDown(screen.getByRole('tab', { name: en.Dashboard.tabs.upload }), { button: 0 });
    await screen.findByTestId('dashboard');
    expect(screen.getByRole('radio', { name: en.Dashboard.period.modes.year })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
