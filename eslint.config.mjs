import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';

/** APIs de rede proibidas onde o upload/os dados de escuta nunca podem sair do aparelho. */
const NETWORK_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts'];
const NETWORK_MESSAGE =
  'Sem rede aqui: o upload e os dados de escuta nunca saem do dispositivo (RNF-01).';
const STORAGE_MESSAGE = 'Dados de escuta nunca em localStorage/IndexedDB (PADROES §1).';
/** `window.fetch(...)`, `self.fetch(...)` etc. escapam de `no-restricted-globals`. */
const networkProperties = ['window', 'self', 'globalThis'].flatMap((object) => [
  ...NETWORK_GLOBALS.map((property) => ({ object, property, message: NETWORK_MESSAGE })),
  { object, property: 'localStorage', message: STORAGE_MESSAGE },
  { object, property: 'indexedDB', message: STORAGE_MESSAGE },
]);

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  prettier,
  {
    // Versão explícita: a detecção automática do eslint-plugin-react 7.x usa
    // `context.getFilename()`, removido no ESLint 10.
    settings: { react: { version: '19.3' } },
    rules: {
      // PADROES §2: sem HTML cru vindo de dados.
      'react/no-danger': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      // PADROES §1: dados de escuta nunca em localStorage/IndexedDB. Nenhuma tela usa hoje; uma
      // preferência que precise de localStorage entra com exceção explícita e justificada.
      'no-restricted-properties': [
        'error',
        ...['window', 'self', 'globalThis'].flatMap((object) =>
          ['localStorage', 'indexedDB'].map((property) => ({
            object,
            property,
            message: STORAGE_MESSAGE,
          })),
        ),
      ],
      'no-restricted-globals': [
        'error',
        ...['localStorage', 'indexedDB'].map((name) => ({ name, message: STORAGE_MESSAGE })),
      ],
    },
  },
  {
    // PADROES §1: `console.*` é proibido no BFF; use `src/server/logger.ts` (allowlist).
    files: ['app/api/**/*.{ts,tsx}', 'src/server/**/*.{ts,tsx}'],
    rules: { 'no-console': 'error' },
  },
  {
    // PADROES §1 / RNF-01: o domínio, os workers (upload e cards), o pipeline dos cards e as telas
    // que lidam com o histórico enviado (upload, dataset, dashboard, demo) nunca fazem rede. (Esta
    // regra substitui as listas globais nestes arquivos, por isso repete o armazenamento.) A rede
    // do app fica só em `src/features/connect` (BFF) e `src/features/cards/card-client.ts`.
    files: [
      'src/domain/**/*.ts',
      'src/workers/**/*.ts',
      'src/features/cards/{model,text,templates,brand,render,assets,share-input,harfbuzz-browser}.ts',
      'src/features/{upload,dataset,dashboard,demo,onboarding,landing}/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...NETWORK_GLOBALS.map((name) => ({ name, message: NETWORK_MESSAGE })),
        ...['localStorage', 'indexedDB'].map((name) => ({ name, message: STORAGE_MESSAGE })),
      ],
      'no-restricted-properties': [
        'error',
        ...networkProperties,
        { object: 'navigator', property: 'sendBeacon', message: NETWORK_MESSAGE },
      ],
    },
  },
  {
    // O domínio e os workers são puros: nem sessionStorage (esse fica na UI, com prazo).
    files: ['src/domain/**/*.ts', 'src/workers/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Identifier[name='sessionStorage']",
          message: 'O domínio é puro: armazenamento fica na UI (PADROES §1).',
        },
      ],
    },
  },
  {
    // Testes conferem que nada foi gravado (`window.localStorage.length === 0`).
    files: ['**/*.test.{ts,tsx}', 'tests/**', 'e2e/**'],
    rules: { 'no-restricted-properties': 'off', 'no-restricted-globals': 'off' },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    'docs/**',
  ]),
]);
