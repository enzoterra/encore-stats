import { readFile } from 'node:fs/promises';

import { expect, test, type Download, type Page } from '@playwright/test';

import { decodePng, gradientPng, pngSize } from '../tests/support/png';
import {
  collectCspViolations,
  CONNECT_URL,
  expectNoHorizontalScroll,
  expectNoSeriousA11y,
  fixture,
} from './support';

/**
 * Cards e compartilhamento (RF-20..RF-22, US-11): o PNG é gerado no navegador (worker com satori +
 * resvg-wasm), sem rede além dos arquivos do próprio site, e baixado quando não há Web Share.
 */

async function pngOf(file: Download): Promise<Uint8Array> {
  return new Uint8Array(await readFile((await file.path())!));
}

async function waitReady(page: Page) {
  const preview = page.getByTestId('share-preview');
  await expect(preview).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
  return preview;
}

async function download(page: Page): Promise<{ name: string; png: Uint8Array }> {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('share-download').click(),
  ]);
  return { name: file.suggestedFilename(), png: await pngOf(file) };
}

test.describe('cards (US-11)', () => {
  test('demo: pipeline só no toque; Festival 9:16 → PNG 1080×1920; troca de formato e template', async ({
    page,
    browserName,
  }) => {
    const csp = collectCspViolations(page);
    const requests: string[] = [];
    page.on('request', (request) => requests.push(new URL(request.url()).pathname));
    await page.goto('/pt-BR/demo');
    await expect(page.getByTestId('dashboard')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // RNF-03: nada do pipeline no carregamento inicial.
    expect(requests.filter((p) => /\.wasm$|\/fonts\/ttf\//.test(p))).toEqual([]);
    const before = requests.length;

    const started = Date.now();
    await page.getByTestId('share-open').first().click();
    const dialog = page.getByRole('dialog', { name: 'Compartilhar' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Compartilhar' })).toBeFocused();
    await expect(dialog.getByRole('radio', { name: 'Festival' })).toHaveAttribute(
      'data-state',
      'on',
    );
    await expect(dialog.getByRole('radio', { name: 'Stories 9:16' })).toHaveAttribute(
      'data-state',
      'on',
    );
    const preview = await waitReady(page);
    console.log(
      `[cards] ${browserName}: 1º card (clique → prévia) ${Date.now() - started} ms; worker ${await preview.getAttribute('data-render-ms')} ms`,
    );

    // Arquivos do pipeline vieram do próprio site, só depois do toque.
    const after = requests.slice(before);
    expect(after.filter((p) => p.endsWith('.wasm'))).toHaveLength(2);
    expect(after.filter((p) => p.startsWith('/fonts/ttf/'))).toHaveLength(6);
    await expect(dialog.getByRole('img', { name: /^Card Festival:/ })).toBeVisible();
    await expect(dialog.getByText('Card marcado como DEMO.').first()).toBeAttached();

    const story = await download(page);
    expect(story.name).toMatch(/^encore-festival-stories-\d{4}\.png$/);
    expect(pngSize(story.png)).toEqual({ width: 1080, height: 1920 });
    await expect(page.getByTestId('share-done')).toHaveText('PNG baixado');

    await dialog.getByRole('radio', { name: 'Quadrado 1:1' }).click();
    await waitReady(page);
    // A barra de ações nunca cobre a prévia (desktop: duas colunas).
    const previewBox = (await page.getByTestId('share-preview').boundingBox())!;
    const actionsBox = (await page.getByTestId('share-actions').boundingBox())!;
    expect(previewBox.y + previewBox.height).toBeLessThanOrEqual(actionsBox.y + 1);
    const square = await download(page);
    expect(square.name).toMatch(/^encore-festival-square-\d{4}\.png$/);
    expect(pngSize(square.png)).toEqual({ width: 1080, height: 1080 });

    // Básico, já com o pipeline quente.
    await dialog.getByRole('radio', { name: 'Básico' }).click();
    await expect(dialog.getByLabel('Nome no cartaz')).toHaveCount(0);
    const warm = await waitReady(page);
    console.log(
      `[cards] ${browserName}: card seguinte (worker quente) ${await warm.getAttribute('data-render-ms')} ms`,
    );
    expect(pngSize((await download(page)).png)).toEqual({ width: 1080, height: 1080 });

    await expectNoSeriousA11y(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('share-open').first()).toBeFocused();
    expect(csp).toEqual([]);
  });

  test('mobile: ≤ 3 toques (Compartilhar → Baixar/Compartilhar), sem scroll horizontal', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/pt-BR/demo');
    await expect(page.getByTestId('dashboard')).toBeVisible();
    // 1º toque: barra inferior.
    await page.locator('[data-bottom-bar]').getByTestId('share-open').click();
    const dialog = page.getByRole('dialog', { name: 'Compartilhar' });
    await expect(dialog).toBeVisible();
    await waitReady(page);
    await expectNoHorizontalScroll(page);
    // O primário fica visível sem rolar (ações fixas na base do sheet).
    const primary = page.getByTestId('share-download');
    await expect(primary).toBeInViewport();
    expect((await primary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // 2º toque: baixar (o navegador do teste não tem Web Share com arquivo).
    const [file] = await Promise.all([page.waitForEvent('download'), primary.click()]);
    expect(pngSize(await pngOf(file))).toEqual({ width: 1080, height: 1920 });
    await expectNoSeriousA11y(page);
  });

  test('nome no cartaz: validação inline e o nome entra no card gerado', async ({ page }) => {
    await page.goto('/pt-BR/demo');
    await page.getByTestId('share-open').first().click();
    await waitReady(page);
    const field = page.getByLabel('Nome no cartaz');
    await field.fill('<b>oi</b>');
    await expect(page.getByText(/Use só letras, números/)).toBeVisible();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await field.fill('Encore do Enzo');
    await expect(field).not.toHaveAttribute('aria-invalid');
    await expect(page.getByTestId('share-preview')).toHaveAttribute('data-state', 'generating');
    await waitReady(page);
    expect(pngSize((await download(page)).png)).toEqual({ width: 1080, height: 1920 });
  });

  test('upload: o card sai do histórico enviado, sem rede para fora', async ({ page, baseURL }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (/^https?:$/.test(url.protocol) && url.origin !== new URL(baseURL!).origin) {
        external.push(request.url());
      }
    });
    await page.goto('/pt-BR/upload');
    await page
      .getByLabel('Escolher o arquivo do histórico (.zip ou .json)')
      .setInputFiles(fixture('valid-two-files.zip'));
    await expect(page.getByTestId('dashboard')).toBeVisible();
    await page.getByTestId('share-open').first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'Básico' }).click();
    await dialog.getByRole('radio', { name: 'Quadrado 1:1' }).click();
    await waitReady(page);
    await expect(
      dialog.getByText('Gerado no seu aparelho, sem enviar nada.').first(),
    ).toBeAttached();
    const card = await download(page);
    expect(card.name).toBe('encore-basic-square-2024.png');
    expect(pngSize(card.png)).toEqual({ width: 1080, height: 1080 });
    expect(external).toEqual([]);
  });
});

test.describe('card do Conectar (mock do Spotify)', () => {
  test.use({ baseURL: CONNECT_URL });

  async function login(page: Page) {
    await page.goto('/pt-BR/connect');
    await page.getByTestId('connect-login').click();
    await expect(page.getByTestId('connect-dashboard')).toBeVisible();
    await expect(
      page.getByTestId('connect-top-artists').getByRole('listitem').first(),
    ).toBeVisible();
  }

  test('Básico 9:16 com a capa da nº 1 (fetch direto do i.scdn.co, ADR 9), sem violar a CSP', async ({
    page,
  }) => {
    const csp = collectCspViolations(page);
    const covers: string[] = [];
    // Responde como o CDN real: PNG/JPEG com `Access-Control-Allow-Origin: *`.
    await page.context().route('https://i.scdn.co/**', (route) => {
      covers.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'access-control-allow-origin': '*' },
        body: gradientPng(300, [61, 224, 255], [122, 43, 255]),
      });
    });
    await login(page);

    await page.getByTestId('share-open').first().click();
    const dialog = page.getByRole('dialog', { name: 'Compartilhar' });
    await waitReady(page);
    await expect(dialog.getByText('Inclui a atribuição ao Spotify.').first()).toBeAttached();
    const before = covers.length;
    await dialog.getByRole('radio', { name: 'Básico' }).click();
    await waitReady(page);
    expect(covers.length).toBeGreaterThan(before);
    expect(covers.at(-1)).toMatch(/^https:\/\/i\.scdn\.co\/image\/mock/);

    const card = await download(page);
    expect(card.name).toBe('encore-basic-stories-ultimas-4-semanas.png');
    const image = decodePng(card.png);
    expect([image.width, image.height]).toEqual([1080, 1920]);
    // A área da capa (260 × 260, à direita dos artistas) tem a cor do gradiente.
    let found = false;
    for (let y = 520; y < 1000 && !found; y += 10) {
      for (let x = 740; x < 1008 && !found; x += 10) {
        const o = (y * image.width + x) * 4;
        const [r, g, b] = [image.rgba[o]!, image.rgba[o + 1]!, image.rgba[o + 2]!];
        if (Math.abs(r - 92) < 30 && Math.abs(g - 134) < 30 && Math.abs(b - 255) < 30) found = true;
      }
    }
    expect(found).toBe(true);
    expect(csp).toEqual([]);
  });

  test('sem CORS a capa falha em silêncio e o card sai tipográfico', async ({ page }) => {
    await page.context().route('https://i.scdn.co/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: gradientPng(8, [0, 0, 0], [0, 0, 0]),
      }),
    );
    await login(page);
    await page.getByTestId('share-open').first().click();
    await page.getByRole('dialog').getByRole('radio', { name: 'Básico' }).click();
    await waitReady(page);
    expect(pngSize((await download(page)).png)).toEqual({ width: 1080, height: 1920 });
  });
});
