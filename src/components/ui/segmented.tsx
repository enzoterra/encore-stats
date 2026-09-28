'use client';

import { ToggleGroup } from 'radix-ui';

import { cn } from './cn';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Opção indisponível: fica visível, sem foco nem clique (explique o motivo perto do controle). */
  disabled?: boolean;
};

type Props<T extends string> = {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  /** Id de um texto que explica o controle (ex.: por que uma opção está desabilitada). */
  describedBy?: string;
};

/**
 * Segmented control (10-design.md §8.2) sobre o Radix ToggleGroup `single`: setas do teclado,
 * estado `on` com fundo amarelo e peso 700 (não é só a cor que muda) e nunca fica sem seleção.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  describedBy,
}: Props<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label={label}
      aria-describedby={describedBy}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
      className={cn('flex gap-0.5 rounded-full border border-line bg-surface p-1', className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={cn(
            'h-9 min-w-0 flex-1 truncate rounded-full px-2 text-body-sm font-semibold text-fg-muted',
            'transition-colors duration-(--duration-fast) ease-standard hover:text-fg',
            'data-[state=on]:bg-accent data-[state=on]:font-bold data-[state=on]:text-on-vibrant',
            'disabled:cursor-not-allowed disabled:text-disabled-fg disabled:hover:text-disabled-fg',
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
