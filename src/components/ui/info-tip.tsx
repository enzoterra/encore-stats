'use client';

import { Info } from 'lucide-react';
import { Popover } from 'radix-ui';
import { type ReactNode } from 'react';

import { cn } from './cn';

/**
 * "Tooltip" tocável (10-design.md §8.4): botão com ícone `info` que abre um popover.
 * Popover em vez de tooltip porque precisa funcionar no toque e no teclado.
 */
export function InfoTip({
  label,
  children,
  triggerText,
  className,
}: {
  /** Nome acessível do botão (ex.: "Como calculamos"). */
  label: string;
  children: ReactNode;
  /** Texto visível ao lado do ícone (opcional). */
  triggerText?: string;
  className?: string;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={triggerText ? `${triggerText}: ${label}` : label}
        className={cn(
          'touch-target inline-flex items-center gap-1 rounded-full text-caption text-fg-subtle transition-colors duration-(--duration-fast) hover:text-fg',
          className,
        )}
      >
        <Info aria-hidden="true" className="size-4 shrink-0" />
        {triggerText ? <span aria-hidden="true">{triggerText}</span> : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 max-w-[min(20rem,calc(100vw-2rem))] rounded-sm border border-line bg-surface-2 p-3 text-body-sm text-fg shadow-e2 motion-safe:animate-fade-in"
        >
          {children}
          <Popover.Arrow className="fill-surface-2" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
