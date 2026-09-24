import { describe, expect, it } from 'vitest';

import { computeGenres } from '@/domain/api-stats';
import { generateDemo } from '@/domain/demo';
import type { Artist, Track } from '@/domain/spotify-types';
import { computeStats } from '@/domain/stats';

import { connectShareInput, uploadShareInput, type CardsTranslator } from './share-input';

/** Tradutor falso: devolve a chave com os valores, para conferir o que foi pedido. */
const t: CardsTranslator = (key, values) =>
  values
    ? `${key}(${Object.entries(values)
        .map(([k, v]) => `${k}=${v}`)
        .join(',')})`
    : key;
const format = {
  number: (n: number) => new Intl.NumberFormat('pt-BR').format(n),
  minutes: (ms: number) => new Intl.NumberFormat('pt-BR').format(Math.round(ms / 60_000)),
  instantMonthYear: (s: number) =>
    new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(s * 1000),
    ),
};

describe('recorte do card no Upload/Demo', () => {
  const demo = generateDemo();

  it('usa o período selecionado: tops, minutos e o artista nº 1', () => {
    const stats = computeStats(demo.dataset, { kind: 'year', year: 2024 }, demo.timeZone, {
      limit: 50,
    });
    const input = uploadShareInput({
      stats,
      period: { kind: 'year', year: 2024 },
      periodLabel: '2024',
      mode: 'demo',
      format,
      t,
    })!;
    expect(input.mode).toBe('demo');
    expect(input.periodLabel).toBe('2024');
    expect(input.topArtists[0]).toBe(stats.top.artists[0]!.name);
    expect(input.topArtists.length).toBeLessThanOrEqual(25);
    expect(input.topTracks).toHaveLength(5);
    expect(input.stat).toEqual({
      value: format.minutes(stats.totals.ms),
      label: 'stat.minutesIn(label=2024)',
    });
    expect(input.heroSub).toMatch(/^heroSub\.upload\(plays=\d+,since=/);
    expect(input.stats).toEqual([
      `stats.minutes(value=${format.minutes(stats.totals.ms)})`,
      `stats.plays(count=${stats.totals.plays})`,
      `stats.artists(count=${stats.totals.artists})`,
    ]);
    // Upload/Demo nunca levam capa.
    expect(input.coverUrl).toBeUndefined();
  });

  it('rótulo do destaque por tipo de período', () => {
    for (const [period, label] of [
      [{ kind: 'all' }, 'stat.minutesAll'],
      [{ kind: 'range', from: '2024-01-01', to: '2024-03-31' }, 'stat.minutesRange'],
    ] as const) {
      const stats = computeStats(demo.dataset, period, demo.timeZone);
      const input = uploadShareInput({
        stats,
        period,
        periodLabel: 'x',
        mode: 'upload',
        format,
        t,
      })!;
      expect(input.stat?.label).toBe(label);
      expect(input.mode).toBe('upload');
    }
  });

  it('sem plays no período não há card', () => {
    const period = { kind: 'year', year: 1999 } as const;
    const stats = computeStats(demo.dataset, period, demo.timeZone);
    expect(
      uploadShareInput({ stats, period, periodLabel: '1999', mode: 'upload', format, t }),
    ).toBe(null);
  });
});

const artist = (n: number, genres: string[] = []): Artist => ({
  id: `artist${n}`.padEnd(22, 'x'),
  name: `Artista ${n}`,
  genres,
  url: 'https://open.spotify.com/artist/x',
});
const track = (n: number): Track => ({
  id: `track${n}`.padEnd(22, 'x'),
  name: `Música ${n}`,
  artists: [
    { id: 'a'.repeat(22), name: `Artista ${n}` },
    { id: 'b'.repeat(22), name: 'Convidada' },
  ],
  album: { id: 'c'.repeat(22), name: 'Álbum', image: `https://i.scdn.co/image/cover${n}` },
  url: 'https://open.spotify.com/track/x',
});

describe('recorte do card no Conectar', () => {
  const artists = Array.from({ length: 30 }, (_, i) =>
    artist(i + 1, i < 5 ? ['indie', 'rock'] : ['pop']),
  );
  const tracks = Array.from({ length: 10 }, (_, i) => track(i + 1));
  const base = { range: 'medium_term' as const, artists, tracks, format, t };

  it('Conectar real: capa da música nº 1, top 25 e a janela', () => {
    const input = connectShareInput({ ...base, demo: false })!;
    expect(input.mode).toBe('connect');
    expect(input.coverUrl).toBe('https://i.scdn.co/image/cover1');
    expect(input.topArtists).toHaveLength(25);
    expect(input.periodLabel).toBe('window.medium_term');
    expect(input.stats).toEqual(['stats.topArtists(count=25)', 'window.medium_term']);
    expect(input.topTracks[0]).toEqual({ name: 'Música 1', artist: 'Artista 1, Convidada' });
  });

  it('visão Conectar do Demo: modo demo e sem capa', () => {
    const input = connectShareInput({ ...base, demo: true })!;
    expect(input.mode).toBe('demo');
    expect(input.coverUrl).toBeUndefined();
  });

  it('destaque: curtidas do nº 1 > gênero nº 1 (≥ 3 gêneros) > nada', () => {
    const liked = [{ id: artists[0]!.id, name: 'Artista 1', count: 1234 }];
    expect(connectShareInput({ ...base, demo: false, liked })!.stat).toEqual({
      value: '1.234',
      label: 'stat.liked(artist=Artista 1)',
    });
    const manyGenres = artists.map((a, i) => ({ ...a, genres: [`g${i % 4}`] }));
    const genres = computeGenres(manyGenres);
    expect(connectShareInput({ ...base, artists: manyGenres, demo: false, genres })!.stat).toEqual({
      value: 'g0',
      label: 'stat.genre',
    });
    // Curtidas de outro artista não contam para o nº 1.
    const other = [{ id: artists[3]!.id, name: 'Artista 4', count: 9 }];
    const poor = computeGenres(artists.slice(0, 2));
    expect(connectShareInput({ ...base, demo: false, liked: other, genres: poor })!.stat).toBe(
      undefined,
    );
  });

  it('sub-herói: tendência do nº 1, senão os gêneros dele', () => {
    expect(
      connectShareInput({ ...base, demo: false, trend: { kind: 'rising', delta: 3 } })!.heroSub,
    ).toBe('heroSub.rising(delta=3)');
    expect(connectShareInput({ ...base, demo: false, trend: { kind: 'entered' } })!.heroSub).toBe(
      'heroSub.entered',
    );
    expect(connectShareInput({ ...base, demo: false })!.heroSub).toBe(
      'heroSub.genres(genres=indie · rock)',
    );
    expect(
      connectShareInput({ ...base, artists: [artist(1)], demo: false })!.heroSub,
    ).toBeUndefined();
  });

  it('sem artistas não há card', () => {
    expect(connectShareInput({ ...base, artists: [], demo: false })).toBe(null);
  });
});
