import { expect, test } from '@playwright/test';

import { collectCspViolations, expectNoHorizontalScroll, expectNoSeriousA11y } from './support';

/**
 * 404 localizado (S8.0; pendência da S7). Antes, o 404 padrão do Next era pré-renderizado sem o
 * nonce e saía com o JS bloqueado pela CSP. Agora ele passa pelo layout dinâmico do locale.
 */
const CASES = [
  {
    path: '/pt-BR/nao-existe',
    lang: 'pt-BR',
    heading: 'Esta página não existe',
    title: 'Página não encontrada · Encore',
  },
  {
    path: '/en/does-not-exist',
    lang: 'en',
    heading: 'This page does not exist',
    title: 'Page not found · Encore',
  },
  // Caminho com ponto: fora da 1ª entrada do matcher do proxy, coberto pela 2ª.
  {
    path: '/pt-BR/arquivo.txt',
    lang: 'pt-BR',
    heading: 'Esta página não existe',
    title: 'Página não encontrada · Encore',
  },
  // Abaixo de uma rota que existe.
  {
    path: '/en/connect/extra',
    lang: 'en',
    heading: 'This page does not exist',
    title: 'Page not found · Encore',
  },
] as const;

test.describe('404 localizado', () => {
  for (const { path, lang, heading, title } of CASES) {
    test(`${path}: 404 no idioma certo, com CSP com nonce e sem violações`, async ({ page }) => {
      const violations = collectCspViolations(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      expect(response?.headers()['content-security-policy']).toMatch(/script-src [^;]*'nonce-/);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page).toHaveTitle(title);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(page.getByTestId('not-found').getByRole('link')).toHaveCount(2);
      await page.waitForLoadState('networkidle');
      expect(violations).toEqual([]);
    });
  }

  test('o JS roda: o seletor de idioma troca para o inglês no mesmo caminho', async ({ page }) => {
    await page.goto('/pt-BR/nao-existe');
    await page.getByRole('button', { name: /Trocar idioma/ }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en\/nao-existe$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page does not exist');
  });

  test('os atalhos levam ao início e ao demo do mesmo idioma', async ({ page }) => {
    await page.goto('/en/does-not-exist');
    const main = page.getByTestId('not-found');
    await expect(main.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute(
      'href',
      '/en',
    );
    await expect(main.getByRole('link', { name: 'See the demo' })).toHaveAttribute(
      'href',
      '/en/demo',
    );
  });

  test('sem prefixo de idioma: redireciona pelo idioma do navegador e responde 404', async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale: 'pt-BR' });
    const page = await context.newPage();
    const response = await page.goto('/nao-existe');
    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL(/\/pt-BR\/nao-existe$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Esta página não existe');
    await context.close();
  });

  test('a URL pedida não aparece na página', async ({ page }) => {
    await page.goto('/pt-BR/%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Esta página não existe');
    await expect(page.locator('main')).not.toContainText('alert');
  });

  test('acessível e sem scroll horizontal em 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/pt-BR/nao-existe');
    // O Next entrega um shell de erro e o React monta a página no cliente: espera a montagem.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Esta página não existe');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expectNoSeriousA11y(page);
    await expectNoHorizontalScroll(page);
  });
});
