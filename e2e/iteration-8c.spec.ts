import { expect, test, type Page } from '@playwright/test';

import {
  collectCspViolations,
  CONNECT_URL,
  expectNoHorizontalScroll,
  expectNoSeriousA11y,
  fixture,
  routeFakeCovers,
} from './support';

/** Iteração 8c.4: contatos do autor no rodapé de todas as páginas (portfólio). */

const PAGES = ['/pt-BR', '/pt-BR/demo', '/pt-BR/upload', '/pt-BR/onboarding', '/pt-BR/privacy'];

async function expectAuthorLinks(page: Page): Promise<void> {
  const nav = page.getByRole('contentinfo').getByRole('navigation', { name: 'Fale comigo' });
  await expect(nav).toBeVisible();
  await expect(page.getByTestId('footer-author')).toContainText('Feito por Enzo Terra');
  await expect(nav.getByRole('link')).toHaveCount(3);
  await expect(nav.getByRole('link', { name: 'E-mail: enzoterra18@gmail.com' })).toHaveAttribute(
    'href',
    'mailto:enzoterra18@gmail.com',
  );
  for (const [name, href] of [
    ['GitHub: enzoterra (abre em nova aba)', 'https://github.com/enzoterra'],
    ['Site pessoal: enzoterra.dev.br (abre em nova aba)', 'https://enzoterra.dev.br'],
  ] as const) {
    const link = nav.getByRole('link', { name });
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  // Alvo de toque de 44 px.
  for (const box of await nav
    .getByRole('link')
    .evaluateAll((links) => links.map((l) => l.getBoundingClientRect().height))) {
    expect(box).toBeGreaterThanOrEqual(44);
  }
}

test.describe('8c.4 · contatos do autor no rodapé', () => {
  for (const path of PAGES) {
    test(`${path}: bloco de autoria com e-mail, GitHub e site`, async ({ page }) => {
      await page.goto(path);
      await expectAuthorLinks(page);
    });
  }

  test('360 px na demo: sem rolagem horizontal, axe limpo e fora da barra inferior fixa', async ({
    page,
  }) => {
    const csp = collectCspViolations(page);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/pt-BR/demo');
    await expect(page.getByTestId('dashboard')).toBeVisible();
    await expectAuthorLinks(page);
    await expectNoHorizontalScroll(page);

    // Rolando até o fim, o último contato fica inteiro acima da barra de ação do mobile.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const bar = (await page.locator('[data-bottom-bar]').boundingBox())!;
    const last = page.getByRole('link', { name: /^Site pessoal/ });
    await expect(last).toBeInViewport();
    const box = (await last.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(bar.y);

    // Foco visível pelo teclado.
    await last.focus();
    const outline = await last.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');

    await expectNoSeriousA11y(page);
    expect(csp).toEqual([]);
  });

  test('360 px na página inicial em inglês: rótulos, axe e sem rolagem horizontal', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/en');
    await expect(page.getByTestId('footer-author')).toContainText('Made by Enzo Terra');
    const nav = page.getByRole('navigation', { name: 'Get in touch' });
    await expect(nav.getByRole('link', { name: 'Email: enzoterra18@gmail.com' })).toBeVisible();
    await expect(
      nav.getByRole('link', { name: 'GitHub: enzoterra (opens in a new tab)' }),
    ).toBeVisible();
    await expect(
      nav.getByRole('link', { name: 'Website: enzoterra.dev.br (opens in a new tab)' }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11y(page);
  });

  test('Conectar: landing e painel (mock) a 360 px, fora da barra inferior fixa', async ({
    page,
  }) => {
    await page.goto(`${CONNECT_URL}/pt-BR/connect`);
    await expectAuthorLinks(page);

    await routeFakeCovers(page);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.getByTestId('connect-login').click();
    await expect(page.getByTestId('connect-dashboard')).toBeVisible();
    await expectAuthorLinks(page);
    await expectNoHorizontalScroll(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const bar = (await page.locator('[data-bottom-bar]').boundingBox())!;
    const last = page.getByRole('link', { name: /^Site pessoal/ });
    await expect(last).toBeInViewport();
    const box = (await last.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(bar.y);
  });

  test('404: rodapé com os contatos', async ({ page }) => {
    await page.goto('/pt-BR/nao-existe');
    await expectAuthorLinks(page);
  });
});

/** Iteração 8c.5b: curtidas do export "Dados da conta" no modo Upload e na demo. */
const PICK_HISTORY = 'Escolher o arquivo do Spotify (.zip ou .json)';
const PICK_LIKED = 'Escolher o arquivo "Dados da conta" do Spotify (.zip ou .json)';

async function expectLikedBoard(page: Page): Promise<void> {
  const section = page.getByTestId('liked-section');
  await expect(section).toBeVisible();
  await expect(section.getByRole('heading', { level: 2 })).toHaveText('Suas curtidas');
  await expect(section).toContainText('Todas as suas curtidas, de qualquer época.');
  await expect(page.getByTestId('liked-winner')).toContainText('Capivara Cósmica');
  await expect(page.getByTestId('liked-winner')).toContainText('7 músicas curtidas');
  await expect(page.getByTestId('liked-total')).toHaveText(
    '30 músicas curtidas de 10 artistas, no total.',
  );
  const others = section.getByRole('list', { name: 'Artistas com mais músicas curtidas' });
  await expect(others.getByRole('listitem')).toHaveCount(9);
  // Upload: sem capa nem link do Spotify.
  await expect(section.locator('img')).toHaveCount(0);
  await expect(section.locator('a')).toHaveCount(0);
}

test.describe('8c.5b · curtidas no modo Upload', () => {
  test('histórico + "Dados da conta" no mesmo envio: painel com o quadro', async ({ page }) => {
    const csp = collectCspViolations(page);
    await page.goto('/pt-BR/upload');
    const hint = page.getByTestId('liked-hint');
    await expect(hint).toContainText('"Dados da conta"');
    await expect(hint.getByRole('link', { name: 'Como pedir esse arquivo' })).toHaveAttribute(
      'href',
      '/pt-BR/onboarding#dados-da-conta',
    );
    await page.getByLabel(PICK_HISTORY).setInputFiles(fixture('history-and-account-data.zip'));
    await expect(page.getByTestId('dashboard-title')).toHaveText('Seu 2024');
    await expectLikedBoard(page);
    await expect(page.getByTestId('liked-invite')).toHaveCount(0);
    await expect(page.getByTestId('toast')).toContainText('e 30 curtidas');

    // Trocar o período não muda o quadro.
    const before = await page.getByTestId('liked-board').textContent();
    await page.getByRole('radio', { name: 'Sempre' }).click();
    await expect(page.getByTestId('dashboard-title')).toHaveText('Você, desde sempre');
    expect(await page.getByTestId('liked-board').textContent()).toBe(before);

    await expectNoSeriousA11y(page);
    expect(csp).toEqual([]);
  });

  test('curtidas enviadas depois, com o painel aberto', async ({ page }) => {
    const csp = collectCspViolations(page);
    await page.goto('/pt-BR/upload');
    await page.getByLabel(PICK_HISTORY).setInputFiles(fixture('valid-two-files.zip'));
    await expect(page.getByTestId('dashboard-title')).toHaveText('Seu 2024');
    const invite = page.getByTestId('liked-invite');
    await expect(invite).toBeVisible();
    await expect(invite.getByRole('heading', { level: 2 })).toHaveText(
      'De quem você tem mais músicas curtidas?',
    );
    await expect(invite.getByRole('link', { name: 'Como pedir esse arquivo' })).toHaveAttribute(
      'href',
      '/pt-BR/onboarding#dados-da-conta',
    );
    await expectNoSeriousA11y(page);

    // Um arquivo sem as curtidas: recado próprio, e o histórico continua.
    await invite.getByLabel(PICK_LIKED).setInputFiles(fixture('valid-two-files.zip'));
    await expect(invite.getByRole('alert')).toContainText(
      'Não achamos suas curtidas nesse arquivo',
    );
    await expect(
      invite.getByRole('link', { name: 'Como pedir o "Dados da conta"' }),
    ).toHaveAttribute('href', '/pt-BR/onboarding#dados-da-conta');

    await invite.getByLabel(PICK_LIKED).setInputFiles(fixture('account-data-full.zip'));
    await expectLikedBoard(page);
    await expect(page.getByRole('heading', { name: 'Suas curtidas' })).toBeFocused();
    await expect(page.getByTestId('dashboard-title')).toHaveText('Seu 2024');
    await expect(page.getByText('Do seu histórico e das suas curtidas do Spotify')).toBeVisible();
    await expectNoSeriousA11y(page);
    expect(csp).toEqual([]);
  });

  test('só o "Dados da conta": pede também o histórico completo (WRONG_EXPORT + library)', async ({
    page,
  }) => {
    await page.goto('/pt-BR/upload');
    await page.getByLabel(PICK_HISTORY).setInputFiles(fixture('account-data-full.zip'));
    const alert = page.getByRole('main').getByRole('alert');
    await expect(alert).toContainText('Esse arquivo só tem suas curtidas');
    await expect(alert).toContainText('Envie também o seu histórico completo');
    await expect(alert.locator('[data-error-code]')).toHaveAttribute(
      'data-error-code',
      'WRONG_EXPORT',
    );
    await expect(
      alert.getByRole('link', { name: 'Como pedir o histórico completo' }),
    ).toBeVisible();
    await expectNoSeriousA11y(page);
  });

  test('360 px: quadro sem rolagem horizontal, axe limpo, 0 violações de CSP', async ({ page }) => {
    const csp = collectCspViolations(page);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/pt-BR/upload');
    await expectNoHorizontalScroll(page);
    await page.getByLabel(PICK_HISTORY).setInputFiles(fixture('history-and-account-data.zip'));
    await expectLikedBoard(page);
    await page.getByTestId('liked-section').scrollIntoViewIfNeeded();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11y(page);
    expect(csp).toEqual([]);
  });

  test('a demo mostra o quadro na Visão Upload', async ({ page }) => {
    const csp = collectCspViolations(page);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/pt-BR/demo');
    await expect(page.getByTestId('dashboard')).toBeVisible();
    const section = page.getByTestId('liked-section');
    await expect(section.getByRole('heading', { level: 2 })).toHaveText('Suas curtidas');
    await expect(page.getByTestId('liked-winner')).toContainText('músicas curtidas');
    await expect(section.getByRole('listitem')).toHaveCount(9);
    await expect(page.getByTestId('liked-invite')).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11y(page);
    expect(csp).toEqual([]);
  });

  test('onboarding explica como pedir o "Dados da conta"; privacidade diz o que é lido', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/pt-BR/onboarding#dados-da-conta');
    const section = page.getByTestId('onboarding-liked');
    await expect(section).toBeInViewport();
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(
      'Quer ver suas curtidas também?',
    );
    await expect(section.getByRole('list').getByRole('listitem')).toHaveCount(4);
    await expect(section).toContainText('marque também "Dados da conta"');
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11y(page);

    await page.goto('/pt-BR/privacy');
    await expect(
      page.getByRole('heading', { name: 'Modo Upload: o arquivo "Dados da conta" (opcional)' }),
    ).toBeVisible();
    await expect(page.getByText('nem são abertos', { exact: false })).toBeVisible();
    await expectNoSeriousA11y(page);
  });
});
