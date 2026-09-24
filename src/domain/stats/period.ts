import { z } from 'zod';

import type { Dataset } from '../history/dataset';
import { FLAG_VALID } from '../history/dataset';
import { dayToYearMonth, localIndex, localMidnightToUtc } from '../time';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number) as [number, number, number];
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, 'data inválida');

const year = z.number().int().min(2000).max(2100);

/** Seletor de período (RF-07): mês, ano, desde sempre ou intervalo (datas locais, inclusivas). */
export const periodSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('year'), year }),
  z.object({ kind: z.literal('month'), year, month: z.number().int().min(1).max(12) }),
  z
    .object({ kind: z.literal('range'), from: isoDate, to: isoDate })
    .refine((p) => p.from <= p.to, 'from > to'),
]);

export type Period = z.infer<typeof periodSchema>;

const MAX_TS = 0xffff_ffff;

/** Intervalo [from, to) em epoch (s) do período, com as fronteiras na meia-noite local. */
export function resolvePeriod(period: Period, tz: string): { from: number; to: number } {
  switch (period.kind) {
    case 'all':
      return { from: 0, to: MAX_TS + 1 };
    case 'year':
      return {
        from: localMidnightToUtc(period.year, 1, 1, tz),
        to: localMidnightToUtc(period.year + 1, 1, 1, tz),
      };
    case 'month':
      return {
        from: localMidnightToUtc(period.year, period.month, 1, tz),
        to: localMidnightToUtc(period.year, period.month + 1, 1, tz),
      };
    case 'range': {
      const [fy, fm, fd] = period.from.split('-').map(Number) as [number, number, number];
      const [ty, tm, td] = period.to.split('-').map(Number) as [number, number, number];
      return {
        from: localMidnightToUtc(fy, fm, fd, tz),
        to: localMidnightToUtc(ty, tm, td + 1, tz),
      };
    }
  }
}

/** Primeiro índice com `ts[i] >= value` (busca binária; `ts` é crescente). */
export function lowerBound(ts: Uint32Array, value: number): number {
  let lo = 0;
  let hi = ts.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (ts[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Faixa de índices [start, end) do período no Dataset — O(log n). */
export function periodIndexRange(
  dataset: Dataset,
  period: Period,
  tz: string,
): { start: number; end: number; from: number; to: number } {
  const { from, to } = resolvePeriod(period, tz);
  const start = lowerBound(dataset.cols.ts, from);
  const end = Math.max(start, lowerBound(dataset.cols.ts, to));
  return { start, end, from, to };
}

/** Anos e meses (locais) com pelo menos um play válido, em ordem, para montar o seletor. */
export function availableMonths(
  dataset: Dataset,
  tz: string,
): { year: number; month: number; plays: number }[] {
  const { day } = localIndex(dataset, tz);
  const flags = dataset.cols.flags;
  const counts = new Map<number, number>();
  for (let i = 0; i < day.length; i++) {
    if (!(flags[i]! & FLAG_VALID)) continue;
    const { year: y, month } = dayToYearMonth(day[i]!);
    const key = y * 12 + (month - 1);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, plays]) => ({ year: Math.floor(key / 12), month: (key % 12) + 1, plays }));
}
