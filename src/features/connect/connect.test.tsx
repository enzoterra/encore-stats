import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastViewport, useToasts } from '@/components/ui/toast';
import ptBR from '@/i18n/messages/pt-BR.json';
import {
  json,
  makeArtist,
  makeTrack,
  mockBff,
  savedPage,
  type Handler,
} from '../../../tests/support/bff';
import { renderWithIntl } from '../../../tests/support/intl';

import { AccountMenu } from './account-menu';
import { liveSource } from './bff-client';
import { createConnectBundle, type ConnectBundle } from './connect-client';
import { ConnectDashboard } from './connect-dashboard';
import { ConnectProvider } from './connect-provider';

vi.mock('./navigate', () => ({ replaceLocation: vi.fn() }));

const t = ptBR.Connect;

function setup(overrides: Partial<Record<string, Handler>> = {}, savedTotal = 120) {
  const bff = mockBff(overrides, savedTotal);
  const bundle = createConnectBundle(liveSource);
  renderWithIntl(
    <ConnectProvider bundle={bundle}>
      <AccountMenu />
      <ConnectDashboard />
      <ToastViewport />
    </ConnectProvider>,
  );
  return { ...bff, bundle };
}

const spotifyCalls = (calls: { path: string }[]) =>
  calls.filter((c) => c.path.startsWith('/api/spotify/'));

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  useToasts.setState({ queue: [], raised: false });
});

describe('<ConnectDashboard /> com o BFF', () => {
  it('sucesso: `me` sozinho primeiro; depois tops, tendências, recentes e gêneros com atribuição', async () => {
    const { calls } = setup();
    expect(await screen.findByText('Oi, Pessoa Teste')).toBeInTheDocument();
    const top = await screen.findByTestId('connect-top-artists');
    expect(within(top).getAllByRole('listitem')).toHaveLength(7);
    // Linha inteira é link para o `url` da resposta, em nova aba, com "Abrir no Spotify".
    const first = within(top).getAllByRole('link')[0]!;
    expect(first).toHaveAttribute('href', makeArtist(6).url);
    expect(first).toHaveAttribute('target', '_blank');
    expect(first).toHaveAttribute('rel', 'noopener noreferrer');
    expect(first).toHaveTextContent(t.top.open);

    expect(await screen.findByTestId('trends-up')).toHaveTextContent('Artista 6');
    expect(screen.getByTestId('trends-up')).toHaveTextContent(t.trends.entered);
    expect(screen.getByTestId('trends-down')).toHaveTextContent('Artista 8');
    expect(await screen.findByText('Faixa 1')).toBeInTheDocument(); // tocadas recentemente
    expect(await screen.findByRole('heading', { name: t.genres.title })).toBeInTheDocument();
    // Logo oficial no cabeçalho de toda seção com dado da API.
    expect(screen.getAllByTestId('spotify-logo').length).toBeGreaterThanOrEqual(5);

    const spotify = spotifyCalls(calls);
    expect(spotify[0]!.path).toBe('/api/spotify/me');
    expect(spotify.filter((c) => c.path === '/api/spotify/me')).toHaveLength(1);
    expect(spotify.length).toBeGreaterThan(1);
  });

  it('troca de janela busca a nova e volta à anterior pelo cache (dedupe, staleTime 6 h)', async () => {
    const { calls } = setup();
    await screen.findByTestId('connect-top-artists');
    fireEvent.click(screen.getByRole('radio', { name: t.dashboard.windows.long_term }));
    await waitFor(() =>
      expect(
        within(screen.getByTestId('connect-top-artists')).getAllByRole('listitem'),
      ).toHaveLength(5),
    );
    expect(screen.getByText('Mostrando: 1 ano')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: t.dashboard.windows.short_term }));
    await screen.findByTestId('connect-top-artists');
    const shortCalls = calls.filter(
      (c) => c.path === '/api/spotify/top?type=artists&range=short_term',
    );
    expect(shortCalls).toHaveLength(1);
  });

  it('top de músicas: capas do álbum, link "Ouvir no Spotify" e "Ver top 50"', async () => {
    setup({
      top: (url) =>
        json(200, {
          items:
            url.searchParams.get('type') === 'tracks'
              ? Array.from({ length: 14 }, (_, i) => makeTrack(i + 1))
              : [makeArtist(1)],
        }),
    });
    await screen.findByTestId('connect-top-artists');
    const top = screen.getByTestId('connect-top');
    fireEvent.click(within(top).getByRole('radio', { name: t.top.kinds.tracks }));
    const list = await screen.findByTestId('connect-top-tracks');
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    const link = within(list).getAllByRole('link')[0]!;
    expect(link).toHaveAttribute('href', makeTrack(1).url);
    expect(link).toHaveTextContent(t.top.play);
    expect(link.querySelector('img')).toHaveAttribute('src', makeTrack(1).album.image);
    fireEvent.click(within(top).getByRole('button', { name: t.top.more }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(14);
    expect(within(top).getByRole('button', { name: t.top.less })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('401: página inteira pede reconexão e apaga o cache', async () => {
    const { bundle } = setup({ me: () => json(401, { error: { code: 'UNAUTHENTICATED' } }) });
    expect(await screen.findByRole('heading', { name: t.expired.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.expired.action })).toHaveAttribute(
      'href',
      '/api/auth/login?locale=pt-BR',
    );
    expect(screen.queryByRole('button', { name: /Conta:/ })).toBeNull();
    await waitFor(() => expect(bundle.queryClient.getQueryCache().getAll()).toHaveLength(0));
  });

  it('403: explica o limite de 5 contas e sugere Upload e Demo', async () => {
    setup({ me: () => json(403, { error: { code: 'NOT_ALLOWLISTED' } }) });
    expect(await screen.findByRole('heading', { name: t.forbidden.title })).toBeInTheDocument();
    expect(screen.getByText(/5 contas convidadas/)).toBeInTheDocument();
    expect(screen.getByText(t.forbidden.ownerPremium)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.forbidden.upload })).toHaveAttribute(
      'href',
      '/upload',
    );
    expect(screen.getByRole('link', { name: t.forbidden.demo })).toHaveAttribute('href', '/demo');
  });

  it('429 numa seção: contagem regressiva, "Tentar agora" desabilitado e nova tentativa no zero', async () => {
    let attempts = 0;
    setup({
      recent: () => {
        attempts++;
        return attempts === 1
          ? json(429, { error: { code: 'RATE_LIMITED', retryAfter: 1 } }, { 'Retry-After': '1' })
          : json(200, { items: [] });
      },
    });
    expect(await screen.findByText(t.rateLimited.title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.rateLimited.now })).toBeDisabled();
    // As outras seções seguem de pé (RNF-05).
    expect(await screen.findByTestId('connect-top-artists')).toBeInTheDocument();
    expect(await screen.findByText(t.recent.empty, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('UPSTREAM: erro só da seção, com "Tentar de novo" (1 retry automático antes)', async () => {
    let attempts = 0;
    setup({
      recent: () => {
        attempts++;
        return attempts <= 2
          ? json(502, { error: { code: 'UPSTREAM' } })
          : json(200, { items: [] });
      },
    });
    const section = await screen.findByTestId('connect-recent');
    const retry = await within(section).findByRole(
      'button',
      { name: t.sectionError.retry },
      { timeout: 4000 },
    );
    expect(attempts).toBe(2);
    expect(screen.getByTestId('connect-top-artists')).toBeInTheDocument();
    fireEvent.click(retry);
    expect(await within(section).findByText(t.recent.empty)).toBeInTheDocument();
  });

  it('QUOTA: banner global, pausa de 15 min guardada no sessionStorage e nada mais sai', async () => {
    const { calls, bundle } = setup({
      top: () => json(503, { error: { code: 'QUOTA', retryAfter: 900 } }),
    });
    const banner = await screen.findByTestId('quota-banner');
    expect(banner).toHaveTextContent(t.quota.title);
    expect(banner).toHaveTextContent('~15 min');
    expect(within(banner).getByRole('link', { name: t.quota.upload })).toHaveAttribute(
      'href',
      '/upload',
    );
    const until = bundle.status.getState().pausedUntil!;
    expect(until - Date.now()).toBeGreaterThan(899_000);
    expect(window.sessionStorage.getItem('encore.connect.pause')).toContain(String(until));
    const before = spotifyCalls(calls).length;
    fireEvent.click(screen.getByRole('radio', { name: t.dashboard.windows.long_term }));
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(spotifyCalls(calls).length).toBe(before);
    expect(screen.getAllByText(t.quota.sectionPaused).length).toBeGreaterThan(0);
  });

  it('gêneros com menos de 3: a seção some, sem erro', async () => {
    setup({
      top: (url) =>
        json(200, {
          items:
            url.searchParams.get('type') === 'artists'
              ? [makeArtist(1, ['mpb']), makeArtist(2, [])]
              : [],
        }),
    });
    await screen.findByTestId('connect-top-artists');
    expect(screen.queryByRole('heading', { name: t.genres.title })).toBeNull();
    expect(screen.queryByTestId('connect-genres')).toBeNull();
    expect(within(screen.getByTestId('connect-dashboard')).queryByRole('alert')).toBeNull();
  });
});

describe('Varredura de curtidas', () => {
  it('lê as páginas com concorrência ≤ 3, mostra o progresso e o artista com mais curtidas', async () => {
    let inFlight = 0;
    let peak = 0;
    const { calls } = setup(
      {
        saved: async (url) => {
          inFlight++;
          peak = Math.max(peak, inFlight);
          await new Promise((r) => setTimeout(r, 5));
          inFlight--;
          return json(200, savedPage(Number(url.searchParams.get('offset')), 400));
        },
      },
      400,
    );
    fireEvent.click(await screen.findByRole('button', { name: t.liked.start }));
    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
    const winner = await screen.findByTestId('liked-winner');
    expect(winner).toHaveTextContent('Artista 1');
    expect(winner).toHaveTextContent('200 músicas curtidas');
    expect(peak).toBeLessThanOrEqual(3);
    const pages = calls.filter((c) => c.path.startsWith('/api/spotify/saved'));
    expect(pages).toHaveLength(8);
    expect(pages.every((p) => p.cache === 'no-cache')).toBe(true);
    // Resultado guardado por 12 h no sessionStorage (nunca localStorage).
    expect(window.sessionStorage.getItem('encore.connect.liked.user-1')).toContain('Artista 1');
    expect(window.localStorage.length).toBe(0);
  });

  it('cancelar aborta a leitura, volta ao início e não guarda resultado parcial', async () => {
    const signals: AbortSignal[] = [];
    setup({
      saved: (url, init) =>
        Number(url.searchParams.get('offset')) === 0
          ? json(200, savedPage(0, 500))
          : new Promise<Response>((_, reject) => {
              signals.push(init!.signal!);
              init!.signal!.addEventListener('abort', () =>
                reject(new DOMException('aborted', 'AbortError')),
              );
            }),
    });
    fireEvent.click(await screen.findByRole('button', { name: t.liked.start }));
    expect(await screen.findByText('Página 1 de 10')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.liked.cancel }));
    expect(await screen.findByRole('button', { name: t.liked.start })).toBeInTheDocument();
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((s) => s.aborted)).toBe(true);
    expect(await screen.findByText(t.liked.cancelled)).toBeInTheDocument();
    expect(window.sessionStorage.getItem('encore.connect.liked.user-1')).toBeNull();
  });

  it('429 numa página: espera o retryAfter e tenta a mesma página de novo', async () => {
    let hits = 0;
    setup(
      {
        saved: (url) => {
          const offset = Number(url.searchParams.get('offset'));
          if (offset === 50 && hits++ === 0) {
            return json(429, { error: { code: 'RATE_LIMITED', retryAfter: 1 } });
          }
          return json(200, savedPage(offset, 120));
        },
      },
      120,
    );
    fireEvent.click(await screen.findByRole('button', { name: t.liked.start }));
    expect(
      await screen.findByText(/O Spotify pediu uma pausa\. Seguindo em 1 s/),
    ).toBeInTheDocument();
    expect(await screen.findByTestId('liked-winner', {}, { timeout: 4000 })).toHaveTextContent(
      '60 músicas curtidas',
    );
    expect(hits).toBe(2);
  });

  it('segunda visita (< 12 h, sem mudanças): resultado imediato, só com a validação limit=1', async () => {
    window.sessionStorage.setItem(
      'encore.connect.liked.user-1',
      JSON.stringify({
        v: 1,
        expiresAt: Date.now() + 3_600_000,
        data: {
          userId: 'user-1',
          total: 120,
          firstAddedAt: savedPage(0, 120).items[0]!.addedAt,
          scannedAt: Date.now() - 7_200_000,
          pages: 3,
          top: [{ id: makeArtist(1).id, name: 'Artista 1', count: 60 }],
        },
      }),
    );
    const { calls } = setup();
    expect(await screen.findByTestId('liked-winner')).toHaveTextContent('60 músicas curtidas');
    await screen.findByRole('button', { name: t.liked.refresh });
    expect(screen.getByText('atualizado há 2 horas')).toBeInTheDocument();
    const saved = calls.filter((c) => c.path.startsWith('/api/spotify/saved'));
    expect(saved.map((c) => c.path)).toEqual(['/api/spotify/saved?offset=0&limit=1']);
  });

  it('biblioteca mudou: avisa e "Atualizar" revarre', async () => {
    window.sessionStorage.setItem(
      'encore.connect.liked.user-1',
      JSON.stringify({
        v: 1,
        expiresAt: Date.now() + 3_600_000,
        data: {
          userId: 'user-1',
          total: 99,
          firstAddedAt: null,
          scannedAt: Date.now(),
          pages: 2,
          top: [{ id: makeArtist(3).id, name: 'Artista 3', count: 9 }],
        },
      }),
    );
    setup();
    expect(await screen.findByText(t.liked.changed)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.liked.refresh }));
    await waitFor(() => expect(screen.getByTestId('liked-winner')).toHaveTextContent('Artista 1'));
  });
});

describe('Logout', () => {
  async function openLogout(bundle: ConnectBundle) {
    const trigger = await screen.findByRole('button', { name: /Conta: Pessoa Teste/ });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: t.account.logout }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(t.account.confirmBody);
    return { dialog, bundle };
  }

  it('POST same-origin, limpa o cache em memória e o sessionStorage e recarrega a rota', async () => {
    const { calls, bundle } = setup();
    await screen.findByTestId('connect-top-artists');
    window.sessionStorage.setItem('encore.connect.liked.user-1', '{}');
    const { dialog } = await openLogout(bundle);
    fireEvent.click(within(dialog).getByRole('button', { name: t.account.confirm }));
    const { replaceLocation } = await import('./navigate');
    await waitFor(() =>
      expect(replaceLocation).toHaveBeenCalledWith('/pt-BR/connect?status=logged_out'),
    );
    expect(calls.find((c) => c.path.startsWith('/api/auth/logout'))).toMatchObject({
      method: 'POST',
      path: '/api/auth/logout?locale=pt-BR',
    });
    expect(bundle.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('se o servidor recusar, nada é apagado e a UI avisa', async () => {
    const { bundle } = setup({ logout: () => json(403, { error: { code: 'FORBIDDEN' } }) });
    await screen.findByTestId('connect-top-artists');
    const { dialog } = await openLogout(bundle);
    fireEvent.click(within(dialog).getByRole('button', { name: t.account.confirm }));
    expect(await screen.findByText(t.account.logoutError)).toBeInTheDocument();
    expect(bundle.queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);
  });
});
