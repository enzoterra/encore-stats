import { transfer } from 'comlink';

import {
  datasetTransferables,
  processHistory,
  type HistoryInput,
  type HistoryLimits,
  type ProcessProgress,
  type ProcessResult,
} from '@/domain/history';

/**
 * Contrato do `history.worker.ts` (Comlink). Uso na UI (Sprint 4):
 *
 * ```ts
 * const worker = new Worker(new URL('@/workers/history.worker.ts', import.meta.url), { type: 'module' });
 * const api = Comlink.wrap<HistoryWorkerApi>(worker);
 * const result = await api.processHistory(files, Comlink.proxy(setProgress));
 * // cancelar: api.cancel()  (ou worker.terminate() como corte imediato)
 * ```
 *
 * O resultado nunca é uma exceção: `{ ok: false, error: { code } }` atravessa o Comlink sem
 * perder o tipo. As colunas do Dataset são transferidas (sem cópia).
 */
export type HistoryWorkerApi = {
  processHistory(
    files: readonly HistoryInput[],
    onProgress?: (progress: ProcessProgress) => void,
  ): Promise<ProcessResult>;
  /** Cancela o processamento em andamento (resolve com `CANCELLED`). */
  cancel(): void;
};

type Deps = {
  process?: typeof processHistory;
  transfer?: typeof transfer;
  limits?: Partial<HistoryLimits>;
};

export function createHistoryWorkerApi(deps: Deps = {}): HistoryWorkerApi {
  const run = deps.process ?? processHistory;
  const markTransfer = deps.transfer ?? transfer;
  let current: AbortController | null = null;

  return {
    async processHistory(files, onProgress) {
      current?.abort(); // um job por vez: um novo upload cancela o anterior
      const controller = new AbortController();
      current = controller;
      const report = onProgress
        ? (progress: ProcessProgress) => {
            // Via Comlink o callback é um proxy assíncrono; falhas do lado da UI são ignoradas.
            try {
              void Promise.resolve(onProgress(progress)).catch(() => undefined);
            } catch {
              /* a UI pode ter liberado o proxy */
            }
          }
        : undefined;
      try {
        const result = await run(files, {
          onProgress: report,
          signal: controller.signal,
          limits: deps.limits,
        });
        return result.ok ? markTransfer(result, datasetTransferables(result.dataset)) : result;
      } finally {
        if (current === controller) current = null;
      }
    },
    cancel() {
      current?.abort();
    },
  };
}
