import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  // `server-only` lança erro fora do bundler do Next; nos testes vira um módulo vazio.
  'server-only': fileURLToPath(new URL('./tests/stubs/empty.ts', import.meta.url)),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    // Unit/integração em Node (domínio, servidor, rotas) e componentes em jsdom.
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts', 'app/**/*.test.ts', 'tests/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx', 'app/**/*.test.tsx'],
          setupFiles: ['./tests/setup-dom.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'app/api/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts', 'src/i18n/messages/**'],
      reporter: ['text', 'html', 'lcov'],
      // Meta de 07-estrategia-de-testes.md: ≥ 80% de linhas e ramos em src/domain.
      thresholds: {
        'src/domain/**': { lines: 80, branches: 80, functions: 80, statements: 80 },
      },
    },
  },
});
