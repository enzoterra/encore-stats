import { decodeProtectedHeader } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OTHER_SECRET, PREVIOUS_SECRET, SECRET, sessionData } from '../../tests/mocks/spotify';

import {
  cookieName,
  readCookie,
  serializeClearedCookie,
  serializeCookie,
  SESSION_COOKIE,
} from './cookies';
import {
  OAUTH_MAX_AGE_S,
  openOAuth,
  openSession,
  seal,
  sealOAuth,
  sealSession,
  SESSION_MAX_AGE_S,
  sessionRemainingSeconds,
} from './session';

const secrets = { current: SECRET };
const oauth = { state: 's'.repeat(43), verifier: 'v'.repeat(43), locale: 'pt-BR', iat: 0 };

function tamper(token: string): string {
  const parts = token.split('.');
  const ciphertext = parts[3] as string;
  const flipped = (ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1);
  parts[3] = flipped;
  return parts.join('.');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('sessão JWE', () => {
  it('sela e abre a sessão (dir + A256GCM, com kid e typ)', async () => {
    const data = sessionData();
    const token = await sealSession(data, secrets);
    expect(token.split('.')).toHaveLength(5);
    const header = decodeProtectedHeader(token);
    expect(header).toMatchObject({ alg: 'dir', enc: 'A256GCM', typ: 'session' });
    expect(header.kid).toMatch(/^[A-Za-z0-9_-]{8}$/);
    await expect(openSession(token, secrets)).resolves.toEqual(data);
  });

  it('não expõe os tokens em claro no cookie', async () => {
    const token = await sealSession(sessionData(), secrets);
    expect(token).not.toContain('access-token');
    expect(Buffer.from(token.split('.')[3] as string, 'base64url').toString()).not.toContain(
      'refresh-token',
    );
  });

  it('rejeita cookie adulterado, truncado, lixo ou gigante', async () => {
    const token = await sealSession(sessionData(), secrets);
    await expect(openSession(tamper(token), secrets)).resolves.toBeNull();
    await expect(openSession(token.slice(0, -2), secrets)).resolves.toBeNull();
    await expect(openSession('nao-e-um-jwe', secrets)).resolves.toBeNull();
    await expect(openSession(`${token}${'A'.repeat(5000)}`, secrets)).resolves.toBeNull();
  });

  it('rejeita cookie selado com outro segredo', async () => {
    const token = await sealSession(sessionData(), { current: OTHER_SECRET });
    await expect(openSession(token, secrets)).resolves.toBeNull();
  });

  it('rotação: cookie selado com a chave anterior ainda abre; novos saem com a atual', async () => {
    const old = await sealSession(sessionData(), { current: PREVIOUS_SECRET });
    const rotated = { current: SECRET, previous: PREVIOUS_SECRET };
    await expect(openSession(old, rotated)).resolves.toEqual(
      expect.objectContaining({ at: 'access-token-original' }),
    );
    // Sem o segredo anterior configurado, o cookie antigo deixa de valer.
    await expect(openSession(old, secrets)).resolves.toBeNull();
    const fresh = await sealSession(sessionData(), rotated);
    const current = await sealSession(sessionData(), secrets);
    expect(decodeProtectedHeader(fresh).kid).toBe(decodeProtectedHeader(current).kid);
    expect(decodeProtectedHeader(fresh).kid).not.toBe(decodeProtectedHeader(old).kid);
  });

  it('um cookie do OAuth não abre como sessão (chave e typ por finalidade)', async () => {
    const token = await sealOAuth({ ...oauth, iat: Math.floor(Date.now() / 1000) }, secrets);
    await expect(openSession(token, secrets)).resolves.toBeNull();
    // Mesmo forjando o typ com a chave da sessão, o conteúdo precisa do schema da sessão.
    const forged = await seal('session', { ...oauth, iat: 1 } as never, secrets);
    await expect(openSession(forged, secrets)).resolves.toBeNull();
  });

  it('expira 30 dias depois do login, mesmo com refresh', async () => {
    const now = Math.floor(Date.now() / 1000);
    const almost = sessionData({ authAt: now - SESSION_MAX_AGE_S + 10 });
    const expired = sessionData({ authAt: now - SESSION_MAX_AGE_S - 1 });
    const future = sessionData({ authAt: now + 3600 });
    await expect(openSession(await sealSession(almost, secrets), secrets)).resolves.not.toBeNull();
    await expect(openSession(await sealSession(expired, secrets), secrets)).resolves.toBeNull();
    await expect(openSession(await sealSession(future, secrets), secrets)).resolves.toBeNull();
    expect(sessionRemainingSeconds(almost)).toBeLessThanOrEqual(10);
    expect(sessionRemainingSeconds(expired)).toBe(0);
  });

  it('recusa selar conteúdo fora do schema', async () => {
    await expect(sealSession({ at: '', rt: 'x', exp: 1, authAt: 1 }, secrets)).rejects.toThrow();
  });
});

describe('cookie temporário do OAuth', () => {
  it('abre dentro de 10 minutos e expira depois', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
    const iat = Math.floor(Date.now() / 1000);
    const token = await sealOAuth({ ...oauth, iat }, secrets);
    await expect(openOAuth(token, secrets)).resolves.toEqual({ ...oauth, iat });
    vi.setSystemTime(new Date((iat + OAUTH_MAX_AGE_S - 1) * 1000));
    await expect(openOAuth(token, secrets)).resolves.not.toBeNull();
    vi.setSystemTime(new Date((iat + OAUTH_MAX_AGE_S) * 1000));
    await expect(openOAuth(token, secrets)).resolves.toBeNull();
  });

  it('rejeita adulteração e a sessão no lugar do OAuth', async () => {
    const token = await sealOAuth({ ...oauth, iat: Math.floor(Date.now() / 1000) }, secrets);
    await expect(openOAuth(tamper(token), secrets)).resolves.toBeNull();
    const session = await sealSession(sessionData(), secrets);
    await expect(openOAuth(session, secrets)).resolves.toBeNull();
  });
});

describe('cookies', () => {
  it('usa __Host- + Secure em HTTPS e nome sem prefixo em HTTP de loopback', () => {
    expect(cookieName(SESSION_COOKIE, true)).toBe('__Host-encore_session');
    expect(cookieName(SESSION_COOKIE, false)).toBe('encore_session');
    expect(serializeCookie('__Host-encore_session', 'v', { maxAge: 60, secure: true })).toBe(
      '__Host-encore_session=v; Path=/; Max-Age=60; HttpOnly; SameSite=Lax; Secure',
    );
    expect(serializeCookie('encore_session', 'v', { maxAge: 60, secure: false })).toBe(
      'encore_session=v; Path=/; Max-Age=60; HttpOnly; SameSite=Lax',
    );
  });

  it('apaga com Max-Age=0 e data no passado', () => {
    expect(serializeClearedCookie('__Host-encore_session', true)).toBe(
      '__Host-encore_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    );
  });

  it('lê o cookie certo do cabeçalho', () => {
    const request = new Request('http://127.0.0.1:3000/', {
      headers: { cookie: 'a=1; encore_session=abc.def; encore_session_x=zzz; vazio=' },
    });
    expect(readCookie(request, 'encore_session')).toBe('abc.def');
    expect(readCookie(request, 'vazio')).toBeUndefined();
    expect(readCookie(request, 'ausente')).toBeUndefined();
    expect(readCookie(new Request('http://127.0.0.1:3000/'), 'a')).toBeUndefined();
  });
});
