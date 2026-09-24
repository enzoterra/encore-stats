import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToastViewport, useToasts } from '@/components/ui/toast';
import { generateDemo } from '@/domain/demo';
import type { ProcessProgress, ProcessResult } from '@/domain/history';
import { useDatasetStore } from '@/features/dataset/store';
import ptBR from '@/i18n/messages/pt-BR.json';
import { renderWithIntl } from '../../../tests/support/intl';

import { Dropzone } from './dropzone';
import { UploadView } from './upload-view';
import type { WorkerHandle } from './use-history-upload';

type Controls = {
  handle: WorkerHandle;
  resolve: (result: ProcessResult) => void;
  progress: (p: ProcessProgress) => void;
  crash: () => void;
  terminated: () => boolean;
  files: () => readonly File[];
};

/** Worker falso: controla progresso, resultado e queda sem Web Worker de verdade. */
function fakeWorker(): Controls {
  let resolve: (r: ProcessResult) => void = () => undefined;
  let onProgress: ((p: ProcessProgress) => void) | undefined;
  let crash: () => void = () => undefined;
  let terminated = false;
  let received: readonly File[] = [];
  const handle: WorkerHandle = {
    api: {
      processHistory: ((files: readonly File[], cb?: (p: ProcessProgress) => void) => {
        received = files;
        onProgress = cb;
        return new Promise<ProcessResult>((r) => (resolve = r));
      }) as unknown as WorkerHandle['api']['processHistory'],
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
    crash: () => crash(),
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
    expect(alert).toHaveTextContent('100×');
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
