import { expect, test } from '@playwright/test';

import { collectCspViolations, expectNoHorizontalScroll, expectNoSeriousA11y } from './support';

test.describe('landing (RF-01, US-01)', () => {
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

  for (const { locale, heading, modes, seal } of [
    {
      locale: 'pt-BR',
      heading: 'Seu ano em música. Quando você quiser.',
      seal: 'Seus dados ficam com você',
      modes: ['Enviar meu histórico', 'Conectar com Spotify', 'Ver demo'],
    },
    {
      locale: 'en',
      heading: 'Your year in music. Whenever you want.',
      seal: 'Your data stays with you',
      modes: ['Upload my history', 'Connect with Spotify', 'See the demo'],
    },
  ]) {
    test(`mostra os 3 modos e o selo de privacidade em ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      for (const mode of modes) {
        await expect(page.getByRole('heading', { level: 3, name: mode })).toBeVisible();
      }
      await expect(page.getByRole('heading', { level: 3, name: seal })).toBeVisible();
    });
  }

  test('sem credenciais, o Conectar aparece desabilitado com a explicação', async ({ page }) => {
    await page.goto('/pt-BR');
    const card = page.locator('[data-mode="connect"]');
    const button = card.getByRole('button', { name: 'Conectar com Spotify' });
    await expect(button).toBeDisabled();
    await expect(card).toContainText('Ainda não disponível neste site');
    await expect(button).toHaveAccessibleDescription(/ainda não ligou a conexão com o Spotify/);
  });

  test('os CTAs levam ao upload, ao onboarding e ao demo', async ({ page }) => {
    await page.goto('/pt-BR');
    await page
      .locator('[data-mode="upload"]')
      .getByRole('link', { name: 'Enviar meu histórico' })
      .click();
    await expect(page).toHaveURL(/\/pt-BR\/upload$/);
    await page.goBack();
    await page.getByRole('link', { name: 'Ainda não tenho o arquivo' }).click();
    await expect(page).toHaveURL(/\/pt-BR\/onboarding$/);
    await page.goto('/pt-BR');
    await page.locator('[data-mode="demo"]').getByRole('link', { name: 'Ver demo' }).click();
    await expect(page).toHaveURL(/\/pt-BR\/demo$/);
  });

  test('o selo compacto abre o expandido com o link da política', async ({ page }) => {
    await page.goto('/pt-BR');
    await page
      .getByRole('main')
      .getByRole('button', { name: /Tudo fica no seu aparelho/ })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Seus dados ficam com você');
    await expect(dialog.getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute(
      'href',
      /\/pt-BR\/privacy$/,
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('troca de idioma pelo menu (RF-23)', async ({ page }) => {
    await page.goto('/pt-BR');
    await page.getByRole('button', { name: /Trocar idioma/ }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Your year in music. Whenever you want.',
    );
  });

  test('logo (8b.9): lockup no cabeçalho e no rodapé, link para o início, favicons novos', async ({
    page,
    request,
  }) => {
    const csp = collectCspViolations(page);
    await page.goto('/pt-BR/demo');
    const home = page.getByRole('link', { name: 'Encore, página inicial' });
    await expect(home).toHaveAttribute('href', '/pt-BR');
    const logo = home.locator('svg[data-logo="encore"]');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('aria-hidden', 'true');
    // 12 px de altura, proporção fixa, sem `style` inline (CSP).
    const box = (await logo.boundingBox())!;
    expect(Math.round(box.height)).toBe(12);
    expect(box.width).toBeGreaterThanOrEqual(64);
    expect(await logo.getAttribute('style')).toBeNull();
    // Área de toque do link ≥ 24 px (WCAG 2.2).
    expect((await home.boundingBox())!.height).toBeGreaterThanOrEqual(24);
    // Cada cópia tem o próprio degradê (ids únicos na página).
    const ids = await page
      .locator('svg[data-logo="encore"] linearGradient')
      .evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ids).size).toBe(ids.length);
    await expect(page.locator('footer svg[data-logo="encore"]')).toBeVisible();
    await home.click();
    await expect(page).toHaveURL(/\/pt-BR$/);
    expect(csp).toEqual([]);

    // Favicons: símbolo em SVG, ICO com 16/32/48 e ícone de app de 180 px.
    await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
    const svg = await request.get('/icon.svg');
    expect(svg.ok()).toBe(true);
    expect(await svg.text()).toContain('#FF7A1A');
    const ico = await request.get('/favicon.ico');
    const bytes = await ico.body();
    expect(bytes.readUInt16LE(4)).toBe(3);
    expect([bytes[6], bytes[22], bytes[38]]).toEqual([16, 32, 48]);
    const apple = await request.get('/apple-icon.png');
    const png = await apple.body();
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([180, 180]);
  });

  test('envia CSP com nonce e os cabeçalhos de segurança', async ({ page }) => {
    const response = await page.goto('/pt-BR');
    const headers = response?.headers() ?? {};
    expect(headers['content-security-policy']).toMatch(
      /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
    );
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy']).toContain("worker-src 'self';");
    expect(headers['strict-transport-security']).toContain('max-age=63072000');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['permissions-policy']).toContain('camera=()');
  });

  test('nenhuma página viola a CSP ao hidratar', async ({ page }) => {
    const violations = collectCspViolations(page);
    for (const path of [
      '/pt-BR',
      '/pt-BR/onboarding',
      '/pt-BR/privacy',
      '/pt-BR/upload',
      '/pt-BR/demo',
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    await expect(page.getByTestId('dashboard')).toBeVisible();
    expect(violations).toEqual([]);
  });

  test('não tem violações de acessibilidade sérias ou críticas', async ({ page }) => {
    await page.goto('/pt-BR');
    await expectNoSeriousA11y(page);
  });

  test('360 px sem scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/pt-BR');
    await expectNoHorizontalScroll(page);
  });
});
