'use client';

import { ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';

import { PrivacySealCompact } from '@/components/layout/privacy-seal';
import { toast } from '@/components/ui/toast';
import { Dashboard } from '@/features/dashboard/dashboard';
import { useDatasetStore } from '@/features/dataset/store';
import { Link } from '@/i18n/navigation';

import { Dropzone } from './dropzone';
import { ProgressPanel } from './progress-panel';
import { UploadErrorAlert } from './upload-error';
import { type UploadSuccess, useHistoryUpload, type WorkerHandle } from './use-history-upload';

/**
 * Tela do modo Upload (US-03, US-04): dropzone → progresso → dashboard. O Dataset fica só
 * na memória (Zustand); recarregar a página exige novo envio, e o dashboard avisa disso.
 */
export function UploadView({
  repoUrl,
  createWorker,
}: {
  repoUrl?: string;
  /** Só para testes de componente. */
  createWorker?: () => WorkerHandle;
}) {
  const t = useTranslations('Upload');
  const locale = useLocale();
  const upload = useDatasetStore((state) => state.upload);
  const setUpload = useDatasetStore((state) => state.setUpload);
  const clearUpload = useDatasetStore((state) => state.clearUpload);
  const [justLoaded, setJustLoaded] = useState(false);

  const onSuccess = useCallback(
    (result: UploadSuccess) => {
      setUpload(result);
      setJustLoaded(true);
      const seconds = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
        result.elapsedMs / 1000,
      );
      toast(t('done', { music: result.report.music, seconds }), 'success');
    },
    [locale, setUpload, t],
  );
  const onCancel = useCallback(() => toast(t('progress.cancelled'), 'info'), [t]);
  const { status, start, cancel, reset } = useHistoryUpload({ onSuccess, onCancel, createWorker });

  if (upload) {
    return (
      <Dashboard
        mode="upload"
        dataset={upload.dataset}
        timeZone={upload.timeZone}
        report={upload.report}
        elapsedMs={upload.elapsedMs}
        repoUrl={repoUrl}
        focusOnMount={justLoaded}
        onReset={() => {
          clearUpload();
          setJustLoaded(false);
          reset();
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 lg:py-16">
      <header className="flex flex-col gap-3">
        <p className="text-overline text-info uppercase">{t('overline')}</p>
        <h1 className="font-display text-h1 lg:text-h1-lg">{t('title')}</h1>
        <p className="text-body-lg text-fg-muted">{t('lead')}</p>
      </header>

      {status.kind === 'processing' ? (
        <ProgressPanel progress={status.progress} maxStage={status.maxStage} onCancel={cancel} />
      ) : (
        <div className="flex flex-col gap-4">
          {status.kind === 'error' && status.error.code !== 'CANCELLED' ? (
            <UploadErrorAlert error={status.error} onRetry={reset} repoUrl={repoUrl} />
          ) : null}
          <Dropzone onFiles={(files) => void start(files)} />
        </div>
      )}

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PrivacySealCompact mode="upload" repoUrl={repoUrl} />
        <p className="text-body-sm text-fg-muted">
          {t('noFile')}{' '}
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1 font-semibold text-primary-fg underline decoration-1 underline-offset-[3px] hover:decoration-2"
          >
            {t('noFileLink')}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </p>
      </div>
    </div>
  );
}
