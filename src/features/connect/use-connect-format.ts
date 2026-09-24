'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['week', 7 * 86_400],
  ['day', 86_400],
  ['hour', 3600],
  ['minute', 60],
];

/** Formatadores do Conectar por locale (RNF-09), no fuso do navegador. */
export function useConnectFormat() {
  const locale = useLocale();
  const t = useTranslations('Connect.time');
  return useMemo(() => {
    const number = new Intl.NumberFormat(locale);
    const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const dateTime = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
    return {
      number: (n: number) => number.format(n),
      percent: (n: number) => percent.format(n),
      time: (ms: number) => time.format(new Date(ms)),
      /** "há 5 minutos" até 1 dia; depois, data e hora ("12 de set., 18:04"). */
      played: (iso: string, now: number) => {
        const ms = Date.parse(iso);
        const seconds = Math.round((now - ms) / 1000);
        if (seconds < 60) return t('justNow');
        if (seconds < 86_400) {
          const [unit, size] = seconds < 3600 ? UNITS[5]! : UNITS[4]!;
          return relative.format(-Math.floor(seconds / size), unit);
        }
        return dateTime.format(new Date(ms));
      },
      /** "há 2 horas", "agora". */
      ago: (ms: number, now: number) => {
        const seconds = Math.max(0, Math.round((now - ms) / 1000));
        if (seconds < 60) return t('justNow');
        for (const [unit, size] of UNITS) {
          if (seconds >= size) return relative.format(-Math.floor(seconds / size), unit);
        }
        return t('justNow');
      },
    };
  }, [locale, t]);
}

export type ConnectFormat = ReturnType<typeof useConnectFormat>;
