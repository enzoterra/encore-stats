import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { createCardWorkerApi } from '@/workers/card-worker-api';

import {
  ARTISTS,
  CONNECT_DATA,
  loadCardFonts,
  loadResvgWasm,
  spotifyLogoDataUrl,
  TRACKS,
  UPLOAD_DATA,
} from '../../../tests/support/cards';
import { decodePng, diffRatio, pngSize } from '../../../tests/support/png';
import type { CardData, CardFormat, CardMode, CardTemplate } from './model';
import { initResvg, renderCardPng, toSatoriFonts } from './render';

/**
 * Snapshot visual (S6.4): o PNG gerado em Node é comparado com a referência em
 * `tests/snapshots/cards/` com tolerância (antialiasing muda entre versões do resvg).
 * `UPDATE_CARD_SNAPSHOTS=1 pnpm test` regrava as referências.
 */
const DIR = fileURLToPath(new URL('../../../tests/snapshots/cards/', import.meta.url));
const UPDATE = process.env.UPDATE_CARD_SNAPSHOTS === '1';
/** Até 0,5% dos pixels podem mudar além do limiar. */
const TOLERANCE = 0.005;

const STRESS: CardData = {
  ...UPLOAD_DATA,
  topArtists: [
    'Orquestra Sinfônica de Garagem do Bairro Alto',
    'Ñandú & Los Çãopeões',
    'Жанна Агузарова',
    ...ARTISTS.slice(3),
  ],
  topTracks: [
    {
      name: 'Uma Música Com Título Realmente Muito Comprido (Remix Estendido)',
      artist: 'Coletivo Com Nome Enorme Também',
    },
    ...TRACKS.slice(1),
  ],
  posterName: 'Maria Eduarda',
};

const CASES: [CardTemplate, CardFormat, CardMode, () => CardData, string?][] = [
  ['festival', 'story', 'upload', () => UPLOAD_DATA],
  ['festival', 'square', 'demo', () => UPLOAD_DATA],
  ['basic', 'story', 'upload', () => UPLOAD_DATA],
  ['basic', 'square', 'upload', () => UPLOAD_DATA],
  ['basic', 'story', 'connect', () => ({ ...CONNECT_DATA, spotifyLogo: spotifyLogoDataUrl() })],
  ['festival', 'story', 'upload', () => STRESS, 'stress'],
];

describe('pipeline satori → resvg → PNG (Node)', () => {
  let fonts: ReturnType<typeof toSatoriFonts>;

  beforeAll(async () => {
    await initResvg(loadResvgWasm());
    fonts = toSatoriFonts(loadCardFonts());
  });

  it.each(CASES)(
    '%s × %s × %s %s bate com a referência',
    async (template, format, mode, data, tag) => {
      const png = await renderCardPng({ template, format, mode, data: data() }, fonts);
      expect(pngSize(png)).toEqual({ width: 1080, height: format === 'story' ? 1920 : 1080 });
      expect(png.byteLength).toBeLessThan(600 * 1024);

      const file = `${DIR}${template}-${format}-${mode}${tag ? `-${tag}` : ''}.png`;
      if (UPDATE || !existsSync(file)) {
        mkdirSync(DIR, { recursive: true });
        writeFileSync(file, png);
        return;
      }
      const expected = decodePng(readFileSync(file));
      const actual = decodePng(png);
      expect(diffRatio(actual.rgba, expected.rgba)).toBeLessThan(TOLERANCE);
    },
    30_000,
  );

  it('um card diferente não passa na comparação (a tolerância não é frouxa demais)', async () => {
    const a = decodePng(
      await renderCardPng(
        { template: 'festival', format: 'square', mode: 'upload', data: UPLOAD_DATA },
        fonts,
      ),
    );
    const b = decodePng(
      await renderCardPng(
        {
          template: 'festival',
          format: 'square',
          mode: 'upload',
          data: { ...UPLOAD_DATA, topArtists: [...UPLOAD_DATA.topArtists].reverse() },
        },
        fonts,
      ),
    );
    expect(diffRatio(a.rgba, b.rgba)).toBeGreaterThan(TOLERANCE);
  }, 30_000);
});

describe('API do worker de cards', () => {
  const assets = () => ({
    fonts: loadCardFonts(),
    resvgWasm: new Uint8Array(loadResvgWasm()).buffer,
    harfbuzzWasm: new ArrayBuffer(0),
  });

  it('exige init, é idempotente e mede o tempo', async () => {
    let clock = 0;
    let hooks = 0;
    const api = createCardWorkerApi({ beforeInit: () => hooks++, now: () => (clock += 250) });
    await expect(
      api.render({ template: 'basic', format: 'square', mode: 'upload', data: UPLOAD_DATA }),
    ).rejects.toThrow(/not initialized/);
    expect(api.isReady()).toBe(false);
    await Promise.all([api.init(assets()), api.init(assets())]);
    expect(hooks).toBe(1);
    expect(api.isReady()).toBe(true);
    const result = await api.render({
      template: 'basic',
      format: 'square',
      mode: 'upload',
      data: UPLOAD_DATA,
    });
    expect(pngSize(result.png)).toEqual({ width: 1080, height: 1080 });
    expect(result.ms).toBe(250);
  }, 30_000);

  it('init que falha pode ser repetido', async () => {
    const api = createCardWorkerApi({
      beforeInit: () => {
        throw new Error('boom');
      },
    });
    await expect(api.init(assets())).rejects.toThrow('boom');
    expect(api.isReady()).toBe(false);
  });
});
