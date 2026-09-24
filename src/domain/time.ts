/**
 * Utilitários de fuso horário para as stats (RF-07, RF-10). O fuso é sempre um parâmetro
 * (IANA, ex. "America/Sao_Paulo"), o que mantém as funções puras e testáveis em Node.
 */
import type { Dataset } from './history/dataset';

export const SECONDS_PER_DAY = 86_400;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Devolve o fuso se for um IANA válido; caso contrário, "UTC". */
export function resolveTimeZone(tz: string | undefined): string {
  if (!tz) return 'UTC';
  try {
    formatter(tz);
    return tz;
  } catch {
    return 'UTC';
  }
}

/** Deslocamento (segundos) do fuso em relação ao UTC no instante `ts` (epoch em segundos). */
export function tzOffsetSeconds(ts: number, tz: string): number {
  const parts = formatter(tz).formatToParts(new Date(ts * 1000));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc / 1000 - ts;
}

/** Epoch (s) da meia-noite local de `year-month-day` no fuso (aceita dia/mês fora do intervalo). */
export function localMidnightToUtc(year: number, month: number, day: number, tz: string): number {
  const guess = Date.UTC(year, month - 1, day) / 1000;
  const first = guess - tzOffsetSeconds(guess, tz);
  return guess - tzOffsetSeconds(first, tz);
}

/** Dia (número de dias desde 1970-01-01) → "YYYY-MM-DD". */
export function dayToIsoDate(day: number): string {
  return new Date(day * SECONDS_PER_DAY * 1000).toISOString().slice(0, 10);
}

/** Dia → { year, month (1–12) }. */
export function dayToYearMonth(day: number): { year: number; month: number } {
  const date = new Date(day * SECONDS_PER_DAY * 1000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

/** Dia da semana ISO: 0 = segunda … 6 = domingo. 1970-01-01 foi quinta (3). */
export function weekdayOfDay(day: number): number {
  return (((day + 3) % 7) + 7) % 7;
}

/**
 * Índice local por registro: dia local (desde a época) e `weekHour` = weekday × 24 + hora
 * local. Calculado uma vez por (Dataset, fuso) e memorizado, para a troca de período ficar
 * abaixo de 200 ms (RNF-03).
 */
export type LocalIndex = { day: Int32Array; weekHour: Uint8Array };

const localIndexCache = new WeakMap<Dataset, Map<string, LocalIndex>>();

export function localIndex(dataset: Dataset, tz: string): LocalIndex {
  let byTz = localIndexCache.get(dataset);
  if (!byTz) {
    byTz = new Map();
    localIndexCache.set(dataset, byTz);
  }
  const cached = byTz.get(tz);
  if (cached) return cached;
  const built = buildLocalIndex(dataset.cols.ts, tz);
  byTz.set(tz, built);
  return built;
}

/**
 * O deslocamento é consultado no início de cada dia UTC (≈ 1 chamada ao Intl por dia com
 * escuta). Se o início do dia seguinte tiver outro deslocamento (dia de transição de horário
 * de verão), os registros desse dia são convertidos um a um. Premissa: nenhum fuso muda duas
 * vezes no mesmo dia e volta ao valor anterior.
 */
function buildLocalIndex(ts: Uint32Array, tz: string): LocalIndex {
  const n = ts.length;
  const day = new Int32Array(n);
  const weekHour = new Uint8Array(n);
  const dayStartOffset = new Map<number, number>();
  const offsetAtDayStart = (utcDay: number) => {
    let offset = dayStartOffset.get(utcDay);
    if (offset === undefined) {
      offset = tzOffsetSeconds(utcDay * SECONDS_PER_DAY, tz);
      dayStartOffset.set(utcDay, offset);
    }
    return offset;
  };

  let currentUtcDay = Number.NaN;
  let constantOffset: number | null = null;
  for (let i = 0; i < n; i++) {
    const t = ts[i]!;
    const utcDay = Math.floor(t / SECONDS_PER_DAY);
    if (utcDay !== currentUtcDay) {
      currentUtcDay = utcDay;
      const start = offsetAtDayStart(utcDay);
      constantOffset = start === offsetAtDayStart(utcDay + 1) ? start : null;
    }
    const local = t + (constantOffset ?? tzOffsetSeconds(t, tz));
    const localDay = Math.floor(local / SECONDS_PER_DAY);
    const hour = Math.floor((local - localDay * SECONDS_PER_DAY) / 3600);
    day[i] = localDay;
    weekHour[i] = weekdayOfDay(localDay) * 24 + hour;
  }
  return { day, weekHour };
}
