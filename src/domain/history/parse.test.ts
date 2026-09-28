import { describe, expect, it } from 'vitest';

import { HistoryProcessingError, type LibraryError } from './errors';
import { parseHistoryJson } from './parse';
import type { MusicRecord } from './schema';

const encode = (value: unknown) =>
  new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));

const record = (i: number, patch: Record<string, unknown> = {}) => ({
  ts: new Date(Date.UTC(2024, 0, 1) + i * 60_000).toISOString(),
  ms_played: 60_000,
  master_metadata_track_name: `Faixa ${i}`,
  master_metadata_album_artist_name: 'Artista',
  master_metadata_album_album_name: 'Álbum',
  spotify_track_uri: `spotify:track:${String(i).padStart(22, '0')}`,
  ip_addr: '192.0.2.1',
  ...patch,
});

function errorOf(fn: () => unknown): LibraryError {
  try {
    fn();
  } catch (error) {
    if (error instanceof HistoryProcessingError) return error.detail;
    throw error;
  }
  throw new Error('não lançou');
}

describe('parseHistoryJson', () => {
  it('entrega só música e conta o resto', () => {
    const out: MusicRecord[] = [];
    const counts = parseHistoryJson(
      'a.json',
      encode([record(1), record(2, { spotify_track_uri: null }), record(3)]),
      (r) => out.push(r),
    );
    expect(counts).toEqual({ total: 3, invalid: 0, music: 2, nonMusic: 1 });
    expect(out.map((r) => r.track)).toEqual(['Faixa 1', 'Faixa 3']);
  });

  it('aceita array vazio e BOM UTF-8', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...encode('[]')]);
    expect(parseHistoryJson('a.json', bytes, () => undefined)).toEqual({
      total: 0,
      invalid: 0,
      music: 0,
      nonMusic: 0,
    });
  });

  it('JSON malformado → INVALID_JSON', () => {
    expect(errorOf(() => parseHistoryJson('a.json', encode('[{"ts":'), () => undefined))).toEqual({
      code: 'INVALID_JSON',
      entry: 'a.json',
    });
  });

  it('raiz que não é array → UNEXPECTED_FORMAT', () => {
    expect(errorOf(() => parseHistoryJson('a.json', encode({ a: 1 }), () => undefined)).code).toBe(
      'UNEXPECTED_FORMAT',
    );
  });

  it('nenhum item válido → UNEXPECTED_FORMAT', () => {
    expect(
      errorOf(() => parseHistoryJson('a.json', encode([{ song: 'x' }, 1, null]), () => undefined))
        .code,
    ).toBe('UNEXPECTED_FORMAT');
  });

  it('formato "Dados da conta" → WRONG_EXPORT', () => {
    const data = [{ endTime: '2024-01-01 10:00', artistName: 'A', trackName: 'T', msPlayed: 1 }];
    expect(errorOf(() => parseHistoryJson('a.json', encode(data), () => undefined))).toEqual({
      code: 'WRONG_EXPORT',
    });
  });

  it('tolera até 5% de inválidos', () => {
    const data = Array.from({ length: 100 }, (_, i) => (i < 5 ? { bad: i } : record(i)));
    expect(parseHistoryJson('a.json', encode(data), () => undefined)).toMatchObject({
      invalid: 5,
      music: 95,
    });
  });

  it('acima de 5% de inválidos → INVALID_RECORDS com contagem', () => {
    const data = Array.from({ length: 100 }, (_, i) => (i < 6 ? { bad: i } : record(i)));
    expect(errorOf(() => parseHistoryJson('b.json', encode(data), () => undefined))).toEqual({
      code: 'INVALID_RECORDS',
      entry: 'b.json',
      invalid: 6,
      total: 100,
    });
  });

  it('limita o nome exibido no erro', () => {
    const detail = errorOf(() => parseHistoryJson('n'.repeat(500), encode('x'), () => undefined));
    expect(detail.code === 'INVALID_JSON' && detail.entry.length).toBe(201);
  });
});
