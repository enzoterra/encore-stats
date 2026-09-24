import { Unzip, UnzipInflate, type UnzipFile } from 'fflate';

import {
  ACCOUNT_DATA_FILE_PATTERN,
  HISTORY_FILE_PATTERN,
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

/** Um arquivo de histórico já descompactado, entregue um por vez. */
export type HistoryEntry = { name: string; bytes: Uint8Array };

/** Estado compartilhado entre todos os arquivos de uma mesma execução. */
export type ReadContext = {
  readonly limits: HistoryLimits;
  readonly signal?: { readonly aborted: boolean };
  /** Bytes (compactados) lidos das entradas, para o progresso. */
  bytesRead: number;
  /** Soma descompactada dos arquivos de histórico (limite total). */
  historyBytes: number;
  /** Viu um arquivo do export "Dados da conta" (para o erro `WRONG_EXPORT`). */
  sawAccountData: boolean;
  onChunk?: () => void;
};

export function createReadContext(
  limits: HistoryLimits,
  signal?: { readonly aborted: boolean },
  onChunk?: () => void,
): ReadContext {
  return { limits, signal, bytesRead: 0, historyBytes: 0, sawAccountData: false, onChunk };
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

export function isAccountDataFileName(name: string): boolean {
  return ACCOUNT_DATA_FILE_PATTERN.test(baseName(name));
}

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

/**
 * Descompacta um .zip em streaming (fflate `Unzip`) e entrega, um por vez, só os
 * `Streaming_History_Audio_*.json` (em qualquer subpasta). As demais entradas nunca são
 * descompactadas. Os limites são verificados **durante** o streaming:
 * - entradas > `maxEntries` e nomes inseguros: no cabeçalho de cada entrada;
 * - tamanho e razão declarados no cabeçalho: antes de descompactar;
 * - tamanho real por arquivo, total e razão real (por entrada e acumulada do arquivo): a cada
 *   pedaço descompactado. Cabeçalhos mentirosos ou com data descriptor não escapam.
 */
export async function* readZipEntries(
  input: HistoryInput,
  ctx: ReadContext,
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
    if (isAccountDataFileName(name)) ctx.sawAccountData = true;
    if (!isHistoryFileName(name)) return; // não chamar start(): o fflate descarta sem inflar

    const shown = displayName(name);
    const declaredSize = entry.size;
    const declaredOriginal = entry.originalSize;
    if (declaredOriginal !== undefined && declaredOriginal > limits.maxEntryBytes) {
      failure = { code: 'ENTRY_TOO_LARGE', file, entry: shown, limit: limits.maxEntryBytes };
      return;
    }
    if (
      declaredSize !== undefined &&
      declaredOriginal !== undefined &&
      declaredOriginal >= limits.ratioCheckMinBytes &&
      declaredOriginal > declaredSize * limits.maxCompressionRatio
    ) {
      failure = {
        code: 'COMPRESSION_RATIO',
        file,
        entry: shown,
        limit: limits.maxCompressionRatio,
      };
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
      ctx.historyBytes += data.length;
      if (bytes > limits.maxEntryBytes) {
        failure = { code: 'ENTRY_TOO_LARGE', file, entry: shown, limit: limits.maxEntryBytes };
      } else if (ctx.historyBytes > limits.maxTotalBytes) {
        failure = { code: 'TOTAL_TOO_LARGE', limit: limits.maxTotalBytes };
      } else if (
        bytes >= limits.ratioCheckMinBytes &&
        ((declaredSize !== undefined && bytes > declaredSize * limits.maxCompressionRatio) ||
          inflated > consumed * limits.maxCompressionRatio)
      ) {
        failure = {
          code: 'COMPRESSION_RATIO',
          file,
          entry: shown,
          limit: limits.maxCompressionRatio,
        };
      }
      if (failure) {
        chunks.length = 0;
        return;
      }
      chunks.push(data);
      if (final) {
        pending--;
        ready.push({ name, bytes: concat(chunks, bytes) });
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

/** Lê um JSON solto (sem zip) respeitando os mesmos limites de tamanho e o cancelamento. */
export async function readLooseFile(input: HistoryInput, ctx: ReadContext): Promise<HistoryEntry> {
  const { limits } = ctx;
  const file = displayName(input.name);
  if (input.size > limits.maxEntryBytes) {
    fail({ code: 'ENTRY_TOO_LARGE', file, entry: file, limit: limits.maxEntryBytes });
  }
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
      ctx.historyBytes += value.length;
      if (bytes > limits.maxEntryBytes) {
        fail({ code: 'ENTRY_TOO_LARGE', file, entry: file, limit: limits.maxEntryBytes });
      }
      if (ctx.historyBytes > limits.maxTotalBytes) {
        fail({ code: 'TOTAL_TOO_LARGE', limit: limits.maxTotalBytes });
      }
      chunks.push(value);
      ctx.onChunk?.();
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
  return { name: input.name, bytes: concat(chunks, bytes) };
}
