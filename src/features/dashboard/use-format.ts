'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { isoToUtcDate } from './period-utils';

/** 2024-01-01 foi segunda-feira: base para nomes de dia ISO (0 = segunda). */
const MONDAY = Date.UTC(2024, 0, 1);

/**
 * Formatadores por locale (RNF-09). Datas ISO locais ("YYYY-MM-DD") são formatadas em UTC, pois
 * já estão no fuso do usuário; instantes (epoch) usam o fuso do histórico.
 */
export function useFormat(timeZone: string) {
  const locale = useLocale();
  const t = useTranslations('Dashboard');
  return useMemo(() => {
    const number = new Intl.NumberFormat(locale);
    const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
    const dateShort = new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const dayMonth = new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'short',
    });
    const monthYearShort = new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      month: 'short',
      year: 'numeric',
    });
    const monthYearLong = new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      month: 'long',
      year: 'numeric',
    });
    const instantMonthYear = new Intl.DateTimeFormat(locale, {
      timeZone,
      month: 'short',
      year: 'numeric',
    });
    const instantDate = new Intl.DateTimeFormat(locale, {
      timeZone,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const weekdayLong = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long' });
    const weekdayShort = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' });
    const weekdayNarrow = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'narrow' });
    const isoDay = (d: number) => new Date(MONDAY + d * 86_400_000);

    const cap = (value: string) => value.charAt(0).toLocaleUpperCase(locale) + value.slice(1);

    return {
      locale,
      /** Só a primeira letra em maiúscula ("Jul. de 2023", não "Jul. De 2023"). */
      cap,
      number: (n: number) => number.format(n),
      percent: (n: number) => percent.format(n),
      minutes: (ms: number) => number.format(Math.round(ms / 60_000)),
      duration: (ms: number) => {
        const total = Math.round(ms / 60_000);
        const h = Math.floor(total / 60);
        const m = total % 60;
        return h > 0
          ? t('duration.hm', { h: number.format(h), m })
          : t('duration.m', { m: number.format(m) });
      },
      dateShort: (iso: string) => dateShort.format(isoToUtcDate(iso)),
      dayMonth: (iso: string) => dayMonth.format(isoToUtcDate(iso)),
      dateRange: (from: string, to: string) =>
        dateShort.formatRange(isoToUtcDate(from), isoToUtcDate(to)),
      monthYearShort: (year: number, month: number) =>
        monthYearShort.format(new Date(Date.UTC(year, month - 1, 1))),
      monthYearLong: (year: number, month: number) =>
        monthYearLong.format(new Date(Date.UTC(year, month - 1, 1))),
      instantMonthYear: (epochSeconds: number) =>
        instantMonthYear.format(new Date(epochSeconds * 1000)),
      instantDate: (epochSeconds: number) => instantDate.format(new Date(epochSeconds * 1000)),
      weekdayLong: (d: number) => weekdayLong.format(isoDay(d)),
      weekdayShort: (d: number) => cap(weekdayShort.format(isoDay(d))),
      weekdayNarrow: (d: number) => weekdayNarrow.format(isoDay(d)),
      hour: (h: number) => t('heatmap.hour', { hour: h }),
    };
  }, [locale, t, timeZone]);
}

export type Format = ReturnType<typeof useFormat>;
