'use client';

import { Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { lazy, Suspense, useCallback, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

import type { ShareInput } from './share-input';

/**
 * O modal (e, a partir dele, o worker com satori + resvg, as fontes e o WASM) só é baixado quando
 * o usuário toca em "Compartilhar": nada disso entra no bundle inicial (RNF-03).
 */
const ShareDialog = lazy(() => import('./share-dialog'));

export type ShareBuilder = () => ShareInput | null | Promise<ShareInput | null>;

/**
 * Estado do modal de compartilhar de um dashboard. O recorte é "congelado" no toque: trocar o
 * período por trás do modal não muda o card aberto.
 */
export function useShareLauncher(build: ShareBuilder) {
  const t = useTranslations('Cards');
  const [input, setInput] = useState<ShareInput | null>(null);
  const [pending, setPending] = useState(false);
  const origin = useRef<HTMLElement | null>(null);

  const open = useCallback(
    async (from: HTMLElement) => {
      origin.current = from;
      setPending(true);
      try {
        const next = await build();
        if (next) setInput(next);
        else toast(t('unavailable'), 'warning');
      } catch {
        toast(t('dialog.errorTitle'), 'danger');
      } finally {
        setPending(false);
      }
    },
    [build, t],
  );

  const close = useCallback(() => {
    setInput(null);
    // O foco volta para o botão de origem (10-design.md §8.14).
    requestAnimationFrame(() => origin.current?.focus());
  }, []);

  const dialog: ReactNode = input ? (
    <Suspense fallback={<div aria-hidden="true" className="fixed inset-0 z-50 bg-overlay" />}>
      <ShareDialog
        input={input}
        open
        onOpenChange={(next) => {
          if (!next) close();
        }}
        returnFocus={origin}
      />
    </Suspense>
  ) : null;

  return { open, pending, dialog };
}

export function ShareButton({
  onOpen,
  pending,
  disabled,
  className,
}: {
  onOpen: (from: HTMLElement) => void;
  pending: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations('Cards');
  return (
    <Button
      variant="primary"
      className={className}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      title={disabled ? t('unavailable') : undefined}
      onClick={(event) => onOpen(event.currentTarget)}
      data-testid="share-open"
    >
      <Share2 aria-hidden="true" />
      {t('dialog.share')}
    </Button>
  );
}
