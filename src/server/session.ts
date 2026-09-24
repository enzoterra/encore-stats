import 'server-only';

import { CompactEncrypt, compactDecrypt, type CompactJWEHeaderParameters } from 'jose';
import { z } from 'zod';

import { MAX_COOKIE_VALUE_LENGTH } from './cookies';

/**
 * Sessão sem banco: o cookie guarda um JWE compacto (`alg: dir`, `enc: A256GCM`), autenticado e
 * cifrado (ADR 2, 08-seguranca.md). Nada de token sai do servidor em claro.
 *
 * - Chaves derivadas por HKDF-SHA-256 do `SESSION_SECRET`, uma por finalidade (`session` e
 *   `oauth`): um cookie de uma finalidade não abre como a outra, e o `typ` do cabeçalho reforça.
 * - `kid` = impressão curta (HKDF) do segredo. Na rotação, `SESSION_SECRET` passa a ser o novo e
 *   `SESSION_SECRET_PREVIOUS` o antigo: cookies do antigo continuam abrindo e são resselados com
 *   o novo no próximo refresh; os novos saem sempre com o segredo atual.
 * - Qualquer falha (adulteração, `kid` desconhecido, JSON inválido, expiração) vira `null`.
 */

export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;
export const OAUTH_MAX_AGE_S = 10 * 60;
/** Tolerância de relógio para `authAt`/`iat` no futuro. */
const CLOCK_SKEW_S = 60;

export type SealPurpose = 'session' | 'oauth';

export type SessionSecrets = { current: string; previous?: string | undefined };

/** Conteúdo da sessão: `exp` é a expiração do access token (epoch s); `authAt`, a do login. */
export const sessionDataSchema = z
  .object({
    at: z.string().min(1).max(2048),
    rt: z.string().min(1).max(2048),
    exp: z.number().int().positive(),
    authAt: z.number().int().positive(),
  })
  .strict();
export type SessionData = z.infer<typeof sessionDataSchema>;

/** Cookie temporário do OAuth (10 min): `state`, `code_verifier` do PKCE e idioma de retorno. */
export const oauthDataSchema = z
  .object({
    state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    verifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
    locale: z.string().min(2).max(16),
    iat: z.number().int().positive(),
  })
  .strict();
export type OAuthData = z.infer<typeof oauthDataSchema>;

type DerivedKey = { kid: string; key: Uint8Array };

const keyCache = new Map<string, Promise<DerivedKey>>();
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

async function hkdf(secret: Uint8Array, info: string, bits: number): Promise<Uint8Array> {
  const ikm = await crypto.subtle.importKey('raw', secret as BufferSource, 'HKDF', false, [
    'deriveBits',
  ]);
  const derived = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('encore'), info: encoder.encode(info) },
    ikm,
    bits,
  );
  return new Uint8Array(derived);
}

function deriveKey(secret: string, purpose: SealPurpose): Promise<DerivedKey> {
  const cacheKey = `${purpose}:${secret}`;
  let pending = keyCache.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      const raw = new Uint8Array(Buffer.from(secret, 'base64url'));
      if (raw.byteLength !== 32) throw new Error('SESSION_SECRET deve ter 32 bytes');
      const [key, fingerprint] = await Promise.all([
        hkdf(raw, `encore/${purpose}/v1`, 256),
        hkdf(raw, 'encore/kid/v1', 48),
      ]);
      return { key, kid: toBase64Url(fingerprint) };
    })();
    keyCache.set(cacheKey, pending);
  }
  return pending;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Sela um objeto como JWE compacto com o segredo atual. */
export async function seal(
  purpose: SealPurpose,
  payload: SessionData | OAuthData,
  secrets: SessionSecrets,
): Promise<string> {
  const { key, kid } = await deriveKey(secrets.current, purpose);
  return new CompactEncrypt(encoder.encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM', kid, typ: purpose })
    .encrypt(key);
}

async function openRaw(
  purpose: SealPurpose,
  token: string,
  secrets: SessionSecrets,
): Promise<unknown> {
  if (token.length > MAX_COOKIE_VALUE_LENGTH) return null;
  const candidates = [secrets.current, secrets.previous].filter(
    (secret): secret is string => secret !== undefined,
  );
  const keys = await Promise.all(candidates.map((secret) => deriveKey(secret, purpose)));
  try {
    const { plaintext } = await compactDecrypt(
      token,
      (header: CompactJWEHeaderParameters) => {
        if (header.typ !== purpose) throw new Error('typ inesperado');
        const match = keys.find((candidate) => candidate.kid === header.kid);
        if (!match) throw new Error('kid desconhecido');
        return match.key;
      },
      { keyManagementAlgorithms: ['dir'], contentEncryptionAlgorithms: ['A256GCM'] },
    );
    return JSON.parse(decoder.decode(plaintext));
  } catch {
    return null;
  }
}

export async function sealSession(data: SessionData, secrets: SessionSecrets): Promise<string> {
  return seal('session', sessionDataSchema.parse(data), secrets);
}

/** Abre o cookie de sessão; `null` se inválido, adulterado ou com mais de 30 dias de login. */
export async function openSession(
  token: string,
  secrets: SessionSecrets,
): Promise<SessionData | null> {
  const parsed = sessionDataSchema.safeParse(await openRaw('session', token, secrets));
  if (!parsed.success) return null;
  const now = nowSeconds();
  const { authAt } = parsed.data;
  if (authAt > now + CLOCK_SKEW_S || now >= authAt + SESSION_MAX_AGE_S) return null;
  return parsed.data;
}

/** Segundos que restam do teto absoluto de 30 dias desde o login (base do `Max-Age`). */
export function sessionRemainingSeconds(data: SessionData): number {
  return Math.max(0, data.authAt + SESSION_MAX_AGE_S - nowSeconds());
}

export async function sealOAuth(data: OAuthData, secrets: SessionSecrets): Promise<string> {
  return seal('oauth', oauthDataSchema.parse(data), secrets);
}

/** Abre o cookie temporário do OAuth; `null` se inválido ou com mais de 10 minutos. */
export async function openOAuth(token: string, secrets: SessionSecrets): Promise<OAuthData | null> {
  const parsed = oauthDataSchema.safeParse(await openRaw('oauth', token, secrets));
  if (!parsed.success) return null;
  const now = nowSeconds();
  const { iat } = parsed.data;
  if (iat > now + CLOCK_SKEW_S || now >= iat + OAUTH_MAX_AGE_S) return null;
  return parsed.data;
}
