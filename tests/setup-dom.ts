import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { createElement, type AnchorHTMLAttributes } from 'react';
import { afterEach, vi } from 'vitest';

// A navegação do next-intl depende do roteador do Next; nos testes de componente, um <a> basta.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    createElement('a', { href, ...props }),
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  redirect: vi.fn(),
  getPathname: () => '/',
}));

// Radix (Popover/Tooltip) mede elementos com ResizeObserver, que o jsdom não tem.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// O jsdom não implementa rolagem; `scrollIntoView` vira um no-op nos testes.
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

afterEach(() => {
  cleanup();
});
