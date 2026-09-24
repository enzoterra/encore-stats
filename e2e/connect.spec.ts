import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { expectNoHorizontalScroll, expectNoSeriousA11y } from './support';

/**
 * BFF e tela do Conectar num ambiente SEM credenciais (`:3000`): as rotas de auth e do Spotify
 * respondem 404 tipado, nada é cacheável e o botão de entrar fica desabilitado com o motivo.
 * O fluxo completo com o Spotify mockado está em `connect-live.spec.ts`.
 */
test.describe('Conectar desabilitado', () => {
  for (const path of [
    '/api/auth/login',
    '/api/auth/callback?code=x&state=y',
    '/api/spotify/me',
    '/api/spotify/top?type=artists&range=short_term',
    '/api/spotify/recent',
    '/api/spotify/saved?offset=0',
    '/api/spotify/artist/0TnOYISbd1XYRBk9myaseg',
  ]) {
    test(`GET ${path} → 404 CONNECT_DISABLED, sem cache`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ error: { code: 'CONNECT_DISABLED' } });
      const headers = response.headers();
      expect(headers['cache-control']).toBe('private, no-store');
      expect(headers['vary']).toContain('Cookie');
      expect(headers['x-content-type-options']).toBe('nosniff');
    });
  }

  test('POST /api/auth/logout → 404 tipado; GET não existe', async ({ request }) => {
    const post = await request.post('/api/auth/logout', {
      headers: { origin: 'http://127.0.0.1:3000' },
    });
    expect(post.status()).toBe(404);
    const get = await request.get('/api/auth/logout');
    expect(get.status()).toBe(405);
  });

  test('a página /connect avisa que o modo está indisponível e passa no axe', async ({ page }) => {
    // O `main` evita o anunciador de rotas do Next, que também tem role=alert.
    await page.goto('/pt-BR/connect?error=denied');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Conectar com o Spotify');
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(/cancelou a autorização/);
    await expect(page.getByText(/indisponível neste ambiente/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar com o Spotify' })).toBeDisabled();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious.map((v) => v.id)).toEqual([]);
  });

  test('código de erro desconhecido na URL é ignorado', async ({ page }) => {
    await page.goto('/en/connect?error=<script>');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Connect with Spotify');
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  });

  test('fora da allowlist: explica o limite de 5 contas e oferece Upload e Demo (axe, 360 px)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/pt-BR/connect?error=not_allowlisted');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Este app ainda está em modo de teste',
    );
    await expect(page.getByText(/5 contas convidadas/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Enviar meu histórico' })).toHaveAttribute(
      'href',
      '/pt-BR/upload',
    );
    await expect(page.getByRole('link', { name: 'Ver demo' })).toHaveAttribute(
      'href',
      '/pt-BR/demo',
    );
    await expectNoSeriousA11y(page);
    await expectNoHorizontalScroll(page);
  });
});
