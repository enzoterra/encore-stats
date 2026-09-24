import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildFixtures, FIXTURES_DIR } from '../scripts/make-fixtures';

describe('tests/fixtures', () => {
  const fixtures = buildFixtures();

  it.each(Object.keys(fixtures))('%s está atualizada (rode `pnpm fixtures`)', (name) => {
    const path = join(FIXTURES_DIR, name);
    expect(existsSync(path)).toBe(true);
    expect(new Uint8Array(readFileSync(path))).toEqual(fixtures[name]);
  });

  it('a zip bomb é pequena no disco', () => {
    expect(fixtures['zip-bomb.zip']!.length).toBeLessThan(300 * 1024);
  });

  it('não contém IPs fora da faixa de documentação', () => {
    const text = new TextDecoder().decode(fixtures['loose/Streaming_History_Audio_2025_0.json']);
    const ips = text.match(/\d+\.\d+\.\d+\.\d+/g) ?? [];
    expect(ips.length).toBeGreaterThan(0);
    for (const ip of ips) expect(ip.startsWith('192.0.2.')).toBe(true);
  });
});
