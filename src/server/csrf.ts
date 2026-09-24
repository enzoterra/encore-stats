import 'server-only';

/**
 * Proteção CSRF das rotas que mudam estado (hoje só o logout): `POST` + checagem de origem.
 *
 * O site envia `Referrer-Policy: no-referrer`, e com essa política o navegador manda
 * `Origin: null` até em POST da mesma origem (spec Fetch, "append a request Origin header").
 * Por isso a regra é:
 * - `Origin` ausente → nega (clientes fora do navegador não têm por que chamar o logout);
 * - `Origin` igual à origem do app → aceita, a não ser que `Sec-Fetch-Site` diga outra coisa;
 * - `Origin: null` → aceita só com `Sec-Fetch-Site: same-origin`, cabeçalho que uma página não
 *   consegue forjar (um iframe `sandbox` de outro site manda `null`, mas com `cross-site`).
 */
export function isSameOriginRequest(request: Request, appOrigin: string): boolean {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (origin === null) return false;
  if (fetchSite !== null && fetchSite !== 'same-origin') return false;
  if (origin === appOrigin) return true;
  return origin === 'null' && fetchSite === 'same-origin';
}
