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
