/**
 * Cabeçalhos de segurança (docs/projeto/08-seguranca.md).
 *
 * - `staticSecurityHeaders`: valem para toda resposta (páginas, API e assets);
 *   aplicados em `next.config.ts` e também pelo `proxy.ts`.
 * - `buildContentSecurityPolicy`: CSP com nonce por requisição, montada no `proxy.ts`.
 *
 * Módulo sem dependências de runtime para poder ser importado por `next.config.ts`,
 * pelo `proxy.ts` e pelos testes.
 */

export type SecurityHeader = { key: string; value: string };

export const staticSecurityHeaders: readonly SecurityHeader[] = [
  // Navegadores ignoram HSTS em HTTP, então é seguro enviar também no ambiente local.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Legado; o controle real é `frame-ancestors 'none'` na CSP.
  { key: 'X-Frame-Options', value: 'DENY' },
];

export type CspOptions = {
  nonce: string;
  /** `next dev` precisa de `'unsafe-eval'` (React em desenvolvimento) e estilos inline do overlay. */
  isDev: boolean;
  /** Só pedimos `upgrade-insecure-requests` quando a página já é servida por HTTPS. */
  isHttps: boolean;
};

/** Hosts de imagem do Spotify (capas e fotos de artista). */
const SPOTIFY_IMAGE_HOSTS = ['https://i.scdn.co', 'https://*.spotifycdn.com'];

export function buildContentSecurityPolicy({ nonce, isDev, isHttps }: CspOptions): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "'wasm-unsafe-eval'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // Em dev, o overlay de erros do Next injeta estilos inline sem nonce.
    'style-src': ["'self'", ...(isDev ? ["'unsafe-inline'"] : [`'nonce-${nonce}'`])],
    'img-src': ["'self'", 'data:', 'blob:', ...SPOTIFY_IMAGE_HOSTS],
    'connect-src': ["'self'"],
    'font-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'self'", 'https://accounts.spotify.com'],
    'frame-ancestors': ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`);
  if (isHttps) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}

/** Nonce de 128 bits em base64, gerado com Web Crypto (funciona em Node e Edge). */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
