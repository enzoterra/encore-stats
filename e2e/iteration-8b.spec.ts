import { expect, test, type Page } from '@playwright/test';

import {
  collectCspViolations,
  CONNECT_URL,
  expectNoHorizontalScroll,
  expectNoSeriousA11y,
  routeFakeCovers,
} from './support';

/**
 * Iteração 8b (pedidos do cliente após a produção):
 * - 8b.3: mais espaço horizontal entre os cards de métrica e as colunas, sem quebrar 360 px;
 * - 8b.4: "Desde o começo" e "Selecionar período" no Conectar como atalho para o histórico.
 */

async function gapsBetween(page: Page, selector: string): Promise<number[]> {
  return page.locator(selector).evaluateAll((nodes) => {
    const boxes = nodes.map((n) => n.getBoundingClientRect());
    const gaps: number[] = [];
    for (let i = 1; i < boxes.length; i += 1) {
      const prev = boxes[i - 1]!;
      const box = boxes[i]!;
      // Só vizinhos na mesma linha do grid.
      if (Math.abs(box.top - prev.top) < 2) gaps.push(Math.round(box.left - prev.right));
    }
    return gaps;
  });
}

/** Cada número dos totais cabe numa linha e não transborda o card. */
async function expectTotalsOnOneLine(page: Page): Promise<void> {
  const report = await page.locator('[data-testid^="total-"]').evaluateAll((nodes) =>
    nodes.map((n) => {
      const lineHeight = parseFloat(getComputedStyle(n).lineHeight);
      return {
        text: n.textContent,
        lines: Math.round(n.getBoundingClientRect().height / lineHeight),
        overflow: n.scrollWidth > n.clientWidth,
      };
    }),
  );
  expect(report.length).toBe(3);
  for (const item of report)
    expect(item, item.text ?? '').toMatchObject({ lines: 1, overflow: false });
}

test.describe('8b.3 · espaçamento horizontal do grid', () => {
  for (const width of [360, 768, 1024, 1440]) {
    test(`${width} px: gaps da escala, números numa linha e sem scroll horizontal`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/pt-BR/demo');
      await expect(page.getByTestId('dashboard')).toBeVisible();
      for (const mode of ['Ano', 'Sempre']) {
        await page.getByRole('radio', { name: mode, exact: true }).click();
        await expectTotalsOnOneLine(page);
        await expectNoHorizontalScroll(page);
      }
      // Totais: 12 px no mobile, 16 no tablet, 24 com a largura toda (md) e 12/16 na coluna do lg.
      const expected =
        width < 640 ? 12 : width < 768 ? 16 : width < 1024 ? 24 : width < 1280 ? 12 : 16;
      const totals = await gapsBetween(page, 'section[aria-labelledby="totals-title"] dl > div');
      expect(totals).toEqual([expected, expected]);
      // "Você por você": 12 px no mobile, 16 a partir do sm.
      const self = await gapsBetween(
        page,
        'section[aria-labelledby="self-title"] > .grid > div:not(.col-span-full)',
      );
      expect(self.length).toBeGreaterThan(0);
      for (const gap of self) expect(gap).toBe(width < 640 ? 12 : 16);
    });
  }

  test('Visão Conectar em 360 px: sem scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/pt-BR/demo');
    await page.getByRole('tab', { name: 'Visão Conectar' }).click();
    await expect(page.getByTestId('trends-up')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe('8b.4 · "Desde o começo" e "Selecionar período" no Conectar (Demo)', () => {
  test('explicam o limite, mantêm a janela e levam à Visão Upload já em "Sempre" (axe)', async ({
    page,
  }) => {
    const csp = collectCspViolations(page);
    const requests: string[] = [];
    await page.goto('/pt-BR/demo');
    await page.getByRole('tab', { name: 'Visão Conectar' }).click();
    await expect(page.getByTestId('connect-dashboard')).toHaveAttribute('data-mode', 'demo');
    await expect(page.getByTestId('trends-up')).toBeVisible();
    page.on('request', (request) => requests.push(request.url()));

    const windowGroup = page.getByRole('radiogroup', { name: 'Período do Spotify' });
    const allTime = page.getByRole('button', { name: 'Desde o começo' });
    await expect(allTime).toHaveAttribute('aria-expanded', 'false');
    await allTime.click();
    await expect(allTime).toHaveAttribute('aria-expanded', 'true');
    const panel = page.getByRole('region', {
      name: '“Desde o começo” pede o seu histórico completo',
    });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('só mostra três períodos');
    await expect(panel).toContainText('Você continua vendo: 4 semanas.');
    await expect(panel.getByRole('link', { name: 'Como pedir o histórico' })).toHaveAttribute(
      'href',
      '/pt-BR/onboarding',
    );
    // A janela real continua marcada, no seletor e na barra inferior.
    await expect(windowGroup.getByRole('radio', { name: '4 semanas' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByTestId('window-summary')).toContainText('4 semanas');
    await expect(
      page.getByText(
        'Desde o começo precisa do histórico completo. O período continua em 4 semanas.',
      ),
    ).toHaveAttribute('aria-live', 'polite');
    await expectNoSeriousA11y(page);

    // Nada de rede nova por causa do atalho: nem API, nem outra origem (o prefetch de rota dos
    // links do Next, na mesma origem, não traz dado nenhum).
    expect(
      requests.filter((url) => url.includes('/api/') || !url.startsWith('http://127.0.0.1:3000/')),
    ).toEqual([]);

    await panel.getByRole('button', { name: 'Ver na Visão Upload' }).click();
    await expect(page.getByRole('tab', { name: 'Visão Upload' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByTestId('dashboard-title')).toHaveText('Você, desde sempre');
    const all = page.getByRole('radio', { name: 'Sempre', exact: true });
    await expect(all).toHaveAttribute('aria-checked', 'true');
    await expect(all).toBeFocused();
    expect(csp).toEqual([]);
  });

  test('teclado: Tab chega aos atalhos, Enter abre, Esc fecha e o foco volta (EN)', async ({
    page,
  }) => {
    await page.goto('/en/demo');
    await page.getByRole('tab', { name: 'Connect view' }).click();
    await expect(page.getByTestId('trends-up')).toBeVisible();
    const checked = page
      .getByRole('radiogroup', { name: 'Spotify period' })
      .getByRole('radio', { name: '4 weeks' });
    await checked.focus();
    await page.keyboard.press('Tab');
    const allTime = page.getByRole('button', { name: 'All time' });
    await expect(allTime).toBeFocused();
    await page.keyboard.press('Tab');
    const custom = page.getByRole('button', { name: 'Custom range' });
    await expect(custom).toBeFocused();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('region', { name: '“Custom range” needs your full history' });
    await expect(panel).toBeVisible();
    await expect(custom).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(panel.getByRole('button', { name: 'Open the Upload view' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(custom).toBeFocused();
    await expect(custom).toHaveAttribute('aria-expanded', 'false');

    // "Custom range" → Visão Upload já no intervalo.
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Open the Upload view' }).click();
    const range = page.getByRole('radio', { name: 'Range', exact: true });
    await expect(range).toHaveAttribute('aria-checked', 'true');
    await expect(range).toBeFocused();
    await expect(page.getByLabel('From', { exact: true })).toBeVisible();
  });

  test('360 px: 5 opções sem cortar texto, aviso aberto sem scroll horizontal e barra com a janela', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/pt-BR/demo');
    await page.getByRole('tab', { name: 'Visão Conectar' }).click();
    await expect(page.getByTestId('trends-up')).toBeVisible();
    const options = page.locator(
      '[aria-label="Período do Spotify"] [role="radio"], [data-testid^="window-extra-"]',
    );
    await expect(options).toHaveCount(5);
    const clipped = await options.evaluateAll((nodes) =>
      nodes.filter((n) => n.scrollWidth > n.clientWidth).map((n) => n.textContent),
    );
    expect(clipped).toEqual([]);
    await page.getByRole('button', { name: 'Selecionar período' }).click();
    await expect(page.getByTestId('window-upsell')).toBeVisible();
    await expectNoHorizontalScroll(page);
    const bar = page.locator('[data-bottom-bar]');
    await expect(bar).toContainText('4 semanas');
    await page.getByRole('radio', { name: '1 ano' }).click();
    await expect(page.getByTestId('window-upsell')).toHaveCount(0);
    await expect(bar).toContainText('1 ano');
    await expectNoSeriousA11y(page);
  });
});

test.describe('8b.4 · Conectar com o mock do Spotify', () => {
  test.use({ baseURL: CONNECT_URL });

  test('o aviso leva ao upload real e ao passo a passo, sem chamar o BFF', async ({ page }) => {
    await routeFakeCovers(page);
    await page.goto('/pt-BR/connect');
    await page.getByTestId('connect-login').click();
    await expect(page.getByTestId('connect-dashboard')).toHaveAttribute('data-mode', 'live');
    await expect(page.getByTestId('connect-recent').getByRole('listitem').first()).toBeVisible();
    const bff: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/')) bff.push(request.url());
    });
    await page.getByRole('button', { name: 'Desde o começo' }).click();
    const panel = page.getByTestId('window-upsell');
    await expect(panel.getByRole('link', { name: 'Enviar meu histórico' })).toHaveAttribute(
      'href',
      '/pt-BR/upload',
    );
    await expect(panel.getByRole('link', { name: 'Como pedir o histórico' })).toHaveAttribute(
      'href',
      '/pt-BR/onboarding',
    );
    await expect(panel.getByRole('button', { name: 'Ver na Visão Upload' })).toHaveCount(0);
    await expectNoSeriousA11y(page);
    expect(bff).toEqual([]);
    await panel.getByRole('link', { name: 'Enviar meu histórico' }).click();
    await expect(page).toHaveURL(`${CONNECT_URL}/pt-BR/upload`);
  });
});
