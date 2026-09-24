'use client';

import { setNonce } from 'get-nonce';

/**
 * Os primitivos modais do Radix (menu, diálogo) travam o scroll do `body` injetando um `<style>`
 * (`react-remove-scroll` → `react-style-singleton`), que a CSP com nonce bloqueava. O
 * `react-style-singleton` lê o nonce de `get-nonce`; aqui ele recebe o mesmo nonce que o Next já
 * aplicou aos próprios scripts. A propriedade `.nonce` só é legível por script da própria página
 * (o atributo fica vazio no DOM), então nada novo é exposto.
 */
if (typeof document !== 'undefined') {
  const nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;
  if (nonce) setNonce(nonce);
}

export function StyleNonce(): null {
  return null;
}
