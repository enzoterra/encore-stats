import { Slot } from 'radix-ui';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

import { cn } from './cn';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

/** Variantes e tamanhos de 10-design.md §8.1 (pílula, alvo de toque ≥ 44 px). */
const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-vibrant hover:bg-primary-hover hover:shadow-glow active:bg-primary-active motion-safe:active:translate-y-px',
  accent: 'bg-accent text-on-vibrant hover:bg-accent-hover active:bg-accent-active',
  secondary: 'border-line-strong bg-surface-2 text-fg hover:bg-surface-3 active:bg-surface',
  ghost: 'bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg active:bg-surface-3',
  destructive: 'bg-danger text-on-vibrant hover:bg-danger-hover active:bg-danger-active',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'touch-target h-9 px-3.5 text-body-sm font-semibold',
  md: 'h-11 px-5 text-body font-semibold',
  lg: 'h-13 px-6 text-[17px] font-semibold',
  icon: 'size-11 shrink-0 p-0',
};

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-full border border-transparent text-center leading-tight no-underline',
    'transition-[background-color,box-shadow,color,transform] duration-(--duration-fast) ease-standard',
    'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-fg disabled:shadow-none',
    '[&_svg]:size-5 [&_svg]:shrink-0',
    variants[variant],
    sizes[size],
    block && 'w-full',
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Renderiza o filho (ex.: um link) com o visual de botão. */
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, asChild = false, className, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? 'button')}
      className={buttonClasses({ variant, size, block, className })}
      {...props}
    />
  );
});
