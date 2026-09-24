import { expect, type Request, test } from '@playwright/test';

import {
  collectCspViolations,
  expectNoHorizontalScroll,
  expectNoSeriousA11y,
  fixture,
} from './support';

test.describe('upload (RF-03..RF-05, US-03)', () => {
  test('a fixture válida vira o dashboard, com aviso de recarga e relatório', async ({ page }) => {
    const csp = collectCspViolations(page);
    await page.goto('/pt-BR/upload');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Envie seu histórico');
    await page
      .getByLabel('Escolher o arquivo do histórico (.zip ou .json)')
      .setInputFiles(fixture('valid-two-files.zip'));
    const dashboard = page.getByTestId('dashboard');
    await expect(dashboard).toBeVisible();
    await expect(dashboard).toHaveAttribute('data-mode', 'upload');
    // A fixture tem 2023 e 2024: abre no ano mais recente.
    await expect(page.getByTestId('dashboard-title')).toHaveText('Seu 2024');
    await expect(page.getByTestId('dashboard-title')).toBeFocused();
    await expect(page.getByText('Seus dados ficam só nesta aba.', { exact: false })).toBeVisible();
    await expect(page.getByTestId('upload-report')).toContainText('de 2 arquivos');
    await expect(page.getByTestId('toast')).toContainText('Pronto!');
    await expect(page.locator('a[href*="open.spotify.com"]')).toHaveCount(0);
    await expectNoSeriousA11y(page);
    expect(csp).toEqual([]);

    // Recarregar apaga o histórico (só em memória).
    await page.reload();
    await expect(page.getByTestId('dropzone')).toBeVisible();

    // "Enviar outro arquivo" volta à dropzone.
    await page
      .getByLabel('Escolher o arquivo do histórico (.zip ou .json)')
      .setInputFiles(fixture('valid-two-files.zip'));
    await page.getByRole('button', { name: 'Enviar outro arquivo' }).click();
    await expect(page.getByTestId('dropzone')).toBeVisible();
  });

  test('aceita os Streaming_History_Audio_*.json soltos', async ({ page }) => {
    await page.goto('/en/upload');
    await page
      .getByLabel('Choose your history file (.zip or .json)')
      .setInputFiles(fixture('loose/Streaming_History_Audio_2025_0.json'));
    await expect(page.getByTestId('dashboard-title')).toHaveText('Your 2025');
  });

  for (const { file, code, title } of [
    {
      file: 'zip-bomb.zip',
      code: 'COMPRESSION_RATIO',
      title: 'Arquivo grande demais ou fora do padrão',
    },
    { file: 'path-traversal.zip', code: 'UNSAFE_PATH', title: 'Arquivo fora do padrão' },
    { file: 'invalid-json.zip', code: 'INVALID_JSON', title: 'Um dos arquivos está corrompido' },
    {
      file: 'unexpected-format.zip',
      code: 'UNEXPECTED_FORMAT',
      title: 'O formato mudou ou o arquivo não é do Spotify',
    },
    {
      file: 'not-history.zip',
      code: 'NO_HISTORY_FILES',
      title: 'Esse zip não tem o histórico estendido',
    },
    { file: 'account-data.zip', code: 'WRONG_EXPORT', title: 'Esse é o pacote "Dados da conta"' },
  ]) {
    test(`recusa ${file} com mensagem útil (${code})`, async ({ page }) => {
      await page.goto('/pt-BR/upload');
      await page
        .getByLabel('Escolher o arquivo do histórico (.zip ou .json)')
        .setInputFiles(fixture(file));
      const alert = page.getByRole('main').getByRole('alert');
      await expect(alert).toBeVisible();
      await expect(alert.getByRole('heading')).toHaveText(title);
      await expect(alert.locator(`[data-error-code="${code}"]`)).toBeVisible();
      await expect(page.getByTestId('dashboard')).toHaveCount(0);
      // Nada quebra: a dropzone continua disponível e um arquivo bom funciona em seguida.
      await page
        .getByLabel('Escolher o arquivo do histórico (.zip ou .json)')
        .setInputFiles(fixture('valid-two-files.zip'));
      await expect(page.getByTestId('dashboard')).toBeVisible();
    });
  }

  test('o zip malicioso não quebra a acessibilidade nem o layout em 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/pt-BR/upload');
    await expectNoHorizontalScroll(page);
    await page
      .getByLabel('Escolher o arquivo do histórico (.zip ou .json)')
      .setInputFiles(fixture('zip-bomb.zip'));
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11y(page);
  });

  test('extensão não aceita é recusada antes de ler', async ({ page }) => {
    await page.goto('/pt-BR/upload');
    await page.getByLabel('Escolher o arquivo do histórico (.zip ou .json)').setInputFiles({
      name: 'foto.png',
      mimeType: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    await expect(page.getByRole('main').getByRole('alert').getByRole('heading')).toHaveText(
      'Esse tipo de arquivo não é aceito',
    );
  });
});

/**
 * RNF-01 / US-03: "durante e depois do upload, nenhuma requisição de rede leva o conteúdo".
 * Todas as requisições do contexto (página e worker) são interceptadas a partir da escolha do
 * arquivo. O teste falha se houver método diferente de GET/HEAD, qualquer corpo, WebSocket,
 * outra origem ou um caminho fora dos assets e das rotas de página do próprio app.
 */
test.describe('privacidade de rede do upload (RNF-01)', () => {
  test('o upload não envia dados a lugar nenhum', async ({ page, context, baseURL }) => {
    await page.goto('/pt-BR/upload');
    await page.waitForLoadState('networkidle');

    const seen: Request[] = [];
    const sockets: string[] = [];
    await context.route('**/*', async (route) => {
      seen.push(route.request());
      await route.continue();
    });
    context.on('request', (request) => {
      if (!seen.includes(request)) seen.push(request);
    });
    page.on('websocket', (ws) => sockets.push(ws.url()));

    await page
      .getByLabel('Escolher o arquivo do histórico (.zip ou .json)')
      .setInputFiles([
        fixture('valid-two-files.zip'),
        fixture('loose/Streaming_History_Audio_2025_0.json'),
      ]);
    await expect(page.getByTestId('dashboard')).toBeVisible();

    // Depois do upload: interações que recalculam tudo no cliente.
    await page.getByRole('radio', { name: 'Sempre' }).click();
    await page.getByRole('radio', { name: 'Músicas' }).click();
    await page.getByRole('button', { name: 'Ver como tabela' }).click();
    await page.getByRole('radio', { name: 'Mês' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const origin = new URL(baseURL!).origin;
    const allowedPath = /^\/(_next\/static\/|fonts\/|favicon\.ico$|(pt-BR|en)(\/[a-z]*)?$)/;
    const problems: string[] = [];
    for (const request of seen) {
      const url = new URL(request.url());
      if (url.protocol === 'blob:' || url.protocol === 'data:') continue;
      const label = `${request.method()} ${request.url()}`;
      if (!['GET', 'HEAD'].includes(request.method())) problems.push(`método: ${label}`);
      if (request.postDataBuffer()) problems.push(`corpo: ${label}`);
      if (url.origin !== origin) problems.push(`origem: ${label}`);
      if (!allowedPath.test(url.pathname)) problems.push(`caminho: ${label}`);
      const params = [...url.searchParams.keys()].filter((key) => key !== '_rsc');
      if (params.length > 0) problems.push(`query: ${label}`);
    }
    console.log(
      `[network] ${seen.length} requisições após escolher o arquivo; ${problems.length} problemas`,
    );
    expect(problems).toEqual([]);
    expect(sockets).toEqual([]);
  });
});
