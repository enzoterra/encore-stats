'use client';

import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 600;

function motionAllowed(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Contagem de 0 ao valor em 600 ms só na primeira exibição (10-design.md §7). Nas trocas de
 * período o valor muda na hora (meta < 200 ms). Com `prefers-reduced-motion`, nunca anima.
 */
export function useCountUp(value: number): number {
  const target = useRef(value);
  useEffect(() => {
    target.current = value;
  }, [value]);
  const [animated, setAnimated] = useState<number | null>(() =>
    motionAllowed() && value > 0 ? 0 : null,
  );
  const running = animated !== null;

  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      if (progress >= 1) {
        setAnimated(null);
        return;
      }
      setAnimated(Math.round(target.current * (1 - (1 - progress) ** 3)));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
    // Só na montagem: depois disso o valor é exibido direto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return animated ?? value;
}
