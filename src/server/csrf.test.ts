import { describe, expect, it } from 'vitest';

import { isSameOriginRequest } from './csrf';

const APP = 'https://encore.example';

function check(headers: Record<string, string>): boolean {
  return isSameOriginRequest(
    new Request(`${APP}/api/auth/logout`, { method: 'POST', headers }),
    APP,
  );
}

describe('isSameOriginRequest', () => {
  it('aceita a origem do app', () => {
    expect(check({ origin: APP })).toBe(true);
    expect(check({ origin: APP, 'sec-fetch-site': 'same-origin' })).toBe(true);
  });

  it('aceita Origin: null só com Sec-Fetch-Site: same-origin (efeito do no-referrer)', () => {
    expect(check({ origin: 'null', 'sec-fetch-site': 'same-origin' })).toBe(true);
    expect(check({ origin: 'null' })).toBe(false);
    expect(check({ origin: 'null', 'sec-fetch-site': 'cross-site' })).toBe(false);
  });

  it('nega sem Origin, com outra origem ou com Sec-Fetch-Site de fora', () => {
    expect(check({})).toBe(false);
    expect(check({ 'sec-fetch-site': 'same-origin' })).toBe(false);
    expect(check({ origin: 'https://evil.example' })).toBe(false);
    expect(check({ origin: 'https://encore.example.evil.com' })).toBe(false);
    expect(check({ origin: APP, 'sec-fetch-site': 'same-site' })).toBe(false);
  });
});
