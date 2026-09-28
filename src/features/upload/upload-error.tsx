'use client';

import { useTranslations } from 'next-intl';

import { Alert } from '@/components/ui/alert';
import { Button, buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

import { ERROR_ACTIONS, errorValues, type ShownErrorCode } from './errors';
import type { UploadError } from './use-history-upload';

/** Alerta de erro do upload (10-design.md §8.10), com mensagem útil e próximas ações. */
export function UploadErrorAlert({
  error,
  onRetry,
  repoUrl,
}: {
  error: Exclude<UploadError, { code: 'CANCELLED' }>;
  onRetry: () => void;
  repoUrl?: string;
}) {
  const t = useTranslations('Upload');
  const code: ShownErrorCode = error.code;
  const values = errorValues(error);
  const actions = ERROR_ACTIONS[code].filter((action) => action !== 'report' || repoUrl);

  return (
    <Alert
      tone="danger"
      role="alert"
      title={t(`errors.${code}.title`)}
      className="p-5"
      actions={actions.map((action, index) => {
        // A dropzone logo abaixo já tem o botão primário da tela (10-design.md §1, item 5).
        const variant = index === 0 ? 'secondary' : 'ghost';
        if (action === 'howTo') {
          return (
            <Link key={action} href="/onboarding" className={buttonClasses({ variant })}>
              {t('actions.howTo')}
            </Link>
          );
        }
        if (action === 'report') {
          return (
            <a
              key={action}
              href={`${repoUrl}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ variant: 'ghost' })}
            >
              {t('actions.report')}
            </a>
          );
        }
        return (
          <Button key={action} variant={variant} onClick={onRetry}>
            {t(`actions.${action}`)}
          </Button>
        );
      })}
    >
      <p data-error-code={code} className="text-body-sm [overflow-wrap:anywhere] text-fg-muted">
        {t(`errors.${code}.body`, values)}
      </p>
    </Alert>
  );
}
