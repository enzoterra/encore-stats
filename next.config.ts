import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import {
  apiSecurityHeaders,
  buildWorkerContentSecurityPolicy,
  staticSecurityHeaders,
} from './src/server/security-headers';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // Não gerar AGENTS.md/CLAUDE.md no repositório durante o `next dev`.
  agentRules: false,
  turbopack: {
    resolveAlias: {
      // O satori busca o `hb.wasm` do HarfBuzz ao lado do script, o que não funciona depois do
      // bundle. No navegador, o worker de cards entrega os bytes (src/features/cards/harfbuzz-browser.ts).
      harfbuzzjs: { browser: './src/features/cards/harfbuzz-browser.ts' },
      // O `hb.js` só usa `fs` no Node; no navegador vira um módulo vazio.
      fs: { browser: './src/features/cards/browser-empty.ts' },
    },
  },
  async headers() {
    return [
      {
        // Todas as respostas (API, assets e páginas). A CSP com nonce vem do `proxy.ts`.
        source: '/:path*',
        headers: [...staticSecurityHeaders],
      },
      {
        // BFF (JSON): fora do `proxy.ts`, sem conteúdo ativo nem embutível por outra origem.
        source: '/api/:path*',
        headers: [...apiSecurityHeaders],
      },
      {
        // Scripts de Web Worker (upload e cards) ficam em `/_next/static`: um worker usa a CSP da
        // resposta do próprio script. `'wasm-unsafe-eval'` vale só ali, não nas páginas.
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: buildWorkerContentSecurityPolicy({
              isDev: process.env.NODE_ENV === 'development',
            }),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
