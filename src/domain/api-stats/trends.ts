import type { TimeRange } from '../spotify-types';

export type TrendKind = 'entered' | 'rising' | 'falling' | 'left';

export type TrendItem<T> = {
  item: T;
  kind: TrendKind;
  /** Posição (1-based) na janela atual; `null` para `left`. */
  rank: number | null;
  /** Posição (1-based) na janela de referência; `null` para `entered`. */
  previousRank: number | null;
  /** Posições ganhas (positivo) ou perdidas (negativo); `null` para `entered`/`left`. */
  delta: number | null;
};

export type Trends<T> = {
  entered: TrendItem<T>[];
  rising: TrendItem<T>[];
  falling: TrendItem<T>[];
  left: TrendItem<T>[];
};

export type TrendOptions = {
  /** Variação mínima de posições para contar como subiu/caiu. */
  minDelta?: number;
  /** Só conta como "saiu" quem estava entre os N primeiros da referência. */
  leftTopN?: number;
};

/**
 * Compara dois rankings (RF-16):
 * - **entrou**: está na janela atual e não estava na referência (ordem da janela atual);
 * - **subiu** / **caiu**: está nas duas e mudou ≥ `minDelta` posições (maior variação primeiro);
 * - **saiu**: estava entre os `leftTopN` da referência e não está na atual.
 */
export function compareRankings<T extends { id: string }>(
  current: readonly T[],
  baseline: readonly T[],
  options: TrendOptions = {},
): Trends<T> {
  const minDelta = options.minDelta ?? 3;
  const leftTopN = options.leftTopN ?? 20;
  const previous = new Map(baseline.map((item, index) => [item.id, index + 1]));
  const now = new Set(current.map((item) => item.id));
  const trends: Trends<T> = { entered: [], rising: [], falling: [], left: [] };

  current.forEach((item, index) => {
    const rank = index + 1;
    const previousRank = previous.get(item.id);
    if (previousRank === undefined) {
      trends.entered.push({ item, kind: 'entered', rank, previousRank: null, delta: null });
      return;
    }
    const delta = previousRank - rank;
    if (delta >= minDelta) trends.rising.push({ item, kind: 'rising', rank, previousRank, delta });
    else if (-delta >= minDelta) {
      trends.falling.push({ item, kind: 'falling', rank, previousRank, delta });
    }
  });
  baseline.slice(0, leftTopN).forEach((item, index) => {
    if (!now.has(item.id)) {
      trends.left.push({ item, kind: 'left', rank: null, previousRank: index + 1, delta: null });
    }
  });

  trends.rising.sort((a, b) => b.delta! - a.delta! || a.rank! - b.rank!);
  trends.falling.sort((a, b) => a.delta! - b.delta! || a.rank! - b.rank!);
  return trends;
}

/**
 * Tendências do modo Conectar: últimas ~4 semanas (`short_term`) contra os últimos ~6 meses
 * (`medium_term`). Se a janela média vier vazia (conta nova), compara com `long_term`.
 */
export function computeWindowTrends<T extends { id: string }>(
  windows: Readonly<Record<TimeRange, readonly T[]>>,
  options?: TrendOptions,
): Trends<T> & { baseline: 'medium_term' | 'long_term' } {
  const baseline = windows.medium_term.length > 0 ? 'medium_term' : 'long_term';
  return { ...compareRankings(windows.short_term, windows[baseline], options), baseline };
}
