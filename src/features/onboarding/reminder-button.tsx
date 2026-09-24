'use client';

import { CalendarPlus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

import { buildReminderIcs } from './ics';

/** `randomUUID` só existe em contexto seguro; em HTTP de rede local cai no `getRandomValues`. */
function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

/** Baixa o lembrete `.ics` montado no navegador (Blob + URL local, sem rede). */
export function ReminderButton() {
  const t = useTranslations('Onboarding.reminder');
  const locale = useLocale();

  const download = () => {
    const url = `${window.location.origin}/${locale}/upload`;
    const ics = buildReminderIcs({
      now: new Date(),
      title: t('eventTitle'),
      description: t('eventDescription', { url }),
      url,
      uid: `${randomId()}@encore`,
    });
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = 'encore-lembrete.ics';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(href), 0);
    toast(t('done'), 'success');
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="secondary" onClick={download} aria-describedby="reminder-help">
        <CalendarPlus aria-hidden="true" />
        {t('cta')}
      </Button>
      <p id="reminder-help" className="text-caption text-fg-muted">
        {t('help')}
      </p>
    </div>
  );
}
