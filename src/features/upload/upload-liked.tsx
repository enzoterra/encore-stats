'use client';

import { ArrowRight, Heart, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, buttonClasses } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { toast } from '@/components/ui/toast';
import type { LikedByArtist, ProcessProgress } from '@/domain/history';
import { LikedBoard, LikedSection } from '@/features/dashboard/liked-board';
import { useDatasetStore } from '@/features/dataset/store';
import { Link } from '@/i18n/navigation';

import { FILE_ACCEPT, takeFiles, useFileDrop } from './dropzone';
import { LIBRARY_HOW_TO_HREF, UploadErrorAlert } from './upload-error';
import {
  progressPercent,
  type UploadStatus,
  useLibraryUpload,
  type WorkerHandle,
} from './use-history-upload';

const linkClass =
  'inline-flex items-center gap-1 text-body-sm font-semibold text-primary-fg underline decoration-1 underline-offset-[3px] hover:decoration-2';

/** Progresso compacto da leitura das curtidas: barra, %, quantas já foram lidas e "Cancelar". */
function LikedProgress({
  progress,
  onCancel,
}: {
  progress: ProcessProgress | null;
  onCancel: () => void;
}) {
  const t = useTranslations('Dashboard.liked.progress');
  const percent = progressPercent(progress);
  return (
    <div
      role="group"
      aria-labelledby="liked-progress-title"
      aria-busy="true"
      data-testid="liked-progress"
      className="flex flex-col gap-3"
    >
      <p id="liked-progress-title" className="text-body-strong">
        {t('title')}
      </p>
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label={t('label')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-(--duration-base) ease-standard"
            style={{ width: `${Math.max(2, percent)}%` }}
          />
        </div>
        <span className="w-12 text-right text-body-sm font-semibold tabular-nums">{percent}%</span>
      </div>
      <p className="text-body-sm text-fg-muted tabular-nums">
        {t('records', { records: progress?.records ?? 0 })}
      </p>
      <p className="sr-only" aria-live="polite">
        {t('announce', { percent: Math.floor(percent / 25) * 25 })}
      </p>
      <Button variant="secondary" size="sm" className="self-start" onClick={onCancel}>
        <X aria-hidden="true" />
        {t('cancel')}
      </Button>
    </div>
  );
}

/**
 * Convite discreto no lugar do quadro, quando o histórico veio sem as curtidas: mandar agora o
 * "Dados da conta", sem recarregar o histórico. Aceita escolher ou arrastar o arquivo.
 */
function LikedInvite({
  status,
  onFiles,
  onCancel,
  onRetry,
  repoUrl,
}: {
  status: UploadStatus;
  onFiles: (files: File[]) => void;
  onCancel: () => void;
  onRetry: () => void;
  repoUrl?: string;
}) {
  const t = useTranslations('Dashboard.liked.invite');
  const { drag, handlers } = useFileDrop(onFiles);
  const busy = status.kind === 'processing';

  return (
    <section
      aria-labelledby="liked-invite-title"
      data-testid="liked-invite"
      data-drag={drag}
      {...(busy ? {} : handlers)}
      className={cn(
        'flex flex-col gap-4 rounded-lg border-2 border-dashed bg-surface/60 p-4 transition-colors duration-(--duration-fast) ease-standard sm:p-6',
        'md:flex-row md:items-start md:gap-5',
        drag === 'none' && 'border-line-strong',
        drag === 'valid' && 'border-solid border-primary bg-primary/8',
        drag === 'invalid' && 'border-solid border-danger',
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/12 text-primary-fg"
      >
        <Heart className="size-6" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="liked-invite-title" className="font-display text-h3">
            {t('title')}
          </h2>
          <p className="max-w-prose text-body-sm text-fg-muted">{t('body')}</p>
        </div>

        {status.kind === 'error' && status.error.code !== 'CANCELLED' ? (
          <UploadErrorAlert
            error={status.error}
            onRetry={onRetry}
            repoUrl={repoUrl}
            flow="library"
            titleAs="h3"
          />
        ) : null}

        {busy ? (
          <LikedProgress progress={status.progress} onCancel={onCancel} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label
                className={buttonClasses({
                  variant: 'secondary',
                  className:
                    'cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
                })}
              >
                <Upload aria-hidden="true" />
                <span aria-hidden="true">
                  {drag === 'valid'
                    ? t('dragValid')
                    : drag === 'invalid'
                      ? t('dragInvalid')
                      : t('choose')}
                </span>
                <input
                  type="file"
                  multiple
                  accept={FILE_ACCEPT}
                  aria-label={t('inputLabel')}
                  aria-describedby="liked-invite-help"
                  className="sr-only"
                  onChange={(event) => {
                    const files = takeFiles(event.currentTarget);
                    if (files.length > 0) onFiles(files);
                  }}
                />
              </label>
              <Link href={LIBRARY_HOW_TO_HREF} className={linkClass}>
                {t('howTo')}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
            <p id="liked-invite-help" className="text-caption text-fg-muted">
              {t('help')}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Curtidas no painel do Upload: o quadro, se o "Dados da conta" veio (junto ou depois), ou o
 * convite para mandá-lo agora. O resultado vai para o store do dataset, ao lado do histórico.
 */
export function UploadLiked({
  repoUrl,
  createWorker,
}: {
  repoUrl?: string;
  /** Só para testes de componente. */
  createWorker?: () => WorkerHandle;
}) {
  const t = useTranslations('Dashboard.liked');
  const library = useDatasetStore((state) => state.upload?.library);
  const setUploadLibrary = useDatasetStore((state) => state.setUploadLibrary);
  const heading = useRef<HTMLHeadingElement>(null);
  const [justLoaded, setJustLoaded] = useState(false);

  const onSuccess = useCallback(
    (result: LikedByArtist) => {
      setUploadLibrary(result);
      setJustLoaded(true);
      toast(t('done', { count: result.total }), 'success');
    },
    [setUploadLibrary, t],
  );
  const onCancel = useCallback(() => toast(t('progress.cancelled'), 'info'), [t]);
  const { status, start, cancel, reset } = useLibraryUpload({ onSuccess, onCancel, createWorker });

  // O convite (onde estava o foco) some: o foco vai para o título do quadro novo.
  useEffect(() => {
    if (justLoaded && library) heading.current?.focus();
  }, [justLoaded, library]);

  if (library) {
    return (
      <LikedSection headingRef={heading}>
        <LikedBoard library={library} />
      </LikedSection>
    );
  }
  return (
    <LikedInvite
      status={status}
      onFiles={(files) => void start(files)}
      onCancel={cancel}
      onRetry={reset}
      repoUrl={repoUrl}
    />
  );
}
