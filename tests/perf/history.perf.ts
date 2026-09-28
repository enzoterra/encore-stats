import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LIMITS,
  processHistory,
  processLibrary,
  type HistoryInput,
  type ProcessResult,
} from '@/domain/history';
import { computeStats, type Period } from '@/domain/stats';

import { syntheticRecords } from '../../scripts/make-fixtures';

/**
 * Meta RNF-03: ~50 MB de JSON processados em < 10 s (desktop/Node). Mede também o pico
 * aproximado de memória (RSS e heap amostrados durante o processamento) e a troca de período
 * (< 200 ms).
 */
const FILES = 4;
const RECORDS_PER_FILE = 18_000;
const MiB = 1024 * 1024;

type Sample = { rss: number; heap: number };

function gc(): void {
  (globalThis as { gc?: () => void }).gc?.();
}

function sample(): Sample {
  const { rss, heapUsed } = process.memoryUsage();
  return { rss, heap: heapUsed };
}

async function measure(label: string, inputs: HistoryInput[]) {
  gc();
  const base = sample();
  let peak = base;
  const take = () => {
    const now = sample();
    peak = { rss: Math.max(peak.rss, now.rss), heap: Math.max(peak.heap, now.heap) };
  };
  const timer = setInterval(take, 5);
  const start = performance.now();
  let result: ProcessResult;
  try {
    result = await processHistory(inputs, { onProgress: take });
  } finally {
    clearInterval(timer);
  }
  const elapsed = performance.now() - start;
  take();
  const report = {
    label,
    seconds: +(elapsed / 1000).toFixed(2),
    peakRssMiB: +(peak.rss / MiB).toFixed(0),
    rssDeltaMiB: +((peak.rss - base.rss) / MiB).toFixed(0),
    peakHeapDeltaMiB: +((peak.heap - base.heap) / MiB).toFixed(0),
  };
  console.log(`[bench] ${JSON.stringify(report)}`);
  return { result, elapsed, report };
}

describe('benchmark do upload (~50 MB sintéticos)', () => {
  const jsons = Array.from({ length: FILES }, (_, i) =>
    strToU8(
      JSON.stringify(
        syntheticRecords({
          count: RECORDS_PER_FILE,
          seed: 1000 + i,
          start: Date.UTC(2019 + i, 0, 1),
          tracks: 4000,
        }),
        null,
        2,
      ),
    ),
  );
  const jsonBytes = jsons.reduce((sum, bytes) => sum + bytes.length, 0);
  const zipped = zipSync(
    Object.fromEntries(
      jsons.map((bytes, i) => [
        `Spotify Extended Streaming History/Streaming_History_Audio_${2019 + i}_${i}.json`,
        bytes,
      ]),
    ),
    { level: 6 },
  );
  console.log(
    `[bench] entrada: ${FILES} arquivos, ${(jsonBytes / MiB).toFixed(1)} MiB de JSON, zip de ${(zipped.length / MiB).toFixed(1)} MiB, ${FILES * RECORDS_PER_FILE} registros`,
  );

  it('zip do Spotify: < 10 s', async () => {
    expect(jsonBytes).toBeGreaterThan(45 * MiB);
    const { result, elapsed } = await measure('zip', [new File([zipped], 'my_spotify_data.zip')]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.dataset.cols.ts.length).toBe(FILES * RECORDS_PER_FILE);
    expect(elapsed).toBeLessThan(10_000);
  });

  it('curtidas: YourLibrary.json com 100 mil músicas em < 2 s (sozinho) e junto do zip', async () => {
    const artists = Array.from({ length: 3000 }, (_, i) => `Artista Fictício ${i}`);
    const library = {
      tracks: Array.from({ length: 100_000 }, (_, i) => ({
        artist: artists[(i * 7919) % artists.length],
        album: `Álbum ${i % 5000}`,
        track: `Faixa ${i}`,
        uri: `spotify:track:${String(i).padStart(22, '0')}`,
      })),
      albums: [],
      artists: [],
      shows: [],
      episodes: [],
      bannedTracks: [],
    };
    const bytes = strToU8(JSON.stringify(library, null, 2));
    expect(bytes.length).toBeLessThan(DEFAULT_LIMITS.maxLibraryBytes);
    const file = () => new File([bytes], 'YourLibrary.json');

    const start = performance.now();
    const alone = await processLibrary([file()]);
    const libraryMs = performance.now() - start;
    expect(alone.ok && alone.library.total).toBe(100_000);
    console.log(
      `[bench] ${JSON.stringify({ label: 'library', mib: +(bytes.length / MiB).toFixed(1), seconds: +(libraryMs / 1000).toFixed(2) })}`,
    );
    expect(libraryMs).toBeLessThan(2_000);

    const { result, elapsed } = await measure('zip+library', [
      new File([zipped], 'my_spotify_data.zip'),
      file(),
    ]);
    expect(result.ok && result.library?.total).toBe(100_000);
    expect(elapsed).toBeLessThan(10_000);
  });

  it('JSONs soltos: < 10 s', async () => {
    const inputs = jsons.map(
      (bytes, i) => new File([bytes], `Streaming_History_Audio_${2019 + i}_${i}.json`),
    );
    const { result, elapsed } = await measure('json', inputs);
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(10_000);

    if (!result.ok) return;
    const periods: Period[] = [
      { kind: 'all' },
      { kind: 'year', year: 2021 },
      { kind: 'month', year: 2022, month: 6 },
      { kind: 'range', from: '2020-03-01', to: '2021-02-28' },
    ];
    // A primeira chamada inclui o índice local (memorizado por fuso).
    const first = performance.now();
    computeStats(result.dataset, periods[0]!, 'America/Sao_Paulo');
    const firstMs = performance.now() - first;
    const times = periods.map((period) => {
      const start = performance.now();
      computeStats(result.dataset, period, 'America/Sao_Paulo');
      return +(performance.now() - start).toFixed(1);
    });
    console.log(
      `[bench] computeStats: 1ª chamada ${firstMs.toFixed(1)} ms; troca de período (ms) ${JSON.stringify(times)}`,
    );
    expect(Math.max(...times)).toBeLessThan(200);
  });
});
