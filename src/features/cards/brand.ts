/**
 * Marca do Encore dentro dos cards: **ponto único**. O cabeçalho do Básico e o rodapé dos quatro
 * templates chamam só `brandMark`. Desde o 8b.9 é o lockup da logo (conceito 2, "Bis"), como
 * `<img>` com o SVG em data URL: o mesmo desenho do cabeçalho do site (`logo-art.ts`), sem rede.
 */
import { lockupSvg, lockupWidth } from '@/components/brand/logo-art';

import type { CardNode } from './templates';

/** Data URL do lockup, montado uma vez por contexto (worker ou Node). */
let cached: string | undefined;
export function lockupDataUrl(): string {
  cached ??= `data:image/svg+xml;base64,${btoa(lockupSvg())}`;
  return cached;
}

/**
 * Lockup com `height` px de altura no canvas (a largura segue a proporção). Rodapé do Stories:
 * 30 px (design/logo/LOGO.md); os outros usos escalam a partir dele.
 */
export function brandMark(height: number): CardNode {
  return {
    type: 'img',
    props: {
      src: lockupDataUrl(),
      width: lockupWidth(height),
      height,
      style: { flexShrink: 0 },
    },
  };
}
