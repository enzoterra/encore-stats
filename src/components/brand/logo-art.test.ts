import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LOCKUP, lockupSvg, lockupWidth } from './logo-art';

const SOURCE = fileURLToPath(
  new URL('../../../docs/projeto/design/logo/conceito-2.svg', import.meta.url),
);

/** Os `d` dos paths, na ordem do arquivo. */
const paths = (svg: string) => [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);

describe('logo (conceito 2, variação 3)', () => {
  it('o desenho é o mesmo do SVG aprovado em design/logo/', () => {
    const source = readFileSync(SOURCE, 'utf8');
    expect(paths(lockupSvg())).toEqual(paths(source));
    expect(source).toContain(`viewBox="0 0 ${LOCKUP.width} ${LOCKUP.height}"`);
    expect(source).toContain(`stroke-width="${LOCKUP.arcWidth}"`);
    for (const color of ['#FF3D8B', '#FF7A1A', '#FFE14D']) expect(lockupSvg()).toContain(color);
  });

  it('SVG autônomo, só com paths e degradê (sem texto, fonte nem script)', () => {
    const svg = lockupSvg();
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).not.toMatch(/<text|<script|<style|font-family|href=/);
  });

  it('a largura segue a proporção (nunca esticar); 12 px de altura passa do mínimo de 64 px', () => {
    expect(lockupWidth(56)).toBe(308.3);
    expect(lockupWidth(12)).toBeGreaterThanOrEqual(64);
    expect(lockupWidth(30)).toBe(165.2);
  });
});
