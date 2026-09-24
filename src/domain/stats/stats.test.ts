import { describe, expect, it } from 'vitest';

import { DatasetBuilder, emptyDataset } from '../history/dataset';
import type { PlatformCode } from '../history/platform';
import type { MusicRecord } from '../history/schema';
import { computeStats } from './compute';
import { availableMonths, lowerBound, periodIndexRange, periodSchema, type Period } from './period';

const utc = (y: number, m: number, d: number, h = 0, min = 0) =>
  Date.UTC(y, m - 1, d, h, min) / 1000;

type Row = [ts: number, uri: string, ms: number, extra?: Partial<MusicRecord>];

const CATALOG: Record<string, { track: string; artist: string; album: string }> = {
  a1: { track: 'Alfa Um', artist: 'Artista A', album: 'Disco A' },
  a2: { track: 'Alfa Dois', artist: 'Artista A', album: 'Disco A' },
  b1: { track: 'Beta Um', artist: 'Artista B', album: 'Disco B' },
  c1: { track: 'Gama Um', artist: 'Artista C', album: 'Disco C' },
};

function build(rows: Row[]) {
  const builder = new DatasetBuilder();
  for (const [ts, uri, ms, extra] of rows) {
    builder.add({
      ts,
      ms,
      uri,
      ...CATALOG[uri]!,
      platform: 'android' as PlatformCode,
      skipped: false,
      shuffle: false,
      ...extra,
    });
  }
  return builder.build();
}

const ALL: Period = { kind: 'all' };

/**
 * Cenário (UTC), segunda 2024-01-01 e terça 2024-01-02 (+ 1 play em dez/2023):
 * - a1: 3 plays (200 s) + 1 pulo (5 s) em janeiro;
 * - a2: 1 play (100 s);
 * - b1: 3 plays (300 s): empata com a1 em plays e vence por tempo;
 * - c1: 2 pulos curtos (10 s), sem play.
 * Artista A: 4 plays / 705 s; Artista B: 3 plays / 900 s.
 */
const rows: Row[] = [
  [utc(2023, 12, 20, 9), 'a1', 200_000], // antes do período de janeiro: "fã desde"
  [utc(2024, 1, 1, 8), 'a1', 200_000, { platform: 'desktop' }],
  [utc(2024, 1, 1, 8, 5), 'a1', 200_000, { platform: 'desktop' }],
  [utc(2024, 1, 1, 8, 10), 'a1', 5_000, { skipped: true }],
  [utc(2024, 1, 1, 21), 'b1', 300_000],
  [utc(2024, 1, 2, 21), 'b1', 300_000, { platform: 'web' }],
  [utc(2024, 1, 2, 21, 10), 'b1', 300_000],
  [utc(2024, 1, 2, 22), 'a1', 200_000],
  [utc(2024, 1, 2, 22, 5), 'a2', 100_000],
  [utc(2024, 1, 2, 23), 'c1', 10_000, { skipped: true }],
  [utc(2024, 1, 2, 23, 1), 'c1', 10_000, { skipped: true }],
];

describe('computeStats', () => {
  const ds = build(rows);
  const jan: Period = { kind: 'month', year: 2024, month: 1 };

  it('totais do período (plays ≥ 30 s; minutos incluem pulos)', () => {
    const { totals } = computeStats(ds, jan, 'UTC');
    expect(totals).toEqual({
      ms: 200_000 * 3 + 5_000 + 300_000 * 3 + 100_000 + 20_000,
      plays: 7,
      streams: 10,
      artists: 2,
      tracks: 3,
      albums: 2,
      days: 2,
    });
  });

  it('tops de artistas, músicas e álbuns', () => {
    const { top } = computeStats(ds, jan, 'UTC');
    expect(top.artists).toEqual([
      { artist: 0, name: 'Artista A', plays: 4, ms: 705_000 },
      { artist: 1, name: 'Artista B', plays: 3, ms: 900_000 },
    ]);
    expect(top.tracks.map((t) => [t.name, t.plays, t.ms])).toEqual([
      ['Beta Um', 3, 900_000],
      ['Alfa Um', 3, 605_000],
      ['Alfa Dois', 1, 100_000],
    ]);
    expect(top.tracks[0]).toMatchObject({ artist: 'Artista B', album: 'Disco B', uri: 'b1' });
    expect(top.albums.map((a) => [a.name, a.artist, a.plays])).toEqual([
      ['Disco A', 'Artista A', 4],
      ['Disco B', 'Artista B', 3],
    ]);
  });

  it('desempate por nome quando plays e ms empatam; respeita o limite', () => {
    const tie = build([
      [utc(2024, 1, 1), 'b1', 60_000],
      [utc(2024, 1, 1, 1), 'a1', 60_000],
    ]);
    const { top } = computeStats(tie, ALL, 'UTC', { limit: 1 });
    expect(top.artists).toEqual([{ artist: 1, name: 'Artista A', plays: 1, ms: 60_000 }]);
    expect(top.tracks).toHaveLength(1);
  });

  it('heatmap 7×24 no fuso local', () => {
    const utcMap = computeStats(ds, jan, 'UTC').heatmap;
    expect(utcMap.plays).toHaveLength(168);
    expect(utcMap.plays[0 * 24 + 8]).toBe(2); // segunda 08h: 2 plays + 1 pulo
    expect(utcMap.ms[0 * 24 + 8]).toBe(405_000);
    expect(utcMap.plays[1 * 24 + 21]).toBe(2);
    expect(utcMap.maxPlays).toBe(2);
    expect(utcMap.maxMs).toBe(600_000);

    const sp = computeStats(ds, jan, 'America/Sao_Paulo').heatmap;
    expect(sp.plays[0 * 24 + 5]).toBe(2); // 08h UTC = 05h em SP
    expect(sp.plays[0 * 24 + 18]).toBe(1); // segunda 21h UTC = 18h
  });

  it('plataformas por tempo ouvido', () => {
    const { platforms } = computeStats(ds, jan, 'UTC');
    expect(platforms.map((p) => p.platform)).toEqual(['android', 'desktop', 'web']);
    expect(platforms[1]).toMatchObject({ plays: 2, ms: 400_000 });
    expect(platforms.reduce((sum, p) => sum + p.share, 0)).toBeCloseTo(1);
  });

  it('métricas "você por você"', () => {
    const { self } = computeStats(ds, jan, 'UTC');
    expect(self.topArtist).toEqual({
      artist: 0,
      name: 'Artista A',
      fanSince: utc(2023, 12, 20, 9),
      fanSinceDate: '2023-12-20',
      shareOfPlays: 4 / 7,
      distinctDays: 2,
    });
    expect(self.mostSkipped).toEqual({
      track: 3,
      name: 'Gama Um',
      artist: 'Artista C',
      skips: 2,
      streams: 2,
      skipRate: 1,
    });
    expect(self.mostMusicalDay).toEqual({ date: '2024-01-02', ms: 920_000, plays: 4 });
  });

  it('mais pulada: empate em pulos → maior taxa', () => {
    const tie = build([
      [utc(2024, 1, 1), 'a1', 1_000, { skipped: true }],
      [utc(2024, 1, 1, 1), 'a1', 200_000],
      [utc(2024, 1, 1, 2), 'b1', 1_000, { skipped: true }],
    ]);
    expect(computeStats(tie, ALL, 'UTC').self.mostSkipped).toMatchObject({
      name: 'Beta Um',
      skipRate: 1,
    });
  });

  it('dia mais musical: empate → o mais antigo', () => {
    const tie = build([
      [utc(2024, 1, 2), 'a1', 60_000],
      [utc(2024, 1, 1), 'b1', 60_000],
    ]);
    expect(computeStats(tie, ALL, 'UTC').self.mostMusicalDay?.date).toBe('2024-01-01');
  });

  it('fronteiras do período seguem o fuso local', () => {
    // 2024-02-01T02:00Z ainda é 31/01 em São Paulo.
    const edge = build([[utc(2024, 2, 1, 2), 'a1', 60_000]]);
    const feb: Period = { kind: 'month', year: 2024, month: 2 };
    expect(computeStats(edge, feb, 'UTC').totals.plays).toBe(1);
    expect(computeStats(edge, feb, 'America/Sao_Paulo').totals.plays).toBe(0);
    expect(
      computeStats(edge, { kind: 'month', year: 2024, month: 1 }, 'America/Sao_Paulo').totals.plays,
    ).toBe(1);
  });

  it('ano, intervalo e desde sempre', () => {
    expect(computeStats(ds, { kind: 'year', year: 2023 }, 'UTC').totals.plays).toBe(1);
    expect(computeStats(ds, ALL, 'UTC').totals.plays).toBe(8);
    const day2 = computeStats(ds, { kind: 'range', from: '2024-01-02', to: '2024-01-02' }, 'UTC');
    expect(day2.totals.streams).toBe(6);
    expect(day2.range).toEqual({ from: utc(2024, 1, 2), to: utc(2024, 1, 3) });
  });

  it('período vazio devolve zeros e métricas nulas', () => {
    const stats = computeStats(ds, { kind: 'year', year: 2030 }, 'UTC');
    expect(stats.totals).toEqual({
      ms: 0,
      plays: 0,
      streams: 0,
      artists: 0,
      tracks: 0,
      albums: 0,
      days: 0,
    });
    expect(stats.top.artists).toEqual([]);
    expect(stats.platforms).toEqual([]);
    expect(stats.heatmap.maxPlays).toBe(0);
    expect(stats.self).toEqual({ topArtist: null, mostSkipped: null, mostMusicalDay: null });
  });

  it('dataset vazio', () => {
    expect(computeStats(emptyDataset(), ALL, 'UTC').totals.streams).toBe(0);
  });
});

describe('período', () => {
  it('valida o seletor com Zod', () => {
    expect(periodSchema.safeParse({ kind: 'month', year: 2024, month: 13 }).success).toBe(false);
    expect(periodSchema.safeParse({ kind: 'year', year: 1999 }).success).toBe(false);
    expect(
      periodSchema.safeParse({ kind: 'range', from: '2024-02-30', to: '2024-03-01' }).success,
    ).toBe(false);
    expect(
      periodSchema.safeParse({ kind: 'range', from: '2024-03-02', to: '2024-03-01' }).success,
    ).toBe(false);
    expect(
      periodSchema.safeParse({ kind: 'range', from: '2024-1-1', to: '2024-03-01' }).success,
    ).toBe(false);
    expect(periodSchema.parse({ kind: 'range', from: '2024-02-29', to: '2024-03-01' })).toEqual({
      kind: 'range',
      from: '2024-02-29',
      to: '2024-03-01',
    });
  });

  it('lowerBound', () => {
    const ts = Uint32Array.from([10, 20, 20, 30]);
    expect([0, 10, 15, 20, 25, 30, 31].map((v) => lowerBound(ts, v))).toEqual([
      0, 0, 1, 1, 3, 3, 4,
    ]);
    expect(lowerBound(new Uint32Array(0), 5)).toBe(0);
  });

  it('periodIndexRange usa busca binária sobre ts', () => {
    const ds = build(rows);
    expect(periodIndexRange(ds, { kind: 'year', year: 2024 }, 'UTC')).toMatchObject({
      start: 1,
      end: rows.length,
    });
  });

  it('availableMonths lista meses locais com plays', () => {
    const ds = build([
      ...rows,
      [utc(2024, 3, 1, 1), 'a1', 1_000], // só pulo: não conta
      [utc(2024, 3, 1, 2), 'a1', 60_000], // 01/03 02:00Z = 29/02 em SP
    ]);
    expect(availableMonths(ds, 'UTC')).toEqual([
      { year: 2023, month: 12, plays: 1 },
      { year: 2024, month: 1, plays: 7 },
      { year: 2024, month: 3, plays: 1 },
    ]);
    expect(availableMonths(ds, 'America/Sao_Paulo').at(-1)).toEqual({
      year: 2024,
      month: 2,
      plays: 1,
    });
  });
});
