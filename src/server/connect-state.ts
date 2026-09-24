import 'server-only';

import { cookies } from 'next/headers';

import { cookieName, SESSION_COOKIE } from './cookies';
import { getConnectConfig } from './env';
import { openSession } from './session';

export type ConnectState = 'disabled' | 'connected' | 'disconnected';

/** Estado do Conectar para as páginas (RSC): sem expor nada da sessão além de "há sessão". */
export async function getConnectState(): Promise<ConnectState> {
  const config = getConnectConfig();
  if (!config) return 'disabled';
  const store = await cookies();
  const raw = store.get(cookieName(SESSION_COOKIE, config.spotify.secureCookies))?.value;
  if (!raw) return 'disconnected';
  const session = await openSession(raw, {
    current: config.sessionSecret,
    previous: config.sessionSecretPrevious,
  });
  return session ? 'connected' : 'disconnected';
}
