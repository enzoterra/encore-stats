import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';

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
      'no-restricted-syntax': [
        'error',
        {
          // PADROES §1: dados de escuta nunca em localStorage/IndexedDB.
          selector: "MemberExpression[object.name='window'][property.name='indexedDB']",
          message: 'IndexedDB é proibido para dados de escuta (PADROES §1).',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'indexedDB', message: 'IndexedDB é proibido para dados de escuta (PADROES §1).' },
      ],
    },
  },
  {
    // PADROES §1: `console.*` é proibido no BFF; use `src/server/logger.ts` (allowlist).
    files: ['app/api/**/*.{ts,tsx}', 'src/server/**/*.{ts,tsx}'],
    rules: { 'no-console': 'error' },
  },
  {
    // PADROES §1 / RNF-01: o domínio, os workers (upload e cards) e o pipeline dos cards nunca
    // fazem rede nem persistem dados de escuta. (Esta regra substitui a lista global para estes
    // arquivos, por isso repete o IndexedDB.) A busca de fontes/WASM/capa fica em `card-client.ts`.
    files: [
      'src/domain/**/*.ts',
      'src/workers/**/*.ts',
      'src/features/cards/{model,text,templates,render,assets,share-input,harfbuzz-browser}.ts',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts'].map((name) => ({
          name,
          message: 'Sem rede no domínio/worker: o upload nunca sai do dispositivo (RNF-01).',
        })),
        ...['localStorage', 'sessionStorage', 'indexedDB'].map((name) => ({
          name,
          message: 'O domínio é puro: armazenamento fica na UI (PADROES §1).',
        })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'navigator', property: 'sendBeacon', message: 'Sem rede no domínio/worker.' },
      ],
    },
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
