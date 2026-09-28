import { DEFAULT_LIMITS, type HistoryLimits } from './constants';
import { DatasetBuilder, type Dataset } from './dataset';
import {
  displayName,
  fail,
  toHistoryError,
  toLibraryError,
  type HistoryError,
  type LibraryError,
} from './errors';
import { LibraryAccumulator, type LikedByArtist } from './library';
import { parseHistoryJson } from './parse';
import {
  createReadContext,
  isAccountDataFileName,
  isLibraryFileName,
  readLooseFile,
  readZipEntries,
  type EntryKind,
  type HistoryEntry,
  type HistoryInput,
  type ReadContext,
  type WantedKinds,
} from './unzip';

export type ProcessStage = 'unzip' | 'parse' | 'aggregate' | 'done';

export type ProcessProgress = {
  stage: ProcessStage;
  /** Bytes lidos das entradas (compactados, no caso do zip). */
  bytesRead: number;
  /** Soma de `size` das entradas. */
  bytesTotal: number;
  /** Arquivos já lidos (de histórico em `processHistory`; `YourLibrary.json` em `processLibrary`). */
  filesDone: number;
  /** Registros acumulados (músicas do histórico; curtidas em `processLibrary`). */
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
  | {
      ok: true;
      dataset: Dataset;
      report: ProcessReport;
      /**
       * Curtidas por artista, só quando o envio trouxe o `YourLibrary.json` (export "Dados da
       * conta"). Ausente = a pessoa não mandou as curtidas. Não depende do período.
       */
      library?: LikedByArtist;
    }
  | { ok: false; error: HistoryError };

export type LibraryResult =
  { ok: true; library: LikedByArtist } | { ok: false; error: LibraryError };

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
 * Tipo de um JSON solto pelo nome. `null` = não é lido: os demais arquivos conhecidos do export
 * "Dados da conta" (`Userdata.json`, `Payments.json`, `StreamingHistory_music_*.json`…) e o que
 * a execução não pediu. Um JSON solto de nome desconhecido é tratado como histórico, como antes.
 */
function looseKind(name: string, want: WantedKinds, ctx: ReadContext): EntryKind | null {
  if (isLibraryFileName(name)) {
    ctx.sawAccountData = true;
    return want.library ? 'library' : null;
  }
  if (isAccountDataFileName(name)) {
    ctx.sawAccountData = true;
    return null;
  }
  return want.history ? 'history' : null;
}

type Runner = {
  ctx: ReadContext;
  emit: (stage: ProcessStage) => void;
  /** Valida as entradas e entrega cada arquivo dos tipos pedidos, um por vez. */
  read: (onEntry: (entry: HistoryEntry) => void) => Promise<void>;
};

function createRunner(
  inputs: readonly HistoryInput[],
  options: ProcessOptions,
  want: WantedKinds,
  counters: () => { filesDone: number; records: number },
): Runner {
  const limits: HistoryLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const bytesTotal = inputs.reduce((sum, input) => sum + input.size, 0);
  let lastEmit = 0;
  const emit = (stage: ProcessStage) => {
    lastEmit = ctx.bytesRead;
    options.onProgress?.({ stage, bytesRead: ctx.bytesRead, bytesTotal, ...counters() });
  };
  const ctx: ReadContext = createReadContext(limits, options.signal, () => {
    if (ctx.bytesRead - lastEmit >= PROGRESS_STEP_BYTES) emit('unzip');
  });

  const read = async (onEntry: (entry: HistoryEntry) => void) => {
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
        for await (const entry of readZipEntries(input, ctx, want)) onEntry(entry);
      } else {
        const kind = looseKind(input.name, want, ctx);
        if (kind !== null) onEntry(await readLooseFile(input, ctx, kind));
      }
      emit('unzip');
    }
  };

  return { ctx, emit, read };
}

/**
 * Pipeline completo do upload (RF-03..RF-06): aceita `.zip` do Spotify e/ou JSONs soltos, lê
 * um arquivo por vez, valida, filtra música e constrói o Dataset colunar. Nunca lança: devolve
 * `{ ok: false, error }` tipado. Não faz rede (o conteúdo nunca sai do dispositivo).
 *
 * Combinações aceitas:
 * - só o histórico completo (`Streaming_History_Audio_*.json`, em zip ou soltos);
 * - o histórico e, no mesmo envio, o export "Dados da conta" (zip ou `YourLibrary.json` solto):
 *   o resultado ganha `library` (curtidas por artista). Do export, só o `YourLibrary.json` é
 *   descompactado e lido; nenhum outro arquivo dele é descompactado;
 * - só o export "Dados da conta" → `WRONG_EXPORT` (com `source: 'library'` se ele tiver as
 *   curtidas). O `StreamingHistory_music_*.json` (histórico curto de 1 ano) nunca entra.
 *
 * O `YourLibrary.json` só é interpretado depois de confirmar que há histórico.
 */
export async function processHistory(
  inputs: readonly HistoryInput[],
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  const builder = new DatasetBuilder();
  const report: ProcessReport = { files: 0, records: 0, music: 0, nonMusic: 0, invalid: 0 };
  const { ctx, emit, read } = createRunner(
    inputs,
    options,
    { history: true, library: true },
    () => ({
      filesDone: report.files,
      records: builder.size,
    }),
  );
  const libraryEntries: HistoryEntry[] = [];

  try {
    await read((entry) => {
      if (entry.kind === 'library') {
        libraryEntries.push(entry);
        return;
      }
      emit('parse');
      const counts = parseHistoryJson(entry.name, entry.bytes, (record) => builder.add(record));
      report.files++;
      report.records += counts.total;
      report.music += counts.music;
      report.nonMusic += counts.nonMusic;
      report.invalid += counts.invalid;
    });
    if (report.files === 0) {
      if (libraryEntries.length > 0) fail({ code: 'WRONG_EXPORT', source: 'library' });
      fail({ code: ctx.sawAccountData ? 'WRONG_EXPORT' : 'NO_HISTORY_FILES' });
    }

    let library: LikedByArtist | undefined;
    if (libraryEntries.length > 0) {
      emit('parse');
      const accumulator = new LibraryAccumulator();
      for (const entry of libraryEntries.splice(0)) accumulator.addFile(entry.name, entry.bytes);
      library = accumulator.build();
    }
    if (options.signal?.aborted) fail({ code: 'CANCELLED' });

    emit('aggregate');
    const dataset = builder.build();
    emit('done');
    return library ? { ok: true, dataset, report, library } : { ok: true, dataset, report };
  } catch (error) {
    return { ok: false, error: toHistoryError(error) };
  }
}

/**
 * Lê só as curtidas, para um histórico já carregado (a pessoa manda o export "Dados da conta"
 * depois). Aceita o zip do export (ou um zip com os dois exports) e/ou o `YourLibrary.json`
 * solto. **Nenhum** outro arquivo é descompactado ou lido, nem o histórico completo: o
 * resultado só tem `library`, para a UI juntar ao dataset que já está na memória. Sem
 * `YourLibrary.json` → `NO_LIBRARY_FILE`. Nunca lança; não faz rede.
 */
export async function processLibrary(
  inputs: readonly HistoryInput[],
  options: ProcessOptions = {},
): Promise<LibraryResult> {
  const accumulator = new LibraryAccumulator();
  const { emit, read } = createRunner(inputs, options, { history: false, library: true }, () => ({
    filesDone: accumulator.fileCount,
    records: accumulator.size,
  }));

  try {
    await read((entry) => {
      emit('parse');
      accumulator.addFile(entry.name, entry.bytes);
    });
    if (accumulator.fileCount === 0) fail({ code: 'NO_LIBRARY_FILE' });
    if (options.signal?.aborted) fail({ code: 'CANCELLED' });
    emit('aggregate');
    const library = accumulator.build();
    emit('done');
    return { ok: true, library };
  } catch (error) {
    return { ok: false, error: toLibraryError(error) };
  }
}
