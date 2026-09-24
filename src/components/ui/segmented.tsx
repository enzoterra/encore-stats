'use client';

import { ToggleGroup } from 'radix-ui';

import { cn } from './cn';

export type SegmentedOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
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
}: Props<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label={label}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
      className={cn('flex gap-0.5 rounded-full border border-line bg-surface p-1', className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className={cn(
            'h-9 min-w-0 flex-1 truncate rounded-full px-2 text-body-sm font-semibold text-fg-muted',
            'transition-colors duration-(--duration-fast) ease-standard hover:text-fg',
            'data-[state=on]:bg-accent data-[state=on]:font-bold data-[state=on]:text-on-vibrant',
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
