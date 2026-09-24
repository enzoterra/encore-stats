import { describe, expect, it } from 'vitest';

import { blockTotals, heatScale, peakCell, quietestBlock, weekOrder } from './heat-scale';

describe('heatScale (10-design.md §2.4)', () => {
  it('zero vai para heat-0 e os não nulos ocupam os 6 degraus por quantis', () => {
    const values = [0, ...Array.from({ length: 60 }, (_, i) => i + 1)];
    const scale = heatScale(values);
    expect(scale.bin(0)).toBe(0);
    expect(scale.bin(1)).toBe(1);
    expect(scale.bin(60)).toBe(6);
    const used = new Set(values.map(scale.bin));
    expect(used.size).toBe(7);
    expect(scale.legend[0]).toEqual({ min: 0, max: 0 });
    expect(scale.legend[6]?.max).toBe(60);
    // Limites contíguos e crescentes.
    for (let b = 2; b <= 6; b++) {
      expect(scale.legend[b]!.min).toBeGreaterThan(scale.legend[b - 1]!.max);
    }
  });

  it('degraus sem valores ficam sem faixa na legenda', () => {
    const scale = heatScale([5, 5, 5, 5]);
    expect(scale.legend.filter(Boolean).length).toBeLessThan(7);
    expect(scale.bin(5)).toBeGreaterThan(0);
  });

  it('pico e bloco mais quieto', () => {
    const values = new Array<number>(168).fill(1);
    values[4 * 24 + 18] = 50; // sexta, 18h
    for (let h = 3; h < 6; h++) for (let d = 0; d < 7; d++) values[d * 24 + h] = 0;
    expect(peakCell(values)).toBe(4 * 24 + 18);
    expect(quietestBlock(values)).toBe(1);
    expect(peakCell(new Array<number>(168).fill(0))).toBeNull();
    expect(blockTotals(values)[4]![6]).toBe(52);
  });

  it('início da semana pelo locale (domingo como padrão)', () => {
    const order = weekOrder('pt-BR');
    expect(order).toHaveLength(7);
    expect(new Set(order).size).toBe(7);
    expect([6, 0]).toContain(order[0]);
    expect(weekOrder('xx-invalid-@@')[0]).toBe(6);
  });
});
