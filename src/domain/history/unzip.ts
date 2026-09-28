import { Unzip, UnzipInflate, type UnzipFile } from 'fflate';

import {
  ACCOUNT_DATA_FILE_PATTERN,
  HISTORY_FILE_PATTERN,
  LIBRARY_FILE_PATTERN,
  UNZIP_PUSH_BYTES,
  type HistoryLimits,
} from './constants';
import { displayName, fail, type HistoryError } from './errors';

/** O que o motor precisa de um arquivo: compatível com `File`/`Blob` do navegador e do Node. */
export type HistoryInput = {
  readonly name: string;
  readonly size: number;
  stream(): ReadableStream<Uint8Array>;
};

/**
 * Tipos de arquivo que o motor lê: `history` (`Streaming_History_Audio_*.json`, histórico
 * completo) e `library` (`YourLibrary.json`, curtidas do export "Dados da conta").
 */
export type EntryKind = 'history' | 'library';

/** Um arquivo já descompactado, entregue um por vez. */
export type HistoryEntry = { kind: EntryKind; name: string; bytes: Uint8Array };

/** Estado compartilhado entre todos os arquivos de uma mesma execução. */
export type ReadContext = {
  readonly limits: HistoryLimits;
  readonly signal?: { readonly aborted: boolean };
  /** Bytes (compactados) lidos das entradas, para o progresso. */
  bytesRead: number;
  /** Soma descompactada de tudo o que foi lido (histórico + curtidas), para o limite total. */
  totalBytes: number;
  /** Soma descompactada dos `YourLibrary.json` (limite `maxLibraryBytes`). */
  libraryBytes: number;
  /** Viu um arquivo do export "Dados da conta" (para o erro `WRONG_EXPORT`). */
  sawAccountData: boolean;
  onChunk?: () => void;
};

export function createReadContext(
  limits: HistoryLimits,
  signal?: { readonly aborted: boolean },
  onChunk?: () => void,
): ReadContext {
  return {
    limits,
    signal,
    bytesRead: 0,
    totalBytes: 0,
    libraryBytes: 0,
    sawAccountData: false,
    onChunk,
  };
}

/**
 * Rejeita nomes absolutos, com letra de unidade, com NUL ou com segmento `..` (path traversal,
 * "zip slip"). Barras invertidas contam como separador. O Encore nunca grava arquivos, mas um
 * zip com nomes assim não é um export legítimo do Spotify e é rejeitado por inteiro.
 */
export function isSafeEntryName(name: string): boolean {
  if (name.length === 0 || name.includes('\u0000')) return false;
  const normalized = name.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) return false;
  return !normalized.split('/').some((segment) => segment === '..');
}

export function baseName(name: string): string {
  const normalized = name.replace(/\\/g, '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

export function isHistoryFileName(name: string): boolean {
  return HISTORY_FILE_PATTERN.test(baseName(name));
}

export function isLibraryFileName(name: string): boolean {
  return LIBRARY_FILE_PATTERN.test(baseName(name));
}

/** Arquivo conhecido do export "Dados da conta" que **não** é lido (tudo menos o `YourLibrary`). */
export function isAccountDataFileName(name: string): boolean {
  return ACCOUNT_DATA_FILE_PATTERN.test(baseName(name));
}

/** Classifica pelo nome; `null` = o arquivo nunca é descompactado nem lido. */
export function entryKind(name: string): EntryKind | null {
  if (isHistoryFileName(name)) return 'history';
  if (isLibraryFileName(name)) return 'library';
  return null;
}

/** Quais tipos a execução quer ler; o resto não é descompactado. */
export type WantedKinds = Readonly<Record<EntryKind, boolean>>;

export const READ_ALL: WantedKinds = Object.freeze({ history: true, library: true });

function checkCancelled(ctx: ReadContext): void {
  if (ctx.signal?.aborted) fail({ code: 'CANCELLED' });
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  if (chunks.length === 1 && chunks[0]!.length === total) return chunks[0]!;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

const ZIP_SIGNATURES = [0x04034b50, 0x06054b50, 0x08074b50];

function hasZipSignature(header: Uint8Array): boolean {
  if (header.length < 4) return false;
  const sig = (header[0]! | (header[1]! << 8) | (header[2]! << 16) | (header[3]! << 24)) >>> 0;
  return ZIP_SIGNATURES.includes(sig);
}

/** Limite de tamanho descompactado de cada tipo de arquivo. */
function entryLimit(kind: EntryKind, limits: HistoryLimits): number {
  return kind === 'history' ? limits.maxEntryBytes : limits.maxLibraryBytes;
}

function tooLarge(kind: EntryKind, file: string, entry: string, limit: number): HistoryError {
  return kind === 'library'
    ? { code: 'ENTRY_TOO_LARGE', file, entry, limit, source: 'library' }
    : { code: 'ENTRY_TOO_LARGE', file, entry, limit };
}

function badRatio(kind: EntryKind, file: string, entry: string, limit: number): HistoryError {
  return kind === 'library'
    ? { code: 'COMPRESSION_RATIO', file, entry, limit, source: 'library' }
    : { code: 'COMPRESSION_RATIO', file, entry, limit };
}

/**
 * Soma `length` bytes descompactados de um arquivo do tipo `kind` e devolve o erro de limite,
 * se houver: por arquivo, total e, nas curtidas, a soma de todos os `YourLibrary.json`.
 */
function countBytes(
  ctx: ReadContext,
  kind: EntryKind,
  entryBytes: number,
  length: number,
  file: string,
  entry: string,
): HistoryError | null {
  const { limits } = ctx;
  ctx.totalBytes += length;
  if (kind === 'library') ctx.libraryBytes += length;
  const limit = entryLimit(kind, limits);
  if (entryBytes > limit || (kind === 'library' && ctx.libraryBytes > limit)) {
    return tooLarge(kind, file, entry, limit);
  }
  if (ctx.totalBytes > limits.maxTotalBytes) {
    return { code: 'TOTAL_TOO_LARGE', limit: limits.maxTotalBytes };
  }
  return null;
}

/**
 * Descompacta um .zip em streaming (fflate `Unzip`) e entrega, um por vez, só os arquivos dos
 * tipos pedidos em `want`: `Streaming_History_Audio_*.json` e/ou `YourLibrary.json`, em
 * qualquer subpasta. **As demais entradas nunca são descompactadas** (sem `start()`, o fflate
 * descarta os bytes sem inflar): `Userdata.json`, `Identity.json`, `Payments.json`,
 * `StreamingHistory_*` etc. do export "Dados da conta" passam pelo leitor só como nome.
 * Os limites são verificados **durante** o streaming:
 * - entradas > `maxEntries` e nomes inseguros: no cabeçalho de cada entrada;
 * - tamanho e razão declarados no cabeçalho: antes de descompactar;
 * - tamanho real por arquivo, total e razão real (por entrada e acumulada do arquivo): a cada
 *   pedaço descompactado. Cabeçalhos mentirosos ou com data descriptor não escapam.
 */
export async function* readZipEntries(
  input: HistoryInput,
  ctx: ReadContext,
  want: WantedKinds = READ_ALL,
): AsyncGenerator<HistoryEntry> {
  const { limits } = ctx;
  const file = displayName(input.name);
  const ready: HistoryEntry[] = [];
  let failure: HistoryError | null = null;
  let entries = 0;
  let pending = 0;
  let consumed = 0;
  let inflated = 0;

  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (entry: UnzipFile) => {
    if (failure) return;
    entries++;
    if (entries > limits.maxEntries) {
      failure = { code: 'TOO_MANY_ENTRIES', file, limit: limits.maxEntries };
      return;
    }
    const name = entry.name;
    if (!isSafeEntryName(name)) {
      failure = { code: 'UNSAFE_PATH', file, entry: displayName(name) };
      return;
    }
    const kind = entryKind(name);
    if (kind === 'library' || (kind === null && isAccountDataFileName(name))) {
      ctx.sawAccountData = true;
    }
    if (kind === null || !want[kind]) return; // não chamar start(): o fflate descarta sem inflar

    const shown = displayName(name);
    const limit = entryLimit(kind, limits);
    const declaredSize = entry.size;
    const declaredOriginal = entry.originalSize;
    if (declaredOriginal !== undefined && declaredOriginal > limit) {
      failure = tooLarge(kind, file, shown, limit);
      return;
    }
    if (
      declaredSize !== undefined &&
      declaredOriginal !== undefined &&
      declaredOriginal >= limits.ratioCheckMinBytes &&
      declaredOriginal > declaredSize * limits.maxCompressionRatio
    ) {
      failure = badRatio(kind, file, shown, limits.maxCompressionRatio);
      return;
    }

    const chunks: Uint8Array[] = [];
    let bytes = 0;
    pending++;
    entry.ondata = (error, data, final) => {
      if (failure) return;
      if (error) {
        failure = { code: 'INVALID_ZIP', file };
        return;
      }
      bytes += data.length;
      inflated += data.length;
      failure = countBytes(ctx, kind, bytes, data.length, file, shown);
      if (
        !failure &&
        bytes >= limits.ratioCheckMinBytes &&
        ((declaredSize !== undefined && bytes > declaredSize * limits.maxCompressionRatio) ||
          inflated > consumed * limits.maxCompressionRatio)
      ) {
        failure = badRatio(kind, file, shown, limits.maxCompressionRatio);
      }
      if (failure) {
        chunks.length = 0;
        return;
      }
      chunks.push(data);
      if (final) {
        pending--;
        ready.push({ kind, name, bytes: concat(chunks, bytes) });
        chunks.length = 0;
      }
    };
    entry.start();
  };

  const push = (part: Uint8Array, final: boolean) => {
    try {
      unzip.push(part, final);
    } catch {
      failure ??= { code: 'INVALID_ZIP', file };
    }
    if (failure) fail(failure);
  };

  const reader = input.stream().getReader();
  let header: Uint8Array | null = new Uint8Array(0);
  try {
    for (;;) {
      checkCancelled(ctx);
      const { done, value } = await reader.read();
      if (done) break;
      if (header !== null) {
        header = concat([header, value], header.length + value.length);
        if (header.length < 4) continue;
        if (!hasZipSignature(header)) fail({ code: 'INVALID_ZIP', file });
        const first = header;
        header = null;
        yield* pushChunk(first);
      } else {
        yield* pushChunk(value);
      }
      ctx.onChunk?.();
    }
    if (header !== null) fail({ code: 'INVALID_ZIP', file });
    push(new Uint8Array(0), true);
    while (ready.length > 0) yield ready.shift()!;
    // Entrada iniciada e não terminada = zip truncado.
    if (pending > 0) fail({ code: 'INVALID_ZIP', file });
  } finally {
    reader.cancel().catch(() => undefined);
  }

  function* pushChunk(chunk: Uint8Array): Generator<HistoryEntry> {
    for (let offset = 0; offset < chunk.length; offset += UNZIP_PUSH_BYTES) {
      const part = chunk.subarray(offset, offset + UNZIP_PUSH_BYTES);
      consumed += part.length;
      ctx.bytesRead += part.length;
      push(part, false);
      while (ready.length > 0) yield ready.shift()!;
    }
  }
}

/**
 * Lê um JSON solto (sem zip) do tipo `kind`, com os mesmos limites de tamanho e o
 * cancelamento. Quem chama decide o tipo pelo nome e nunca chama isto para os demais arquivos
 * do export "Dados da conta".
 */
export async function readLooseFile(
  input: HistoryInput,
  ctx: ReadContext,
  kind: EntryKind = 'history',
): Promise<HistoryEntry> {
  const file = displayName(input.name);
  const limit = entryLimit(kind, ctx.limits);
  if (input.size > limit) fail(tooLarge(kind, file, file, limit));
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const reader = input.stream().getReader();
  try {
    for (;;) {
      checkCancelled(ctx);
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      ctx.bytesRead += value.length;
      const failure = countBytes(ctx, kind, bytes, value.length, file, file);
      if (failure) fail(failure);
      chunks.push(value);
      ctx.onChunk?.();
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
  return { kind, name: input.name, bytes: concat(chunks, bytes) };
}
