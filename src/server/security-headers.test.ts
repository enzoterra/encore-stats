import { describe, expect, it } from 'vitest';

import {
  apiSecurityHeaders,
  buildContentSecurityPolicy,
  buildWorkerContentSecurityPolicy,
  generateNonce,
  staticSecurityHeaders,
} from './security-headers';

describe('buildContentSecurityPolicy', () => {
  const prod = buildContentSecurityPolicy({ nonce: 'abc123', isDev: false, isHttps: true });

  it('aplica o nonce e strict-dynamic em script-src e style-src', () => {
    expect(prod).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic';");
    expect(prod).toContain("style-src 'self' 'nonce-abc123'");
  });

  it('bloqueia framing, plugins, base e conexões fora da origem', () => {
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("base-uri 'none'");
    // ADR 9: além da origem, só o CDN de capas do Spotify (bytes da capa do card do Conectar).
    expect(prod).toContain("connect-src 'self' https://i.scdn.co;");
    expect(prod).toContain("form-action 'self' https://accounts.spotify.com");
    expect(prod).toContain('upgrade-insecure-requests');
  });

  it('só aceita workers da própria origem (sem blob:)', () => {
    expect(prod).toContain("worker-src 'self';");
    expect(prod).not.toMatch(/worker-src[^;]*blob:/);
  });

  it('não usa unsafe-eval, wasm-unsafe-eval nem unsafe-inline nas páginas em produção', () => {
    // O WASM dos cards roda só no worker, que tem a própria CSP.
    expect(prod).not.toContain('unsafe-eval');
    expect(prod).not.toContain("'unsafe-inline'");
  });

  it('libera só o necessário em dev e não força HTTPS em HTTP local', () => {
    const dev = buildContentSecurityPolicy({ nonce: 'n', isDev: true, isHttps: false });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain('upgrade-insecure-requests');
  });
});

describe('buildWorkerContentSecurityPolicy', () => {
  it('libera WASM só no worker e proíbe rede (só data: local)', () => {
    const worker = buildWorkerContentSecurityPolicy({ isDev: false });
    expect(worker).toBe(
      "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src data:; base-uri 'none'",
    );
    expect(worker).not.toContain("'unsafe-eval'");
    expect(worker).not.toContain('https:');
  });

  it('em dev aceita o eval do bundler e a origem (HMR)', () => {
    const dev = buildWorkerContentSecurityPolicy({ isDev: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("connect-src 'self' data:");
  });
});

describe('staticSecurityHeaders', () => {
  it('inclui os cabeçalhos exigidos em 08-seguranca.md', () => {
    const headers = Object.fromEntries(staticSecurityHeaders.map((h) => [h.key, h.value]));
    expect(headers['Strict-Transport-Security']).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(headers['Permissions-Policy']).toContain('camera=()');
    expect(headers['Permissions-Policy']).toContain('microphone=()');
    expect(headers['Permissions-Policy']).toContain('geolocation=()');
  });
});

describe('apiSecurityHeaders', () => {
  it('rotas /api sem conteúdo ativo e sem embutir de outra origem', () => {
    const headers = Object.fromEntries(apiSecurityHeaders.map((h) => [h.key, h.value]));
    expect(headers['Content-Security-Policy']).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    expect(headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
  });
});

describe('generateNonce', () => {
  it('gera nonces base64 de 128 bits, diferentes a cada chamada', () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(a).not.toBe(b);
  });
});
