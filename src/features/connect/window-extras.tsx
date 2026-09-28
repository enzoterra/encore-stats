'use client';

import { ArrowRight, BookOpen, CalendarRange, History, Info, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type KeyboardEvent, type RefObject, useId, useRef } from 'react';

import { Button, buttonClasses } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Link } from '@/i18n/navigation';

/**
 * Períodos que a API do Spotify não oferece (Iteração 8b.4). Não mudam os dados: explicam o
 * limite e levam ao histórico completo, onde "Sempre" e "Intervalo" funcionam.
 */
export const WINDOW_EXTRAS = ['all_time', 'custom'] as const;
export type WindowExtra = (typeof WINDOW_EXTRAS)[number];

/** Modo do seletor de período do Upload que corresponde a cada atalho. */
export const EXTRA_PERIOD_KIND = { all_time: 'all', custom: 'range' } as const satisfies Record<
  WindowExtra,
  'all' | 'range'
>;

const ICONS = { all_time: History, custom: CalendarRange } as const;

/**
 * Botões "Desde o começo" / "Selecionar período", ao lado do segmented da janela. São botões de
 * divulgação (`aria-expanded`), não rádios: escolher um deles não troca a janela ativa, que
 * continua marcada no segmented.
 */
export function WindowExtraButtons({
  open,
  onToggle,
  panelId,
  buttonRefs,
}: {
  open: WindowExtra | null;
  onToggle: (extra: WindowExtra) => void;
  panelId: string;
  buttonRefs: RefObject<Partial<Record<WindowExtra, HTMLButtonElement | null>>>;
}) {
  const t = useTranslations('Connect.dashboard.extras');
  return (
    <div role="group" aria-label={t('groupLabel')} className="flex gap-2">
      {WINDOW_EXTRAS.map((extra) => {
        const Icon = ICONS[extra];
        const expanded = open === extra;
        return (
          <button
            key={extra}
            ref={(node) => {
              buttonRefs.current[extra] = node;
            }}
            type="button"
            data-testid={`window-extra-${extra}`}
            aria-expanded={expanded}
            aria-controls={expanded ? panelId : undefined}
            onClick={() => onToggle(extra)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && expanded) {
                event.preventDefault();
                onToggle(extra);
              }
            }}
            className={cn(
              'touch-target inline-flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-body-sm leading-tight font-semibold sm:flex-none',
              'transition-colors duration-(--duration-fast) ease-standard',
              expanded
                ? 'border-line-strong bg-surface-3 text-fg'
                : 'border-line bg-surface-2 text-fg-muted hover:text-fg',
            )}
          >
            <Icon aria-hidden="true" className="hidden size-4 shrink-0 sm:block" />
            <span>{t(extra)}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Aviso inline aberto por um dos atalhos: por que a opção não existe no Conectar e o caminho
 * para o histórico completo. No Demo, o CTA principal leva à Visão Upload da própria Demo.
 */
export function WindowExtraPanel({
  extra,
  panelId,
  windowLabel,
  onClose,
  onOpenUpload,
}: {
  extra: WindowExtra;
  panelId: string;
  windowLabel: string;
  onClose: () => void;
  /** Só no Demo: troca para a Visão Upload com o modo correspondente já escolhido. */
  onOpenUpload?: (extra: WindowExtra) => void;
}) {
  const t = useTranslations('Connect.dashboard.extras');
  const titleId = useId();
  const demo = Boolean(onOpenUpload);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      id={panelId}
      role="region"
      aria-labelledby={titleId}
      data-testid="window-upsell"
      data-extra={extra}
      onKeyDown={onKeyDown}
      className="flex gap-3 rounded-md border border-l-4 border-line border-l-info bg-surface py-4 pr-2 pl-4"
    >
      <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 [overflow-wrap:anywhere]">
        <h3 id={titleId} className="text-h4 text-fg">
          {t(`title.${extra}`)}
        </h3>
        <p className="max-w-prose text-body-sm text-fg-muted">
          {t('body')} {demo ? t('bodyDemo') : null}
        </p>
        <p className="text-body-sm text-fg">{t('keep', { label: windowLabel })}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {onOpenUpload ? (
            <Button variant="secondary" onClick={() => onOpenUpload(extra)}>
              {t('demoUpload')}
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : (
            <Link href="/upload" className={buttonClasses({ variant: 'secondary' })}>
              <Upload aria-hidden="true" />
              {t('upload')}
            </Link>
          )}
          <Link href="/onboarding" className={buttonClasses({ variant: 'ghost' })}>
            <BookOpen aria-hidden="true" />
            {t('howTo')}
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('close')}
        className="-mt-1.5 grid size-11 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-surface-2 hover:text-fg"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}

/** Estado dos atalhos: qual aviso está aberto e os refs para devolver o foco ao fechar. */
export function useWindowExtras() {
  const buttonRefs = useRef<Partial<Record<WindowExtra, HTMLButtonElement | null>>>({});
  const panelId = useId();
  return { buttonRefs, panelId };
}
