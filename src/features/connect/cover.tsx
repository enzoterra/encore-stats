/* eslint-disable @next/next/no-img-element -- Capas vêm dos CDNs do Spotify (já em ~300 px,
   liberados na CSP) e precisam aparecer sem corte nem alteração; o next/image geraria `style` no
   SSR, bloqueado pela CSP. */
'use client';

import { useState } from 'react';

import { cn } from '@/components/ui/cn';

/**
 * Capa ou foto (10-design.md §10, itens 11–12): quadrada, `object-fit: contain` (sem corte nem
 * distorção), sem nada por cima; raio de 4 px até 64 px e 8 px acima. Sem imagem (ou no Demo),
 * um bloco neutro com a inicial.
 */
export function Cover({
  src,
  name,
  size = 48,
  className,
}: {
  src?: string;
  name: string;
  size?: 40 | 48 | 64 | 96;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const radius = size > 64 ? 'rounded-sm' : 'rounded-xs';
  const box = { 40: 'size-10', 48: 'size-12', 64: 'size-16', 96: 'size-24' }[size];
  if (!src || broken) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'grid shrink-0 place-items-center bg-surface-2 font-display font-extrabold text-fg-subtle uppercase',
          size > 64 ? 'text-h2' : 'text-h4',
          radius,
          box,
          className,
        )}
      >
        {Array.from(name.trim())[0] ?? '?'}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={cn('aspect-square shrink-0 bg-surface-2 object-contain', radius, box, className)}
    />
  );
}
