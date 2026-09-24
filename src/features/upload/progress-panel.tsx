'use client';

import { CircleCheck, LoaderCircle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import type { ProcessProgress } from '@/domain/history';

import { progressPercent } from './use-history-upload';

const STEPS = ['unzip', 'parse', 'aggregate'] as const;

/**
 * Progresso por etapa (10-design.md §8.10): Descompactar → Ler → Agregar, barra geral com %,
 * detalhe e "Cancelar". O leitor de tela ouve a troca de etapa e cada 25%.
 */
export function ProgressPanel({
  progress,
  maxStage,
  onCancel,
}: {
  progress: ProcessProgress | null;
  maxStage: number;
  onCancel: () => void;
}) {
  const t = useTranslations('Upload.progress');
  const percent = progressPercent(progress);
  const activeIndex = Math.min(maxStage, STEPS.length - 1);
  const allDone = progress?.stage === 'done';
  const activeStep = STEPS[activeIndex]!;
  const announce = t('announce', {
    step: t(`steps.${activeStep}`),
    percent: Math.floor(percent / 25) * 25,
  });

  return (
    <div
      role="group"
      aria-labelledby="progress-title"
      aria-busy="true"
      data-testid="upload-progress"
      className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-5 sm:p-8"
    >
      <h2 id="progress-title" className="font-display text-h3">
        {t('title')}
      </h2>

      <ol className="grid grid-cols-3 gap-2">
        {STEPS.map((step, index) => {
          const state =
            allDone || index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending';
          return (
            <li key={step} data-state={state} className="flex flex-col items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-7 place-items-center rounded-full text-body-sm font-bold tabular-nums',
                  state === 'pending' && 'bg-surface-2 text-fg-subtle',
                  state === 'active' && 'border-2 border-primary text-primary',
                  state === 'done' && 'bg-success text-on-vibrant motion-safe:animate-pop-in',
                )}
              >
                {state === 'done' ? (
                  <CircleCheck className="size-5" />
                ) : state === 'active' ? (
                  <LoaderCircle className="size-4 motion-safe:animate-spin" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  'text-body-sm',
                  state === 'pending' ? 'text-fg-subtle' : 'font-semibold text-fg',
                )}
              >
                {t(`steps.${step}`)}
                <span className="sr-only">{` (${t(`stepState.${state}`)})`}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label={t('percentLabel')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-(--duration-base) ease-standard"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="w-12 text-right text-body-sm font-semibold tabular-nums">{percent}%</span>
      </div>

      <p className="text-body-sm text-fg-muted tabular-nums">
        {t('detail', { files: progress?.filesDone ?? 0, records: progress?.records ?? 0 })}
      </p>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <Button variant="secondary" onClick={onCancel} className="self-start">
        <X aria-hidden="true" />
        {t('cancel')}
      </Button>
    </div>
  );
}
