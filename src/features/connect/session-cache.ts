/**
 * Persistência opcional do modo Conectar (03-arquitetura, "Cache"): **só sessionStorage**, que
 * some ao fechar a aba, sempre com prazo de validade, e apagada no logout ou quando a sessão cai.
 * Nunca localStorage nem IndexedDB (PADROES §1). Toda leitura/escrita tolera storage bloqueado.
 */

const PREFIX = 'encore.connect.';

type Entry<T> = { v: 1; expiresAt: number; data: T };

function storage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function readSession<T>(key: string, now = Date.now()): T | undefined {
  const store = storage();
  if (!store) return undefined;
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as Partial<Entry<T>>;
    if (entry.v !== 1 || typeof entry.expiresAt !== 'number' || entry.expiresAt <= now) {
      store.removeItem(PREFIX + key);
      return undefined;
    }
    return entry.data;
  } catch {
    return undefined;
  }
}

export function writeSession<T>(key: string, data: T, ttlMs: number, now = Date.now()): void {
  const store = storage();
  if (!store) return;
  try {
    const entry: Entry<T> = { v: 1, expiresAt: now + ttlMs, data };
    store.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    /* cota cheia ou storage bloqueado: segue só com a memória */
  }
}

export function removeSession(key: string): void {
  try {
    storage()?.removeItem(PREFIX + key);
  } catch {
    /* nada a fazer */
  }
}

/** Apaga tudo do Conectar (quando a sessão expira ou a conta não tem acesso). */
export function clearConnectSession(): void {
  const store = storage();
  if (!store) return;
  try {
    for (let i = store.length - 1; i >= 0; i--) {
      const key = store.key(i);
      if (key?.startsWith(PREFIX)) store.removeItem(key);
    }
  } catch {
    /* nada a fazer */
  }
}

/** Logout: limpa o sessionStorage inteiro da aba (03-arquitetura, "Logout"). */
export function clearAllSession(): void {
  try {
    storage()?.clear();
  } catch {
    /* nada a fazer */
  }
}
