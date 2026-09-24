import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { staticSecurityHeaders } from './src/server/security-headers';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // Não gerar AGENTS.md/CLAUDE.md no repositório durante o `next dev`.
  agentRules: false,
  async headers() {
    return [
      {
        // Todas as respostas (API, assets e páginas). A CSP com nonce vem do `proxy.ts`.
        source: '/:path*',
        headers: [...staticSecurityHeaders],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
