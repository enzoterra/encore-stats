import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('página provisória', () => {
  test('a raiz redireciona conforme o idioma do navegador', async ({ browser }) => {
    for (const [browserLocale, expected] of [
      ['pt-BR', /\/pt-BR$/],
      ['en-US', /\/en$/],
      ['fr-FR', /\/pt-BR$/], // idioma não suportado cai no padrão
    ] as const) {
      const context = await browser.newContext({ locale: browserLocale });
      const page = await context.newPage();
      await page.goto('/');
      await expect(page).toHaveURL(expected);
      await context.close();
    }
  });

  for (const { locale, heading, status } of [
    { locale: 'pt-BR', heading: 'Encore', status: /indisponível neste ambiente/ },
    { locale: 'en', heading: 'Encore', status: /unavailable in this environment/ },
  ]) {
    test(`renderiza em ${locale} com textos traduzidos`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(page.getByRole('status')).toHaveText(status);
    });
  }

  test('troca de idioma pelo link', async ({ page }) => {
    await page.goto('/pt-BR');
    await page.getByRole('link', { name: 'Read in English' }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('envia CSP com nonce e os cabeçalhos de segurança', async ({ page }) => {
    const response = await page.goto('/pt-BR');
    const headers = response?.headers() ?? {};
    expect(headers['content-security-policy']).toMatch(
      /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
    );
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['strict-transport-security']).toContain('max-age=63072000');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['permissions-policy']).toContain('camera=()');
  });

  test('não viola a CSP ao hidratar', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
        violations.push(message.text());
      }
    });
    await page.goto('/pt-BR');
    await page.waitForLoadState('networkidle');
    expect(violations).toEqual([]);
  });

  test('não tem violações de acessibilidade sérias ou críticas', async ({ page }) => {
    await page.goto('/pt-BR');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious.map((v) => v.id)).toEqual([]);
  });
});
