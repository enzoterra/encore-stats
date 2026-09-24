import { NextRequest, type NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';

import { routing } from '@/i18n/routing';
import {
  buildContentSecurityPolicy,
  generateNonce,
  staticSecurityHeaders,
} from '@/server/security-headers';

/**
 * Proxy do Next 16 (antigo middleware):
 * 1. gera um nonce por requisição e monta a CSP (docs/projeto/08-seguranca.md);
 * 2. repassa nonce e CSP nos cabeçalhos da requisição, para o Next aplicar o nonce
 *    aos próprios scripts durante o render;
 * 3. negocia o locale com o next-intl (páginas) e aplica os cabeçalhos na resposta.
 */
const handleI18nRouting = createIntlMiddleware(routing);

export default function proxy(request: NextRequest): NextResponse | Response {
  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy({
    nonce,
    isDev: process.env.NODE_ENV === 'development',
    isHttps:
      request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https',
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const forwarded = new NextRequest(request, { headers: requestHeaders });

  const response = handleI18nRouting(forwarded);

  response.headers.set('Content-Security-Policy', csp);
  for (const { key, value } of staticSecurityHeaders) response.headers.set(key, value);
  return response;
}

export const config = {
  // Páginas apenas: API, arquivos do Next e arquivos estáticos (com ponto) ficam de fora.
  // Os cabeçalhos estáticos dessas rotas vêm de `next.config.ts`.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
