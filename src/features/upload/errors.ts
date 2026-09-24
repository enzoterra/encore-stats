import type { HistoryError, HistoryErrorCode } from '@/domain/history';

export type ShownErrorCode = Exclude<HistoryErrorCode, 'CANCELLED'>;
export type UploadAction = 'tryAnother' | 'tryAgain' | 'howTo' | 'report';

/**
 * Ações de cada erro do worker (10-design.md §8.10). O `Record` obriga a cobrir todo código:
 * um código novo no domínio quebra o typecheck até ganhar mensagem e ações.
 */
export const ERROR_ACTIONS: Readonly<Record<ShownErrorCode, readonly UploadAction[]>> = {
  UNSUPPORTED_FILE: ['tryAnother', 'howTo'],
  INVALID_ZIP: ['tryAnother'],
  UNSAFE_PATH: ['tryAnother'],
  TOO_MANY_ENTRIES: ['tryAnother'],
  ENTRY_TOO_LARGE: ['tryAnother'],
  TOTAL_TOO_LARGE: ['tryAnother'],
  COMPRESSION_RATIO: ['tryAnother'],
  NO_HISTORY_FILES: ['howTo', 'tryAnother'],
  WRONG_EXPORT: ['howTo', 'tryAnother'],
  INVALID_JSON: ['tryAnother'],
  UNEXPECTED_FORMAT: ['tryAnother', 'report'],
  INVALID_RECORDS: ['tryAnother', 'report'],
  INTERNAL: ['tryAgain'],
};

const MB = 1024 * 1024;

/** Valores interpolados na mensagem. Nomes vindos do arquivo são exibidos só como texto. */
export function errorValues(error: HistoryError): Record<string, string | number> {
  switch (error.code) {
    case 'UNSUPPORTED_FILE':
    case 'INVALID_ZIP':
      return { file: error.file };
    case 'UNSAFE_PATH':
      return { file: error.file, entry: error.entry };
    case 'TOO_MANY_ENTRIES':
      return { limit: error.limit };
    case 'ENTRY_TOO_LARGE':
      return { entry: error.entry, limit: Math.round(error.limit / MB) };
    case 'TOTAL_TOO_LARGE':
      return { limit: Math.round(error.limit / MB) };
    case 'COMPRESSION_RATIO':
      return { entry: error.entry, limit: error.limit };
    case 'INVALID_JSON':
    case 'UNEXPECTED_FORMAT':
      return { entry: error.entry };
    case 'INVALID_RECORDS':
      return { entry: error.entry, invalid: error.invalid, total: error.total };
    default:
      return {};
  }
}

/** Checagem de UX antes do worker: só `.zip`/`.json` (o worker revalida tudo). */
export function firstUnsupported(files: readonly { name: string }[]): string | undefined {
  return files.find((file) => !/\.(zip|json)$/i.test(file.name))?.name;
}
