import { describe, expect, it } from 'vitest';

import { DEFAULT_SITE_URL, EnvValidationError, parseEnv } from './env';

const SECRET = 'A'.repeat(43);
const SPOTIFY = {
  SPOTIFY_CLIENT_ID: 'client-id',
  SPOTIFY_CLIENT_SECRET: 'client-secret',
  SPOTIFY_REDIRECT_URI: 'http://127.0.0.1:3000/api/auth/callback',
};

describe('parseEnv', () => {
  it('sobe com ambiente vazio e deixa o Conectar desabilitado', () => {
    const env = parseEnv({});
    expect(env.connect).toEqual({ enabled: false, reason: 'missing-credentials' });
    expect(env.spotify).toBeUndefined();
    expect(env.siteUrl).toBe(DEFAULT_SITE_URL);
  });

  it('trata strings vazias (como no .env.example copiado) como ausentes', () => {
    const env = parseEnv({
      SPOTIFY_CLIENT_ID: '',
      SPOTIFY_CLIENT_SECRET: ' ',
      SPOTIFY_REDIRECT_URI: '',
      SESSION_SECRET: '',
      NEXT_PUBLIC_SITE_URL: '',
    });
    expect(env.connect.enabled).toBe(false);
  });

  it('habilita o Conectar com credenciais completas e SESSION_SECRET válido', () => {
    const env = parseEnv({ ...SPOTIFY, SESSION_SECRET: SECRET });
    expect(env.connect).toEqual({ enabled: true });
    expect(env.spotify?.redirectUri).toBe(SPOTIFY.SPOTIFY_REDIRECT_URI);
  });

  it('rejeita credenciais parciais do Spotify citando só os nomes das variáveis', () => {
    const run = () => parseEnv({ SPOTIFY_CLIENT_ID: 'client-id' });
    expect(run).toThrow(EnvValidationError);
    try {
      run();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('SPOTIFY_CLIENT_SECRET');
      expect(message).toContain('SPOTIFY_REDIRECT_URI');
      expect(message).not.toContain('client-id');
    }
  });

  it('exige SESSION_SECRET quando o Spotify está configurado', () => {
    expect(() => parseEnv(SPOTIFY)).toThrow(/SESSION_SECRET/);
  });

  it('rejeita SESSION_SECRET fora do formato de 32 bytes em base64url', () => {
    expect(() => parseEnv({ ...SPOTIFY, SESSION_SECRET: 'curto' })).toThrow(/SESSION_SECRET/);
    expect(() => parseEnv({ SESSION_SECRET_PREVIOUS: `${'A'.repeat(42)}=` })).toThrow(
      /SESSION_SECRET_PREVIOUS/,
    );
  });

  it('rejeita URLs inválidas', () => {
    expect(() => parseEnv({ NEXT_PUBLIC_SITE_URL: 'não é url' })).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it('deriva origem, bases padrão e cookies Secure a partir da redirect URI', () => {
    const local = parseEnv({ ...SPOTIFY, SESSION_SECRET: SECRET }).spotify;
    expect(local).toMatchObject({
      appOrigin: 'http://127.0.0.1:3000',
      apiBase: 'https://api.spotify.com/v1',
      accountsBase: 'https://accounts.spotify.com',
      secureCookies: false,
    });
    const prod = parseEnv({
      ...SPOTIFY,
      SPOTIFY_REDIRECT_URI: 'https://encore.example/api/auth/callback',
      SESSION_SECRET: SECRET,
      NEXT_PUBLIC_SITE_URL: 'https://encore.example',
      VERCEL_ENV: 'production',
    }).spotify;
    expect(prod).toMatchObject({ appOrigin: 'https://encore.example', secureCookies: true });
  });

  it('só aceita HTTP em loopback e nunca em deploy da Vercel', () => {
    expect(() =>
      parseEnv({
        ...SPOTIFY,
        SPOTIFY_REDIRECT_URI: 'http://encore.example/api/auth/callback',
        SESSION_SECRET: SECRET,
      }),
    ).toThrow(/SPOTIFY_REDIRECT_URI/);
    expect(() => parseEnv({ NEXT_PUBLIC_SITE_URL: 'http://encore.example' })).toThrow(
      /NEXT_PUBLIC_SITE_URL/,
    );
    expect(() => parseEnv({ ...SPOTIFY, SESSION_SECRET: SECRET, VERCEL_ENV: 'preview' })).toThrow(
      /SPOTIFY_REDIRECT_URI/,
    );
    expect(() =>
      parseEnv({ VERCEL_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000' }),
    ).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it('exige que a redirect URI aponte para /api/auth/callback', () => {
    for (const uri of [
      'http://127.0.0.1:3000/callback',
      'http://127.0.0.1:3000/api/auth/callback?x=1',
    ]) {
      expect(() =>
        parseEnv({ ...SPOTIFY, SPOTIFY_REDIRECT_URI: uri, SESSION_SECRET: SECRET }),
      ).toThrow(/SPOTIFY_REDIRECT_URI/);
    }
  });

  it('bases do Spotify trocáveis só por loopback e fora da Vercel (mocks de teste)', () => {
    const mocked = parseEnv({
      ...SPOTIFY,
      SESSION_SECRET: SECRET,
      SPOTIFY_API_BASE: 'http://127.0.0.1:4010/v1/',
      SPOTIFY_ACCOUNTS_BASE: 'http://127.0.0.1:4010',
    }).spotify;
    expect(mocked).toMatchObject({
      apiBase: 'http://127.0.0.1:4010/v1',
      accountsBase: 'http://127.0.0.1:4010',
    });
    expect(() => parseEnv({ SPOTIFY_API_BASE: 'https://evil.example/v1' })).toThrow(
      /SPOTIFY_API_BASE: só aceita loopback/,
    );
    for (const VERCEL_ENV of ['preview', 'production']) {
      expect(() =>
        parseEnv({
          VERCEL_ENV,
          NEXT_PUBLIC_SITE_URL: 'https://encore.example',
          SPOTIFY_ACCOUNTS_BASE: 'http://127.0.0.1:4010',
        }),
      ).toThrow(/SPOTIFY_ACCOUNTS_BASE: proibida em deploys da Vercel/);
    }
  });

  it('exige NEXT_PUBLIC_SITE_URL em produção na Vercel', () => {
    expect(() => parseEnv({ VERCEL_ENV: 'production' })).toThrow(/NEXT_PUBLIC_SITE_URL/);
    expect(
      parseEnv({ VERCEL_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://encore.example' })
        .siteUrl,
    ).toBe('https://encore.example');
  });
});
