import { describe, expect, it } from 'vitest';

import {
  buildContentSecurityPolicy,
  generateNonce,
  staticSecurityHeaders,
} from './security-headers';

describe('buildContentSecurityPolicy', () => {
  const prod = buildContentSecurityPolicy({ nonce: 'abc123', isDev: false, isHttps: true });

  it('aplica o nonce e strict-dynamic em script-src e style-src', () => {
    expect(prod).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic' 'wasm-unsafe-eval'");
    expect(prod).toContain("style-src 'self' 'nonce-abc123'");
  });

  it('bloqueia framing, plugins, base e conexões fora da origem', () => {
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("base-uri 'none'");
    expect(prod).toContain("connect-src 'self';");
    expect(prod).toContain("form-action 'self' https://accounts.spotify.com");
    expect(prod).toContain('upgrade-insecure-requests');
  });

  it('não usa unsafe-eval nem unsafe-inline em produção', () => {
    // `'wasm-unsafe-eval'` (resvg-wasm) é permitido; `'unsafe-eval'` não.
    expect(prod).not.toContain("'unsafe-eval'");
    expect(prod).not.toContain("'unsafe-inline'");
  });

  it('libera só o necessário em dev e não força HTTPS em HTTP local', () => {
    const dev = buildContentSecurityPolicy({ nonce: 'n', isDev: true, isHttps: false });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain('upgrade-insecure-requests');
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

describe('generateNonce', () => {
  it('gera nonces base64 de 128 bits, diferentes a cada chamada', () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(a).not.toBe(b);
  });
});
