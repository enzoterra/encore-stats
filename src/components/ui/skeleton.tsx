import { cn } from './cn';

/** Bloco de carregamento com as dimensões do componente final (10-design.md §8.15). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton rounded-lg', className)} />;
}
