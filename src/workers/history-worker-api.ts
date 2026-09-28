import { transfer } from 'comlink';

import {
  datasetTransferables,
  processHistory,
  processLibrary,
  type HistoryInput,
  type HistoryLimits,
  type LibraryResult,
  type ProcessOptions,
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
 * // curtidas enviadas depois: const liked = await api.processLibrary(files, Comlink.proxy(setProgress));
 * // cancelar: api.cancel()  (ou worker.terminate() como corte imediato)
 * ```
 *
 * O resultado nunca é uma exceção: `{ ok: false, error: { code } }` atravessa o Comlink sem
 * perder o tipo. As colunas do Dataset são transferidas (sem cópia).
 */
export type HistoryWorkerApi = {
  /**
   * Histórico completo, opcionalmente com o export "Dados da conta" no mesmo envio (o resultado
   * ganha `library`, as curtidas por artista).
   */
  processHistory(
    files: readonly HistoryInput[],
    onProgress?: (progress: ProcessProgress) => void,
  ): Promise<ProcessResult>;
  /**
   * Só as curtidas (`YourLibrary.json`, em zip ou solto), para um histórico já carregado.
   * Erro próprio: `NO_LIBRARY_FILE`.
   */
  processLibrary(
    files: readonly HistoryInput[],
    onProgress?: (progress: ProcessProgress) => void,
  ): Promise<LibraryResult>;
  /** Cancela o processamento em andamento (resolve com `CANCELLED`). */
  cancel(): void;
};

type Deps = {
  process?: typeof processHistory;
  processLibrary?: typeof processLibrary;
  transfer?: typeof transfer;
  limits?: Partial<HistoryLimits>;
};

export function createHistoryWorkerApi(deps: Deps = {}): HistoryWorkerApi {
  const run = deps.process ?? processHistory;
  const runLibrary = deps.processLibrary ?? processLibrary;
  const markTransfer = deps.transfer ?? transfer;
  let current: AbortController | null = null;

  /** Um job por vez: um novo envio (de qualquer tipo) cancela o anterior. */
  async function job<T>(
    onProgress: ((progress: ProcessProgress) => void) | undefined,
    work: (options: ProcessOptions) => Promise<T>,
  ): Promise<T> {
    current?.abort();
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
      return await work({ onProgress: report, signal: controller.signal, limits: deps.limits });
    } finally {
      if (current === controller) current = null;
    }
  }

  return {
    processHistory(files, onProgress) {
      return job(onProgress, async (options) => {
        const result = await run(files, options);
        return result.ok ? markTransfer(result, datasetTransferables(result.dataset)) : result;
      });
    },
    processLibrary(files, onProgress) {
      return job(onProgress, (options) => runLibrary(files, options));
    },
    cancel() {
      current?.abort();
    },
  };
}
