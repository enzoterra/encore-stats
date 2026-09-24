import 'server-only';

/**
 * Cookies do BFF (08-seguranca.md).
 *
 * Produção e qualquer origem HTTPS: `__Host-encore_session` e `__Host-encore_oauth`, com
 * `Secure; HttpOnly; SameSite=Lax; Path=/` e sem `Domain`. O prefixo `__Host-` impede que um
 * subdomínio plante ou sobrescreva o cookie.
 *
 * Desenvolvimento local em `http://127.0.0.1` (o Spotify exige redirect URI de loopback com IP
 * literal, sem HTTPS): o Safari descarta cookies `Secure` em HTTP, e o Chrome aceita `Secure`
 * em loopback, mas não cookies com prefixo `__Host-`. Por isso, só quando a redirect URI é HTTP de
 * loopback (o `env.ts` proíbe HTTP fora de loopback e em qualquer deploy da Vercel), os nomes
 * perdem o prefixo e o `Secure` sai. Os demais atributos continuam iguais, e o tráfego não sai
 * da máquina. Em produção nada muda.
 */

export const SESSION_COOKIE = 'encore_session';
export const OAUTH_COOKIE = 'encore_oauth';

/** Limite prático de um cookie (nome + valor) nos navegadores. */
export const MAX_COOKIE_VALUE_LENGTH = 4000;

export function cookieName(base: typeof SESSION_COOKIE | typeof OAUTH_COOKIE, secure: boolean) {
  return secure ? `__Host-${base}` : base;
}

export type CookieWriteOptions = { maxAge: number; secure: boolean };

/** `Set-Cookie` com os atributos fixos do projeto. `value` já vem em base64url/JWE compacto. */
export function serializeCookie(name: string, value: string, options: CookieWriteOptions): string {
  const parts = [
    `${name}=${value}`,
    'Path=/',
    `Max-Age=${Math.max(0, Math.floor(options.maxAge))}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

/** `Set-Cookie` que apaga o cookie (mesmos atributos, `Max-Age=0` e data no passado). */
export function serializeClearedCookie(name: string, secure: boolean): string {
  return `${serializeCookie(name, '', { maxAge: 0, secure })}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/** Lê um cookie do cabeçalho `Cookie` da requisição (sem decodificar: os valores são base64url). */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index === -1) continue;
    if (pair.slice(0, index).trim() !== name) continue;
    const value = pair.slice(index + 1).trim();
    return value === '' ? undefined : value;
  }
  return undefined;
}
