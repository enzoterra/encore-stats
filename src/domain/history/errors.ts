/**
 * Erros tipados do processamento do histórico (union discriminada por `code`).
 * A UI traduz cada `code` em mensagem (next-intl); nenhum stack trace é exposto.
 * `file`/`entry` são nomes fornecidos pelo usuário: exibir sempre como texto puro.
 */
export type HistoryError =
  | { code: 'UNSUPPORTED_FILE'; file: string }
  | { code: 'INVALID_ZIP'; file: string }
  | { code: 'UNSAFE_PATH'; file: string; entry: string }
  | { code: 'TOO_MANY_ENTRIES'; file: string; limit: number }
  | { code: 'ENTRY_TOO_LARGE'; file: string; entry: string; limit: number }
  | { code: 'TOTAL_TOO_LARGE'; limit: number }
  | { code: 'COMPRESSION_RATIO'; file: string; entry: string; limit: number }
  | { code: 'NO_HISTORY_FILES' }
  | { code: 'WRONG_EXPORT' }
  | { code: 'INVALID_JSON'; entry: string }
  | { code: 'UNEXPECTED_FORMAT'; entry: string }
  | { code: 'INVALID_RECORDS'; entry: string; invalid: number; total: number }
  | { code: 'CANCELLED' }
  | { code: 'INTERNAL' };

export type HistoryErrorCode = HistoryError['code'];

export class HistoryProcessingError extends Error {
  readonly detail: HistoryError;

  constructor(detail: HistoryError) {
    super(detail.code);
    this.name = 'HistoryProcessingError';
    this.detail = detail;
  }
}

export function fail(detail: HistoryError): never {
  throw new HistoryProcessingError(detail);
}

/** Converte qualquer exceção em erro tipado; erros inesperados viram `INTERNAL` (sem detalhes). */
export function toHistoryError(error: unknown): HistoryError {
  if (error instanceof HistoryProcessingError) return error.detail;
  return { code: 'INTERNAL' };
}

const MAX_DISPLAY_NAME = 200;

/** Limita nomes vindos do arquivo antes de colocá-los numa mensagem de erro. */
export function displayName(name: string): string {
  return name.length > MAX_DISPLAY_NAME ? `${name.slice(0, MAX_DISPLAY_NAME)}…` : name;
}
