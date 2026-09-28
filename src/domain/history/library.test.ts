import { describe, expect, it } from 'vitest';

import { libraryFixture, SENSITIVE_CANARY } from '../../../scripts/make-fixtures';
import { EXPECTED_FIXTURE_LIBRARY } from '../../../tests/support/library';
import { HistoryProcessingError, type LibraryError } from './errors';
import {
  LibraryAccumulator,
  likedByArtist,
  normalizeArtistName,
  parseLibraryJson,
  topLikedArtists,
} from './library';

const encode = (value: unknown) =>
  new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));

const item = (artist: unknown, i: number, patch: Record<string, unknown> = {}) => ({
  artist,
  album: `Álbum ${i}`,
  track: `Faixa ${i}`,
  uri: `spotify:track:${String(i).padStart(22, '0')}`,
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

describe('normalizeArtistName', () => {
  it.each([
    ['  Maré   de\tFevereiro ', 'Maré de Fevereiro'],
    ['Maré', 'Maré'],
    ['MØ', 'MØ'],
    ['   ', ''],
  ])('%j → %j', (input, expected) => {
    expect(normalizeArtistName(input)).toBe(expected);
  });

  it('não ignora caixa nem acentos (não junta artistas diferentes)', () => {
    expect(normalizeArtistName('Queen')).not.toBe(normalizeArtistName('QUEEN'));
    expect(normalizeArtistName('Ñu')).not.toBe(normalizeArtistName('Nu'));
  });
});

describe('likedByArtist', () => {
  it('conta por artista, ordena por contagem e desempata pelo nome', () => {
    const result = likedByArtist([
      { artist: 'Beta' },
      { artist: 'alfa' },
      { artist: 'Beta' },
      { artist: 'Gama' },
      { artist: 'Alfa' },
      { artist: '  ' },
    ]);
    expect(result).toEqual({
      total: 5,
      artists: [
        { name: 'Beta', count: 2 },
        { name: 'alfa', count: 1 },
        { name: 'Alfa', count: 1 },
        { name: 'Gama', count: 1 },
      ],
    });
  });

  it('ordem estável e independente da ordem de entrada', () => {
    const names = ['Zeta', 'Éter', 'eter', 'Ana', 'Ana', 'Éter'];
    const forward = likedByArtist(names.map((artist) => ({ artist })));
    const backward = likedByArtist([...names].reverse().map((artist) => ({ artist })));
    expect(backward).toEqual(forward);
    expect(forward.artists.map((a) => a.name)).toEqual(['Ana', 'Éter', 'eter', 'Zeta']);
  });

  it('nomes diferentes que o localeCompare considera iguais: desempate por código', () => {
    const soft = 'An­a'; // hífen suave: invisível para o localeCompare
    const forward = likedByArtist([{ artist: soft }, { artist: 'Ana' }]);
    const backward = likedByArtist([{ artist: 'Ana' }, { artist: soft }]);
    expect(forward.artists.map((a) => a.name)).toEqual(['Ana', soft]);
    expect(backward).toEqual(forward);
  });

  it('vazio', () => {
    expect(likedByArtist([])).toEqual({ total: 0, artists: [] });
  });
});

describe('toHistoryError', () => {
  it('NO_LIBRARY_FILE fora do processLibrary vira INTERNAL', async () => {
    const { toHistoryError, toLibraryError } = await import('./errors');
    const error = new HistoryProcessingError({ code: 'NO_LIBRARY_FILE' });
    expect(toHistoryError(error)).toEqual({ code: 'INTERNAL' });
    expect(toLibraryError(error)).toEqual({ code: 'NO_LIBRARY_FILE' });
    expect(toLibraryError(new Error('x'))).toEqual({ code: 'INTERNAL' });
  });
});

describe('topLikedArtists', () => {
  const library = likedByArtist(['A', 'A', 'B', 'C'].map((artist) => ({ artist })));

  it('resume para o quadro', () => {
    expect(topLikedArtists(library, 2)).toEqual({
      total: 4,
      artistCount: 3,
      top: [
        { name: 'A', count: 2 },
        { name: 'B', count: 1 },
      ],
    });
  });

  it('limite padrão 10, limite negativo vira 0 e devolve cópias', () => {
    expect(topLikedArtists(library).top).toHaveLength(3);
    expect(topLikedArtists(library, -1).top).toEqual([]);
    topLikedArtists(library).top[0]!.count = 99;
    expect(library.artists[0]!.count).toBe(2);
  });
});

describe('parseLibraryJson', () => {
  it('entrega só artista e chave; descarta álbuns, podcasts, banidos e o resto', () => {
    const seen: { artist: string; key: string }[] = [];
    const counts = parseLibraryJson('YourLibrary.json', encode(libraryFixture()), (t) =>
      seen.push(t),
    );
    expect(counts).toEqual({ total: 33, invalid: 0, withoutArtist: 1 });
    expect(seen).toHaveLength(32);
    for (const track of seen) expect(Object.keys(track).sort()).toEqual(['artist', 'key']);
    expect(JSON.stringify(seen)).not.toContain(SENSITIVE_CANARY);
  });

  it('chave: uri do Spotify (faixa ou local) ou artista + álbum + faixa', () => {
    const keys: string[] = [];
    parseLibraryJson(
      'YourLibrary.json',
      encode({
        tracks: [
          item('A', 1),
          item('A', 2, { uri: 'spotify:local:A::x:1' }),
          item('A', 3, { uri: null }),
          item('A', 4, { uri: 'https://example.invalid/x' }),
          { artist: 'A' },
          { artist: null, track: 'Sem artista' },
        ],
      }),
      (t) => keys.push(t.key),
    );
    expect(keys).toEqual([
      `spotify:track:${'1'.padStart(22, '0')}`,
      'spotify:local:A::x:1',
      'A\u0000Álbum 3\u0000Faixa 3',
      'A\u0000Álbum 4\u0000Faixa 4',
      'A\u0000\u0000',
    ]);
  });

  it('aceita o formato antigo (sem uri) e campos extras', () => {
    const counts = parseLibraryJson(
      'YourLibrary.json',
      encode({ tracks: [{ artist: 'A', album: 'B', track: 'C', extra: { x: 1 } }] }),
      () => undefined,
    );
    expect(counts).toEqual({ total: 1, invalid: 0, withoutArtist: 0 });
  });

  it('biblioteca sem curtidas (tracks vazio ou ausente) é válida', () => {
    for (const value of [{ tracks: [] }, { albums: [], shows: [] }]) {
      expect(parseLibraryJson('YourLibrary.json', encode(value), () => undefined).total).toBe(0);
    }
  });

  it('tolera ≤ 5% de itens inválidos', () => {
    const tracks = Array.from({ length: 40 }, (_, i) => (i === 0 ? { artist: 7 } : item('A', i)));
    const counts = parseLibraryJson('YourLibrary.json', encode({ tracks }), () => undefined);
    expect(counts).toMatchObject({ total: 40, invalid: 1 });
  });

  it.each([
    ['JSON malformado', '{"tracks": [', 'INVALID_JSON'],
    ['raiz em array', '[]', 'UNEXPECTED_FORMAT'],
    ['raiz nula', 'null', 'UNEXPECTED_FORMAT'],
    ['objeto sem chaves do YourLibrary', '{"username":"x"}', 'UNEXPECTED_FORMAT'],
    ['tracks que não é array', '{"tracks": {"a": 1}}', 'UNEXPECTED_FORMAT'],
    ['nenhum item válido', '{"tracks": [1, 2, {"artist": []}]}', 'UNEXPECTED_FORMAT'],
  ])('%s → %s (source library)', (_label, text, code) => {
    const error = errorOf(() => parseLibraryJson('x/YourLibrary.json', encode(text), () => {}));
    expect(error).toEqual({ code, entry: 'x/YourLibrary.json', source: 'library' });
  });

  it('mais de 5% inválidos → INVALID_RECORDS', () => {
    const tracks = Array.from({ length: 20 }, (_, i) => (i < 2 ? { artist: 1 } : item('A', i)));
    const error = errorOf(() =>
      parseLibraryJson('YourLibrary.json', encode({ tracks }), () => undefined),
    );
    expect(error).toEqual({
      code: 'INVALID_RECORDS',
      entry: 'YourLibrary.json',
      invalid: 2,
      total: 20,
      source: 'library',
    });
  });

  it('nome longo demais é inválido (limite do schema)', () => {
    const tracks = [
      item('x'.repeat(1025), 1),
      ...Array.from({ length: 30 }, (_, i) => item('A', i)),
    ];
    const counts = parseLibraryJson('YourLibrary.json', encode({ tracks }), () => undefined);
    expect(counts.invalid).toBe(1);
  });
});

describe('LibraryAccumulator', () => {
  it('fixture: agrega com dedupe, normalização e desempate', () => {
    const accumulator = new LibraryAccumulator();
    accumulator.addFile('YourLibrary.json', encode(libraryFixture()));
    expect(accumulator.fileCount).toBe(1);
    expect(accumulator.size).toBe(30);
    expect(accumulator.build()).toEqual(EXPECTED_FIXTURE_LIBRARY);
    expect(accumulator.size).toBe(30);
    // `build()` libera os nomes e as chaves: um segundo build() sai vazio.
    expect(accumulator.build()).toEqual({ total: 0, artists: [] });
  });

  it('o mesmo export enviado duas vezes não conta em dobro', () => {
    const accumulator = new LibraryAccumulator();
    accumulator.addFile('a/YourLibrary.json', encode(libraryFixture()));
    accumulator.addFile('YourLibrary.json', encode(libraryFixture()));
    expect(accumulator.fileCount).toBe(2);
    expect(accumulator.build()).toEqual(EXPECTED_FIXTURE_LIBRARY);
  });
});
