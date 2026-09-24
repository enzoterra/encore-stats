import { describe, expect, it } from 'vitest';

import type { SavedPage } from '../spotify-types';
import { computeGenres } from './genres';
import { LikedArtistsCounter, missingArtistIds, savedPageOffsets } from './liked';
import { compareRankings, computeWindowTrends } from './trends';

const items = (...ids: string[]) => ids.map((id) => ({ id }));

describe('compareRankings', () => {
  it('classifica entrou, subiu, caiu e saiu', () => {
    const baseline = items('a', 'b', 'c', 'd', 'e', 'f', 'g');
    const current = items('f', 'x', 'a', 'b', 'g', 'c');
    const trends = compareRankings(current, baseline, { minDelta: 3 });
    expect(trends.entered).toEqual([
      { item: { id: 'x' }, kind: 'entered', rank: 2, previousRank: null, delta: null },
    ]);
    expect(trends.rising.map((t) => [t.item.id, t.previousRank, t.rank, t.delta])).toEqual([
      ['f', 6, 1, 5],
    ]);
    expect(trends.falling.map((t) => [t.item.id, t.delta])).toEqual([['c', -3]]);
    expect(trends.left.map((t) => [t.item.id, t.previousRank])).toEqual([
      ['d', 4],
      ['e', 5],
    ]);
  });

  it('ordena por variação e desempata pela posição atual', () => {
    const baseline = items('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h');
    const current = items('g', 'h', 'a', 'b', 'c', 'd', 'e', 'f');
    const { rising, falling } = compareRankings(current, baseline, { minDelta: 2 });
    expect(rising.map((t) => t.item.id)).toEqual(['g', 'h']);
    expect(falling.map((t) => t.item.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('respeita leftTopN e os padrões', () => {
    const baseline = items(...Array.from({ length: 30 }, (_, i) => `id${i}`));
    const trends = compareRankings(items('id0'), baseline);
    expect(trends.left).toHaveLength(19); // top 20 da referência, menos o id0
    expect(compareRankings([], baseline, { leftTopN: 5 }).left).toHaveLength(5);
  });
});

describe('computeWindowTrends', () => {
  it('compara short com medium e cai para long quando medium está vazio', () => {
    const short = items('a', 'b');
    expect(
      computeWindowTrends({ short_term: short, medium_term: items('b'), long_term: [] }).baseline,
    ).toBe('medium_term');
    const fallback = computeWindowTrends({
      short_term: short,
      medium_term: [],
      long_term: items('a'),
    });
    expect(fallback.baseline).toBe('long_term');
    expect(fallback.entered.map((t) => t.item.id)).toEqual(['b']);
  });
});

describe('computeGenres', () => {
  it('pondera pelo rank (N − i) e normaliza', () => {
    const summary = computeGenres([
      { genres: ['MPB', 'indie'] }, // peso 3
      { genres: ['indie ', 'rock'] }, // peso 2
      { genres: ['mpb', 'MPB'] }, // peso 1 (duplicado no mesmo artista conta uma vez)
    ]);
    expect(summary.distinct).toBe(3);
    expect(summary.visible).toBe(true);
    expect(summary.genres).toEqual([
      { genre: 'indie', weight: 5, share: 5 / 11, artists: 2 },
      { genre: 'mpb', weight: 4, share: 4 / 11, artists: 2 },
      { genre: 'rock', weight: 2, share: 2 / 11, artists: 1 },
    ]);
  });

  it('esconde a seção com menos de 3 gêneros e aplica o limite', () => {
    expect(computeGenres([{ genres: ['a', 'b'] }]).visible).toBe(false);
    expect(computeGenres([]).genres).toEqual([]);
    expect(computeGenres([{ genres: ['', '  '] }]).distinct).toBe(0);
    const many = computeGenres([{ genres: ['c', 'a', 'b', 'd'] }], { limit: 2, minGenres: 4 });
    expect(many.genres.map((g) => g.genre)).toEqual(['a', 'b']);
    expect(many.visible).toBe(true);
  });
});

const artist = (id: string, name = id.toUpperCase()) => ({ id: id.padEnd(22, '0'), name });

function page(offset: number, total: number, tracks: [string, string[]][]): SavedPage {
  return {
    offset,
    total,
    items: tracks.map(([trackId, artistIds]) => ({
      addedAt: '2024-01-01T00:00:00Z',
      track: { id: trackId.padEnd(22, '0'), artists: artistIds.map((a) => artist(a)) },
    })),
  };
}

describe('LikedArtistsCounter', () => {
  it('conta por artista creditado, em qualquer ordem de páginas, sem duplicar', () => {
    const counter = new LikedArtistsCounter();
    expect(counter.progress).toBe(1);
    counter.addPage(
      page(50, 53, [
        ['t4', ['b']],
        ['t5', ['a', 'b']],
        ['t6', ['c']],
      ]),
    );
    expect(counter.done).toBe(false);
    expect(counter.progress).toBe(0.5);
    counter.addPage(
      page(0, 53, [
        ['t1', ['a']],
        ['t2', ['a', 'a']],
        ['t3', ['b']],
        ['t5', ['a', 'b']], // sobreposição: já contada
      ]),
    );
    counter.addPage(page(0, 53, [['t9', ['z']]])); // página repetida: ignorada
    expect(counter.done).toBe(true);
    expect(counter.total).toBe(53);
    expect(counter.processed).toBe(6);
    expect(counter.top()).toEqual([
      { id: artist('a').id, name: 'A', count: 3 },
      { id: artist('b').id, name: 'B', count: 3 },
      { id: artist('c').id, name: 'C', count: 1 },
    ]);
    expect(counter.top(1)).toHaveLength(1);
    expect(counter.countFor(artist('b').id)).toBe(3);
    expect(counter.countFor('nenhum')).toBe(0);
  });

  it('desempata por id quando os nomes coincidem', () => {
    const counter = new LikedArtistsCounter();
    counter.addPage({
      offset: 0,
      total: 2,
      items: [
        {
          addedAt: '2024-01-01T00:00:00Z',
          track: { id: 'x'.repeat(22), artists: [artist('b', 'Mesmo')] },
        },
        {
          addedAt: '2024-01-01T00:00:00Z',
          track: { id: 'y'.repeat(22), artists: [artist('a', 'Mesmo')] },
        },
      ],
    });
    expect(counter.top().map((a) => a.id[0])).toEqual(['a', 'b']);
  });
});

describe('savedPageOffsets e missingArtistIds', () => {
  it('gera offsets de 50 em 50 até o total, com teto', () => {
    expect(savedPageOffsets(0)).toEqual([]);
    expect(savedPageOffsets(120)).toEqual([0, 50, 100]);
    expect(savedPageOffsets(1_000_000).at(-1)).toBe(100_000);
  });

  it('lista artistas curtidos que faltam no top', () => {
    const liked = items('a', 'b', 'c', 'd');
    expect(missingArtistIds(liked, items('b'), 3)).toEqual(['a', 'c']);
    expect(missingArtistIds(liked, [])).toEqual(['a', 'b', 'c', 'd']);
  });
});
