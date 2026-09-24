'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * `false` no HTML do servidor e na hidratação; `true` depois. Serve para componentes que
 * renderizam `style="…"` no SSR (ex.: Radix Tabs): a CSP com nonce bloqueia atributos de estilo
 * vindos do HTML, mas não os aplicados pelo React no cliente (CSSOM).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
