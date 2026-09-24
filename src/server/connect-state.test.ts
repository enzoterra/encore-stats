import { afterEach, describe, expect, it, vi } from 'vitest';

import { SECRET, sessionCookie, useConnectEnv, useDisabledEnv } from '../../tests/mocks/spotify';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
  }),
}));

const { getConnectState } = await import('./connect-state');

afterEach(() => {
  jar.clear();
  vi.unstubAllEnvs();
});

async function putSession(secret = SECRET) {
  const header = await sessionCookie(undefined, secret);
  jar.set('encore_session', header.slice('encore_session='.length));
}

describe('getConnectState', () => {
  it('desabilitado sem credenciais', async () => {
    useDisabledEnv();
    await expect(getConnectState()).resolves.toBe('disabled');
  });

  it('conectado só com sessão válida', async () => {
    useConnectEnv();
    await expect(getConnectState()).resolves.toBe('disconnected');
    await putSession('O'.repeat(43));
    await expect(getConnectState()).resolves.toBe('disconnected');
    await putSession();
    await expect(getConnectState()).resolves.toBe('connected');
  });
});
