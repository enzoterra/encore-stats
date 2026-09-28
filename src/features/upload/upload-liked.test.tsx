import { act, fireEvent, renderHook, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ToastViewport, useToasts } from '@/components/ui/toast';
import { type DemoData, generateDemo } from '@/domain/demo';
import {
  type LibraryResult,
  type LikedByArtist,
  type ProcessProgress,
  type ProcessResult,
  topLikedArtists,
} from '@/domain/history';
import { LikedBoard, LikedSection } from '@/features/dashboard/liked-board';
import { useDatasetStore } from '@/features/dataset/store';
import { DemoView } from '@/features/demo/demo-view';
import en from '@/i18n/messages/en.json';
import ptBR from '@/i18n/messages/pt-BR.json';
import { EXPECTED_FIXTURE_LIBRARY } from '../../../tests/support/library';
import { renderWithIntl } from '../../../tests/support/intl';

import { UploadView } from './upload-view';
import { useLibraryUpload, type WorkerHandle } from './use-history-upload';

type Fake = {
  handle: WorkerHandle;
  resolveHistory: (result: ProcessResult) => void;
  resolveLibrary: (result: LibraryResult) => void;
  progress: (p: ProcessProgress) => void;
  terminated: () => boolean;
  libraryFiles: () => readonly File[] | null;
};

/** Worker falso com os dois jobs (`processHistory` e `processLibrary`). */
function fakeWorker(): Fake {
  let resolveHistory: (r: ProcessResult) => void = () => undefined;
  let resolveLibrary: (r: LibraryResult) => void = () => undefined;
  let onProgress: ((p: ProcessProgress) => void) | undefined;
  let terminated = false;
  let libraryFiles: readonly File[] | null = null;
  const handle: WorkerHandle = {
    api: {
      processHistory: ((_: readonly File[], cb?: (p: ProcessProgress) => void) => {
        onProgress = cb;
        return new Promise<ProcessResult>((r) => (resolveHistory = r));
      }) as unknown as WorkerHandle['api']['processHistory'],
      processLibrary: ((files: readonly File[], cb?: (p: ProcessProgress) => void) => {
        libraryFiles = files;
        onProgress = cb;
        return new Promise<LibraryResult>((r) => (resolveLibrary = r));
      }) as unknown as WorkerHandle['api']['processLibrary'],
      cancel: vi.fn() as unknown as WorkerHandle['api']['cancel'],
    },
    terminate: () => {
      terminated = true;
    },
    onCrash: () => undefined,
  };
  return {
    handle,
    resolveHistory: (r) => resolveHistory(r),
    resolveLibrary: (r) => resolveLibrary(r),
    progress: (p) => onProgress?.(p),
    terminated: () => terminated,
    libraryFiles: () => libraryFiles,
  };
}

let demo: DemoData;
beforeAll(() => {
  demo = generateDemo({ days: 60 });
});

afterEach(() => {
  useDatasetStore.setState({ upload: null, demo: null });
  useToasts.setState({ queue: [], raised: false });
});

const REPORT = { files: 2, records: 5000, music: 4900, nonMusic: 100, invalid: 0 };
const LIBRARY: LikedByArtist = EXPECTED_FIXTURE_LIBRARY;
const zip = (name = 'my_spotify_data.zip') => new File(['PK'], name, { type: 'application/zip' });

function setup(locale: 'pt-BR' | 'en' = 'pt-BR') {
  const workers: Fake[] = [];
  renderWithIntl(
    <>
      <UploadView
        repoUrl="https://github.com/exemplo/encore"
        createWorker={() => {
          const fake = fakeWorker();
          workers.push(fake);
          return fake.handle;
        }}
      />
      <ToastViewport />
    </>,
    locale,
  );
  return workers;
}

async function loadHistory(workers: Fake[], library?: LikedByArtist, label?: string) {
  fireEvent.change(screen.getByLabelText(label ?? ptBR.Upload.dropzone.inputLabel), {
    target: { files: [zip()] },
  });
  await screen.findByTestId('upload-progress');
  await act(async () =>
    workers[0]!.resolveHistory({
      ok: true,
      dataset: demo.dataset,
      report: REPORT,
      ...(library ? { library } : {}),
    }),
  );
  return screen.findByTestId('dashboard');
}

const t = ptBR.Dashboard.liked;

/** O alerta de erro do envio (a fila de toasts também tem `role="alert"`). */
function errorAlert(): HTMLElement {
  const alert = screen
    .getAllByRole('alert')
    .find((element) => element.querySelector('[data-error-code]'));
  if (!alert) throw new Error('sem alerta de erro');
  return alert;
}

/** Mensagens dos toasts enfileirados (um aparece por vez). */
const toasts = () => useToasts.getState().queue.map((toast) => toast.message);

describe('envio do histórico com o "Dados da conta"', () => {
  it('a tela de envio explica o segundo arquivo, opcional, com o link das instruções', () => {
    setup();
    const hint = screen.getByTestId('liked-hint');
    expect(hint).toHaveTextContent(ptBR.Upload.liked.hint);
    expect(within(hint).getByRole('link', { name: ptBR.Upload.liked.hintLink })).toHaveAttribute(
      'href',
      '/onboarding#dados-da-conta',
    );
  });

  it('no mesmo envio: o painel já abre com o quadro de curtidas', async () => {
    const workers = setup();
    await loadHistory(workers, LIBRARY);
    const section = screen.getByTestId('liked-section');
    expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(t.title);
    expect(section).toHaveTextContent(t.badge);
    expect(section).toHaveTextContent(t.lead);
    const winner = screen.getByTestId('liked-winner');
    expect(winner).toHaveTextContent('Capivara Cósmica');
    expect(winner).toHaveTextContent('7 músicas curtidas');
    expect(screen.getByTestId('liked-total')).toHaveTextContent(
      '30 músicas curtidas de 10 artistas, no total.',
    );
    const others = screen.getByRole('list', { name: ptBR.Connect.liked.othersLabel });
    expect(others).toHaveAttribute('start', '2');
    expect(within(others).getAllByRole('listitem')).toHaveLength(9);
    expect(within(others).getAllByRole('listitem')[0]).toHaveTextContent('Lua de Vinil');
    // Sem capa nem link do Spotify no Upload.
    expect(section.querySelector('img')).toBeNull();
    expect(section.querySelector('a')).toBeNull();
    expect(screen.queryByTestId('liked-invite')).toBeNull();
    expect(useDatasetStore.getState().upload?.library).toEqual(LIBRARY);
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'Pronto! 4.900 músicas lidas e 30 curtidas',
    );
    expect(screen.getByText(ptBR.Dashboard.footer.uploadLiked)).toBeInTheDocument();
  });

  it('o quadro não muda com o período', async () => {
    const workers = setup();
    await loadHistory(workers, LIBRARY);
    const before = screen.getByTestId('liked-board').textContent;
    fireEvent.click(screen.getByRole('radio', { name: ptBR.Dashboard.period.modes.all }));
    expect(screen.getByTestId('dashboard-title')).toHaveTextContent(ptBR.Dashboard.title.all);
    expect(screen.getByTestId('liked-board').textContent).toBe(before);
  });

  it('só o "Dados da conta" (WRONG_EXPORT + library): pede o histórico completo', async () => {
    const workers = setup();
    fireEvent.change(screen.getByLabelText(ptBR.Upload.dropzone.inputLabel), {
      target: { files: [zip('my_spotify_data (1).zip')] },
    });
    await screen.findByTestId('upload-progress');
    await act(async () =>
      workers[0]!.resolveHistory({ ok: false, error: { code: 'WRONG_EXPORT', source: 'library' } }),
    );
    const alert = errorAlert();
    expect(alert).toHaveTextContent(ptBR.Upload.libraryErrors.WRONG_EXPORT.title);
    expect(alert).toHaveTextContent(ptBR.Upload.libraryErrors.WRONG_EXPORT.body);
    expect(alert).not.toHaveTextContent(ptBR.Upload.libraryErrors.optionalHint);
    expect(within(alert).getByRole('link', { name: ptBR.Upload.actions.howTo })).toHaveAttribute(
      'href',
      '/onboarding',
    );
    expect(alert.querySelector('[data-error-code]')).toHaveAttribute(
      'data-error-code',
      'WRONG_EXPORT',
    );
  });

  it('WRONG_EXPORT sem "source" continua com o recado do pacote "Dados da conta"', async () => {
    const workers = setup();
    fireEvent.change(screen.getByLabelText(ptBR.Upload.dropzone.inputLabel), {
      target: { files: [zip()] },
    });
    await screen.findByTestId('upload-progress');
    await act(async () =>
      workers[0]!.resolveHistory({ ok: false, error: { code: 'WRONG_EXPORT' } }),
    );
    expect(errorAlert()).toHaveTextContent(ptBR.Upload.errors.WRONG_EXPORT.title);
  });

  it('arquivo de curtidas quebrado no envio junto: recado próprio e lembra que é opcional (en)', async () => {
    const workers = setup('en');
    fireEvent.change(screen.getByLabelText(en.Upload.dropzone.inputLabel), {
      target: { files: [zip()] },
    });
    await screen.findByTestId('upload-progress');
    await act(async () =>
      workers[0]!.resolveHistory({
        ok: false,
        error: {
          code: 'ENTRY_TOO_LARGE',
          file: 'a.zip',
          entry: 'YourLibrary.json',
          limit: 32 * 1024 * 1024,
          source: 'library',
        },
      }),
    );
    const alert = errorAlert();
    expect(alert).toHaveTextContent(en.Upload.libraryErrors.ENTRY_TOO_LARGE.title);
    expect(alert).toHaveTextContent('"YourLibrary.json" grows past 32 MB once opened.');
    expect(alert).toHaveTextContent(en.Upload.libraryErrors.optionalHint);
  });
});

describe('curtidas enviadas depois, com o painel aberto', () => {
  it('convite discreto → progresso → quadro, sem reler o histórico', async () => {
    const workers = setup();
    await loadHistory(workers);
    expect(screen.queryByTestId('liked-board')).toBeNull();
    expect(screen.getByText(ptBR.Dashboard.footer.upload)).toBeInTheDocument();
    const invite = screen.getByTestId('liked-invite');
    expect(within(invite).getByRole('heading', { level: 2 })).toHaveTextContent(t.invite.title);
    expect(within(invite).getByRole('link', { name: t.invite.howTo })).toHaveAttribute(
      'href',
      '/onboarding#dados-da-conta',
    );
    const input = within(invite).getByLabelText(t.invite.inputLabel);
    expect(input).toHaveAttribute('accept', '.zip,.json,application/zip,application/json');

    const file = zip('my_spotify_data (account).zip');
    fireEvent.change(input, { target: { files: [file] } });
    const progress = await screen.findByTestId('liked-progress');
    expect(workers).toHaveLength(2);
    expect(workers[1]!.libraryFiles()?.[0]).toBe(file);
    act(() =>
      workers[1]!.progress({
        stage: 'parse',
        bytesRead: 50,
        bytesTotal: 100,
        filesDone: 1,
        records: 30,
      }),
    );
    expect(within(progress).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '45');
    expect(progress).toHaveTextContent('30 curtidas lidas');

    const dataset = useDatasetStore.getState().upload!.dataset;
    await act(async () => workers[1]!.resolveLibrary({ ok: true, library: LIBRARY }));
    expect(await screen.findByTestId('liked-board')).toBeInTheDocument();
    expect(screen.getByTestId('liked-winner')).toHaveTextContent('Capivara Cósmica');
    expect(workers[1]!.terminated()).toBe(true);
    const state = useDatasetStore.getState().upload!;
    expect(state.library).toEqual(LIBRARY);
    expect(state.dataset).toBe(dataset); // o histórico não foi relido
    expect(screen.getByRole('heading', { name: t.title })).toHaveFocus();
    expect(toasts().at(-1)).toMatch(/^Pronto! 30 músicas curtidas lidas/);
    expect(screen.getByText(ptBR.Dashboard.footer.uploadLiked)).toBeInTheDocument();
  });

  it('NO_LIBRARY_FILE: recado simples, instruções do "Dados da conta" e tentar outro', async () => {
    const workers = setup();
    await loadHistory(workers);
    fireEvent.change(screen.getByLabelText(t.invite.inputLabel), { target: { files: [zip()] } });
    await screen.findByTestId('liked-progress');
    await act(async () =>
      workers[1]!.resolveLibrary({ ok: false, error: { code: 'NO_LIBRARY_FILE' } }),
    );
    const invite = screen.getByTestId('liked-invite');
    const alert = errorAlert();
    expect(alert).toHaveTextContent(ptBR.Upload.errors.NO_LIBRARY_FILE.title);
    expect(alert).toHaveTextContent(ptBR.Upload.errors.NO_LIBRARY_FILE.body);
    expect(within(alert).getByRole('heading', { level: 3 })).toBeInTheDocument();
    expect(
      within(alert).getByRole('link', { name: ptBR.Upload.actions.howToLibrary }),
    ).toHaveAttribute('href', '/onboarding#dados-da-conta');
    fireEvent.click(within(alert).getByRole('button', { name: ptBR.Upload.actions.tryAnother }));
    expect(within(invite).queryByRole('alert')).toBeNull();
    expect(within(invite).getByLabelText(t.invite.inputLabel)).toBeInTheDocument();
    // O histórico continua carregado.
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });

  it('YourLibrary.json quebrado no envio depois: recado das curtidas, sem o "envie só o histórico"', async () => {
    const workers = setup();
    await loadHistory(workers);
    fireEvent.change(screen.getByLabelText(t.invite.inputLabel), { target: { files: [zip()] } });
    await screen.findByTestId('liked-progress');
    await act(async () =>
      workers[1]!.resolveLibrary({
        ok: false,
        error: { code: 'INVALID_JSON', entry: 'YourLibrary.json', source: 'library' },
      }),
    );
    const alert = errorAlert();
    expect(alert).toHaveTextContent(ptBR.Upload.libraryErrors.INVALID_JSON.title);
    expect(alert).toHaveTextContent('Não deu para ler "YourLibrary.json"');
    expect(alert).not.toHaveTextContent(ptBR.Upload.libraryErrors.optionalHint);
  });

  it('cancelar: encerra o worker, volta ao convite e o histórico continua', async () => {
    const workers = setup();
    await loadHistory(workers);
    fireEvent.change(screen.getByLabelText(t.invite.inputLabel), { target: { files: [zip()] } });
    await screen.findByTestId('liked-progress');
    fireEvent.click(screen.getByRole('button', { name: t.progress.cancel }));
    expect(workers[1]!.terminated()).toBe(true);
    expect(screen.queryByTestId('liked-progress')).toBeNull();
    expect(screen.getByLabelText(t.invite.inputLabel)).toBeInTheDocument();
    expect(toasts().at(-1)).toBe(t.progress.cancelled);
    await act(async () => workers[1]!.resolveLibrary({ ok: true, library: LIBRARY }));
    expect(screen.queryByTestId('liked-board')).toBeNull();
    expect(useDatasetStore.getState().upload?.library).toBeUndefined();
  });

  it('arrastar o arquivo até o convite também envia', async () => {
    const workers = setup();
    await loadHistory(workers);
    const invite = screen.getByTestId('liked-invite');
    fireEvent.dragEnter(invite, {
      dataTransfer: { items: [{ kind: 'file', type: 'application/json' }] },
    });
    expect(invite).toHaveAttribute('data-drag', 'valid');
    const file = new File(['{}'], 'YourLibrary.json', { type: 'application/json' });
    fireEvent.drop(invite, { dataTransfer: { files: [file], items: [] } });
    await screen.findByTestId('liked-progress');
    expect(workers[1]!.libraryFiles()?.[0]).toBe(file);
  });
});

describe('useLibraryUpload', () => {
  it('um envio novo cancela o anterior (um job por vez)', async () => {
    const fakes: Fake[] = [];
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useLibraryUpload({
        onSuccess,
        createWorker: () => {
          const fake = fakeWorker();
          fakes.push(fake);
          return fake.handle;
        },
      }),
    );
    act(() => void result.current.start([zip('a.zip')]));
    act(() => void result.current.start([zip('b.zip')]));
    expect(fakes).toHaveLength(2);
    expect(fakes[0]!.terminated()).toBe(true);
    expect(fakes[1]!.terminated()).toBe(false);

    // O resultado atrasado do primeiro é ignorado; vale o do segundo.
    await act(async () =>
      fakes[0]!.resolveLibrary({
        ok: true,
        library: { total: 1, artists: [{ name: 'Velho', count: 1 }] },
      }),
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.status.kind).toBe('processing');
    await act(async () => fakes[1]!.resolveLibrary({ ok: true, library: LIBRARY }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(LIBRARY);
    expect(result.current.status.kind).toBe('idle');
  });

  it('extensão estranha vira erro antes de abrir o worker', () => {
    const create = vi.fn();
    const { result } = renderHook(() =>
      useLibraryUpload({ onSuccess: vi.fn(), createWorker: create }),
    );
    act(() => void result.current.start([new File(['x'], 'foto.png')]));
    expect(result.current.status).toEqual({
      kind: 'error',
      error: { code: 'UNSUPPORTED_FILE', file: 'foto.png' },
    });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('<LikedBoard />', () => {
  it('biblioteca vazia: recado simples, sem destaque', () => {
    renderWithIntl(
      <LikedSection>
        <LikedBoard library={{ total: 0, artists: [] }} />
      </LikedSection>,
    );
    expect(screen.getByText(t.empty)).toBeInTheDocument();
    expect(screen.queryByTestId('liked-winner')).toBeNull();
  });

  it('em inglês, com um artista só (sem lista dos outros)', () => {
    renderWithIntl(
      <LikedSection>
        <LikedBoard library={{ total: 1, artists: [{ name: 'Solo', count: 1 }] }} />
      </LikedSection>,
      'en',
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(en.Dashboard.liked.title);
    expect(screen.getByText(en.Dashboard.liked.lead)).toBeInTheDocument();
    expect(screen.getByTestId('liked-winner')).toHaveTextContent('1 liked song');
    expect(screen.getByTestId('liked-total')).toHaveTextContent(
      '1 liked song from 1 artist in total.',
    );
    expect(screen.queryByRole('list')).toBeNull();
  });
});

describe('demo', () => {
  it('a Visão Upload mostra o quadro com as curtidas de generateDemo().library', async () => {
    renderWithIntl(<DemoView />);
    const board = await screen.findByTestId('liked-board', {}, { timeout: 5000 });
    const library = useDatasetStore.getState().demo!.library;
    const summary = topLikedArtists(library, 10);
    expect(screen.getByTestId('liked-winner')).toHaveTextContent(summary.top[0]!.name);
    expect(within(board).getByRole('list')).toHaveTextContent(summary.top[1]!.name);
    expect(screen.getByTestId('liked-total')).toHaveTextContent(
      new Intl.NumberFormat('pt-BR').format(summary.total),
    );
    expect(screen.queryByTestId('liked-invite')).toBeNull();
    expect(board.querySelector('a')).toBeNull();
  });
});
