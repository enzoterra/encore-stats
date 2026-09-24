import { expect, test } from '@playwright/test';

import { expectNoHorizontalScroll, expectNoSeriousA11y } from './support';

test.describe('modo Demo (RF-12, US-07)', () => {
  test('percorre o dashboard completo: períodos, tops, heatmap, tabela e métricas', async ({
    page,
  }) => {
    await page.goto('/pt-BR/demo');
    await expect(page.getByRole('banner').getByText('DEMO', { exact: true })).toBeVisible();
    const dashboard = page.getByTestId('dashboard');
    await expect(dashboard).toBeVisible();
    await expect(dashboard).toHaveAttribute('data-mode', 'demo');
    await expect(page.getByTestId('dashboard-title')).toHaveText(/^Seu \d{4}$/);

    // Seções do mockup A.
    for (const name of ['Você por você', 'Seu top', 'Quando você ouve', 'Onde você ouve']) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    await expect(page.getByText('vs. você mesmo').first()).toBeVisible();

    // Troca de período: desde sempre → 2024 → mês → intervalo.
    const summary = page.getByTestId('period-summary');
    await page.getByRole('radio', { name: 'Sempre' }).click();
    await expect(page.getByTestId('dashboard-title')).toHaveText('Você, desde sempre');
    await page.getByRole('radio', { name: 'Ano' }).click();
    await page.getByRole('button', { name: '2024', exact: true }).click();
    await expect(page.getByTestId('dashboard-title')).toHaveText('Seu 2024');
    await expect(summary).toContainText('366 dias');
    await page.getByRole('radio', { name: 'Mês' }).click();
    await expect(page.getByTestId('dashboard-title')).toHaveText('Seu dezembro de 2024');
    await page.getByRole('button', { name: 'Mês anterior' }).click();
    await expect(page.getByTestId('dashboard-title')).toHaveText('Seu novembro de 2024');
    await page.getByRole('radio', { name: 'Intervalo' }).click();
    await page.getByLabel('Até', { exact: true }).fill('2024-10-01');
    await expect(page.getByText('A data final vem depois da inicial.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
    await page.getByLabel('De', { exact: true }).fill('2024-06-01');
    await page.getByLabel('Até', { exact: true }).fill('2024-08-31');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(summary).toContainText('92 dias');

    // Tops: tipos e top 50.
    await page.getByRole('radio', { name: 'Álbuns' }).click();
    await expect(page.getByTestId('ranking-albums').getByRole('listitem')).toHaveCount(10);
    await page.getByRole('button', { name: 'Ver top 50' }).click();
    expect(await page.getByTestId('ranking-albums').getByRole('listitem').count()).toBeGreaterThan(
      10,
    );

    // Heatmap acessível + tabela.
    await expect(page.getByRole('img', { name: /Seu pico:/ })).toBeVisible();
    await page.getByRole('button', { name: 'Ver como tabela' }).click();
    await expect(page.getByRole('table').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Esconder tabela' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    // Demo: nenhum link "Abrir no Spotify".
    await expect(page.locator('a[href*="open.spotify.com"]')).toHaveCount(0);
    await expectNoSeriousA11y(page);
  });

  test('a troca de período fica abaixo de 200 ms (RNF-03)', async ({ page }) => {
    await page.goto('/pt-BR/demo');
    await expect(page.getByTestId('dashboard')).toBeVisible();
    const timings: number[] = [];
    for (const name of ['Sempre', 'Ano', 'Sempre', 'Ano']) {
      const radio = page.getByRole('radio', { name });
      const title = await page.getByTestId('dashboard-title').textContent();
      const elapsed = await radio.evaluate(async (element, before) => {
        const start = performance.now();
        (element as HTMLElement).click();
        const heading = document.querySelector('[data-testid="dashboard-title"]')!;
        while (heading.textContent === before) await new Promise((r) => requestAnimationFrame(r));
        return performance.now() - start;
      }, title);
      timings.push(elapsed);
    }
    console.log(`[period-switch] ${timings.map((t) => t.toFixed(0)).join(' / ')} ms`);
    expect(Math.max(...timings)).toBeLessThan(200);
  });

  test('as abas alternam entre as visões Upload e Conectar (EN)', async ({ page }) => {
    await page.goto('/en/demo');
    await expect(page.getByTestId('dashboard')).toBeVisible();
    await page.getByRole('tab', { name: 'Connect view' }).click();
    await expect(page.getByTestId('connect-title')).toHaveText('Hi, Demo');
    await page.getByRole('tab', { name: 'Upload view' }).click();
    await expect(page.getByTestId('dashboard')).toBeVisible();
  });

  test('mobile 360 px: sem scroll horizontal e barra inferior com o período', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/pt-BR/demo');
    await expect(page.getByTestId('dashboard')).toBeVisible();
    await expectNoHorizontalScroll(page);
    const bar = page.locator('[data-bottom-bar]');
    await expect(bar).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Compartilhar' })).toBeDisabled();
    await page.getByRole('button', { name: 'Ver como tabela' }).click();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11y(page);
  });

  test('trocar o idioma preserva os dados em memória', async ({ page }) => {
    await page.goto('/pt-BR/demo');
    await expect(page.getByTestId('dashboard')).toBeVisible();
    await page.getByRole('button', { name: /Trocar idioma/ }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en\/demo$/);
    await expect(page.getByTestId('dashboard-title')).toHaveText(/^Your \d{4}$/);
  });

  test('aba "Visão Conectar": o dashboard do Conectar com dados fictícios, sem marca do Spotify', async ({
    page,
  }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith('http://127.0.0.1:3000')) external.push(request.url());
    });
    await page.goto('/pt-BR/demo');
    await page.getByRole('tab', { name: 'Visão Conectar' }).click();
    const dashboard = page.getByTestId('connect-dashboard');
    await expect(dashboard).toHaveAttribute('data-mode', 'demo');
    await expect(page.getByTestId('connect-title')).toHaveText('Oi, Demo');
    await expect(page.getByTestId('connect-top-artists').getByRole('listitem')).toHaveCount(10);
    await expect(page.getByTestId('trends-up')).toBeVisible();
    await page.getByRole('button', { name: 'Descobrir' }).click();
    await expect(page.getByTestId('liked-winner')).toContainText(/músicas curtidas/);
    await expect(page.locator('a[href*="spotify.com"]')).toHaveCount(0);
    await expect(page.getByTestId('spotify-logo')).toHaveCount(0);
    expect(external).toEqual([]);
    await expectNoSeriousA11y(page);
  });
});
