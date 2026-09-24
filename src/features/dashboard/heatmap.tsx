'use client';

import { Table2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type PointerEvent, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Heatmap } from '@/domain/stats';

import { blockTotals, heatScale, peakCell, quietestBlock, weekOrder } from './heat-scale';
import { type Format } from './use-format';

/** Classes de preenchimento dos 7 degraus (tokens `heat-0…6`). */
const HEAT_FILL = [
  'fill-heat-0',
  'fill-heat-1',
  'fill-heat-2',
  'fill-heat-3',
  'fill-heat-4',
  'fill-heat-5',
  'fill-heat-6',
] as const;
const HEAT_BG = [
  'bg-heat-0',
  'bg-heat-1',
  'bg-heat-2',
  'bg-heat-3',
  'bg-heat-4',
  'bg-heat-5',
  'bg-heat-6',
] as const;

type Tip = { x: number; y: number; text: string };

type Layout = {
  width: number;
  height: number;
  cell: (column: number, row: number) => { x: number; y: number; w: number; h: number };
};

/** Mobile: 7 colunas (dias) × 24 linhas (horas). */
const VERTICAL = { label: 28, header: 18, w: 40, h: 14, gap: 2 };
/** ≥ 768 px: 7 linhas (dias) × 24 colunas (horas). */
const HORIZONTAL = { label: 44, header: 18, w: 28, h: 22, gap: 2 };

function verticalLayout(): Layout {
  const { label, header, w, h, gap } = VERTICAL;
  return {
    width: label + 7 * w + 6 * gap,
    height: header + 24 * h + 23 * gap,
    cell: (day, hour) => ({ x: label + day * (w + gap), y: header + hour * (h + gap), w, h }),
  };
}

function horizontalLayout(): Layout {
  const { label, header, w, h, gap } = HORIZONTAL;
  return {
    width: label + 24 * w + 23 * gap,
    height: header + 7 * h + 6 * gap,
    cell: (day, hour) => ({ x: label + hour * (w + gap), y: header + day * (h + gap), w, h }),
  };
}

/**
 * Heatmap hora × dia (RF-10, 10-design.md §8.9) em SVG próprio: figura com resumo textual,
 * pico com anel duplo, tooltip no hover/toque, legenda com os limites reais e "Ver como tabela".
 * As células não entram na ordem de tabulação.
 */
export function HeatmapSection({
  heatmap,
  format,
  periodLabel,
}: {
  heatmap: Heatmap;
  format: Format;
  periodLabel: string;
}) {
  const t = useTranslations('Dashboard.heatmap');
  const [showTable, setShowTable] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const values = heatmap.plays;
  const order = useMemo(() => weekOrder(format.locale), [format.locale]);
  const scale = useMemo(() => heatScale(values), [values]);
  const peak = peakCell(values);
  const quiet = quietestBlock(values);
  const blocks = useMemo(() => blockTotals(values), [values]);
  const empty = peak === null;

  const summary = empty
    ? t('empty')
    : t('summary', {
        day: format.weekdayLong(Math.floor(peak / 24)),
        from: format.hour(peak % 24),
        to: format.hour((peak % 24) + 1),
        plays: values[peak]!,
        quietFrom: format.hour(quiet * 3),
        quietTo: format.hour(quiet * 3 + 3),
      });

  const tooltipText = (day: number, hour: number) =>
    t('tooltip', {
      day: format.weekdayShort(day),
      from: format.hour(hour),
      to: format.hour(hour + 1),
      plays: values[day * 24 + hour] ?? 0,
    });

  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    const target = event.target as Element;
    const day = target.getAttribute('data-day');
    const hour = target.getAttribute('data-hour');
    const box = wrapper.current?.getBoundingClientRect();
    if (day === null || hour === null || !box) {
      setTip(null);
      return;
    }
    const cell = target.getBoundingClientRect();
    setTip({
      x: cell.left - box.left + cell.width / 2,
      y: cell.top - box.top,
      text: tooltipText(Number(day), Number(hour)),
    });
  };

  const renderGrid = (layout: Layout, vertical: boolean, className: string) => (
    <svg
      viewBox={`-4 -2 ${layout.width + 8} ${layout.height + 6}`}
      className={className}
      aria-hidden="true"
      onPointerMove={onPointer}
      onPointerDown={onPointer}
      onPointerLeave={() => setTip(null)}
    >
      {order.map((day, column) => {
        const pos = vertical ? layout.cell(column, 0) : layout.cell(0, 0);
        return vertical ? (
          <text
            key={`d${day}`}
            x={pos.x + pos.w / 2}
            y={12}
            textAnchor="middle"
            className="fill-fg-muted text-[11px] font-semibold"
          >
            {format.weekdayNarrow(day)}
          </text>
        ) : (
          <text
            key={`d${day}`}
            x={0}
            y={layout.cell(column, 0).y + HORIZONTAL.h / 2 + 4}
            className="fill-fg-muted text-[11px] font-semibold"
          >
            {format.weekdayShort(day)}
          </text>
        );
      })}
      {Array.from({ length: 8 }, (_, k) => k * 3).map((hour) => {
        const pos = vertical ? layout.cell(0, hour) : layout.cell(0, hour);
        return vertical ? (
          <text
            key={`h${hour}`}
            x={VERTICAL.label - 6}
            y={pos.y + VERTICAL.h - 3}
            textAnchor="end"
            className="fill-fg-subtle text-[10px] tabular-nums"
          >
            {format.hour(hour)}
          </text>
        ) : (
          <text
            key={`h${hour}`}
            x={pos.x}
            y={12}
            className="fill-fg-subtle text-[10px] tabular-nums"
          >
            {format.hour(hour)}
          </text>
        );
      })}
      {order.map((day, column) =>
        Array.from({ length: 24 }, (_, hour) => {
          const value = values[day * 24 + hour] ?? 0;
          const b = scale.bin(value);
          const pos = vertical ? layout.cell(column, hour) : layout.cell(column, hour);
          return (
            <rect
              key={`${day}-${hour}`}
              data-day={day}
              data-hour={hour}
              data-bin={b}
              x={pos.x}
              y={pos.y}
              width={pos.w}
              height={pos.h}
              rx={2}
              className={`${HEAT_FILL[b]}${b === 0 ? 'stroke-line' : ''}`}
              strokeWidth={b === 0 ? 1 : 0}
            />
          );
        }),
      )}
      {peak !== null
        ? (() => {
            const column = order.indexOf(Math.floor(peak / 24));
            const pos = layout.cell(column, peak % 24);
            return (
              <g data-peak="true" className="pointer-events-none">
                <rect
                  x={pos.x - 1}
                  y={pos.y - 1}
                  width={pos.w + 2}
                  height={pos.h + 2}
                  rx={3}
                  className="fill-none stroke-on-vibrant"
                  strokeWidth={2}
                />
                <rect
                  x={pos.x - 3}
                  y={pos.y - 3}
                  width={pos.w + 6}
                  height={pos.h + 6}
                  rx={4}
                  className="fill-none stroke-fg"
                  strokeWidth={2}
                />
              </g>
            );
          })()
        : null}
    </svg>
  );

  const vertical = verticalLayout();
  const horizontal = horizontalLayout();

  return (
    <section aria-labelledby="heat-title" className="flex flex-col gap-3">
      <h2 id="heat-title" className="font-display text-h2 lg:text-h2-lg">
        {t('title')}
      </h2>
      <div ref={wrapper} className="relative">
        <figure
          role="img"
          aria-label={summary}
          data-testid="heatmap"
          className="m-0 flex flex-col gap-3"
        >
          {renderGrid(vertical, true, 'h-auto w-full max-w-[420px] md:hidden')}
          {renderGrid(horizontal, false, 'hidden h-auto w-full md:block')}
          <div
            aria-hidden="true"
            className="flex flex-wrap items-center gap-1 text-caption text-fg-muted"
          >
            <span className="mr-1">{t('less')}</span>
            {scale.legend.map((range, b) => (
              <span
                key={b}
                title={
                  range
                    ? range.min === range.max
                      ? format.number(range.min)
                      : `${format.number(range.min)}–${format.number(range.max)}`
                    : undefined
                }
                className="flex flex-col items-center gap-0.5"
              >
                <span
                  className={`block h-3 w-6 rounded-[2px] ${HEAT_BG[b]} ${b === 0 ? 'ring-1 ring-line ring-inset' : ''}`}
                />
                <span className="text-[10px] text-fg-subtle tabular-nums">
                  {range
                    ? range.min === range.max
                      ? format.number(range.min)
                      : `${format.number(range.min)}–${format.number(range.max)}`
                    : '·'}
                </span>
              </span>
            ))}
            <span className="ml-1">{t('more')}</span>
          </div>
          <figcaption className="text-body-sm text-fg">{summary}</figcaption>
        </figure>
        {tip ? (
          <div
            role="presentation"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-sm border border-line bg-surface-2 px-2.5 py-1.5 text-caption font-semibold whitespace-nowrap text-fg shadow-e2"
            style={{ left: tip.x, top: tip.y }}
          >
            {tip.text}
          </div>
        ) : null}
      </div>
      <Button
        variant="ghost"
        className="self-start"
        aria-expanded={showTable}
        aria-controls="heat-table"
        onClick={() => setShowTable((v) => !v)}
      >
        <Table2 aria-hidden="true" />
        {showTable ? t('hideTable') : t('showTable')}
      </Button>
      <div id="heat-table" hidden={!showTable} className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-md border border-line">
          <table className="w-full border-collapse text-[13px]">
            <caption className="px-3 py-2.5 text-left text-body-sm text-fg-muted">
              {t('tableCaption', { period: periodLabel })}
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="h-9 pl-3 text-left text-caption-strong text-fg-muted">
                  {t('dayHeader')}
                </th>
                {Array.from({ length: 8 }, (_, k) => (
                  <th
                    key={k}
                    scope="col"
                    className="h-9 px-1 text-right text-[11px] font-semibold text-fg-muted tabular-nums"
                  >
                    {t('hourRange', { from: k * 3, to: k * 3 + 3 })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {order.map((day) => (
                <tr key={day} className="odd:bg-surface even:bg-background">
                  <th scope="row" className="h-9 pl-3 text-left font-semibold">
                    {format.weekdayShort(day)}
                  </th>
                  {blocks[day]!.map((value, k) => (
                    <td key={k} className="h-9 px-1 text-right tabular-nums">
                      {format.number(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          role="region"
          aria-label={t('fullLabel')}
          tabIndex={0}
          className="overflow-x-auto rounded-md border border-line"
        >
          <table className="border-collapse text-[13px]">
            <caption className="px-3 py-2.5 text-left text-body-sm text-fg-muted">
              {t('fullCaption', { period: periodLabel })}
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th
                  scope="col"
                  className="sticky left-0 h-9 bg-background pr-2 pl-3 text-left text-caption-strong text-fg-muted"
                >
                  {t('dayHeader')}
                </th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th
                    key={h}
                    scope="col"
                    className="h-9 min-w-10 px-1.5 text-right text-[11px] font-semibold text-fg-muted tabular-nums"
                  >
                    {format.hour(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {order.map((day) => (
                <tr key={day} className="odd:bg-surface even:bg-background">
                  <th
                    scope="row"
                    className="sticky left-0 h-9 bg-inherit pr-2 pl-3 text-left font-semibold"
                  >
                    {format.weekdayShort(day)}
                  </th>
                  {Array.from({ length: 24 }, (_, h) => (
                    <td key={h} className="h-9 px-1.5 text-right tabular-nums">
                      {format.number(values[day * 24 + h] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
