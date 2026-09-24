import { errorResponse } from '@/server/api-errors';
import { clearOAuthCookie, connectPageUrl, NO_STORE, resolveLocale } from '@/server/auth-shared';
import { clearSessionCookie } from '@/server/bff';
import { isSameOriginRequest } from '@/server/csrf';
import { getConnectConfig } from '@/server/env';
import { log } from '@/server/logger';

export const dynamic = 'force-dynamic';

/**
 * Logout: `POST /api/auth/logout[?locale=]`. Só aceita requisições da própria origem (CSRF,
 * ver `src/server/csrf.ts`). Apaga os cookies e pede ao navegador para descartar o cache HTTP da
 * origem (`Clear-Site-Data: "cache"`), onde ficam as respostas `private` do BFF.
 * - `fetch` → 204; envio de formulário (navegação) → 303 para `/{locale}/connect`.
 */
export async function POST(request: Request): Promise<Response> {
  const config = getConnectConfig();
  if (!config) return errorResponse('CONNECT_DISABLED');
  const { spotify } = config;

  if (!isSameOriginRequest(request, spotify.appOrigin)) {
    log('warn', 'auth.logout', { route: '/api/auth/logout', status: 403, code: 'FORBIDDEN' });
    return errorResponse('FORBIDDEN');
  }

  const locale = resolveLocale(new URL(request.url).searchParams.get('locale'));
  const navigate = request.headers.get('sec-fetch-mode') === 'navigate';
  const headers = new Headers({ ...NO_STORE, 'Clear-Site-Data': '"cache"' });
  headers.append('Set-Cookie', clearSessionCookie(spotify));
  headers.append('Set-Cookie', clearOAuthCookie(spotify));
  if (navigate) headers.set('Location', connectPageUrl(spotify, locale));

  const status = navigate ? 303 : 204;
  log('info', 'auth.logout', { route: '/api/auth/logout', status });
  return new Response(null, { status, headers });
}
