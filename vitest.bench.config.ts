import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Benchmark do motor de upload (RNF-03, S1.10): `pnpm bench`.
 * Fica fora do `pnpm test` porque processa ~50 MB e leva alguns segundos.
 */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    name: 'bench',
    environment: 'node',
    include: ['tests/perf/**/*.perf.ts'],
    testTimeout: 120_000,
    execArgv: ['--expose-gc'],
    silent: false,
    reporters: ['verbose'],
  },
});
