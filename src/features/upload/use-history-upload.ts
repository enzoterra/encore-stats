'use client';

import { proxy, wrap, type Remote } from 'comlink';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { HistoryError, ProcessProgress, ProcessReport, ProcessResult } from '@/domain/history';
import { resolveTimeZone } from '@/domain/time';
import type { HistoryWorkerApi } from '@/workers/history-worker-api';

import { firstUnsupported } from './errors';

/**
 * Por que o worker parou: `load` = o script do leitor (ou um pedaço dele) não baixou, o que quase
 * sempre é falta de internet; `crash` = ele morreu no meio (ex.: falta de memória).
 */
export type WorkerFailure = 'load' | 'crash';

/** Worker isolado atrás de uma interface, para trocar por um falso nos testes de componente. */
export type WorkerHandle = {
  api: Pick<Remote<HistoryWorkerApi>, 'processHistory' | 'cancel'>;
  terminate(): void;
  /** Chamado se o worker não carregar ou morrer. */
  onCrash(listener: (cause?: WorkerFailure) => void): void;
};

/**
 * Erro de um evento `error` do Worker. Pela especificação, se o script (ou um módulo que ele
 * importa) não baixa, o navegador dispara um `Event` simples; um erro durante a execução vem como
 * `ErrorEvent`, com mensagem.
 */
export function workerFailure(event: Event, talked: boolean): WorkerFailure {
  if (!(event instanceof ErrorEvent)) return 'load';
  return !talked && !event.message ? 'load' : 'crash';
}

/** Erro mostrado quando o worker falha: sem internet (ou sem o leitor) é outro recado. */
export function failureError(
  cause: WorkerFailure | undefined,
  online: boolean = typeof navigator === 'undefined' ? true : navigator.onLine,
): UploadError {
  return cause === 'load' || !online ? { code: 'OFFLINE' } : { code: 'INTERNAL' };
}

export function createHistoryWorker(): WorkerHandle {
  const worker = new Worker(new URL('../../workers/history.worker.ts', import.meta.url), {
    type: 'module',
    name: 'encore-history',
  });
  let talked = false;
  worker.addEventListener('message', () => {
    talked = true;
  });
  return {
    api: wrap<HistoryWorkerApi>(worker),
    terminate: () => worker.terminate(),
    onCrash: (listener) => {
      worker.addEventListener('error', (event) => listener(workerFailure(event, talked)));
      worker.addEventListener('messageerror', () => listener('crash'));
    },
  };
}

/**
 * Erros do envio: os do leitor (domínio) e `OFFLINE`, quando o leitor não pôde ser baixado (sem
 * internet). O arquivo continua sem sair do aparelho; só o programa que lê é que não chegou.
 */
export type UploadError = HistoryError | { code: 'OFFLINE' };

export type UploadStatus =
  | { kind: 'idle' }
  | { kind: 'processing'; progress: ProcessProgress | null; maxStage: number }
  | { kind: 'error'; error: UploadError };

export type UploadSuccess = {
  dataset: Extract<ProcessResult, { ok: true }>['dataset'];
  report: ProcessReport;
  timeZone: string;
  elapsedMs: number;
};

const STAGE_ORDER = { unzip: 0, parse: 1, aggregate: 2, done: 3 } as const;

/** % geral: leitura até 90%, agregação 95%, fim 100%. */
export function progressPercent(progress: ProcessProgress | null): number {
  if (!progress) return 0;
  if (progress.stage === 'done') return 100;
  if (progress.stage === 'aggregate') return 95;
  if (progress.bytesTotal <= 0) return 0;
  return Math.min(90, Math.floor((progress.bytesRead / progress.bytesTotal) * 90));
}

/**
 * Orquestra o upload (RF-03, RF-04): um worker por envio, progresso via `Comlink.proxy`,
 * cancelamento imediato (`cancel` + `terminate`) e erros tipados. Nada sai do aparelho: o
 * arquivo vai do `<input>` direto ao worker, que não faz rede.
 */
export function useHistoryUpload({
  onSuccess,
  onCancel,
  createWorker = createHistoryWorker,
}: {
  onSuccess: (result: UploadSuccess) => void;
  onCancel?: () => void;
  createWorker?: () => WorkerHandle;
}) {
  const [status, setStatus] = useState<UploadStatus>({ kind: 'idle' });
  const job = useRef(0);
  const handle = useRef<WorkerHandle | null>(null);

  const stop = useCallback(() => {
    handle.current?.terminate();
    handle.current = null;
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const unsupported = firstUnsupported(files);
      if (unsupported !== undefined) {
        setStatus({ kind: 'error', error: { code: 'UNSUPPORTED_FILE', file: unsupported } });
        return;
      }
      stop();
      const id = ++job.current;
      const worker = createWorker();
      handle.current = worker;
      setStatus({ kind: 'processing', progress: null, maxStage: 0 });
      const startedAt = performance.now();

      const crashed = new Promise<{ ok: false; error: UploadError }>((resolve) =>
        worker.onCrash((cause) => resolve({ ok: false, error: failureError(cause) })),
      );
      // O progresso chega por mensagens assíncronas do Comlink: a última pode chegar depois do
      // resultado (acontece no WebKit). Depois de `settled`, ela é ignorada.
      let settled = false;
      const onProgress = proxy((progress: ProcessProgress) => {
        if (settled || job.current !== id) return;
        setStatus((prev) => ({
          kind: 'processing',
          progress,
          maxStage: Math.max(
            prev.kind === 'processing' ? prev.maxStage : 0,
            STAGE_ORDER[progress.stage],
          ),
        }));
      });

      let result: ProcessResult | { ok: false; error: UploadError };
      try {
        result = await Promise.race([worker.api.processHistory(files, onProgress), crashed]);
      } catch {
        result = { ok: false, error: failureError('crash') };
      }
      settled = true;
      if (job.current !== id) return; // cancelado ou substituído por outro envio
      stop();

      if (result.ok) {
        const timeZone = resolveTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
        setStatus({ kind: 'idle' });
        onSuccess({
          dataset: result.dataset,
          report: result.report,
          timeZone,
          elapsedMs: performance.now() - startedAt,
        });
      } else if (result.error.code === 'CANCELLED') {
        setStatus({ kind: 'idle' });
        onCancel?.();
      } else {
        setStatus({ kind: 'error', error: result.error });
      }
    },
    [createWorker, onCancel, onSuccess, stop],
  );

  const cancel = useCallback(() => {
    job.current++;
    try {
      void handle.current?.api.cancel();
    } catch {
      /* o worker pode já ter terminado */
    }
    stop();
    setStatus({ kind: 'idle' });
    onCancel?.();
  }, [onCancel, stop]);

  const reset = useCallback(() => setStatus({ kind: 'idle' }), []);

  return { status, start, cancel, reset };
}
