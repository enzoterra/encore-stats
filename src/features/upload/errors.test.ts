import { describe, expect, it } from 'vitest';

import en from '@/i18n/messages/en.json';
import ptBR from '@/i18n/messages/pt-BR.json';

import {
  ERROR_ACTIONS,
  errorMessageKey,
  errorValues,
  firstUnsupported,
  LIBRARY_ERROR_CODES,
} from './errors';
import { progressPercent } from './use-history-upload';

describe('erros do upload', () => {
  it('todo código exibido tem mensagem e ao menos uma ação', () => {
    for (const [code, actions] of Object.entries(ERROR_ACTIONS)) {
      expect(ptBR.Upload.errors).toHaveProperty(code);
      expect(actions.length).toBeGreaterThan(0);
    }
  });

  it('todo código tem título e texto nas duas línguas, incluindo os das curtidas', () => {
    for (const messages of [ptBR, en]) {
      for (const code of Object.keys(ERROR_ACTIONS)) {
        const entry = (messages.Upload.errors as Record<string, { title: string; body: string }>)[
          code
        ];
        expect(entry?.title, code).toBeTruthy();
        expect(entry?.body, code).toBeTruthy();
      }
      for (const code of LIBRARY_ERROR_CODES) {
        expect(messages.Upload.libraryErrors[code].title, code).toBeTruthy();
        expect(messages.Upload.libraryErrors[code].body, code).toBeTruthy();
      }
      expect(messages.Upload.libraryErrors.optionalHint).toBeTruthy();
      expect(messages.Upload.actions.howToLibrary).toBeTruthy();
    }
    // Linguagem do dia a dia: sem jargão técnico nos recados das curtidas.
    const text = JSON.stringify([ptBR.Upload.libraryErrors, ptBR.Upload.errors.NO_LIBRARY_FILE]);
    expect(text).not.toMatch(/JSON inválido|schema|worker|parse|export/i);
  });

  it('NO_LIBRARY_FILE leva às instruções do "Dados da conta"', () => {
    expect(ERROR_ACTIONS.NO_LIBRARY_FILE).toEqual(['howToLibrary', 'tryAnother']);
    expect(ERROR_ACTIONS.WRONG_EXPORT[0]).toBe('howTo');
  });

  it('source "library" escolhe o recado das curtidas; sem source, o geral', () => {
    expect(errorMessageKey({ code: 'WRONG_EXPORT', source: 'library' })).toBe(
      'libraryErrors.WRONG_EXPORT',
    );
    expect(errorMessageKey({ code: 'WRONG_EXPORT' })).toBe('errors.WRONG_EXPORT');
    expect(errorMessageKey({ code: 'INVALID_JSON', entry: 'x', source: 'library' })).toBe(
      'libraryErrors.INVALID_JSON',
    );
    expect(
      errorMessageKey({
        code: 'COMPRESSION_RATIO',
        file: 'a',
        entry: 'b',
        limit: 100,
        source: 'library',
      }),
    ).toBe('libraryErrors.COMPRESSION_RATIO');
    expect(errorMessageKey({ code: 'NO_LIBRARY_FILE' })).toBe('errors.NO_LIBRARY_FILE');
    expect(errorMessageKey({ code: 'INVALID_ZIP', file: 'z' })).toBe('errors.INVALID_ZIP');
  });

  it('limite das curtidas em MB (32)', () => {
    expect(
      errorValues({
        code: 'ENTRY_TOO_LARGE',
        file: 'a.zip',
        entry: 'YourLibrary.json',
        limit: 32 * 1024 * 1024,
        source: 'library',
      }),
    ).toEqual({ entry: 'YourLibrary.json', limit: 32 });
  });

  it('converte limites de bytes em MB e repassa nomes como texto', () => {
    expect(errorValues({ code: 'TOTAL_TOO_LARGE', limit: 1024 * 1024 * 1024 })).toEqual({
      limit: 1024,
    });
    expect(
      errorValues({
        code: 'ENTRY_TOO_LARGE',
        file: 'a.zip',
        entry: 'x.json',
        limit: 100 * 1024 * 1024,
      }),
    ).toEqual({
      entry: 'x.json',
      limit: 100,
    });
    expect(
      errorValues({ code: 'INVALID_RECORDS', entry: 'e.json', invalid: 7, total: 100 }),
    ).toEqual({
      entry: 'e.json',
      invalid: 7,
      total: 100,
    });
    expect(errorValues({ code: 'COMPRESSION_RATIO', file: 'a', entry: 'b', limit: 100 })).toEqual({
      entry: 'b',
      limit: 100,
    });
    expect(errorValues({ code: 'UNSAFE_PATH', file: 'a', entry: '../x' })).toEqual({
      file: 'a',
      entry: '../x',
    });
    expect(errorValues({ code: 'TOO_MANY_ENTRIES', file: '', limit: 200 })).toEqual({ limit: 200 });
    expect(errorValues({ code: 'INVALID_JSON', entry: 'j' })).toEqual({ entry: 'j' });
    expect(errorValues({ code: 'INVALID_ZIP', file: 'z' })).toEqual({ file: 'z' });
    expect(errorValues({ code: 'NO_HISTORY_FILES' })).toEqual({});
  });

  it('checagem de extensão antes do worker', () => {
    expect(firstUnsupported([{ name: 'my_spotify_data.zip' }, { name: 'a.JSON' }])).toBeUndefined();
    expect(firstUnsupported([{ name: 'a.zip' }, { name: 'foto.png' }])).toBe('foto.png');
  });

  it('percentual geral por etapa', () => {
    const p = { bytesRead: 50, bytesTotal: 100, filesDone: 0, records: 0 };
    expect(progressPercent(null)).toBe(0);
    expect(progressPercent({ ...p, stage: 'unzip' })).toBe(45);
    expect(progressPercent({ ...p, stage: 'unzip', bytesTotal: 0 })).toBe(0);
    expect(progressPercent({ ...p, stage: 'aggregate' })).toBe(95);
    expect(progressPercent({ ...p, stage: 'done' })).toBe(100);
  });
});
