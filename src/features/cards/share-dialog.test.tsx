import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithIntl } from '../../../tests/support/intl';
import type { CardRequest } from './model';
import type { ShareInput } from './share-input';

const client = vi.hoisted(() => ({
  generateCard: vi.fn(),
  loadCover: vi.fn(),
  loadSpotifyLogo: vi.fn(),
  warmUpCards: vi.fn(),
}));
vi.mock('./card-client', () => client);

const { default: ShareDialog } = await import('./share-dialog');
const { ShareButton, useShareLauncher } = await import('./share-launcher');

const INPUT: ShareInput = {
  mode: 'upload',
  periodLabel: 'Dez. de 2024',
  topArtists: ['Lua Vermelha', 'Os Ventiladores', 'Marina Sal', 'DJ Caju'],
  topTracks: [
    { name: 'Céu de Neon (feat. MC Brisa)', artist: 'Lua Vermelha' },
    { name: 'Ventilador no Talo', artist: 'Os Ventiladores' },
    { name: 'Caju Maduro', artist: 'DJ Caju' },
    { name: 'Maré Alta', artist: 'Tiago Maré' },
  ],
  heroSub: '12 plays',
  stat: { value: '1.000', label: 'minutos' },
  stats: ['1.000 min'],
  trackStats: ['12 plays', '4 músicas', '1.000 min'],
  mixStats: ['1.000 min'],
};

function requests(): CardRequest[] {
  return client.generateCard.mock.calls.map(([request]) => request as CardRequest);
}

let created: string[];
let revoked: string[];

beforeEach(() => {
  created = [];
  revoked = [];
  let n = 0;
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:card-${++n}`;
    created.push(url);
    return url;
  });
  URL.revokeObjectURL = vi.fn((url: string) => void revoked.push(url));
  client.generateCard.mockImplementation(async (request: CardRequest) => ({
    blob: new Blob(['png'], { type: 'image/png' }),
    width: 1080,
    height: request.format === 'story' ? 1920 : 1080,
    renderMs: 42,
  }));
  client.loadCover.mockResolvedValue('data:image/png;base64,AAAA');
  client.loadSpotifyLogo.mockResolvedValue('data:image/svg+xml;base64,BBBB');
});

afterEach(() => {
  vi.clearAllMocks();
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'canShare');
});

function open(input: ShareInput = INPUT) {
  const onOpenChange = vi.fn();
  const view = renderWithIntl(<ShareDialog input={input} open onOpenChange={onOpenChange} />);
  return { ...view, onOpenChange };
}

const preview = () => screen.getByTestId('share-preview');

describe('modal de compartilhar (10-design.md §8.14)', () => {
  it('abre já gerando o Line-up 9:16, com foco no título e sem o Spotify no Upload', async () => {
    open();
    expect(screen.getByRole('dialog', { name: 'Compartilhar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Compartilhar' })).toHaveFocus();
    expect(screen.getByText('Montando seu cartaz…')).toBeInTheDocument();
    expect(preview()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('share-download')).toBeDisabled();
    expect(client.warmUpCards).toHaveBeenCalled();

    await waitFor(() => expect(preview()).toHaveAttribute('data-state', 'ready'));
    expect(requests()[0]).toMatchObject({ template: 'festival', format: 'story', mode: 'upload' });
    expect(requests()[0]!.data.topArtists[0]).toBe('Lua Vermelha');
    expect(requests()[0]!.data.spotifyLogo).toBeUndefined();
    expect(client.loadSpotifyLogo).not.toHaveBeenCalled();
    expect(client.loadCover).not.toHaveBeenCalled();
    const img = screen.getByRole('img', {
      name: /Card Line-up: Lua Vermelha, Os Ventiladores, Marina Sal…/,
    });
    expect(img).toHaveAttribute('src', 'blob:card-1');
    expect(
      screen.getByText('Gerado no seu aparelho, sem enviar nada.', { selector: 'span' }),
    ).toBeInTheDocument();
  });

  it('trocar template/formato gera de novo, e voltar reaproveita o cache', async () => {
    open();
    await waitFor(() => expect(preview()).toHaveAttribute('data-state', 'ready'));
    fireEvent.click(screen.getByRole('radio', { name: 'Básico' }));
    expect(screen.queryByLabelText('Nome no cartaz')).not.toBeInTheDocument();
    await waitFor(() => expect(requests()).toHaveLength(2));
    await waitFor(() => expect(preview()).toHaveAttribute('data-state', 'ready'));
    fireEvent.click(screen.getByRole('radio', { name: 'Quadrado 1:1' }));
    await waitFor(() => expect(requests()).toHaveLength(3));
    expect(requests()[2]).toMatchObject({ template: 'basic', format: 'square' });
    await waitFor(() => expect(preview()).toHaveAttribute('data-format', 'square'));
    fireEvent.click(screen.getByRole('radio', { name: 'Line-up' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Stories 9:16' }));
    await waitFor(() => expect(preview()).toHaveAttribute('data-state', 'ready'));
    expect(requests()).toHaveLength(4); // festival × square é novo; festival × story veio do cache
  });

  it('"Nome no cartaz": valida, bloqueia inválido e só entra depois da pausa', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      open();
      await waitFor(() => expect(requests()).toHaveLength(1));
      const field = screen.getByLabelText('Nome no cartaz');
      fireEvent.change(field, { target: { value: 'Festa 🎉' } });
      expect(screen.getByText(/Use só letras, números/)).toBeInTheDocument();
      expect(field).toHaveAttribute('aria-invalid', 'true');
      fireEvent.change(field, { target: { value: 'a'.repeat(21) } });
      expect(screen.getByText('Use até 20 caracteres.')).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(requests()).toHaveLength(1);
      fireEvent.change(field, { target: { value: '  Enzo  ' } });
      expect(field).not.toHaveAttribute('aria-invalid');
      await act(() => vi.advanceTimersByTimeAsync(600));
      await waitFor(() => expect(requests()).toHaveLength(2));
      expect(requests()[1]!.data.posterName).toBe('Enzo');
    } finally {
      vi.useRealTimers();
    }
  });

  it('sem Web Share: o primário baixa a imagem com o nome do arquivo do período', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    open();
    await waitFor(() => expect(screen.getByTestId('share-download')).toBeEnabled());
    expect(screen.queryByRole('button', { name: 'Compartilhar' })).not.toBeInTheDocument();
    expect(screen.getByTestId('share-download')).toHaveTextContent('Baixar imagem');
    fireEvent.click(screen.getByTestId('share-download'));
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe('encore-festival-stories-dez-de-2024.png');
    expect(screen.getByTestId('share-done')).toHaveTextContent('Imagem baixada');
    click.mockRestore();
  });

  it('com Web Share: compartilha o arquivo gerado antes do toque; cancelar não é erro', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share, canShare: () => true });
    open();
    const button = await screen.findByRole('button', { name: 'Compartilhar' });
    expect(screen.getByRole('button', { name: 'Baixar' })).toBeInTheDocument();
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [{ files }] = share.mock.calls[0] as [{ files: File[] }];
    expect(files[0]!.name).toBe('encore-festival-stories-dez-de-2024.png');
    expect(files[0]!.type).toBe('image/png');
    await waitFor(() =>
      expect(screen.getByTestId('share-done')).toHaveTextContent('Card compartilhado'),
    );

    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    share.mockRejectedValueOnce(new DOMException('cancel', 'AbortError'));
    fireEvent.click(button);
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(click).not.toHaveBeenCalled();

    // Outro erro (gesto perdido, alvo recusou): baixa a imagem no lugar.
    share.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'));
    fireEvent.click(button);
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('share-done')).toHaveTextContent('baixamos a imagem');
    click.mockRestore();
  });

  it('modelos na ordem Line-up | Músicas | Mix | Básico, com o Line-up por padrão', async () => {
    open();
    const group = screen.getByRole('radiogroup', { name: 'Modelo' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => radio.textContent)).toEqual([
      'Line-up',
      'Músicas',
      'Mix',
      'Básico',
    ]);
    expect(radios[0]).toHaveAttribute('data-state', 'on');
    expect(radios.every((radio) => !radio.hasAttribute('disabled'))).toBe(true);
    expect(screen.queryByText(/não tem músicas/)).not.toBeInTheDocument();
    await waitFor(() => expect(preview()).toHaveAttribute('data-state', 'ready'));
  });

  it('Músicas e Mix: estatísticas próprias, nome no cartaz, arquivo e texto alternativo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      open();
      await waitFor(() => expect(preview()).toHaveAttribute('data-state', 'ready'));

      fireEvent.click(screen.getByRole('radio', { name: 'Músicas' }));
      await waitFor(() => expect(preview()).toHaveAttribute('data-template', 'tracks'));
      await waitFor(() => expect(preview()).toHaveAttribute('data-state', 'ready'));
      const tracks = requests().at(-1)!;
      expect(tracks).toMatchObject({ template: 'tracks', format: 'story', mode: 'upload' });
      expect(tracks.data.trackStats).toEqual(INPUT.trackStats);
      expect(tracks.data.mixStats).toEqual(INPUT.mixStats);
      expect(tracks.data.topTracks).toEqual(INPUT.topTracks);
      // O texto alternativo usa o nome completo (sem a limpeza do card) e o artista.
      expect(
        screen.getByRole('img', {
          name: 'Card Músicas: Céu de Neon (feat. MC Brisa) (Lua Vermelha), Ventilador no Talo (Os Ventiladores), Caju Maduro (DJ Caju)…',
        }),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('share-download'));
      expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe(
        'encore-tracks-stories-dez-de-2024.png',
      );

      // "Nome no cartaz" também vale para Músicas e Mix.
      fireEvent.change(screen.getByLabelText('Nome no cartaz'), { target: { value: 'Enzo' } });
      await act(() => vi.advanceTimersByTimeAsync(600));
      await waitFor(() => expect(requests().at(-1)!.data.posterName).toBe('Enzo'));
      expect(requests().at(-1)!.template).toBe('tracks');

      fireEvent.click(screen.getByRole('radio', { name: 'Mix' }));
      fireEvent.click(screen.getByRole('radio', { name: 'Quadrado 1:1' }));
      await waitFor(() => expect(preview()).toHaveAttribute('data-template', 'mix'));
      await waitFor(() => expect(preview()).toHaveAttribute('data-state', 'ready'));
      expect(requests().at(-1)).toMatchObject({ template: 'mix', format: 'square' });
      expect(requests().at(-1)!.data.posterName).toBe('Enzo');
      expect(
        screen.getByRole('img', {
          name: 'Card Mix: Lua Vermelha, Os Ventiladores, Marina Sal; Céu de Neon (feat. MC Brisa), Ventilador no Talo, Caju Maduro',
        }),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('share-download'));
      expect((click.mock.instances[1] as unknown as HTMLAnchorElement).download).toBe(
        'encore-mix-square-dez-de-2024.png',
      );

      // No Básico o nome some do card e do formulário.
      fireEvent.click(screen.getByRole('radio', { name: 'Básico' }));
      expect(screen.queryByLabelText('Nome no cartaz')).not.toBeInTheDocument();
      await waitFor(() => expect(requests().at(-1)!.template).toBe('basic'));
      expect(requests().at(-1)!.data.posterName).toBeUndefined();
    } finally {
      click.mockRestore();
      vi.useRealTimers();
    }
  });

  it('período sem músicas: Músicas e Mix desabilitados, com legenda', async () => {
    open({ ...INPUT, topTracks: [], trackStats: [] });
    const group = screen.getByRole('radiogroup', { name: 'Modelo' });
    const caption = screen.getByText(
      'Este período não tem músicas, então Músicas e Mix ficam de fora.',
    );
    expect(group).toHaveAttribute('aria-describedby', caption.id);
    expect(screen.getByRole('radio', { name: 'Músicas' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Mix' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Básico' })).toBeEnabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Músicas' }));
    await waitFor(() => expect(preview()).toHaveAttribute('data-state', 'ready'));
    expect(preview()).toHaveAttribute('data-template', 'festival');
    expect(requests().every((request) => request.template === 'festival')).toBe(true);
  });

  it('Conectar: logo sempre; capa só no Básico', async () => {
    open({ ...INPUT, mode: 'connect', coverUrl: 'https://i.scdn.co/image/abc' });
    await waitFor(() => expect(preview()).toHaveAttribute('data-state', 'ready'));
    expect(requests()[0]!.data.spotifyLogo).toBe('data:image/svg+xml;base64,BBBB');
    expect(requests()[0]!.data.cover).toBeUndefined();
    expect(screen.getAllByText('Inclui a atribuição ao Spotify.').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('radio', { name: 'Básico' }));
    await waitFor(() => expect(requests()).toHaveLength(2));
    expect(client.loadCover).toHaveBeenCalledWith('https://i.scdn.co/image/abc');
    expect(requests()[1]!.data.cover).toBe('data:image/png;base64,AAAA');
    // Músicas e Mix: logo oficial, sem capa.
    for (const name of ['Músicas', 'Mix']) {
      fireEvent.click(screen.getByRole('radio', { name }));
      await waitFor(() =>
        expect(requests().at(-1)!.template).toBe(name === 'Mix' ? 'mix' : 'tracks'),
      );
      await waitFor(() => expect(preview()).toHaveAttribute('data-state', 'ready'));
      const last = requests().at(-1)!;
      expect(last.mode).toBe('connect');
      expect(last.data.spotifyLogo).toBe('data:image/svg+xml;base64,BBBB');
      expect(last.data.cover).toBeUndefined();
    }
    expect(client.loadCover).toHaveBeenCalledTimes(1);
  });

  it('Conectar sem o logo não gera card sem atribuição (erro com "Tentar de novo")', async () => {
    client.loadSpotifyLogo.mockRejectedValueOnce(new Error('offline'));
    open({ ...INPUT, mode: 'connect' });
    expect(await screen.findByText('Não consegui gerar a imagem')).toBeInTheDocument();
    expect(client.generateCard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(preview()).toHaveAttribute('data-state', 'ready'));
  });

  it('erro do worker mostra o alerta; fechar revoga as prévias', async () => {
    client.generateCard.mockRejectedValueOnce(new Error('oom'));
    const { unmount, onOpenChange } = open({ ...INPUT, mode: 'demo' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Não consegui gerar a imagem');
    expect(screen.getAllByText('Card marcado como DEMO.').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(preview()).toHaveAttribute('data-state', 'ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    unmount();
    expect(revoked).toEqual(created);
  });
});

function Harness({ build }: { build: () => ShareInput | null }) {
  const share = useShareLauncher(build);
  return (
    <>
      <ShareButton onOpen={(from) => void share.open(from)} pending={share.pending} />
      {share.dialog}
    </>
  );
}

describe('botão Compartilhar (carregamento sob demanda)', () => {
  it('abre o modal com o recorte do toque e devolve o foco ao fechar', async () => {
    const build = vi.fn(() => INPUT);
    renderWithIntl(<Harness build={build} />);
    const button = screen.getByTestId('share-open');
    expect(client.warmUpCards).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(build).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  });

  it('sem dados, não abre e avisa', async () => {
    renderWithIntl(<Harness build={() => null} />);
    fireEvent.click(screen.getByTestId('share-open'));
    await waitFor(() => expect(screen.getByTestId('share-open')).toBeEnabled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
