/**
 * Cabeçalhos de segurança (docs/projeto/08-seguranca.md).
 *
 * - `staticSecurityHeaders`: valem para toda resposta (páginas, API e assets);
 *   aplicados em `next.config.ts` e também pelo `proxy.ts`.
 * - `buildContentSecurityPolicy`: CSP com nonce por requisição, montada no `proxy.ts`.
 * - `buildWorkerContentSecurityPolicy`: CSP dos scripts de Web Worker (`/_next/static`), aplicada
 *   em `next.config.ts`. Um worker usa a CSP da resposta do próprio script, não a da página.
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

/**
 * ADR 9: a capa da música nº 1 entra no card do Conectar como bytes, buscados direto do CDN do
 * Spotify (responde com `Access-Control-Allow-Origin: *`). Só esse host, só leitura de imagem.
 */
const COVER_FETCH_HOST = 'https://i.scdn.co';

export function buildContentSecurityPolicy({ nonce, isDev, isHttps }: CspOptions): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      // Sem `'wasm-unsafe-eval'`: o WASM dos cards (satori/resvg) roda só no worker, que tem a
      // própria CSP (`buildWorkerContentSecurityPolicy`).
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // Em dev, o overlay de erros do Next injeta estilos inline sem nonce.
    'style-src': ["'self'", ...(isDev ? ["'unsafe-inline'"] : [`'nonce-${nonce}'`])],
    'img-src': ["'self'", 'data:', 'blob:', ...SPOTIFY_IMAGE_HOSTS],
    'connect-src': ["'self'", COVER_FETCH_HOST],
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

/**
 * CSP dos Web Workers (upload e cards), entregue na resposta do script do worker:
 * - `'wasm-unsafe-eval'` só aqui: compila o WASM do satori (Yoga, HarfBuzz) e do resvg;
 * - `connect-src data:`: o worker não faz nenhuma requisição de rede (o upload e os dados do card
 *   nunca saem do aparelho); fontes e WASM chegam da thread principal por `postMessage`. `data:`
 *   é local: o satori lê assim o WASM do Yoga, que vem embutido em base64;
 * - `script-src 'self'`: só os chunks do próprio site (`importScripts` do bootstrap do Turbopack).
 * Nos demais arquivos estáticos (JS carregado por `<script>`, CSS, fontes) o cabeçalho é ignorado.
 */
export function buildWorkerContentSecurityPolicy({ isDev }: Pick<CspOptions, 'isDev'>): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'none'"],
    'script-src': ["'self'", "'wasm-unsafe-eval'", ...(isDev ? ["'unsafe-eval'"] : [])],
    'connect-src': isDev ? ["'self'", 'data:'] : ['data:'],
    'base-uri': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

/** Nonce de 128 bits em base64, gerado com Web Crypto (funciona em Node e Edge). */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
