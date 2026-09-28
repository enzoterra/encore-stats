import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { expectNoHorizontalScroll, expectNoSeriousA11y } from './support';

test.describe('privacidade (RF-24, US-13)', () => {
  test('explica o que é tratado, onde, por quanto tempo e como revogar', async ({ page }) => {
    await page.goto('/pt-BR/privacy');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacidade');
    for (const title of [
      'Quem cuida dos seus dados',
      'Quais dados usamos',
      'Onde os dados ficam',
      'Por quanto tempo',
      'Por que podemos usar esses dados',
      'Seus direitos e como cancelar o acesso',
    ]) {
      await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible();
    }
    const revoke = page.getByRole('link', { name: /spotify\.com\/account\/apps/ });
    await expect(revoke).toHaveAttribute('href', 'https://www.spotify.com/account/apps/');
    await expect(revoke).toHaveAttribute('rel', 'noopener noreferrer');
    await expectNoSeriousA11y(page);
  });

  test('versão em inglês', async ({ page }) => {
    await page.goto('/en/privacy');
    await expect(
      page.getByRole('heading', { level: 2, name: 'Your rights and how to cancel access' }),
    ).toBeVisible();
  });
});

test.describe('onboarding (RF-02, US-02)', () => {
  test('passos, aviso de espera e atalhos para demo e conectar', async ({ page }) => {
    await page.goto('/pt-BR/onboarding');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Peça seu histórico ao Spotify',
    );
    await expect(
      page.getByText('O Spotify pode levar até 30 dias para mandar.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(6);
    await expect(page.getByText('Histórico de streaming estendido', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /spotify\.com\/account\/privacy/ }),
    ).toHaveAttribute('href', 'https://www.spotify.com/account/privacy/');
    await expect(page.getByRole('link', { name: 'Ver demo' })).toHaveAttribute(
      'href',
      /\/pt-BR\/demo$/,
    );
    await expect(page.getByRole('button', { name: 'Conectar com Spotify' })).toBeDisabled();
    await expectNoSeriousA11y(page);
  });

  test('o lembrete .ics é gerado no navegador, sem rede', async ({ page }) => {
    await page.goto('/pt-BR/onboarding');
    await page.waitForLoadState('networkidle');
    // O prefetch de links do Next (GET same-origin, sem corpo) é permitido; nada mais.
    const requests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      const prefetch =
        request.method() === 'GET' &&
        url.origin === 'http://127.0.0.1:3000' &&
        url.searchParams.has('_rsc');
      if (!prefetch && url.protocol !== 'blob:')
        requests.push(`${request.method()} ${request.url()}`);
    });
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar lembrete para a agenda' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('encore-lembrete.ics');
    expect(download.url()).toMatch(/^blob:/);
    const content = await readFile((await download.path())!, 'utf8');
    expect(content).toContain('BEGIN:VCALENDAR');
    expect(content).toContain('RRULE:FREQ=WEEKLY;COUNT=5');
    expect(content).toMatch(/URL:http:\/\/127\.0\.0\.1:3000\/pt-BR\/upload/);
    await expect(page.getByTestId('toast')).toContainText('Lembrete baixado. Nada foi enviado.');
    expect(requests).toEqual([]);
  });

  test('360 px sem scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    for (const path of ['/pt-BR/onboarding', '/pt-BR/privacy', '/en/onboarding']) {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    }
  });
});
