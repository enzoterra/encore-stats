import { describe, expect, it } from 'vitest';

import {
  DatasetBuilder,
  datasetTransferables,
  emptyDataset,
  FLAG_SHUFFLE,
  FLAG_SKIPPED,
  FLAG_VALID,
} from './dataset';
import { PLATFORMS } from './platform';
import type { MusicRecord } from './schema';

const rec = (patch: Partial<MusicRecord>): MusicRecord => ({
  ts: 1_700_000_000,
  ms: 200_000,
  track: 'Faixa',
  artist: 'Artista',
  album: 'Álbum',
  uri: 'spotify:track:a',
  platform: 'android',
  skipped: false,
  shuffle: false,
  ...patch,
});

describe('DatasetBuilder', () => {
  it('deduplica artistas, álbuns (por artista) e faixas (por URI)', () => {
    const builder = new DatasetBuilder();
    builder.add(rec({ uri: 'u1', track: 'T1', artist: 'A', album: 'Greatest Hits' }));
    builder.add(rec({ uri: 'u2', track: 'T2', artist: 'B', album: 'Greatest Hits' }));
    builder.add(rec({ uri: 'u1', track: 'T1 (renomeada)', artist: 'A', album: 'Greatest Hits' }));
    builder.add(rec({ uri: 'u3', track: 'T3', artist: 'A', album: 'Greatest Hits' }));
    const ds = builder.build();
    expect(ds.dict.artists).toEqual(['A', 'B']);
    expect(ds.dict.albums).toEqual([
      { name: 'Greatest Hits', artist: 0 },
      { name: 'Greatest Hits', artist: 1 },
    ]);
    expect(ds.dict.tracks).toEqual([
      { name: 'T1', artist: 0, album: 0, uri: 'u1' },
      { name: 'T2', artist: 1, album: 1, uri: 'u2' },
      { name: 'T3', artist: 0, album: 0, uri: 'u3' },
    ]);
    expect(Array.from(ds.cols.track)).toEqual([0, 1, 0, 2]);
    expect(ds.dict.platforms).toBe(PLATFORMS);
  });

  it('codifica flags e plataforma', () => {
    const builder = new DatasetBuilder();
    builder.add(rec({ ms: 29_999, skipped: true, platform: 'tv' }));
    builder.add(rec({ ms: 30_000, shuffle: true, platform: 'web', ts: 1_700_000_100 }));
    const ds = builder.build();
    expect(Array.from(ds.cols.flags)).toEqual([FLAG_SKIPPED, FLAG_SHUFFLE | FLAG_VALID]);
    expect(Array.from(ds.cols.platform)).toEqual([4, 3]);
    expect(Array.from(ds.cols.ms)).toEqual([29_999, 30_000]);
  });

  it('ordena por ts de forma estável e mantém colunas alinhadas', () => {
    const builder = new DatasetBuilder();
    builder.add(rec({ ts: 300, uri: 'c', ms: 3 }));
    builder.add(rec({ ts: 100, uri: 'a', ms: 1 }));
    builder.add(rec({ ts: 300, uri: 'd', ms: 4 }));
    builder.add(rec({ ts: 200, uri: 'b', ms: 2 }));
    const ds = builder.build();
    expect(Array.from(ds.cols.ts)).toEqual([100, 200, 300, 300]);
    expect(Array.from(ds.cols.ms)).toEqual([1, 2, 3, 4]);
    expect(ds.cols.track.map((t) => ds.dict.tracks[t]!.uri.charCodeAt(0))).toEqual(
      Uint32Array.from('abcd', (c) => c.charCodeAt(0)),
    );
    expect(ds.range).toEqual({ from: 100, to: 300 });
  });

  it('cresce além da capacidade inicial e devolve arrays do tamanho exato', () => {
    const builder = new DatasetBuilder();
    const n = 40_000;
    for (let i = 0; i < n; i++) builder.add(rec({ ts: i, uri: `u${i % 7}` }));
    expect(builder.size).toBe(n);
    const ds = builder.build();
    expect(ds.cols.ts.length).toBe(n);
    expect(ds.cols.ts.buffer.byteLength).toBe(n * 4);
    expect(ds.cols.flags.buffer.byteLength).toBe(n);
    expect(ds.dict.tracks).toHaveLength(7);
  });

  it('dataset vazio', () => {
    const ds = emptyDataset();
    expect(ds.cols.ts.length).toBe(0);
    expect(ds.range).toEqual({ from: 0, to: 0 });
  });

  it('transferables são os buffers das 5 colunas', () => {
    const builder = new DatasetBuilder();
    builder.add(rec({}));
    const ds = builder.build();
    const buffers = datasetTransferables(ds);
    expect(buffers).toHaveLength(5);
    expect(new Set(buffers).size).toBe(5);
    expect(buffers[0]).toBe(ds.cols.ts.buffer);
  });
});
