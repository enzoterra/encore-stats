import { describe, expect, it } from 'vitest';

import ptBR from '@/i18n/messages/pt-BR.json';

import { ERROR_ACTIONS, errorValues, firstUnsupported } from './errors';
import { progressPercent } from './use-history-upload';

describe('erros do upload', () => {
  it('todo código exibido tem mensagem e ao menos uma ação', () => {
    for (const [code, actions] of Object.entries(ERROR_ACTIONS)) {
      expect(ptBR.Upload.errors).toHaveProperty(code);
      expect(actions.length).toBeGreaterThan(0);
    }
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
