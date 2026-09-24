'use client';

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';

import { cn } from './cn';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';
export type ToastItem = { id: number; tone: ToastTone; message: string; persistent?: boolean };

type ToastState = {
  queue: ToastItem[];
  /** `true` enquanto a barra de ação inferior do dashboard está na tela (mobile). */
  raised: boolean;
  setRaised: (raised: boolean) => void;
  push: (toast: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

/** Fila de toasts (10-design.md §8.13): um visível por vez, os demais aguardam. */
export const useToasts = create<ToastState>((set) => ({
  queue: [],
  raised: false,
  setRaised: (raised) => set({ raised }),
  push: (toast) => set((state) => ({ queue: [...state.queue, { ...toast, id: nextId++ }] })),
  dismiss: (id) => set((state) => ({ queue: state.queue.filter((t) => t.id !== id) })),
}));

export function toast(message: string, tone: ToastTone = 'info', persistent = false): void {
  useToasts.getState().push({ message, tone, persistent });
}

const AUTO_DISMISS_MS = 5000;

const border: Record<ToastTone, string> = {
  info: 'border-l-info',
  success: 'border-l-success',
  warning: 'border-l-warning',
  danger: 'border-l-danger',
};
const iconColor: Record<ToastTone, string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};
const icons = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert };

/**
 * Região dos toasts. Mobile: base, acima da barra inferior; desktop: canto inferior direito.
 * Some sozinho em 5 s com pausa no hover/foco; erro que pede ação (`persistent`) não some.
 * As regiões `status`/`alert` ficam sempre montadas para o leitor de tela anunciar a troca.
 */
export function ToastViewport() {
  const t = useTranslations('Common');
  const current = useToasts((state) => state.queue[0]);
  const dismiss = useToasts((state) => state.dismiss);
  const raised = useToasts((state) => state.raised);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!current || current.persistent || paused) return;
    timer.current = setTimeout(() => dismiss(current.id), AUTO_DISMISS_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [current, paused, dismiss]);

  const Icon = current ? icons[current.tone] : Info;
  const isError = current?.tone === 'danger';

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 z-40 flex flex-col px-4 lg:inset-x-auto lg:right-8 lg:bottom-8 lg:w-[420px] lg:px-0',
        raised ? 'bottom-[calc(88px+env(safe-area-inset-bottom))]' : 'bottom-4',
      )}
    >
      <div role="status" aria-live="polite" className="flex w-full justify-center lg:justify-end">
        {current && !isError ? (
          <ToastCard
            key={current.id}
            item={current}
            Icon={Icon}
            closeLabel={t('close')}
            onClose={() => dismiss(current.id)}
            onPause={setPaused}
          />
        ) : null}
      </div>
      <div role="alert" className="flex w-full justify-center lg:justify-end">
        {current && isError ? (
          <ToastCard
            key={current.id}
            item={current}
            Icon={Icon}
            closeLabel={t('close')}
            onClose={() => dismiss(current.id)}
            onPause={setPaused}
          />
        ) : null}
      </div>
    </div>
  );
}

function ToastCard({
  item,
  Icon,
  closeLabel,
  onClose,
  onPause,
}: {
  item: ToastItem;
  Icon: typeof Info;
  closeLabel: string;
  onClose: () => void;
  onPause: (paused: boolean) => void;
}) {
  return (
    <div
      data-testid="toast"
      onPointerEnter={() => onPause(true)}
      onPointerLeave={() => onPause(false)}
      onFocus={() => onPause(true)}
      onBlur={() => onPause(false)}
      className={cn(
        'pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-md border border-l-4 border-line bg-surface-2 py-1 pl-4 shadow-e2 motion-safe:animate-sheet-in',
        border[item.tone],
      )}
    >
      <Icon aria-hidden="true" className={cn('size-5 shrink-0', iconColor[item.tone])} />
      <p className="flex-1 py-2 text-body-sm text-fg">{item.message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="grid size-11 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-surface-3 hover:text-fg"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
