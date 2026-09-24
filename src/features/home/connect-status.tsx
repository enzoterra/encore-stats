import { useTranslations } from 'next-intl';

type Props = { enabled: boolean };

/** Aviso provisório sobre a disponibilidade do modo Conectar (vira o botão na Sprint 5). */
export function ConnectStatus({ enabled }: Props) {
  const t = useTranslations('Home');
  return (
    <p role="status" data-connect-enabled={enabled} className="text-sm text-neutral-300">
      {enabled ? t('connectEnabled') : t('connectDisabled')}
    </p>
  );
}
