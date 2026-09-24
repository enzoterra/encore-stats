import 'server-only';

import { z } from 'zod';

/**
 * Configuração do servidor (12-factor), validada com Zod.
 * Catálogo completo em `docs/projeto/03-arquitetura.md` e em `.env.example`.
 *
 * Regras:
 * - Sem nenhuma credencial do Spotify o app sobe normalmente: o modo Conectar fica
 *   desabilitado e Upload + Demo funcionam.
 * - Credenciais parciais são erro de configuração (fail fast), para não esconder um
 *   `.env` incompleto atrás de um botão desabilitado.
 * - Mensagens de erro citam só o NOME da variável, nunca o valor.
 * - Na Vercel (preview/produção) tudo é HTTPS, então o cookie de sessão é sempre
 *   `__Host-` + `Secure`. HTTP só é aceito em loopback (desenvolvimento local).
 * - `SPOTIFY_API_BASE` e `SPOTIFY_ACCOUNTS_BASE` (mocks de teste) só apontam para loopback
 *   e são proibidas em qualquer deploy da Vercel.
 */

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();

/** 32 bytes em base64url sem padding = 43 caracteres. */
const SESSION_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const sessionSecret = optionalString.refine(
  (value) => value === undefined || SESSION_SECRET_PATTERN.test(value),
  { message: 'deve ter 32 bytes em base64url (43 caracteres, sem "=")' },
);

const optionalUrl = optionalString.refine(
  (value) => value === undefined || z.url().safeParse(value).success,
  { message: 'deve ser uma URL absoluta' },
);

/** Hosts de loopback: os únicos em que HTTP é aceito (o tráfego não sai da máquina). */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', 'localhost']);

function safeUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

export function isLoopbackUrl(value: string): boolean {
  const url = safeUrl(value);
  return url !== undefined && LOOPBACK_HOSTS.has(url.hostname);
}

/** HTTPS em qualquer host; HTTP só em loopback. */
function isHttpsOrLoopback(url: URL): boolean {
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}

export const CALLBACK_PATH = '/api/auth/callback';
export const DEFAULT_SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
export const DEFAULT_SPOTIFY_ACCOUNTS_BASE = 'https://accounts.spotify.com';

const HTTPS_MESSAGE = 'deve usar HTTPS (HTTP só em loopback, fora da Vercel)';

export const envSchema = z
  .object({
    SPOTIFY_CLIENT_ID: optionalString,
    SPOTIFY_CLIENT_SECRET: optionalString,
    SPOTIFY_REDIRECT_URI: optionalUrl,
    SESSION_SECRET: sessionSecret,
    SESSION_SECRET_PREVIOUS: sessionSecret,
    NEXT_PUBLIC_SITE_URL: optionalUrl,
    NEXT_PUBLIC_REPO_URL: optionalUrl,
    SPOTIFY_API_BASE: optionalUrl,
    SPOTIFY_ACCOUNTS_BASE: optionalUrl,
    VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
  })
  .superRefine((env, ctx) => {
    const spotifyKeys = [
      'SPOTIFY_CLIENT_ID',
      'SPOTIFY_CLIENT_SECRET',
      'SPOTIFY_REDIRECT_URI',
    ] as const;
    const present = spotifyKeys.filter((key) => env[key] !== undefined);
    if (present.length > 0 && present.length < spotifyKeys.length) {
      for (const key of spotifyKeys) {
        if (env[key] === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'obrigatória quando outra credencial do Spotify está definida',
          });
        }
      }
    }
    if (present.length === spotifyKeys.length && env.SESSION_SECRET === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_SECRET'],
        message: 'obrigatória quando o modo Conectar está configurado',
      });
    }

    const onVercelDeploy = env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'production';

    // URLs já reprovadas no próprio campo (formato) ficam de fora das regras abaixo.
    for (const key of ['SPOTIFY_REDIRECT_URI', 'NEXT_PUBLIC_SITE_URL'] as const) {
      const url = env[key] === undefined ? undefined : safeUrl(env[key]);
      if (url === undefined) continue;
      if (!isHttpsOrLoopback(url) || (onVercelDeploy && url.protocol !== 'https:')) {
        ctx.addIssue({ code: 'custom', path: [key], message: HTTPS_MESSAGE });
      }
    }

    const redirect =
      env.SPOTIFY_REDIRECT_URI === undefined ? undefined : safeUrl(env.SPOTIFY_REDIRECT_URI);
    if (redirect !== undefined) {
      if (redirect.pathname !== CALLBACK_PATH || redirect.search !== '' || redirect.hash !== '') {
        ctx.addIssue({
          code: 'custom',
          path: ['SPOTIFY_REDIRECT_URI'],
          message: `deve apontar exatamente para ${CALLBACK_PATH}`,
        });
      }
    }

    for (const key of ['SPOTIFY_API_BASE', 'SPOTIFY_ACCOUNTS_BASE'] as const) {
      const value = env[key];
      if (value === undefined || safeUrl(value) === undefined) continue;
      if (onVercelDeploy) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'proibida em deploys da Vercel' });
      } else if (!isLoopbackUrl(value)) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'só aceita loopback (mock local)' });
      }
    }

    if (env.VERCEL_ENV === 'production' && env.NEXT_PUBLIC_SITE_URL === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_SITE_URL'],
        message: 'obrigatória em produção',
      });
    }
  });

export type ConnectStatus = { enabled: true } | { enabled: false; reason: 'missing-credentials' };

export type SpotifyConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Origem do app segundo a redirect URI: é nela que os cookies vivem. */
  appOrigin: string;
  /** `https://api.spotify.com/v1` ou um mock em loopback (fora da Vercel). */
  apiBase: string;
  /** `https://accounts.spotify.com` ou um mock em loopback (fora da Vercel). */
  accountsBase: string;
  /**
   * `true` quando a redirect URI é HTTPS: cookies `__Host-` + `Secure`. Em HTTP de loopback
   * (dev local) os cookies saem sem prefixo e sem `Secure` (ver `src/server/cookies.ts`).
   */
  secureCookies: boolean;
};

export type ServerEnv = {
  spotify: SpotifyConfig | undefined;
  sessionSecret: string | undefined;
  sessionSecretPrevious: string | undefined;
  siteUrl: string;
  repoUrl: string | undefined;
  vercelEnv: 'development' | 'preview' | 'production' | undefined;
  connect: ConnectStatus;
};

export const DEFAULT_SITE_URL = 'http://127.0.0.1:3000';

export class EnvValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Configuração de ambiente inválida:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** Função pura: recebe um objeto de ambiente e devolve a configuração tipada. */
export function parseEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(env)'}: ${issue.message}`),
    );
  }
  const env = result.data;
  const spotify: SpotifyConfig | undefined =
    env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET && env.SPOTIFY_REDIRECT_URI
      ? {
          clientId: env.SPOTIFY_CLIENT_ID,
          clientSecret: env.SPOTIFY_CLIENT_SECRET,
          redirectUri: env.SPOTIFY_REDIRECT_URI,
          appOrigin: new URL(env.SPOTIFY_REDIRECT_URI).origin,
          apiBase: stripTrailingSlash(env.SPOTIFY_API_BASE ?? DEFAULT_SPOTIFY_API_BASE),
          accountsBase: stripTrailingSlash(
            env.SPOTIFY_ACCOUNTS_BASE ?? DEFAULT_SPOTIFY_ACCOUNTS_BASE,
          ),
          secureCookies: new URL(env.SPOTIFY_REDIRECT_URI).protocol === 'https:',
        }
      : undefined;

  return {
    spotify,
    sessionSecret: env.SESSION_SECRET,
    sessionSecretPrevious: env.SESSION_SECRET_PREVIOUS,
    siteUrl: env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL,
    repoUrl: env.NEXT_PUBLIC_REPO_URL,
    vercelEnv: env.VERCEL_ENV,
    connect:
      spotify && env.SESSION_SECRET
        ? { enabled: true }
        : { enabled: false, reason: 'missing-credentials' },
  };
}

let cached: ServerEnv | undefined;

/** Configuração do processo atual, validada uma única vez. */
export function getServerEnv(): ServerEnv {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Só para testes: descarta a configuração em cache (use junto de `vi.stubEnv`). */
export function resetServerEnvCache(): void {
  cached = undefined;
}

/** Flag lida pela UI para habilitar ou não o botão "Conectar com o Spotify". */
export function getConnectStatus(): ConnectStatus {
  return getServerEnv().connect;
}

/** Configuração completa do Conectar, ou `undefined` quando o modo está desabilitado. */
export function getConnectConfig():
  | { spotify: SpotifyConfig; sessionSecret: string; sessionSecretPrevious: string | undefined }
  | undefined {
  const env = getServerEnv();
  if (!env.spotify || !env.sessionSecret) return undefined;
  return {
    spotify: env.spotify,
    sessionSecret: env.sessionSecret,
    sessionSecretPrevious: env.sessionSecretPrevious,
  };
}
