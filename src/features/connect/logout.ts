import { useToasts } from '@/components/ui/toast';

import { wipeConnectData, type ConnectBundle } from './connect-client';
import { clearAllSession } from './session-cache';

/**
 * Logout (RF-13, 03-arquitetura "Logout"): `POST` same-origin (o BFF confere a origem e responde
 * 204 com `Clear-Site-Data: "cache"`), depois `queryClient.clear()` e o sessionStorage limpo.
 * Devolve `false` se o servidor recusou; nesse caso nada é apagado e a UI avisa.
 */
export async function logout(locale: string, bundle: ConnectBundle): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/logout?locale=${encodeURIComponent(locale)}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    return false;
  }
  if (!response.ok) return false;
  wipeConnectData(bundle);
  bundle.status.getState().reset();
  clearAllSession();
  useToasts.setState({ queue: [] });
  return true;
}
