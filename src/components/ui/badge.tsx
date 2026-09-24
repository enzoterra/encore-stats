import { type ReactNode } from 'react';

import { cn } from './cn';

export type BadgeTone = 'info' | 'success' | 'warning' | 'danger' | 'accent' | 'neutral';

const tones: Record<BadgeTone, string> = {
  info: 'bg-info text-on-vibrant',
  success: 'bg-success text-on-vibrant',
  warning: 'bg-warning text-on-vibrant',
  danger: 'bg-danger text-on-vibrant',
  accent: 'bg-accent text-on-vibrant',
  neutral: 'border border-line bg-surface-2 text-fg-muted',
};

/** Badge em pílula (10-design.md §8.6): texto ink sobre cor de estado. */
export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-caption font-bold whitespace-nowrap [&_svg]:size-3.5',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Tag obrigatória do modo Demo (10-design.md §9.6): ink sobre ciano. */
export function DemoTag({ label, className }: { label: string; className?: string }) {
  return (
    <Badge tone="info" className={cn('tracking-[0.12em]', className)}>
      {label}
    </Badge>
  );
}
