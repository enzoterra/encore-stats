import { join } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

// O Playwright transpila os specs para CommonJS: `__dirname` existe, `import.meta` não.
export const FIXTURES = join(__dirname, '..', 'tests', 'fixtures');
export const fixture = (name: string) => join(FIXTURES, name);

/** axe (WCAG 2.x A/AA + 2.2 AA) sem violações `serious`/`critical` (07-estrategia-de-testes). */
export async function expectNoSeriousA11y(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(serious).toEqual([]);
}

/** Sem scroll horizontal da página (RNF-08). */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

/** Coleta violações de CSP reportadas no console (Chromium e WebKit). */
export function collectCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text());
  });
  return violations;
}

/** App com o Conectar ligado contra o mock do Spotify (3º `webServer` do Playwright). */
export const CONNECT_URL = 'http://127.0.0.1:3100';

const COVER_COLORS = ['#FF3D8B', '#3DE0FF', '#FFE14D', '#FF7A1A', '#52F2C8', '#7D71A8'];

/**
 * O mock devolve capas em `https://i.scdn.co/image/mock…`, que não existem. Sem sair para a
 * internet, o teste responde com um SVG quadrado gerado a partir da URL.
 */
export async function routeFakeCovers(page: Page): Promise<void> {
  await page.context().route('https://i.scdn.co/**', (route) => {
    const url = route.request().url();
    let hash = 0;
    for (const char of url) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    const a = COVER_COLORS[hash % COVER_COLORS.length];
    const b = COVER_COLORS[(hash >>> 3) % COVER_COLORS.length];
    const body = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/><circle cx="150" cy="150" r="64" fill="#0E0B1A" opacity=".35"/></svg>`;
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body });
  });
}
