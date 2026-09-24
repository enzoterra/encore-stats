'use client';

import { type ReactNode } from 'react';

import { cn } from '@/components/ui/cn';
import { InfoTip } from '@/components/ui/info-tip';

/**
 * Card de métrica (10-design.md §8.4): overline com ícone, valor, contexto e o selo
 * "vs. você mesmo", que abre a explicação do cálculo.
 */
export function MetricCard({
  icon,
  label,
  value,
  context,
  how,
  howLabel,
  badge,
  wide = false,
  nameValue = false,
  empty = false,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  context?: ReactNode;
  how: string;
  howLabel: string;
  badge: string;
  wide?: boolean;
  /** Valor textual (nome de música, data): tamanho menor que o número. */
  nameValue?: boolean;
  empty?: boolean;
}) {
  return (
    <div
      data-empty={empty || undefined}
      className={cn(
        'flex min-w-0 flex-col gap-1.5 rounded-lg border border-line bg-surface p-4 sm:p-5',
        wide && 'col-span-full',
      )}
    >
      <h3 className="flex items-center gap-1.5 text-overline text-fg-muted uppercase [&_svg]:size-4">
        <span aria-hidden="true">{icon}</span>
        {label}
      </h3>
      <p
        className={cn(
          'font-display font-extrabold break-words',
          nameValue ? 'text-[22px] leading-[1.1]' : 'text-[30px] leading-none tabular-nums',
          empty && 'text-fg-subtle',
        )}
      >
        {value}
      </p>
      {context ? <p className="text-body-sm text-fg-muted">{context}</p> : null}
      <div className="mt-auto pt-1">
        <InfoTip label={howLabel} triggerText={badge}>
          {how}
        </InfoTip>
      </div>
    </div>
  );
}
