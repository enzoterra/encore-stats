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

export const envSchema = z
  .object({
    SPOTIFY_CLIENT_ID: optionalString,
    SPOTIFY_CLIENT_SECRET: optionalString,
    SPOTIFY_REDIRECT_URI: optionalUrl,
    SESSION_SECRET: sessionSecret,
    SESSION_SECRET_PREVIOUS: sessionSecret,
    NEXT_PUBLIC_SITE_URL: optionalUrl,
    NEXT_PUBLIC_REPO_URL: optionalUrl,
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
    if (env.VERCEL_ENV === 'production' && env.NEXT_PUBLIC_SITE_URL === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_SITE_URL'],
        message: 'obrigatória em produção',
      });
    }
  });

export type ConnectStatus = { enabled: true } | { enabled: false; reason: 'missing-credentials' };

export type ServerEnv = {
  spotify: { clientId: string; clientSecret: string; redirectUri: string } | undefined;
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

/** Função pura: recebe um objeto de ambiente e devolve a configuração tipada. */
export function parseEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(env)'}: ${issue.message}`),
    );
  }
  const env = result.data;
  const spotify =
    env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET && env.SPOTIFY_REDIRECT_URI
      ? {
          clientId: env.SPOTIFY_CLIENT_ID,
          clientSecret: env.SPOTIFY_CLIENT_SECRET,
          redirectUri: env.SPOTIFY_REDIRECT_URI,
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

/** Flag lida pela UI para habilitar ou não o botão "Conectar com o Spotify". */
export function getConnectStatus(): ConnectStatus {
  return getServerEnv().connect;
}
