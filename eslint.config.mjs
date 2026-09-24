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
