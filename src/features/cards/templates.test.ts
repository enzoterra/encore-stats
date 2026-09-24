import { describe, expect, it } from 'vitest';

import { CONNECT_DATA, FAKE_COVER, UPLOAD_DATA } from '../../../tests/support/cards';
import type { CardData, CardFormat, CardMode, CardTemplate } from './model';
import {
  buildCard,
  festivalTitle,
  headliners,
  lineup,
  LINEUP_SEPARATOR,
  type CardChild,
  type CardNode,
} from './templates';
import { ELLIPSIS, graphemeLength, NBSP } from './text';

const LOGO = 'data:image/svg+xml;base64,PHN2Zy8+';

function walk(node: CardChild, visit: (node: CardNode) => void): void {
  if (typeof node === 'string') return;
  visit(node);
  const kids = node.props.children;
  for (const child of Array.isArray(kids) ? kids : kids === undefined ? [] : [kids]) {
    walk(child, visit);
  }
}

function texts(tree: CardNode): string[] {
  const out: string[] = [];
  walk(tree, (node) => {
    if (typeof node.props.children === 'string') out.push(node.props.children);
  });
  return out;
}

function images(tree: CardNode): string[] {
  const out: string[] = [];
  walk(tree, (node) => {
    if (node.type === 'img') out.push(String(node.props.src));
  });
  return out;
}

/** Todo `div` com mais de um filho precisa de `display: flex` no satori (§9). */
function assertFlex(tree: CardNode): void {
  walk(tree, (node) => {
    const kids = node.props.children;
    if (Array.isArray(kids) && kids.length > 1) expect(node.props.style?.display).toBe('flex');
  });
}

const build = (template: CardTemplate, format: CardFormat, mode: CardMode, data: CardData) =>
  buildCard({ template, format, mode, data });

const COMBOS = (['festival', 'basic'] as const).flatMap((template) =>
  (['story', 'square'] as const).flatMap((format) =>
    (['upload', 'demo', 'connect'] as const).map((mode) => ({ template, format, mode })),
  ),
);

describe('templates dos cards (10-design.md §9)', () => {
  it.each(COMBOS)(
    '$template × $format × $mode: canvas certo e só flexbox',
    ({ template, format, mode }) => {
      const data = mode === 'connect' ? { ...CONNECT_DATA, spotifyLogo: LOGO } : UPLOAD_DATA;
      const tree = build(template, format, mode, data);
      expect(tree.props.style?.width).toBe(1080);
      expect(tree.props.style?.height).toBe(format === 'story' ? 1920 : 1080);
      assertFlex(tree);
    },
  );

  it('Stories respeita a área segura (250 px no topo, 280 px na base, 72 px nas laterais)', () => {
    for (const template of ['festival', 'basic'] as const) {
      const tree = build(template, 'story', 'upload', UPLOAD_DATA);
      expect(tree.props.style?.padding).toBe('250px 72px 280px');
    }
    expect(build('festival', 'square', 'upload', UPLOAD_DATA).props.style?.padding).toBe(
      '72px 72px 72px',
    );
  });

  describe('atribuição por modo (§9.6, §10)', () => {
    it('Upload: sem capa e sem logo, com menção em texto', () => {
      for (const template of ['festival', 'basic'] as const) {
        // Mesmo que venham capa e logo nos dados, o Upload continua tipográfico.
        const tree = build(template, 'story', 'upload', {
          ...UPLOAD_DATA,
          cover: FAKE_COVER,
          spotifyLogo: LOGO,
        });
        expect(images(tree)).toEqual([]);
        expect(texts(tree)).toContain(UPLOAD_DATA.t.uploadFooter);
        expect(texts(tree)).not.toContain('DEMO');
      }
    });

    it('Demo: tag DEMO obrigatória, sem Spotify', () => {
      for (const template of ['festival', 'basic'] as const) {
        for (const format of ['story', 'square'] as const) {
          const tree = build(template, format, 'demo', { ...UPLOAD_DATA, spotifyLogo: LOGO });
          expect(texts(tree)).toContain('DEMO');
          expect(texts(tree)).toContain(UPLOAD_DATA.t.demoFooter);
          expect(images(tree)).toEqual([]);
          expect(texts(tree).some((t) => /spotify/i.test(t))).toBe(false);
        }
      }
    });

    it('Conectar: logo oficial sozinho no rodapé; capa só no Básico', () => {
      const data = { ...CONNECT_DATA, spotifyLogo: LOGO };
      expect(images(build('basic', 'story', 'connect', data))).toEqual([FAKE_COVER, LOGO]);
      expect(images(build('basic', 'square', 'connect', data))).toEqual([FAKE_COVER, LOGO]);
      expect(images(build('festival', 'story', 'connect', data))).toEqual([LOGO]);
      const tree = build('basic', 'story', 'connect', data);
      expect(texts(tree)).not.toContain(UPLOAD_DATA.t.uploadFooter);
      // O logo não fica dentro de frase ("Dados de [logo]").
      expect(texts(tree).some((t) => /dados de/i.test(t))).toBe(false);
    });

    it('Conectar sem capa sai tipográfico, com o bloco de destaque no 1:1', () => {
      const data = { ...CONNECT_DATA, cover: undefined, spotifyLogo: LOGO };
      const tree = build('basic', 'square', 'connect', data);
      expect(images(tree)).toEqual([LOGO]);
      expect(texts(tree)).toContain('214');
    });

    it('sem destaque (Conectar sem varredura nem gêneros) o bloco some', () => {
      const tree = build('basic', 'story', 'connect', {
        ...CONNECT_DATA,
        stat: undefined,
        spotifyLogo: LOGO,
      });
      expect(texts(tree)).not.toContain('214');
    });
  });

  describe('line-up do Festival (§9.4)', () => {
    it('headliners nº 2 e nº 3 com o mesmo tamanho, a 80% do degrau', () => {
      const fits = headliners(['Lua Vermelha', 'Os Ventiladores', 'Marina Sal'], 'story', 'pt-BR');
      expect(fits.map((f) => f.text)).toEqual(['LUA VERMELHA', 'OS VENTILADORES', 'MARINA SAL']);
      expect(fits[0]!.size).toBe(120);
      expect(fits[1]!.size).toBe(fits[2]!.size);
      expect(fits[1]!.size).toBe(96);
    });

    it('com menos de 3 artistas não quebra', () => {
      expect(headliners(['Solo'], 'square', 'pt-BR')).toEqual([{ text: 'SOLO', size: 104 }]);
      const tree = build('festival', 'story', 'upload', {
        ...UPLOAD_DATA,
        topArtists: ['Solo'],
        topTracks: [],
      });
      expect(texts(tree)).toContain('SOLO');
      assertFlex(tree);
    });

    it('quebra só entre nomes: espaço inquebrável dentro, " • " entre eles', () => {
      const line = lineup(['Coletivo Samambaia', 'Ana Trovão'], 'pt-BR');
      expect(line).toBe(`COLETIVO${NBSP}SAMAMBAIA${LINEUP_SEPARATOR}ANA${NBSP}TROVÃO`);
      const [first] = line.split(LINEUP_SEPARATOR);
      expect(first).not.toContain(' ');
    });

    it('nível 2 = nº 4–10 e nível 3 = nº 11–25 (Stories) ou 11–20 (1:1)', () => {
      const story = texts(build('festival', 'story', 'upload', UPLOAD_DATA));
      const tier3Story = story.find((t) => t.startsWith('RÁDIO'))!;
      expect(tier3Story.split(LINEUP_SEPARATOR)).toHaveLength(15);
      const square = texts(build('festival', 'square', 'upload', UPLOAD_DATA));
      expect(square.find((t) => t.startsWith('RÁDIO'))!.split(LINEUP_SEPARATOR)).toHaveLength(10);
      expect(story.find((t) => t.startsWith('DJ'))!.split(LINEUP_SEPARATOR)).toHaveLength(7);
    });

    it('título: "ENCORE FEST" ou "FESTIVAL {NOME}", em caixa alta pelo locale', () => {
      expect(festivalTitle(UPLOAD_DATA, 'story').text).toBe('ENCORE FEST');
      expect(festivalTitle({ ...UPLOAD_DATA, posterName: 'Enzo' }, 'story')).toEqual({
        text: 'FESTIVAL ENZO',
        size: 104,
      });
      const mid = festivalTitle({ ...UPLOAD_DATA, posterName: 'Maria Eduarda' }, 'square');
      expect(mid.size).toBe(60);
      const long = festivalTitle({ ...UPLOAD_DATA, posterName: 'Maria Eduarda Albuq' }, 'square');
      expect(long.size).toBe(50);
      expect(
        festivalTitle({ ...UPLOAD_DATA, locale: 'tr', posterName: 'istanbul' }, 'story').text,
      ).toBe('FESTİVAL İSTANBUL');
    });

    it('estatísticas em caixa alta, separadas por "·"', () => {
      const tree = texts(build('festival', 'story', 'upload', UPLOAD_DATA));
      expect(tree).toContain('48.213 MIN  ·  9.214 PLAYS  ·  612 ARTISTAS');
    });
  });

  describe('truncamento no Básico (§9.3, §9.5)', () => {
    it('herói em degraus e trunca em 24 grafemas', () => {
      const long = 'Orquestra Sinfônica de Garagem do Bairro Alto';
      const tree = build('basic', 'story', 'upload', {
        ...UPLOAD_DATA,
        topArtists: [long, ...UPLOAD_DATA.topArtists.slice(1)],
      });
      const hero = texts(tree).find((t) => t.startsWith('Orquestra'))!;
      expect(graphemeLength(hero)).toBeLessThanOrEqual(24);
      expect(hero.endsWith(ELLIPSIS)).toBe(true);
    });

    it('músicas com orçamento de 23 (Stories) e 18 (1:1)', () => {
      const story = texts(build('basic', 'story', 'upload', UPLOAD_DATA));
      expect(story).toContain(`Farol Aceso às Três da${ELLIPSIS}`);
      const square = texts(build('basic', 'square', 'upload', UPLOAD_DATA));
      expect(square).toContain(`Maré Alta (ao viv${ELLIPSIS}`);
      // 1:1: só 4 músicas e sem a linha do artista.
      expect(square).not.toContain('Banda Farol');
    });

    it('limpa controles e ignora nomes vazios', () => {
      const tree = texts(
        build('basic', 'story', 'upload', {
          ...UPLOAD_DATA,
          topArtists: ['  ', 'Ana‮Trovão', ...UPLOAD_DATA.topArtists.slice(1)],
        }),
      );
      expect(tree).toContain('Ana Trovão');
    });
  });
});
