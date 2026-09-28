import { cn } from '@/components/ui/cn';

import { LOCKUP, LOGO_GRADIENT, lockupWidth } from './logo-art';

/**
 * Lockup "encore" em SVG inline (10-design.md §16, `design/logo/LOGO.md`). Só atributos SVG, sem
 * `style` inline (CSP). Decorativo: quem usa dá o nome acessível ao link ou ao bloco em volta.
 *
 * `id` separa o degradê de cada cópia na página (cabeçalho, rodapé, landing).
 */
export function Logo({
  id,
  height = 12,
  className,
}: {
  id: string;
  /** Altura em px (a largura segue a proporção). 12 px = cabeçalho, o mínimo de 64 px de largura. */
  height?: number;
  className?: string;
}) {
  const gradient = `encore-logo-${id}`;
  const g = LOCKUP.gradient;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${LOCKUP.width} ${LOCKUP.height}`}
      width={lockupWidth(height)}
      height={height}
      aria-hidden="true"
      focusable="false"
      className={cn('block shrink-0', className)}
      data-logo="encore"
    >
      <defs>
        <linearGradient
          id={gradient}
          gradientUnits="userSpaceOnUse"
          x1={g.x1}
          y1={g.y1}
          x2={g.x2}
          y2={g.y2}
        >
          {LOGO_GRADIENT.map(([offset, color]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>
      </defs>
      <path fill={LOCKUP.wordColor} d={LOCKUP.word} />
      <path d={LOCKUP.bar} fill={`url(#${gradient})`} />
      <path d={LOCKUP.arc} fill="none" stroke={`url(#${gradient})`} strokeWidth={LOCKUP.arcWidth} />
      <path
        d={LOCKUP.head}
        fill={`url(#${gradient})`}
        stroke={`url(#${gradient})`}
        strokeWidth={LOCKUP.headStroke}
        strokeLinejoin="round"
      />
    </svg>
  );
}
