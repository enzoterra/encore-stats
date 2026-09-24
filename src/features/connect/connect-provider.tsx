'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';

import type { ConnectSource } from './bff-client';
import {
  createConnectBundle,
  getLiveBundle,
  wipeConnectData,
  type ConnectBundle,
  type ConnectStatus,
} from './connect-client';

const BundleContext = createContext<ConnectBundle | null>(null);

export function useConnectBundle(): ConnectBundle {
  const bundle = useContext(BundleContext);
  if (!bundle) throw new Error('useConnectBundle fora do <ConnectProvider>');
  return bundle;
}

export function useConnectStatus<T>(selector: (state: ConnectStatus) => T): T {
  return useStore(useConnectBundle().status, selector);
}

/** `true` enquanto a pausa global por `QUOTA` está valendo. */
export function usePaused(): boolean {
  return useConnectStatus((state) => state.pausedUntil !== null);
}

/**
 * Provider do modo Conectar. `source` ausente = BFF real (cliente único da aba); o Demo passa a
 * fonte fictícia e recebe um cliente isolado.
 */
export function ConnectProvider({
  source,
  bundle: injected,
  children,
}: {
  source?: ConnectSource;
  /** Cliente já criado (Demo e testes). */
  bundle?: ConnectBundle;
  children: ReactNode;
}) {
  const [bundle] = useState(
    () => injected ?? (source ? createConnectBundle(source) : getLiveBundle()),
  );
  const session = useStore(bundle.status, (state) => state.session);
  const pausedUntil = useStore(bundle.status, (state) => state.pausedUntil);

  // 401/403: a sessão acabou. Nada do usuário fica na memória nem no sessionStorage.
  useEffect(() => {
    if (session !== 'active') wipeConnectData(bundle);
  }, [bundle, session]);

  // Fim da pausa por QUOTA: libera as queries e refaz as que falharam.
  useEffect(() => {
    if (pausedUntil === null) return;
    const wait = Math.max(0, pausedUntil - Date.now());
    const timer = setTimeout(() => {
      bundle.status.getState().resume();
      void bundle.queryClient.refetchQueries({
        predicate: (query) => query.state.status === 'error',
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [bundle, pausedUntil]);

  return (
    <BundleContext.Provider value={bundle}>
      <QueryClientProvider client={bundle.queryClient}>{children}</QueryClientProvider>
    </BundleContext.Provider>
  );
}
