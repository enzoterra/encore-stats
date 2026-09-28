import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToastViewport, useToasts } from '@/components/ui/toast';
import { generateDemo } from '@/domain/demo';
import type { ProcessProgress, ProcessResult } from '@/domain/history';
import { useDatasetStore } from '@/features/dataset/store';
import en from '@/i18n/messages/en.json';
import ptBR from '@/i18n/messages/pt-BR.json';
import { renderWithIntl } from '../../../tests/support/intl';

import { Dropzone } from './dropzone';
import { UploadView } from './upload-view';
import {
  failureError,
  workerFailure,
  type WorkerFailure,
  type WorkerHandle,
} from './use-history-upload';

type Controls = {
  handle: WorkerHandle;
  resolve: (result: ProcessResult) => void;
  progress: (p: ProcessProgress) => void;
  crash: (cause?: WorkerFailure) => void;
  terminated: () => boolean;
  files: () => readonly File[];
};

/** Worker falso: controla progresso, resultado e queda sem Web Worker de verdade. */
function fakeWorker(): Controls {
  let resolve: (r: ProcessResult) => void = () => undefined;
  let onProgress: ((p: ProcessProgress) => void) | undefined;
  let crash: (cause?: WorkerFailure) => void = () => undefined;
  let terminated = false;
  let received: readonly File[] = [];
  const handle: WorkerHandle = {
    api: {
      processHistory: ((files: readonly File[], cb?: (p: ProcessProgress) => void) => {
        received = files;
        onProgress = cb;
        return new Promise<ProcessResult>((r) => (resolve = r));
      }) as unknown as WorkerHandle['api']['processHistory'],
      processLibrary: vi.fn() as unknown as WorkerHandle['api']['processLibrary'],
      cancel: vi.fn() as unknown as WorkerHandle['api']['cancel'],
    },
    terminate: () => {
      terminated = true;
    },
    onCrash: (listener) => {
      crash = listener;
    },
  };
  return {
    handle,
    resolve: (r) => resolve(r),
    progress: (p) => onProgress?.(p),
    crash: (cause) => crash(cause),
    terminated: () => terminated,
    files: () => received,
  };
}

function setup() {
  const worker = fakeWorker();
  renderWithIntl(
    <>
      <UploadView createWorker={() => worker.handle} repoUrl="https://github.com/exemplo/encore" />
      <ToastViewport />
    </>,
  );
  return worker;
}

function pick(files: File[]) {
  const input = screen.getByLabelText(ptBR.Upload.dropzone.inputLabel);
  fireEvent.change(input, { target: { files } });
}

const zip = () => new File(['PK'], 'my_spotify_data.zip', { type: 'application/zip' });

afterEach(() => {
  useDatasetStore.setState({ upload: null, demo: null });
  useToasts.setState({ queue: [], raised: false });
});

describe('<UploadView />', () => {
  it('mostra o progresso por etapa e, ao terminar, o dashboard (só em memória)', async () => {
    const worker = setup();
    pick([zip()]);
    expect(await screen.findByTestId('upload-progress')).toBeInTheDocument();
    expect(worker.files()[0]?.name).toBe('my_spotify_data.zip');

    act(() =>
      worker.progress({
        stage: 'parse',
        bytesRead: 50,
        bytesTotal: 100,
        filesDone: 1,
        records: 1200,
      }),
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '45');
    expect(screen.getByText(/1 arquivo lido · 1\.200 músicas/)).toBeInTheDocument();
    const steps = screen.getAllByRole('listitem');
    expect(steps[0]).toHaveAttribute('data-state', 'done');
    expect(steps[1]).toHaveAttribute('data-state', 'active');

    const demo = generateDemo({ days: 60 });
    await act(async () => {
      worker.resolve({
        ok: true,
        dataset: demo.dataset,
        report: { files: 2, records: 5000, music: 4900, nonMusic: 100, invalid: 0 },
      });
    });
    expect(await screen.findByTestId('dashboard')).toHaveAttribute('data-mode', 'upload');
    expect(worker.terminated()).toBe(true);
    expect(useDatasetStore.getState().upload?.report.music).toBe(4900);
    expect(screen.getByTestId('toast')).toHaveTextContent(/Pronto! 4\.900 músicas lidas/);
    // Aviso de recarga e nenhum link do Spotify no modo Upload.
    expect(screen.getByText(ptBR.Dashboard.reloadBanner)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /spotify/i })).toBeNull();
    expect(document.querySelector('a[href*="open.spotify.com"]')).toBeNull();
  });

  it('cancela na hora: encerra o worker, volta ao início e avisa que nada foi guardado', async () => {
    const worker = setup();
    pick([zip()]);
    await screen.findByTestId('upload-progress');
    fireEvent.click(screen.getByRole('button', { name: ptBR.Upload.progress.cancel }));
    expect(worker.terminated()).toBe(true);
    expect(screen.queryByTestId('upload-progress')).toBeNull();
    expect(screen.getByTestId('dropzone')).toBeInTheDocument();
    expect(screen.getByTestId('toast')).toHaveTextContent(ptBR.Upload.progress.cancelled);
    // Um resultado atrasado do worker cancelado é ignorado.
    await act(async () => worker.resolve({ ok: false, error: { code: 'INTERNAL' } }));
    expect(screen.queryByText(ptBR.Upload.errors.INTERNAL.title)).toBeNull();
    expect(useDatasetStore.getState().upload).toBeNull();
  });

  it('traduz o erro do worker e permite tentar outro arquivo', async () => {
    const worker = setup();
    pick([zip()]);
    await screen.findByTestId('upload-progress');
    await act(async () =>
      worker.resolve({
        ok: false,
        error: {
          code: 'COMPRESSION_RATIO',
          file: 'bomb.zip',
          entry: 'Streaming_History_Audio_x.json',
          limit: 100,
        },
      }),
    );
    const alert = screen
      .getAllByRole('alert')
      .find((el) => el.textContent?.includes(ptBR.Upload.errors.COMPRESSION_RATIO.title))!;
    expect(alert).toHaveTextContent('Streaming_History_Audio_x.json');
    expect(alert).toHaveTextContent('100 vezes');
    fireEvent.click(within(alert).getByRole('button', { name: ptBR.Upload.actions.tryAnother }));
    expect(screen.queryByText(ptBR.Upload.errors.COMPRESSION_RATIO.title)).toBeNull();
  });

  it('erro de formato oferece "Avisar no GitHub" com o repositório', async () => {
    const worker = setup();
    pick([zip()]);
    await screen.findByTestId('upload-progress');
    await act(async () =>
      worker.resolve({
        ok: false,
        error: { code: 'INVALID_RECORDS', entry: 'a.json', invalid: 9, total: 100 },
      }),
    );
    expect(screen.getByRole('link', { name: ptBR.Upload.actions.report })).toHaveAttribute(
      'href',
      'https://github.com/exemplo/encore/issues',
    );
  });

  it('progresso atrasado (depois do resultado) não volta a tela para "processando"', async () => {
    const worker = setup();
    pick([zip()]);
    await screen.findByTestId('upload-progress');
    await act(async () => worker.resolve({ ok: false, error: { code: 'NO_HISTORY_FILES' } }));
    // No WebKit a última mensagem de progresso do Comlink chega depois do resultado.
    act(() =>
      worker.progress({
        stage: 'unzip',
        bytesRead: 573,
        bytesTotal: 573,
        filesDone: 0,
        records: 0,
      }),
    );
    expect(screen.queryByTestId('upload-progress')).toBeNull();
    expect(screen.getByText(ptBR.Upload.errors.NO_HISTORY_FILES.title)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: ptBR.Upload.actions.howTo })).toHaveAttribute(
      'href',
      '/onboarding',
    );
  });

  it('queda do worker (ex.: sem memória) vira erro INTERNAL', async () => {
    const worker = setup();
    pick([zip()]);
    await screen.findByTestId('upload-progress');
    await act(async () => worker.crash());
    expect(await screen.findByText(ptBR.Upload.errors.INTERNAL.title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ptBR.Upload.actions.tryAgain })).toBeInTheDocument();
  });

  it('sem internet o leitor não baixa: aviso próprio, e não o de falta de memória', async () => {
    const worker = setup();
    pick([zip()]);
    await screen.findByTestId('upload-progress');
    await act(async () => worker.crash('load'));
    expect(await screen.findByText(ptBR.Upload.errors.OFFLINE.title)).toBeInTheDocument();
    const body = screen.getByText(ptBR.Upload.errors.OFFLINE.body);
    expect(body).toHaveAttribute('data-error-code', 'OFFLINE');
    expect(body).toHaveTextContent('seu arquivo continua sem sair do aparelho');
    expect(screen.queryByText(ptBR.Upload.errors.INTERNAL.title)).toBeNull();
    // "Tentar de novo" volta para a escolha do arquivo.
    fireEvent.click(screen.getByRole('button', { name: ptBR.Upload.actions.tryAgain }));
    expect(screen.queryByText(ptBR.Upload.errors.OFFLINE.title)).toBeNull();
    expect(screen.getByLabelText(ptBR.Upload.dropzone.inputLabel)).toBeInTheDocument();
  });

  it('queda com o aparelho offline também vira o aviso de internet', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      const worker = setup();
      pick([zip()]);
      await screen.findByTestId('upload-progress');
      await act(async () => worker.crash());
      expect(await screen.findByText(ptBR.Upload.errors.OFFLINE.title)).toBeInTheDocument();
    } finally {
      online.mockRestore();
    }
  });

  it('recusa extensão estranha antes de abrir o worker', async () => {
    const create = vi.fn();
    renderWithIntl(<UploadView createWorker={create} />);
    pick([new File(['x'], 'foto.png', { type: 'image/png' })]);
    expect(await screen.findByText(ptBR.Upload.errors.UNSUPPORTED_FILE.title)).toBeInTheDocument();
    expect(screen.getByText(/foto\.png/)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('<Dropzone />', () => {
  it('aceita arquivos soltos e sinaliza o arraste válido e o inválido', () => {
    const onFiles = vi.fn();
    renderWithIntl(<Dropzone onFiles={onFiles} />);
    const zone = screen.getByTestId('dropzone');
    const input = screen.getByLabelText(ptBR.Upload.dropzone.inputLabel);
    expect(input).toHaveAttribute('accept', '.zip,.json,application/zip,application/json');
    expect(input).toHaveAttribute('multiple');

    fireEvent.dragEnter(zone, { dataTransfer: { items: [{ kind: 'file', type: 'image/png' }] } });
    expect(zone).toHaveAttribute('data-drag', 'invalid');
    expect(zone).toHaveTextContent(ptBR.Upload.dropzone.dragInvalid);
    fireEvent.dragLeave(zone);
    fireEvent.dragEnter(zone, {
      dataTransfer: { items: [{ kind: 'file', type: 'application/zip' }] },
    });
    expect(zone).toHaveAttribute('data-drag', 'valid');
    expect(zone).toHaveTextContent(ptBR.Upload.dropzone.dragValid);

    const files = [zip(), new File(['[]'], 'Streaming_History_Audio_2024.json')];
    fireEvent.drop(zone, { dataTransfer: { files, items: [] } });
    expect(onFiles).toHaveBeenCalledWith(files);
    expect(zone).toHaveAttribute('data-drag', 'none');
  });

  it('funciona pelo input (teclado): seleção múltipla', async () => {
    const onFiles = vi.fn();
    renderWithIntl(<Dropzone onFiles={onFiles} />);
    const files = [zip(), zip()];
    fireEvent.change(screen.getByLabelText(ptBR.Upload.dropzone.inputLabel), { target: { files } });
    await waitFor(() => expect(onFiles).toHaveBeenCalledWith(files));
  });
});

describe('falha do leitor (worker)', () => {
  it('script que não baixou (Event simples) é "load"; erro de execução é "crash"', () => {
    expect(workerFailure(new Event('error'), false)).toBe('load');
    expect(workerFailure(new Event('error'), true)).toBe('load');
    expect(workerFailure(new ErrorEvent('error', { message: 'boom' }), false)).toBe('crash');
    expect(workerFailure(new ErrorEvent('error', { message: 'boom' }), true)).toBe('crash');
    // Sem mensagem e antes de qualquer resposta: tratado como falha de carregamento.
    expect(workerFailure(new ErrorEvent('error'), false)).toBe('load');
    expect(workerFailure(new ErrorEvent('error'), true)).toBe('crash');
  });

  it('OFFLINE quando o leitor não carregou ou o aparelho está offline; senão INTERNAL', () => {
    expect(failureError('load', true)).toEqual({ code: 'OFFLINE' });
    expect(failureError('crash', false)).toEqual({ code: 'OFFLINE' });
    expect(failureError(undefined, false)).toEqual({ code: 'OFFLINE' });
    expect(failureError('crash', true)).toEqual({ code: 'INTERNAL' });
    expect(failureError(undefined, true)).toEqual({ code: 'INTERNAL' });
  });

  it('a mensagem existe nas duas línguas, em linguagem simples', () => {
    expect(ptBR.Upload.errors.OFFLINE.body).toMatch(/sem internet/);
    expect(en.Upload.errors.OFFLINE.body).toMatch(/offline/);
    expect(ptBR.Upload.errors.OFFLINE.body).not.toMatch(/mem[oó]ria|worker|chunk/i);
    expect(en.Upload.errors.OFFLINE.body).not.toMatch(/memory|worker|chunk/i);
  });
});
