import { describe, expect, it } from 'vitest';

import { generateDemo } from '@/domain/demo';
import { availableMonths } from '@/domain/stats';

import {
  clampDates,
  datasetBounds,
  daysBetween,
  defaultPeriod,
  isoDate,
  periodDates,
  samePeriod,
  validateRange,
  yearsOf,
} from './period-utils';

const bounds = { min: '2023-07-01', max: '2026-06-30' };

describe('period-utils', () => {
  it('período inicial = ano mais recente; sem meses → desde sempre', () => {
    expect(
      defaultPeriod([
        { year: 2024, month: 3, plays: 1 },
        { year: 2025, month: 1, plays: 2 },
      ]),
    ).toEqual({
      kind: 'year',
      year: 2025,
    });
    expect(defaultPeriod([])).toEqual({ kind: 'all' });
  });

  it('anos únicos em ordem', () => {
    expect(
      yearsOf([
        { year: 2025, month: 1, plays: 1 },
        { year: 2024, month: 5, plays: 1 },
        { year: 2025, month: 2, plays: 1 },
      ]),
    ).toEqual([2024, 2025]);
  });

  it('datas de cada tipo de período', () => {
    expect(periodDates({ kind: 'year', year: 2024 }, bounds)).toEqual({
      from: '2024-01-01',
      to: '2024-12-31',
    });
    expect(periodDates({ kind: 'month', year: 2024, month: 2 }, bounds)).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    });
    expect(periodDates({ kind: 'all' }, bounds)).toEqual({ from: bounds.min, to: bounds.max });
    expect(periodDates({ kind: 'range', from: '2024-06-01', to: '2024-08-31' }, bounds)).toEqual({
      from: '2024-06-01',
      to: '2024-08-31',
    });
    expect(isoDate(2024, 13, 1)).toBe('2025-01-01');
  });

  it('limita o resumo às bordas do histórico', () => {
    expect(clampDates({ from: '2026-01-01', to: '2026-12-31' }, bounds)).toEqual({
      from: '2026-01-01',
      to: '2026-06-30',
    });
    expect(clampDates({ from: '2020-01-01', to: '2020-12-31' }, bounds)).toEqual({
      from: '2020-01-01',
      to: '2020-12-31',
    });
  });

  it('conta dias inclusivos', () => {
    expect(daysBetween('2024-01-01', '2024-12-31')).toBe(366);
    expect(daysBetween('2024-03-01', '2024-03-01')).toBe(1);
  });

  it('compara períodos', () => {
    expect(samePeriod({ kind: 'year', year: 2024 }, { kind: 'year', year: 2024 })).toBe(true);
    expect(samePeriod({ kind: 'year', year: 2024 }, { kind: 'all' })).toBe(false);
  });

  it('valida o intervalo: obrigatório, dentro do histórico e em ordem', () => {
    expect(validateRange('2024-01-01', '2024-02-01', bounds)).toEqual({});
    expect(validateRange('', '2024-02-01', bounds)).toEqual({ from: 'required' });
    expect(validateRange('2024-03-01', '2024-02-01', bounds)).toEqual({ to: 'order' });
    expect(validateRange('2020-01-01', '2027-01-01', bounds)).toEqual({
      from: 'outOfRange',
      to: 'outOfRange',
    });
    expect(validateRange('2024-01-01', 'lixo', bounds)).toEqual({ to: 'required' });
  });

  it('bordas do Dataset no fuso', () => {
    const demo = generateDemo();
    const b = datasetBounds(demo.dataset, demo.timeZone);
    expect(b.min).toBe('2023-07-01');
    expect(b.max >= '2026-06-29' && b.max <= '2026-07-01').toBe(true);
    expect(availableMonths(demo.dataset, demo.timeZone).length).toBeGreaterThan(30);
  });
});
