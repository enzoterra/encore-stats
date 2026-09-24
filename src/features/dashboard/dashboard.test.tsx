import { act, fireEvent, screen, within } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { generateDemo, type DemoData } from '@/domain/demo';
import { availableMonths, computeStats } from '@/domain/stats';
import en from '@/i18n/messages/en.json';
import ptBR from '@/i18n/messages/pt-BR.json';

import { renderWithIntl } from '../../../tests/support/intl';
import { Dashboard } from './dashboard';
import { HeatmapSection } from './heatmap';
import { PeriodSelector } from './period-selector';
import { datasetBounds } from './period-utils';
import { type Format, useFormat } from './use-format';

let demo: DemoData;
beforeAll(() => {
  demo = generateDemo();
});

function renderDemo(locale: 'pt-BR' | 'en' = 'pt-BR') {
  return renderWithIntl(
    <Dashboard mode="demo" dataset={demo.dataset} timeZone={demo.timeZone} />,
    locale,
  );
}

describe('<Dashboard /> no modo Demo', () => {
  it('abre no ano mais recente, com totais, tops, heatmap, plataformas e "você por você"', () => {
    renderDemo();
    const months = availableMonths(demo.dataset, demo.timeZone);
    const lastYear = months[months.length - 1]!.year;
    expect(screen.getByTestId('dashboard-title')).toHaveTextContent(`Seu ${lastYear}`);
    const stats = computeStats(demo.dataset, { kind: 'year', year: lastYear }, demo.timeZone);
    expect(screen.getByTestId('total-plays')).toHaveTextContent(
      new Intl.NumberFormat('pt-BR').format(stats.totals.plays),
    );
    expect(screen.getByRole('heading', { name: ptBR.Dashboard.self.title })).toBeInTheDocument();
    expect(screen.getAllByText(ptBR.Dashboard.self.badge).length).toBeGreaterThanOrEqual(5);
    expect(screen.getByTestId('ranking-artists')).toHaveTextContent(stats.top.artists[0]!.name);
    expect(screen.getByTestId('heatmap')).toHaveAttribute('role', 'img');
    expect(screen.getByTestId('platforms').children.length).toBeGreaterThan(0);
    // Demo: sem links "Abrir no Spotify" (dados fictícios).
    expect(document.querySelector('a[href*="spotify.com"]')).toBeNull();
  });

  it('troca de período recalcula e anuncia (aria-live)', () => {
    renderDemo();
    fireEvent.click(screen.getByRole('radio', { name: ptBR.Dashboard.period.modes.all }));
    expect(screen.getByTestId('dashboard-title')).toHaveTextContent(ptBR.Dashboard.title.all);
    const all = computeStats(demo.dataset, { kind: 'all' }, demo.timeZone);
    expect(screen.getByTestId('total-plays')).toHaveTextContent(
      new Intl.NumberFormat('pt-BR').format(all.totals.plays),
    );
    expect(screen.getByText('Mostrando desde sempre')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: ptBR.Dashboard.period.modes.year }));
    fireEvent.click(screen.getByRole('button', { name: '2024' }));
    expect(screen.getByTestId('dashboard-title')).toHaveTextContent('Seu 2024');
    expect(screen.getByTestId('period-summary')).toHaveTextContent(/366 dias/);
  });

  it('troca o tipo de ranking e expande para o top 50', () => {
    renderDemo();
    fireEvent.click(screen.getByRole('radio', { name: ptBR.Dashboard.top.kinds.tracks }));
    const list = screen.getByTestId('ranking-tracks');
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: ptBR.Dashboard.top.more }));
    expect(
      within(screen.getByTestId('ranking-tracks')).getAllByRole('listitem').length,
    ).toBeGreaterThan(10);
    expect(screen.getByRole('button', { name: ptBR.Dashboard.top.less })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('aplica um intervalo de um dia', () => {
    renderDemo();
    fireEvent.click(screen.getByRole('radio', { name: ptBR.Dashboard.period.modes.range }));
    const from = screen.getByLabelText(ptBR.Dashboard.period.from);
    const to = screen.getByLabelText(ptBR.Dashboard.period.to);
    fireEvent.change(from, { target: { value: '2023-07-01' } });
    fireEvent.change(to, { target: { value: '2023-07-01' } });
    fireEvent.click(screen.getByRole('button', { name: ptBR.Dashboard.period.apply }));
    expect(screen.getByTestId('period-summary')).toHaveTextContent(/1 dia/);
  });

  it('funciona em inglês', () => {
    renderDemo('en');
    expect(screen.getByTestId('dashboard-title')).toHaveTextContent(/^Your \d{4}$/);
    expect(screen.getByRole('heading', { name: en.Dashboard.heatmap.title })).toBeInTheDocument();
  });
});

describe('<PeriodSelector />', () => {
  it('valida o intervalo: final antes da inicial bloqueia o "Aplicar" e mostra o erro no campo', () => {
    const onChange = vi.fn();
    const bounds = datasetBounds(demo.dataset, demo.timeZone);
    renderWithIntl(
      <FormatHost>
        {(format) => (
          <PeriodSelector
            period={{ kind: 'range', from: '2024-06-01', to: '2024-08-31' }}
            months={availableMonths(demo.dataset, demo.timeZone)}
            bounds={bounds}
            onChange={onChange}
            format={format}
          />
        )}
      </FormatHost>,
    );
    const apply = screen.getByRole('button', { name: ptBR.Dashboard.period.apply });
    expect(apply).toBeDisabled(); // nada mudou ainda
    const to = screen.getByLabelText(ptBR.Dashboard.period.to);
    fireEvent.change(to, { target: { value: '2024-05-01' } });
    expect(to).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(ptBR.Dashboard.period.errors.order)).toBeInTheDocument();
    expect(apply).toBeDisabled();

    fireEvent.change(to, { target: { value: '2030-01-01' } });
    expect(screen.getByText(/Escolha uma data entre/)).toBeInTheDocument();

    fireEvent.change(to, { target: { value: '2024-09-30' } });
    expect(apply).toBeEnabled();
    fireEvent.click(apply);
    expect(onChange).toHaveBeenCalledWith({ kind: 'range', from: '2024-06-01', to: '2024-09-30' });
  });

  it('stepper de mês desabilita nas bordas do histórico', () => {
    const months = availableMonths(demo.dataset, demo.timeZone);
    const first = months[0]!;
    const onChange = vi.fn();
    renderWithIntl(
      <FormatHost>
        {(format) => (
          <PeriodSelector
            period={{ kind: 'month', year: first.year, month: first.month }}
            months={months}
            bounds={datasetBounds(demo.dataset, demo.timeZone)}
            onChange={onChange}
            format={format}
          />
        )}
      </FormatHost>,
    );
    expect(screen.getByRole('button', { name: ptBR.Dashboard.period.prevMonth })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: ptBR.Dashboard.period.nextMonth }));
    expect(onChange).toHaveBeenCalledWith({
      kind: 'month',
      year: months[1]!.year,
      month: months[1]!.month,
    });
    expect(screen.getByText(/^Julho de 2023$/)).toBeInTheDocument();
  });
});

describe('<HeatmapSection />', () => {
  it('resumo textual, pico marcado e tabela equivalente', () => {
    const plays = new Array<number>(168).fill(2);
    plays[4 * 24 + 18] = 214; // sexta, 18h
    for (let d = 0; d < 7; d++) for (let h = 3; h < 6; h++) plays[d * 24 + h] = 0;
    renderWithIntl(
      <FormatHost>
        {(format) => (
          <HeatmapSection
            heatmap={{ plays, ms: plays, maxPlays: 214, maxMs: 214 }}
            format={format}
            periodLabel="2024"
          />
        )}
      </FormatHost>,
    );
    const figure = screen.getByRole('img');
    expect(figure).toHaveAccessibleName(/sexta-feira, das 18h às 19h \(214 plays\).*das 3h às 6h/);
    expect(document.querySelectorAll('[data-peak="true"]').length).toBe(2); // mobile + desktop
    expect(document.querySelectorAll('rect[data-day]')).toHaveLength(168 * 2);

    const toggle = screen.getByRole('button', { name: ptBR.Dashboard.heatmap.showTable });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(2);
    expect(within(tables[0]!).getAllByRole('columnheader')).toHaveLength(9);
    expect(within(tables[1]!).getAllByRole('columnheader')).toHaveLength(25);
    expect(within(tables[0]!).getByRole('rowheader', { name: 'Sex.' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: ptBR.Dashboard.heatmap.fullLabel })).toHaveAttribute(
      'tabindex',
      '0',
    );
  });

  it('tooltip ao passar o ponteiro numa célula', () => {
    const plays = new Array<number>(168).fill(1);
    renderWithIntl(
      <FormatHost>
        {(format) => (
          <HeatmapSection
            heatmap={{ plays, ms: plays, maxPlays: 1, maxMs: 1 }}
            format={format}
            periodLabel="x"
          />
        )}
      </FormatHost>,
    );
    const cell = document.querySelector('rect[data-day="0"][data-hour="9"]')!;
    act(() => {
      fireEvent.pointerMove(cell);
    });
    expect(screen.getByText(/Seg\., 9h–10h: 1 play/)).toBeInTheDocument();
    act(() => {
      fireEvent.pointerLeave(cell.closest('svg')!);
    });
    expect(screen.queryByText(/Seg\., 9h–10h/)).toBeNull();
  });
});

function FormatHost({ children }: { children: (format: Format) => ReactNode }) {
  const format = useFormat('America/Sao_Paulo');
  return <>{children(format)}</>;
}
