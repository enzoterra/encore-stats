'use client';

import { proxy, wrap, type Remote } from 'comlink';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { HistoryError, ProcessProgress, ProcessReport, ProcessResult } from '@/domain/history';
import { resolveTimeZone } from '@/domain/time';
import type { HistoryWorkerApi } from '@/workers/history-worker-api';

import { firstUnsupported } from './errors';

/** Worker isolado atrás de uma interface, para trocar por um falso nos testes de componente. */
export type WorkerHandle = {
  api: Pick<Remote<HistoryWorkerApi>, 'processHistory' | 'cancel'>;
  terminate(): void;
  /** Chamado se o worker morrer (ex.: falta de memória). */
  onCrash(listener: () => void): void;
};

export function createHistoryWorker(): WorkerHandle {
  const worker = new Worker(new URL('../../workers/history.worker.ts', import.meta.url), {
    type: 'module',
    name: 'encore-history',
  });
  return {
    api: wrap<HistoryWorkerApi>(worker),
    terminate: () => worker.terminate(),
    onCrash: (listener) => {
      worker.addEventListener('error', listener);
      worker.addEventListener('messageerror', listener);
    },
  };
}

export type UploadStatus =
  | { kind: 'idle' }
  | { kind: 'processing'; progress: ProcessProgress | null; maxStage: number }
  | { kind: 'error'; error: HistoryError };

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

      const crashed = new Promise<ProcessResult>((resolve) =>
        worker.onCrash(() => resolve({ ok: false, error: { code: 'INTERNAL' } })),
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

      let result: ProcessResult;
      try {
        result = await Promise.race([worker.api.processHistory(files, onProgress), crashed]);
      } catch {
        result = { ok: false, error: { code: 'INTERNAL' } };
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
