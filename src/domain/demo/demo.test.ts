import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { computeGenres, computeWindowTrends, LikedArtistsCounter } from '../api-stats';
import {
  artistSchema,
  meSchema,
  recentSchema,
  savedPageSchema,
  trackSchema,
  type TimeRange,
} from '../spotify-types';
import { computeStats } from '../stats';
import { DEMO_ARTISTS } from './catalog';
import {
  DEMO_DAYS,
  DEMO_START_DAY,
  DEMO_TIME_ZONE,
  demoArtist,
  demoSavedPage,
  generateDemo,
} from './generate';
import { createRandom, cumulate } from './prng';

function fingerprint(data: ReturnType<typeof generateDemo>): string {
  const hash = createHash('sha256');
  const { cols, dict } = data.dataset;
  for (const col of [cols.ts, cols.ms, cols.track, cols.platform, cols.flags]) {
    hash.update(new Uint8Array(col.buffer));
  }
  hash.update(JSON.stringify(dict));
  hash.update(JSON.stringify(data.api));
  return hash.digest('hex');
}

const RANGES: TimeRange[] = ['short_term', 'medium_term', 'long_term'];

describe('generateDemo', () => {
  const demo = generateDemo();

  it('é determinístico com a seed fixa e muda com outra seed', () => {
    expect(fingerprint(generateDemo())).toBe(fingerprint(demo));
    expect(fingerprint(generateDemo({ seed: 7 }))).not.toBe(fingerprint(demo));
  });

  it('é rápido e leve (< 1 s, algumas dezenas de milhares de registros)', () => {
    const start = performance.now();
    const fresh = generateDemo();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
    expect(fresh.dataset.cols.ts.length).toBeGreaterThan(20_000);
    expect(fresh.dataset.cols.ts.length).toBeLessThan(60_000);
  });

  it('cobre ~3 anos, ordenado e no fuso demo', () => {
    const { range, cols } = demo.dataset;
    const firstDay = Math.floor(range.from / 86_400);
    const lastDay = Math.floor(range.to / 86_400);
    expect(firstDay).toBeGreaterThanOrEqual(DEMO_START_DAY);
    expect(lastDay - firstDay).toBeGreaterThan(DEMO_DAYS - 10);
    for (let i = 1; i < cols.ts.length; i++) expect(cols.ts[i]! >= cols.ts[i - 1]!).toBe(true);
    expect(demo.timeZone).toBe(DEMO_TIME_ZONE);
  });

  it('usa só artistas fictícios do catálogo', () => {
    const catalog = new Set(DEMO_ARTISTS.map((a) => a.name));
    for (const name of demo.dataset.dict.artists) expect(catalog.has(name)).toBe(true);
  });

  it('alimenta todas as seções do dashboard de upload', () => {
    const stats = computeStats(demo.dataset, { kind: 'all' }, DEMO_TIME_ZONE);
    expect(stats.totals.plays).toBeGreaterThan(20_000);
    expect(stats.top.artists).toHaveLength(10);
    expect(stats.top.tracks).toHaveLength(10);
    expect(stats.top.albums).toHaveLength(10);
    expect(stats.heatmap.maxPlays).toBeGreaterThan(0);
    expect(stats.platforms.length).toBeGreaterThanOrEqual(5);
    expect(stats.self.topArtist?.distinctDays).toBeGreaterThan(100);
    expect(stats.self.mostSkipped?.skips).toBeGreaterThan(0);
    expect(stats.self.mostMusicalDay?.plays).toBeGreaterThan(0);
    const year = computeStats(demo.dataset, { kind: 'year', year: 2025 }, DEMO_TIME_ZONE);
    expect(year.totals.days).toBeGreaterThan(300);
  });

  it('respostas fictícias da API passam nos schemas do BFF', () => {
    const { api } = demo;
    expect(api.demo).toBe(true);
    meSchema.parse(api.me);
    for (const range of RANGES) {
      expect(api.top.artists[range].length).toBeGreaterThan(0);
      api.top.artists[range].forEach((a) => artistSchema.parse(a));
      api.top.tracks[range].forEach((t) => trackSchema.parse(t));
    }
    expect(api.recent).toHaveLength(50);
    api.recent.forEach((r) => recentSchema.parse(r));
    expect(api.recent[0]!.playedAt >= api.recent[49]!.playedAt).toBe(true);
    api.artists.forEach((a) => artistSchema.parse(a));
    expect(api.saved.length).toBeGreaterThan(100);
  });

  it('as janelas geram tendências e gêneros', () => {
    const trends = computeWindowTrends(demo.api.top.artists);
    expect(trends.baseline).toBe('medium_term');
    expect(trends.entered.length).toBeGreaterThan(0);
    expect(trends.rising.length + trends.falling.length).toBeGreaterThan(0);
    expect(computeGenres(demo.api.top.artists.long_term).visible).toBe(true);
  });

  it('curtidas paginadas como /me/tracks e contagem por artista', () => {
    const { api } = demo;
    const counter = new LikedArtistsCounter();
    const first = demoSavedPage(api, 0);
    savedPageSchema.parse(first);
    expect(first.items).toHaveLength(50);
    expect(first.total).toBe(api.saved.length);
    for (let offset = 0; offset < first.total; offset += 50) {
      counter.addPage(demoSavedPage(api, offset));
    }
    expect(counter.done).toBe(true);
    expect(counter.processed).toBe(api.saved.length);
    const [top] = counter.top(1);
    expect(demoArtist(api, top!.id)?.name).toBe(top!.name);
    expect(demoArtist(api, 'x'.repeat(22))).toBeUndefined();
    expect(demoSavedPage(api, 10, 5).items).toEqual(api.saved.slice(10, 15));
  });

  it('aceita duração customizada', () => {
    const small = generateDemo({ days: 30 });
    expect(small.dataset.cols.ts.length).toBeGreaterThan(0);
    expect(small.dataset.cols.ts.length).toBeLessThan(demo.dataset.cols.ts.length);
  });
});

describe('prng', () => {
  it('sequência estável e utilitários', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
    const r = createRandom(1);
    for (let i = 0; i < 200; i++) {
      const v = r.range(3, 5);
      expect(v >= 3 && v <= 5).toBe(true);
    }
    expect(r.id()).toMatch(/^[A-Za-z0-9]{22}$/);
    expect(r.permutation(10).sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(r.pick(['só'])).toBe('só');
    expect(typeof r.chance(0.5)).toBe('boolean');
    const counts = [0, 0];
    const cumulative = cumulate([1, 3]);
    for (let i = 0; i < 4000; i++) counts[r.weighted(cumulative)]!++;
    expect(counts[1]! / counts[0]!).toBeGreaterThan(2);
    expect(counts[1]! / counts[0]!).toBeLessThan(4);
  });
});
