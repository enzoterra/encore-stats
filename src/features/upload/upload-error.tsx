'use client';

import { useTranslations } from 'next-intl';

import { Alert } from '@/components/ui/alert';
import { Button, buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

import {
  ERROR_ACTIONS,
  errorMessageKey,
  errorValues,
  libraryErrorCode,
  type ShownErrorCode,
} from './errors';
import type { UploadError } from './use-history-upload';

/** Link para o trecho do onboarding que explica como pedir o "Dados da conta". */
export const LIBRARY_HOW_TO_HREF = '/onboarding#dados-da-conta';

/**
 * Alerta de erro do upload (10-design.md §8.10), com mensagem útil e próximas ações. `flow`:
 * `history` = envio do histórico (com ou sem as curtidas); `library` = só as curtidas, depois.
 */
export function UploadErrorAlert({
  error,
  onRetry,
  repoUrl,
  flow = 'history',
  titleAs = 'h2',
}: {
  error: Exclude<UploadError, { code: 'CANCELLED' }>;
  onRetry: () => void;
  repoUrl?: string;
  flow?: 'history' | 'library';
  titleAs?: 'h2' | 'h3';
}) {
  const t = useTranslations('Upload');
  const code: ShownErrorCode = error.code;
  const key = errorMessageKey(error);
  const values = errorValues(error);
  const actions = ERROR_ACTIONS[code].filter((action) => action !== 'report' || repoUrl);
  // No envio junto do histórico, um arquivo de curtidas com problema trava tudo: lembra que ele
  // é opcional. (Se faltou o histórico, o recado já diz isso.)
  const library = libraryErrorCode(error);
  const optionalHint = flow === 'history' && library && library !== 'WRONG_EXPORT';

  return (
    <Alert
      tone="danger"
      role="alert"
      titleAs={titleAs}
      title={t(`${key}.title`)}
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
        if (action === 'howToLibrary') {
          return (
            <Link key={action} href={LIBRARY_HOW_TO_HREF} className={buttonClasses({ variant })}>
              {t('actions.howToLibrary')}
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
        {t(`${key}.body`, values)}
        {optionalHint ? ` ${t('libraryErrors.optionalHint')}` : null}
      </p>
    </Alert>
  );
}
