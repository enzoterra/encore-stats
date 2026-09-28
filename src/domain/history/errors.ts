/**
 * Erros tipados do processamento do histórico (union discriminada por `code`).
 * A UI traduz cada `code` em mensagem (next-intl); nenhum stack trace é exposto.
 * `file`/`entry` são nomes fornecidos pelo usuário: exibir sempre como texto puro.
 *
 * `source: 'library'` marca o erro como sendo do `YourLibrary.json` (curtidas, export "Dados da
 * conta"), para a UI dar o recado certo sem precisar de um código novo em cada caso:
 * - `WRONG_EXPORT` + `source: 'library'`: veio só o export "Dados da conta" com as curtidas;
 *   falta o histórico completo (Extended streaming history);
 * - `INVALID_JSON`/`UNEXPECTED_FORMAT`/`INVALID_RECORDS` + `source: 'library'`: o
 *   `YourLibrary.json` está quebrado ou num formato desconhecido;
 * - `ENTRY_TOO_LARGE`/`COMPRESSION_RATIO` + `source: 'library'`: o limite é o das curtidas.
 */
type Source = { source?: 'library' };

export type HistoryError =
  | { code: 'UNSUPPORTED_FILE'; file: string }
  | { code: 'INVALID_ZIP'; file: string }
  | { code: 'UNSAFE_PATH'; file: string; entry: string }
  | { code: 'TOO_MANY_ENTRIES'; file: string; limit: number }
  | ({ code: 'ENTRY_TOO_LARGE'; file: string; entry: string; limit: number } & Source)
  | { code: 'TOTAL_TOO_LARGE'; limit: number }
  | ({ code: 'COMPRESSION_RATIO'; file: string; entry: string; limit: number } & Source)
  | { code: 'NO_HISTORY_FILES' }
  | ({ code: 'WRONG_EXPORT' } & Source)
  | ({ code: 'INVALID_JSON'; entry: string } & Source)
  | ({ code: 'UNEXPECTED_FORMAT'; entry: string } & Source)
  | ({ code: 'INVALID_RECORDS'; entry: string; invalid: number; total: number } & Source)
  | { code: 'CANCELLED' }
  | { code: 'INTERNAL' };

export type HistoryErrorCode = HistoryError['code'];

/**
 * Erros de `processLibrary` (curtidas enviadas depois do histórico): os mesmos do histórico e
 * `NO_LIBRARY_FILE`, quando nenhum `YourLibrary.json` veio nos arquivos.
 */
export type LibraryError = HistoryError | { code: 'NO_LIBRARY_FILE' };

export type LibraryErrorCode = LibraryError['code'];

export class HistoryProcessingError extends Error {
  readonly detail: LibraryError;

  constructor(detail: LibraryError) {
    super(detail.code);
    this.name = 'HistoryProcessingError';
    this.detail = detail;
  }
}

export function fail(detail: LibraryError): never {
  throw new HistoryProcessingError(detail);
}

/** Converte qualquer exceção em erro tipado; erros inesperados viram `INTERNAL` (sem detalhes). */
export function toLibraryError(error: unknown): LibraryError {
  if (error instanceof HistoryProcessingError) return error.detail;
  return { code: 'INTERNAL' };
}

/** Como `toLibraryError`, restrito aos códigos de `processHistory`. */
export function toHistoryError(error: unknown): HistoryError {
  const detail = toLibraryError(error);
  return detail.code === 'NO_LIBRARY_FILE' ? { code: 'INTERNAL' } : detail;
}

const MAX_DISPLAY_NAME = 200;

/** Limita nomes vindos do arquivo antes de colocá-los numa mensagem de erro. */
export function displayName(name: string): string {
  return name.length > MAX_DISPLAY_NAME ? `${name.slice(0, MAX_DISPLAY_NAME)}…` : name;
}
