import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * BFF e página provisória do Conectar num ambiente SEM credenciais (como o CI):
 * as rotas de auth e do Spotify respondem 404 tipado e nada é cacheável.
 * O fluxo completo com o Spotify mockado (`scripts/spotify-mock-server.ts`) entra na Sprint 5.
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
});
