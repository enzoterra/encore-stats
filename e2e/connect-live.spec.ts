import { expect, test, type Page } from '@playwright/test';

import {
  collectCspViolations,
  CONNECT_URL,
  expectNoHorizontalScroll,
  expectNoSeriousA11y,
  routeFakeCovers,
} from './support';

/**
 * Modo Conectar de ponta a ponta contra o mock local do Spotify (`scripts/spotify-mock-server.ts`,
 * 2º e 3º `webServer` do Playwright): OAuth com PKCE de verdade, cookie JWE, BFF e UI.
 * Nenhuma conta real e nenhum acesso à internet (as capas do mock são respondidas localmente).
 */
test.use({ baseURL: CONNECT_URL });

async function login(page: Page) {
  await routeFakeCovers(page);
  await page.goto('/pt-BR/connect');
  await page.getByTestId('connect-login').click();
  await expect(page).toHaveURL(`${CONNECT_URL}/pt-BR/connect`);
  await expect(page.getByTestId('connect-dashboard')).toBeVisible();
  await expect(page.getByTestId('connect-title')).toHaveText('Oi, Pessoa Fictícia');
}

test.describe('Conectar com o mock do Spotify (US-08, US-09, US-10)', () => {
  test('login → dashboard → trocar janela → varredura → logout com cache limpo', async ({
    page,
    context,
  }) => {
    const csp = collectCspViolations(page);
    await login(page);

    // Tops com atribuição: logo oficial na seção e cada linha abre o Spotify em nova aba.
    const top = page.getByTestId('connect-top-artists');
    await expect(top.getByRole('listitem').first()).toContainText('Banda Fictícia 21');
    const firstLink = top.getByRole('link').first();
    await expect(firstLink).toHaveAttribute('href', /^https:\/\/open\.spotify\.com\/artist\//);
    await expect(firstLink).toHaveAttribute('target', '_blank');
    await expect(
      page.getByTestId('connect-top').getByRole('img', { name: 'Spotify' }),
    ).toBeVisible();
    // Capas quadradas, sem corte (`object-fit: contain`).
    const cover = top.locator('img').first();
    await expect(cover).toHaveCSS('object-fit', 'contain');

    // Tendências (4 semanas × 6 meses), tocadas recentemente e gêneros.
    await expect(page.getByTestId('trends-up')).toContainText('novo');
    await expect(page.getByTestId('connect-recent')).toContainText('Faixa Inventada 1');
    await expect(page.getByRole('heading', { name: 'Seus gêneros' })).toBeVisible();

    // Trocar de janela: 6 meses tem outra ordem.
    await page.getByRole('radio', { name: '6 meses' }).click();
    await expect(top.getByRole('listitem').first()).toContainText('Banda Fictícia 1');
    await expect(page.getByTestId('window-summary')).toHaveText(/6 meses/);

    // Varredura de curtidas: progresso por página e resultado.
    await page.getByRole('button', { name: 'Descobrir' }).click();
    await expect(page.getByRole('progressbar')).toBeVisible();
    const winner = page.getByTestId('liked-winner');
    await expect(winner).toContainText('Banda Fictícia 1', { timeout: 15_000 });
    await expect(winner).toContainText(/\d+ músicas curtidas/);
    expect(await page.evaluate(() => window.sessionStorage.length)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.localStorage.length)).toBe(0);

    // O cookie de sessão é HttpOnly: o JS da página não o enxerga.
    expect(await page.evaluate(() => document.cookie)).not.toContain('encore_');

    // Logout: confirmação → POST same-origin → a rota recarrega sem sessão e sem cache.
    await page.getByRole('button', { name: /Conta: Pessoa Fictícia/ }).click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Sair apaga a sessão e o cache desta aba');
    await dialog.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/pt-BR\/connect\?status=logged_out$/);
    await expect(page.getByRole('main').getByRole('status')).toContainText('Você saiu');
    await expect(page.getByTestId('connect-login')).toBeVisible();
    expect(await page.evaluate(() => window.sessionStorage.length)).toBe(0);
    const cookies = await context.cookies();
    expect(cookies.map((c) => c.name)).not.toContain('encore_session');
    const me = await page.evaluate(async () => (await fetch('/api/spotify/me')).status);
    expect(me).toBe(401);
    expect(csp).toEqual([]);
  });

  test('axe e 360 px sem scroll horizontal: entrada e dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await routeFakeCovers(page);
    await page.goto('/pt-BR/connect');
    await expectNoSeriousA11y(page);
    await expectNoHorizontalScroll(page);
    await page.getByTestId('connect-login').click();
    await expect(page.getByTestId('connect-top-artists')).toBeVisible();
    await expect(page.getByTestId('connect-recent').getByRole('listitem').first()).toBeVisible();
    await expectNoSeriousA11y(page);
    await expectNoHorizontalScroll(page);
  });

  test('QUOTA: banner global e seções pausadas; o resto da página continua de pé', async ({
    page,
  }) => {
    await page.route('**/api/spotify/recent', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'QUOTA', retryAfter: 900 } }),
      }),
    );
    await login(page);
    const banner = page.getByTestId('quota-banner');
    await expect(banner).toContainText('Limite de consultas do app atingido');
    await expect(banner).toContainText('~15 min');
    await expect(banner.getByRole('link', { name: 'Enviar meu histórico' })).toBeVisible();
    await expect(page.getByTestId('connect-top-artists')).toBeVisible();
  });

  test('sessão expirada (401): pede para conectar de novo', async ({ page }) => {
    await login(page);
    await page.route('**/api/spotify/top?type=tracks*', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }),
      }),
    );
    await page.getByTestId('connect-top').getByRole('radio', { name: 'Músicas' }).click();
    await expect(page.getByRole('heading', { name: 'Sua sessão expirou' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Conectar de novo' })).toHaveAttribute(
      'href',
      '/api/auth/login?locale=pt-BR',
    );
  });
});
