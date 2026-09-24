import { defineConfig, devices } from '@playwright/test';

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
/** 2º servidor, do mesmo build, com o Conectar ligado contra o mock local do Spotify. */
const CONNECT_PORT = 3100;
const CONNECT_URL = `http://127.0.0.1:${CONNECT_PORT}`;
const MOCK_PORT = 4010;
const isCI = Boolean(process.env.CI);

/**
 * E2E contra o build de produção (`next start`). Chromium e WebKit (Safari/iOS é o alvo do
 * RNF-03/04). Três servidores, iniciados em ordem:
 * 1. `:3000`, sem credenciais do Spotify (Upload/Demo, Conectar desabilitado); faz o build;
 * 2. `:4010`, o mock do Accounts + Web API (`scripts/spotify-mock-server.ts`, dados fictícios);
 * 3. `:3100`, o mesmo build com o Conectar ligado e as bases do Spotify no mock (só loopback,
 *    proibido na Vercel pelo `env.ts`). O `SESSION_SECRET` abaixo é descartável, só de teste.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: 'pnpm run build && pnpm run start',
      url: `${BASE_URL}/api/health`,
      reuseExistingServer: !isCI,
      timeout: 180_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'node scripts/spotify-mock-server.ts',
      url: `http://127.0.0.1:${MOCK_PORT}/health`,
      reuseExistingServer: !isCI,
      timeout: 30_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: { MOCK_SPOTIFY_PORT: String(MOCK_PORT), MOCK_SPOTIFY_SAVED_DELAY_MS: '120' },
    },
    {
      command: `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port ${CONNECT_PORT}`,
      url: `${CONNECT_URL}/api/health`,
      reuseExistingServer: !isCI,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        SPOTIFY_CLIENT_ID: 'mock-client',
        SPOTIFY_CLIENT_SECRET: 'mock-secret',
        SPOTIFY_REDIRECT_URI: `${CONNECT_URL}/api/auth/callback`,
        SESSION_SECRET: 'e2e-only-not-a-secret-000000000000000000000',
        SPOTIFY_ACCOUNTS_BASE: `http://127.0.0.1:${MOCK_PORT}`,
        SPOTIFY_API_BASE: `http://127.0.0.1:${MOCK_PORT}/v1`,
        NEXT_PUBLIC_SITE_URL: CONNECT_URL,
      },
    },
  ],
});
