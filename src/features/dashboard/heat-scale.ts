/**
 * Escala do heatmap (10-design.md §2.4): 7 degraus, `heat-0` para zero e 6 quantis dos
 * valores não nulos, para a rampa ser usada por inteiro. A legenda mostra os limites reais.
 */
export type HeatScale = {
  bin: (value: number) => number;
  /** Faixa real de cada degrau (0…6); `null` se nenhum valor caiu nele. */
  legend: ({ min: number; max: number } | null)[];
};

export const HEAT_STEPS = 7;

export function heatScale(values: readonly number[]): HeatScale {
  const nonZero = values.filter((v) => v > 0).sort((a, b) => a - b);
  const thresholds = [1, 2, 3, 4, 5].map((k) => nonZero[Math.floor((nonZero.length * k) / 6)] ?? 0);
  const bin = (value: number) =>
    value <= 0 ? 0 : 1 + thresholds.filter((threshold) => value > threshold).length;
  const legend: HeatScale['legend'] = Array.from({ length: HEAT_STEPS }, () => null);
  legend[0] = { min: 0, max: 0 };
  for (const value of nonZero) {
    const b = bin(value);
    const current = legend[b];
    legend[b] = current
      ? { min: Math.min(current.min, value), max: Math.max(current.max, value) }
      : { min: value, max: value };
  }
  return { bin, legend };
}

/** Célula de pico (maior valor; empate → a primeira). `null` se tudo é zero. */
export function peakCell(values: readonly number[]): number | null {
  let best = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i]! > 0 && (best < 0 || values[i]! > values[best]!)) best = i;
  }
  return best < 0 ? null : best;
}

/** Bloco de 3 h (0–7) com menos plays somando todos os dias. */
export function quietestBlock(values: readonly number[]): number {
  const sums = blockTotals(values).reduce<number[]>((acc, row) => {
    row.forEach((v, k) => (acc[k] = (acc[k] ?? 0) + v));
    return acc;
  }, []);
  let best = 0;
  for (let k = 1; k < sums.length; k++) if (sums[k]! < sums[best]!) best = k;
  return best;
}

/** 7 × 8: soma por dia ISO (0 = segunda) e bloco de 3 h. */
export function blockTotals(values: readonly number[]): number[][] {
  return Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 8 }, (_, block) => {
      let sum = 0;
      for (let h = block * 3; h < block * 3 + 3; h++) sum += values[day * 24 + h] ?? 0;
      return sum;
    }),
  );
}

/**
 * Ordem das colunas de dia pelo locale (`Intl.Locale#getWeekInfo`), com fallback de domingo
 * (pt-BR e en-US). Devolve índices ISO (0 = segunda … 6 = domingo).
 */
export function weekOrder(locale: string): number[] {
  let firstDay = 7;
  try {
    const info = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay ?? 7;
  } catch {
    firstDay = 7;
  }
  const start = (firstDay - 1) % 7; // 1 (segunda) → 0; 7 (domingo) → 6
  return Array.from({ length: 7 }, (_, i) => (start + i) % 7);
}
