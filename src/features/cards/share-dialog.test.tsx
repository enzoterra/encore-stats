import { act, fireEvent, screen, waitFor } from '@testing-library/react';
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
  topTracks: [{ name: 'Céu de Neon', artist: 'Lua Vermelha' }],
  heroSub: '12 plays',
  stat: { value: '1.000', label: 'minutos' },
  stats: ['1.000 min'],
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
  it('abre já gerando o Festival 9:16, com foco no título e sem o Spotify no Upload', async () => {
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
      name: /Card Festival: Lua Vermelha, Os Ventiladores, Marina Sal…/,
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
    fireEvent.click(screen.getByRole('radio', { name: 'Festival' }));
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

  it('sem Web Share: o primário baixa o PNG com o nome do arquivo do período', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    open();
    await waitFor(() => expect(screen.getByTestId('share-download')).toBeEnabled());
    expect(screen.queryByRole('button', { name: 'Compartilhar' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('share-download'));
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe('encore-festival-stories-dez-de-2024.png');
    expect(screen.getByTestId('share-done')).toHaveTextContent('PNG baixado');
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

    // Outro erro (gesto perdido, alvo recusou): baixa o PNG no lugar.
    share.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'));
    fireEvent.click(button);
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('share-done')).toHaveTextContent('baixamos o PNG');
    click.mockRestore();
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
