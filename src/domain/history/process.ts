import { DEFAULT_LIMITS, type HistoryLimits } from './constants';
import { DatasetBuilder, type Dataset } from './dataset';
import { displayName, fail, toHistoryError, type HistoryError } from './errors';
import { parseHistoryJson } from './parse';
import {
  createReadContext,
  isAccountDataFileName,
  readLooseFile,
  readZipEntries,
  type HistoryEntry,
  type HistoryInput,
  type ReadContext,
} from './unzip';

export type ProcessStage = 'unzip' | 'parse' | 'aggregate' | 'done';

export type ProcessProgress = {
  stage: ProcessStage;
  /** Bytes lidos das entradas (compactados, no caso do zip). */
  bytesRead: number;
  /** Soma de `size` das entradas. */
  bytesTotal: number;
  /** Arquivos de histórico já lidos. */
  filesDone: number;
  /** Registros de música acumulados. */
  records: number;
};

export type ProcessReport = {
  /** Arquivos de histórico lidos. */
  files: number;
  /** Itens lidos nos JSONs. */
  records: number;
  /** Registros de música no Dataset. */
  music: number;
  /** Registros válidos descartados por não serem música (podcast, audiolivro, faixa local). */
  nonMusic: number;
  /** Itens inválidos tolerados (≤ 5% por arquivo). */
  invalid: number;
};

export type ProcessResult =
  { ok: true; dataset: Dataset; report: ProcessReport } | { ok: false; error: HistoryError };

export type ProcessOptions = {
  onProgress?: (progress: ProcessProgress) => void;
  /** `AbortSignal` ou qualquer objeto com `aborted`. */
  signal?: { readonly aborted: boolean };
  limits?: Partial<HistoryLimits>;
};

/** Emite progresso de leitura a cada 2 MiB (além das mudanças de etapa e de cada arquivo). */
const PROGRESS_STEP_BYTES = 2 * 1024 * 1024;

type InputKind = 'zip' | 'json';

function inputKind(name: string): InputKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.zip')) return 'zip';
  if (lower.endsWith('.json')) return 'json';
  return null;
}

/**
 * Pipeline completo do upload (RF-03..RF-06): aceita `.zip` do Spotify e/ou
 * `Streaming_History_Audio_*.json` soltos, lê um arquivo de histórico por vez, valida, filtra
 * música e constrói o Dataset colunar. Nunca lança: devolve `{ ok: false, error }` tipado.
 * Não faz rede (o conteúdo nunca sai do dispositivo).
 */
export async function processHistory(
  inputs: readonly HistoryInput[],
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  const limits: HistoryLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const bytesTotal = inputs.reduce((sum, input) => sum + input.size, 0);
  const builder = new DatasetBuilder();
  const report: ProcessReport = { files: 0, records: 0, music: 0, nonMusic: 0, invalid: 0 };
  let lastEmit = 0;

  const emit = (stage: ProcessStage) => {
    lastEmit = ctx.bytesRead;
    options.onProgress?.({
      stage,
      bytesRead: ctx.bytesRead,
      bytesTotal,
      filesDone: report.files,
      records: builder.size,
    });
  };
  const ctx: ReadContext = createReadContext(limits, options.signal, () => {
    if (ctx.bytesRead - lastEmit >= PROGRESS_STEP_BYTES) emit('unzip');
  });

  const handle = (entry: HistoryEntry) => {
    emit('parse');
    const counts = parseHistoryJson(entry.name, entry.bytes, (record) => builder.add(record));
    report.files++;
    report.records += counts.total;
    report.music += counts.music;
    report.nonMusic += counts.nonMusic;
    report.invalid += counts.invalid;
  };

  try {
    if (inputs.length > limits.maxEntries) {
      fail({ code: 'TOO_MANY_ENTRIES', file: '', limit: limits.maxEntries });
    }
    const kinds = inputs.map((input) => {
      const kind = inputKind(input.name);
      if (kind === null) fail({ code: 'UNSUPPORTED_FILE', file: displayName(input.name) });
      return kind;
    });
    emit('unzip');
    for (const [i, input] of inputs.entries()) {
      if (options.signal?.aborted) fail({ code: 'CANCELLED' });
      if (kinds[i] === 'zip') {
        for await (const entry of readZipEntries(input, ctx)) handle(entry);
      } else if (isAccountDataFileName(input.name)) {
        ctx.sawAccountData = true;
      } else {
        handle(await readLooseFile(input, ctx));
      }
      emit('unzip');
    }
    if (report.files === 0)
      fail({ code: ctx.sawAccountData ? 'WRONG_EXPORT' : 'NO_HISTORY_FILES' });
    if (options.signal?.aborted) fail({ code: 'CANCELLED' });

    emit('aggregate');
    const dataset = builder.build();
    emit('done');
    return { ok: true, dataset, report };
  } catch (error) {
    return { ok: false, error: toHistoryError(error) };
  }
}
