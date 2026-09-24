'use client';

import { Check, ChevronLeft, ChevronRight, CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Segmented } from '@/components/ui/segmented';
import { periodSchema, type Period } from '@/domain/stats';

import {
  type MonthEntry,
  periodDates,
  type RangeErrors,
  validateRange,
  yearsOf,
} from './period-utils';
import { type Format } from './use-format';

type Mode = Period['kind'];

const MODES: readonly Mode[] = ['month', 'year', 'all', 'range'];

/**
 * Seletor de período (RF-07, 10-design.md §8.3): segmented do modo + controle secundário
 * (stepper de mês, chips de ano, intervalo com validação) + resumo. Trocar de modo já aplica
 * um período válido; o intervalo só muda no "Aplicar".
 */
export function PeriodSelector({
  period,
  months,
  bounds,
  onChange,
  format,
}: {
  period: Period;
  months: readonly MonthEntry[];
  bounds: { min: string; max: string };
  onChange: (period: Period) => void;
  format: Format;
}) {
  const t = useTranslations('Dashboard.period');
  const years = yearsOf(months);
  const lastMonth = months[months.length - 1];

  const selectMode = (mode: Mode) => {
    if (mode === period.kind) return;
    if (mode === 'all') onChange({ kind: 'all' });
    if (mode === 'year') {
      const year = 'year' in period ? period.year : (years[years.length - 1] ?? 2000);
      onChange({ kind: 'year', year: years.includes(year) ? year : years[years.length - 1]! });
    }
    if (mode === 'month') {
      const inYear = period.kind === 'year' ? months.filter((m) => m.year === period.year) : months;
      const target = inYear[inYear.length - 1] ?? lastMonth;
      if (target) onChange({ kind: 'month', year: target.year, month: target.month });
    }
    if (mode === 'range') {
      const { from, to } = periodDates(period, bounds);
      onChange({
        kind: 'range',
        from: from < bounds.min ? bounds.min : from,
        to: to > bounds.max ? bounds.max : to,
      });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label={t('modeLabel')}
        value={period.kind}
        onChange={selectMode}
        options={MODES.map((mode) => ({ value: mode, label: t(`modes.${mode}`) }))}
      />
      {period.kind === 'year' ? (
        <YearChips
          years={years}
          value={period.year}
          onChange={(year) => onChange({ kind: 'year', year })}
        />
      ) : null}
      {period.kind === 'month' ? (
        <MonthStepper
          months={months}
          year={period.year}
          month={period.month}
          onChange={(year, month) => onChange({ kind: 'month', year, month })}
          format={format}
        />
      ) : null}
      {period.kind === 'range' ? (
        <RangeFields
          key={`${period.from}|${period.to}`}
          from={period.from}
          to={period.to}
          bounds={bounds}
          onApply={(from, to) => onChange({ kind: 'range', from, to })}
          format={format}
        />
      ) : null}
    </div>
  );
}

function YearChips({
  years,
  value,
  onChange,
}: {
  years: number[];
  value: number;
  onChange: (year: number) => void;
}) {
  const t = useTranslations('Dashboard.period');
  const list = useRef<HTMLDivElement>(null);

  // Rola a lista (só na horizontal) até o ano selecionado.
  useEffect(() => {
    const container = list.current;
    const selected = container?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (container && selected) {
      container.scrollLeft =
        selected.offsetLeft - container.clientWidth / 2 + selected.clientWidth / 2;
    }
  }, [value]);

  return (
    <div
      ref={list}
      role="group"
      aria-label={t('yearGroup')}
      className="scroll-fade-x -mx-0.5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-0.5 py-1 pe-6"
    >
      {years.map((year) => {
        const selected = year === value;
        return (
          <button
            key={year}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(year)}
            className={cn(
              'touch-target inline-flex h-9 shrink-0 snap-start items-center gap-1.5 rounded-full px-4 text-body-sm font-semibold tabular-nums transition-colors duration-(--duration-fast)',
              selected
                ? 'bg-accent font-bold text-on-vibrant'
                : 'bg-surface-2 text-fg-muted hover:text-fg',
            )}
          >
            {selected ? <Check aria-hidden="true" className="size-4" /> : null}
            {year}
          </button>
        );
      })}
    </div>
  );
}

function MonthStepper({
  months,
  year,
  month,
  onChange,
  format,
}: {
  months: readonly MonthEntry[];
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
  format: Format;
}) {
  const t = useTranslations('Dashboard.period');
  const index = months.findIndex((m) => m.year === year && m.month === month);
  const prev = index > 0 ? months[index - 1] : undefined;
  const next = index >= 0 && index < months.length - 1 ? months[index + 1] : undefined;
  const iconButton =
    'grid size-11 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:text-disabled-fg disabled:hover:bg-transparent';
  return (
    <div className="flex items-center justify-between rounded-full border border-line bg-surface px-1">
      <button
        type="button"
        className={iconButton}
        aria-label={t('prevMonth')}
        disabled={!prev}
        onClick={() => prev && onChange(prev.year, prev.month)}
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </button>
      <strong className="font-semibold">{format.cap(format.monthYearLong(year, month))}</strong>
      <button
        type="button"
        className={iconButton}
        aria-label={t('nextMonth')}
        disabled={!next}
        onClick={() => next && onChange(next.year, next.month)}
      >
        <ChevronRight aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}

function RangeFields({
  from: initialFrom,
  to: initialTo,
  bounds,
  onApply,
  format,
}: {
  from: string;
  to: string;
  bounds: { min: string; max: string };
  onApply: (from: string, to: string) => void;
  format: Format;
}) {
  const t = useTranslations('Dashboard.period');
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const errors: RangeErrors = validateRange(from, to, bounds);
  const invalid = Boolean(errors.from || errors.to);
  const unchanged = from === initialFrom && to === initialTo;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    const parsed = periodSchema.safeParse({ kind: 'range', from, to });
    if (parsed.success && parsed.data.kind === 'range') onApply(parsed.data.from, parsed.data.to);
  };

  const message = (key: string | undefined) =>
    key === 'outOfRange'
      ? t('errors.outOfRange', {
          min: format.dateShort(bounds.min),
          max: format.dateShort(bounds.max),
        })
      : key
        ? t(`errors.${key as 'required' | 'order'}`)
        : null;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 min-[400px]:flex-row">
        <DateField
          id="range-from"
          label={t('from')}
          value={from}
          min={bounds.min}
          max={bounds.max}
          onChange={setFrom}
          error={message(errors.from)}
        />
        <DateField
          id="range-to"
          label={t('to')}
          value={to}
          min={from && from > bounds.min ? from : bounds.min}
          max={bounds.max}
          onChange={setTo}
          error={message(errors.to)}
        />
      </div>
      <Button
        type="submit"
        variant="secondary"
        disabled={invalid || unchanged}
        className="self-start"
      >
        {t('apply')}
      </Button>
    </form>
  );
}

function DateField({
  id,
  label,
  value,
  min,
  max,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  min: string;
  max: string;
  onChange: (value: string) => void;
  error: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <label htmlFor={id} className="text-body-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="date"
        required
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.currentTarget.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          'h-11 w-full min-w-0 rounded-md border bg-surface px-3.5 text-body text-fg [color-scheme:dark]',
          'focus-visible:border-primary',
          error ? 'border-danger' : 'border-line-strong',
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-caption text-danger-fg">
          <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
