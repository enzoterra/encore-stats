import 'server-only';

import { parseEnv, type ConnectStatus, type ServerEnv, type SpotifyConfig } from './env-schema';

// Schema, tipos e constantes ficam em `env-schema.ts` (puro, também usado pelo `next.config.ts`).
export * from './env-schema';

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
