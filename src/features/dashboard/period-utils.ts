import type { Dataset } from '@/domain/history';
import type { Period } from '@/domain/stats';

/** Mês disponível no histórico (saída de `availableMonths`). */
export type MonthEntry = { year: number; month: number; plays: number };

/** Datas locais "YYYY-MM-DD" do primeiro e do último registro, no fuso. */
export function datasetBounds(dataset: Dataset, tz: string): { min: string; max: string } {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return {
    min: f.format(new Date(dataset.range.from * 1000)),
    max: f.format(new Date(dataset.range.to * 1000)),
  };
}

export function yearsOf(months: readonly MonthEntry[]): number[] {
  return [...new Set(months.map((m) => m.year))].sort((a, b) => a - b);
}

/** Período inicial: o ano mais recente com música ("Seu 2024"). */
export function defaultPeriod(months: readonly MonthEntry[]): Period {
  const last = months[months.length - 1];
  return last ? { kind: 'year', year: last.year } : { kind: 'all' };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Primeiro e último dia (inclusivos) do período, limitados às bordas do histórico em "sempre". */
export function periodDates(
  period: Period,
  bounds: { min: string; max: string },
): { from: string; to: string } {
  switch (period.kind) {
    case 'all':
      return { from: bounds.min, to: bounds.max };
    case 'year':
      return { from: isoDate(period.year, 1, 1), to: isoDate(period.year, 12, 31) };
    case 'month':
      return {
        from: isoDate(period.year, period.month, 1),
        to: isoDate(period.year, period.month + 1, 0),
      };
    case 'range':
      return { from: period.from, to: period.to };
  }
}

/**
 * Limita o período às bordas do histórico para o resumo ("2026" com dados até junho mostra
 * 1 jan – 30 jun). Se o período fica todo fora do histórico, mantém as datas originais.
 */
export function clampDates(
  dates: { from: string; to: string },
  bounds: { min: string; max: string },
): { from: string; to: string } {
  const from = dates.from < bounds.min ? bounds.min : dates.from;
  const to = dates.to > bounds.max ? bounds.max : dates.to;
  return from <= to ? { from, to } : dates;
}

export function isoToUtcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

/** Dias corridos (inclusivos) entre duas datas ISO. */
export function daysBetween(from: string, to: string): number {
  return Math.round((isoToUtcDate(to).getTime() - isoToUtcDate(from).getTime()) / 86_400_000) + 1;
}

/** Mesmo período? (evita recalcular quando o usuário clica no que já está selecionado) */
export function samePeriod(a: Period, b: Period): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export type RangeErrors = {
  from?: 'required' | 'outOfRange';
  to?: 'required' | 'outOfRange' | 'order';
};

/**
 * Validação do intervalo (UX; `periodSchema` revalida): datas obrigatórias, dentro do
 * histórico e com a final depois da inicial.
 */
export function validateRange(
  from: string,
  to: string,
  bounds: { min: string; max: string },
): RangeErrors {
  const errors: RangeErrors = {};
  const valid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!valid(from)) errors.from = 'required';
  else if (from < bounds.min || from > bounds.max) errors.from = 'outOfRange';
  if (!valid(to)) errors.to = 'required';
  else if (to < bounds.min || to > bounds.max) errors.to = 'outOfRange';
  if (!errors.from && !errors.to && from > to) errors.to = 'order';
  return errors;
}
