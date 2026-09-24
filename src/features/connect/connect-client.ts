import { QueryCache, QueryClient } from '@tanstack/react-query';
import { createStore, type StoreApi } from 'zustand/vanilla';

import type { TimeRange } from '@/domain/spotify-types';

import { isBffError, liveSource, QUOTA_PAUSE_SECONDS, type ConnectSource } from './bff-client';
import { clearConnectSession, readSession, removeSession, writeSession } from './session-cache';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * TTLs de 03-arquitetura / docs/api.md: o `staleTime` de cada query é o mesmo `max-age` que o
 * BFF manda no `Cache-Control: private`. O `gcTime` acompanha, para trocar de janela e voltar
 * sem refazer a chamada.
 */
export const TTL = {
  me: 24 * HOUR,
  top: 6 * HOUR,
  recent: MINUTE,
  saved: 12 * HOUR,
  artist: 7 * 24 * HOUR,
} as const;

export const connectKeys = {
  all: (kind: ConnectSource['kind']) => ['connect', kind] as const,
  me: (kind: ConnectSource['kind']) => ['connect', kind, 'me'] as const,
  top: (kind: ConnectSource['kind'], type: 'artists' | 'tracks', range: TimeRange) =>
    ['connect', kind, 'top', type, range] as const,
  recent: (kind: ConnectSource['kind']) => ['connect', kind, 'recent'] as const,
  artist: (kind: ConnectSource['kind'], id: string) => ['connect', kind, 'artist', id] as const,
};

export type SessionState = 'active' | 'expired' | 'forbidden';

export type ConnectStatus = {
  session: SessionState;
  /** Epoch (ms) até quando todas as queries ficam pausadas por `QUOTA` (RF-25). */
  pausedUntil: number | null;
  expire: () => void;
  forbid: () => void;
  pause: (seconds: number) => void;
  resume: () => void;
  reset: () => void;
};

const PAUSE_KEY = 'pause';

function createStatusStore(persist: boolean): StoreApi<ConnectStatus> {
  const saved = persist ? readSession<number>(PAUSE_KEY) : undefined;
  return createStore<ConnectStatus>((set) => ({
    session: 'active',
    pausedUntil: saved && saved > Date.now() ? saved : null,
    expire: () => set({ session: 'expired' }),
    forbid: () => set({ session: 'forbidden' }),
    pause: (seconds) => {
      const until = Date.now() + seconds * 1000;
      if (persist) writeSession(PAUSE_KEY, until, seconds * 1000);
      set({ pausedUntil: until });
    },
    resume: () => {
      if (persist) removeSession(PAUSE_KEY);
      set({ pausedUntil: null });
    },
    reset: () => set({ session: 'active', pausedUntil: null }),
  }));
}

/** Política de retry: nunca em 4xx, `QUOTA` ou 429 (a UI espera o `retryAfter`); 1 vez em 5xx/rede. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (!isBffError(error)) return false;
  return (
    error.code === 'NETWORK' ||
    error.code === 'UPSTREAM' ||
    (error.code === 'INTERNAL' && error.status >= 500)
  );
}

export type ConnectBundle = {
  source: ConnectSource;
  queryClient: QueryClient;
  status: StoreApi<ConnectStatus>;
  /** Trata erros que valem para a página toda (401, 403, `QUOTA`). */
  report: (error: unknown) => void;
};

export function createConnectBundle(source: ConnectSource): ConnectBundle {
  const status = createStatusStore(source.kind === 'live');
  const report = (error: unknown) => {
    if (!isBffError(error)) return;
    const state = status.getState();
    if (error.code === 'UNAUTHENTICATED') state.expire();
    else if (error.code === 'NOT_ALLOWLISTED') state.forbid();
    else if (error.code === 'QUOTA') {
      const current = state.pausedUntil ?? 0;
      const seconds = error.retryAfter ?? QUOTA_PAUSE_SECONDS;
      if (Date.now() + seconds * 1000 > current) state.pause(seconds);
    }
  };
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: report }),
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay: 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
  return { source, queryClient, status, report };
}

let live: ConnectBundle | undefined;

/**
 * Um cliente por aba para o modo real: sobrevive à troca de idioma (navegação do cliente) e é
 * esvaziado no logout. O Demo cria o seu próprio, isolado.
 */
export function getLiveBundle(): ConnectBundle {
  live ??= createConnectBundle(liveSource);
  return live;
}

/** Sessão encerrada (401/403/logout): apaga o cache em memória e o do sessionStorage. */
export function wipeConnectData(bundle: ConnectBundle): void {
  bundle.queryClient.cancelQueries().catch(() => undefined);
  bundle.queryClient.clear();
  if (bundle.source.kind === 'live') clearConnectSession();
}

/** Só para testes: descarta o cliente da aba. */
export function resetLiveBundle(): void {
  live = undefined;
}
