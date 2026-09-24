import { describe, expect, it } from 'vitest';

import en from './messages/en.json';
import ptBR from './messages/pt-BR.json';

function keys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null
      ? keys(child as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('mensagens (RF-23)', () => {
  it('PT-BR e EN têm as mesmas chaves', () => {
    expect(keys(en).sort()).toEqual(keys(ptBR).sort());
  });

  it('nenhuma mensagem está vazia', () => {
    for (const messages of [en, ptBR]) {
      const flat = keys(messages);
      for (const key of flat) {
        const value = key.split('.').reduce<unknown>((node, part) => {
          return (node as Record<string, unknown>)[part];
        }, messages);
        expect(typeof value === 'string' && value.trim().length > 0, key).toBe(true);
      }
    }
  });

  it('há mensagem para todo código de erro do upload', () => {
    const codes = [
      'UNSUPPORTED_FILE',
      'INVALID_ZIP',
      'UNSAFE_PATH',
      'TOO_MANY_ENTRIES',
      'ENTRY_TOO_LARGE',
      'TOTAL_TOO_LARGE',
      'COMPRESSION_RATIO',
      'NO_HISTORY_FILES',
      'WRONG_EXPORT',
      'INVALID_JSON',
      'UNEXPECTED_FORMAT',
      'INVALID_RECORDS',
      'INTERNAL',
    ];
    for (const code of codes) {
      expect(Object.keys(ptBR.Upload.errors)).toContain(code);
      expect(Object.keys(en.Upload.errors)).toContain(code);
    }
  });
});
