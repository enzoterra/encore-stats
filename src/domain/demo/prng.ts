/** PRNG determinístico (mulberry32): mesma seed → mesma sequência, em qualquer runtime. */
export type Random = {
  /** [0, 1) */
  next(): number;
  /** Inteiro em [0, n). */
  int(n: number): number;
  /** Inteiro em [min, max]. */
  range(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Índice sorteado por pesos acumulados (crescentes). */
  weighted(cumulative: ArrayLike<number>): number;
  /** ID base62 com 22 caracteres (formato de ID do Spotify). */
  id(): string;
  /** Permutação de [0, n) (Fisher–Yates; não depende do `sort` do motor JS). */
  permutation(n: number): number[];
};

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    next,
    int,
    range: (min, max) => min + int(max - min + 1),
    chance: (p) => next() < p,
    pick: (items) => items[int(items.length)]!,
    weighted(cumulative) {
      const total = cumulative[cumulative.length - 1]!;
      const target = next() * total;
      let lo = 0;
      let hi = cumulative.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (cumulative[mid]! <= target) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    },
    id() {
      let out = '';
      for (let i = 0; i < 22; i++) out += BASE62[int(62)];
      return out;
    },
    permutation(n) {
      const out = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = int(i + 1);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}

/** Pesos → acumulados. */
export function cumulate(weights: readonly number[]): Float64Array {
  const out = new Float64Array(weights.length);
  let sum = 0;
  weights.forEach((w, i) => {
    sum += w;
    out[i] = sum;
  });
  return out;
}
