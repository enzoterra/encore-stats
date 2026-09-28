import { describe, expect, it } from 'vitest';

import {
  CONNECT_8B,
  CONNECT_DATA,
  FAKE_COVER,
  SHORT_8B,
  STRESS_8B,
  UPLOAD_8B,
  UPLOAD_DATA,
} from '../../../tests/support/cards';
import { lockupDataUrl } from './brand';
import {
  CARD_TEMPLATES,
  type CardData,
  type CardFormat,
  type CardMode,
  type CardTemplate,
} from './model';
import {
  backgroundSvg,
  buildCard,
  COLORS,
  festivalTitle,
  fitTrack,
  headliners,
  lineup,
  LINEUP_SEPARATOR,
  MIX_STEPS,
  TRACK_STEPS,
  type CardChild,
  type CardNode,
} from './templates';
import { ELLIPSIS, graphemeLength, NBSP, tidyTrack } from './text';

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

/** Imagens do card, fora a logo do Encore (capa e logo do Spotify). */
function images(tree: CardNode): string[] {
  return allImages(tree).filter((src) => src !== lockupDataUrl());
}

function allImages(tree: CardNode): string[] {
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

/** Nós de texto com o estilo, para conferir tamanho e cor. */
function textNodes(tree: CardNode): { text: string; style: Record<string, unknown> }[] {
  const out: { text: string; style: Record<string, unknown> }[] = [];
  walk(tree, (node) => {
    if (typeof node.props.children === 'string') {
      out.push({ text: node.props.children, style: node.props.style ?? {} });
    }
  });
  return out;
}

const POSTERS = ['festival', 'tracks', 'mix'] as const;

const COMBOS = CARD_TEMPLATES.flatMap((template) =>
  (['story', 'square'] as const).flatMap((format) =>
    (['upload', 'demo', 'connect'] as const).map((mode) => ({ template, format, mode })),
  ),
);

describe('templates dos cards (10-design.md §9)', () => {
  it.each(COMBOS)(
    '$template × $format × $mode: canvas certo e só flexbox',
    ({ template, format, mode }) => {
      const data = mode === 'connect' ? { ...CONNECT_8B, spotifyLogo: LOGO } : UPLOAD_8B;
      const tree = build(template, format, mode, data);
      expect(tree.props.style?.width).toBe(1080);
      expect(tree.props.style?.height).toBe(format === 'story' ? 1920 : 1080);
      assertFlex(tree);
    },
  );

  it('Stories respeita a área segura (250 px no topo, 280 px na base, 72 px nas laterais)', () => {
    for (const template of CARD_TEMPLATES) {
      const tree = build(template, 'story', 'upload', UPLOAD_8B);
      expect(tree.props.style?.padding).toBe('250px 72px 280px');
    }
    for (const template of POSTERS) {
      expect(build(template, 'square', 'upload', UPLOAD_8B).props.style?.padding).toBe(
        '72px 72px 72px',
      );
    }
  });

  describe('atribuição por modo (§9.6, §10)', () => {
    it('Upload: sem capa e sem logo, com menção em texto', () => {
      for (const template of CARD_TEMPLATES) {
        // Mesmo que venham capa e logo nos dados, o Upload continua tipográfico.
        const tree = build(template, 'story', 'upload', {
          ...UPLOAD_8B,
          cover: FAKE_COVER,
          spotifyLogo: LOGO,
        });
        expect(images(tree)).toEqual([]);
        expect(texts(tree)).toContain(UPLOAD_DATA.t.uploadFooter);
        expect(texts(tree)).not.toContain('DEMO');
      }
    });

    it('Demo: tag DEMO obrigatória, sem Spotify', () => {
      for (const template of CARD_TEMPLATES) {
        for (const format of ['story', 'square'] as const) {
          const tree = build(template, format, 'demo', { ...UPLOAD_8B, spotifyLogo: LOGO });
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
      for (const template of POSTERS) {
        for (const format of ['story', 'square'] as const) {
          // Os cartazes nunca levam capa, nem no Conectar.
          expect(images(build(template, format, 'connect', data))).toEqual([LOGO]);
        }
      }
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

  describe('Top músicas (§9.9)', () => {
    it('10 músicas nos dois formatos: nº 1 amarelo, nº 2–3 brancos e o setlist nº 4–10', () => {
      for (const format of ['story', 'square'] as const) {
        const nodes = textNodes(build('tracks', format, 'upload', UPLOAD_8B));
        const all = nodes.map((n) => n.text);
        expect(all).toContain('TOP MÚSICAS');
        // Limpeza de feat./remaster antes do orçamento, em caixa alta pelo locale.
        const first = nodes.find((n) => n.text.startsWith('FAROL'))!;
        expect(first.style.color).toBe(COLORS.yellow);
        expect(all).toContain('CÉU DE NEON');
        expect(all).toContain('VENTILADOR NO TALO');
        expect(all.some((t) => /FEAT|REMASTER/i.test(t))).toBe(false);
        // Artistas em rosa no pódio.
        expect(nodes.find((n) => n.text === 'BANDA FAROL')!.style.color).toBe(COLORS.pink);
        // Setlist numerado de 4 a 10, com o artista em `muted`.
        const numbers = nodes
          .filter((n) => /^\d+$/.test(n.text) && n.style.color === COLORS.yellow)
          .map((n) => Number(n.text));
        expect(numbers).toEqual([4, 5, 6, 7, 8, 9, 10]);
        expect(nodes.find((n) => n.text === 'COLETIVO SAMAMBAIA')!.style.color).toBe(COLORS.muted);
        expect(all).toContain(`DANÇA${NBSP}DO${NBSP}PELICANO`);
        // "Ao Vivo…" e "Versão Acústica" ficam (versões com sentido).
        expect(all.some((t) => t.includes('(AO') || t.includes('(VERSÃO'))).toBe(true);
        expect(all).toContain('9.214 PLAYS  ·  1.873 MÚSICAS  ·  48.213 MIN');
      }
    });

    it('nº 2 e nº 3 com o mesmo tamanho; nº 1 em 2 linhas quando é muito longo', () => {
      const nodes = textNodes(build('tracks', 'story', 'upload', STRESS_8B));
      const head = nodes.find((n) => n.text.startsWith('UMA MÚSICA'))!;
      expect(head.style.lineClamp).toBe(2);
      expect(head.style.fontSize).toBe(TRACK_STEPS.story.headTwo.size);
      expect(graphemeLength(head.text)).toBeLessThanOrEqual(TRACK_STEPS.story.headTwo.max);
      expect(head.text.endsWith(ELLIPSIS)).toBe(true);
      const second = nodes.find((n) => n.text.startsWith('ЗВЕЗДА'))!;
      const third = nodes.find((n) => n.text.startsWith('ÑANDÚ BAILANDO'))!;
      expect(second.style.fontSize).toBe(third.style.fontSize);
      expect(third.text).not.toMatch(/FEAT/);
    });

    it('com poucas músicas os blocos vazios somem (sem setlist nem divisor)', () => {
      const tree = build('tracks', 'square', 'upload', SHORT_8B);
      assertFlex(tree);
      const nodes = textNodes(tree);
      expect(nodes.filter((n) => /^\d+$/.test(n.text)).map((n) => n.text)).toEqual(['4']);
      const one = build('tracks', 'story', 'upload', {
        ...UPLOAD_8B,
        topTracks: UPLOAD_8B.topTracks.slice(0, 3),
      });
      expect(
        textNodes(one).filter((n) => /^\d+$/.test(n.text) && n.style.color === COLORS.yellow),
      ).toEqual([]);
      assertFlex(one);
    });

    it('Conectar: "TOP N MÚSICAS · JANELA", artistas juntados e logo sozinho', () => {
      const tree = build('tracks', 'story', 'connect', { ...CONNECT_8B, spotifyLogo: LOGO });
      const all = texts(tree);
      expect(all).toContain('TOP 10 MÚSICAS  ·  ÚLTIMOS 6 MESES');
      expect(all).toContain('LUA VERMELHA, MC BRISA');
      expect(all).toContain('FESTIVAL ENZO');
      expect(images(tree)).toEqual([LOGO]);
    });

    it('período sem músicas: o cartaz não quebra', () => {
      const tree = build('tracks', 'story', 'upload', {
        ...UPLOAD_8B,
        topTracks: [],
        trackStats: [],
      });
      assertFlex(tree);
      expect(texts(tree)).toContain('TOP MÚSICAS');
      expect(texts(tree).some((t) => t.includes('PLAYS'))).toBe(false);
    });
  });

  describe('Mix (§9.10)', () => {
    it('3 artistas + 3 músicas, cada seção com a placa de palco', () => {
      for (const format of ['story', 'square'] as const) {
        const nodes = textNodes(build('mix', format, 'upload', UPLOAD_8B));
        const all = nodes.map((n) => n.text);
        expect(all.indexOf('TOP ARTISTAS')).toBeLessThan(all.indexOf('LUA VERMELHA'));
        expect(all.indexOf('LUA VERMELHA')).toBeLessThan(all.indexOf('TOP MÚSICAS'));
        expect(all).not.toContain('DJ CAJU'); // nº 4 fica de fora
        expect(all).toContain('CÉU DE NEON');
        expect(all).not.toContain('MARÉ ALTA (AO VIVO NO CIRCO VOADOR)'); // música nº 4
        const [a1, a2, a3] = ['LUA VERMELHA', 'OS VENTILADORES', 'MARINA SAL'].map((name) =>
          nodes.find((n) => n.text === name && n.style.fontFamily !== 'Inter')!,
        );
        expect(a1!.style.fontSize).toBe(MIX_STEPS[format].artist[1]!.size);
        expect(a2!.style.fontSize).toBe(a3!.style.fontSize);
        expect(all).toContain('48.213 MIN  ·  9.214 PLAYS  ·  612 ARTISTAS');
      }
    });

    it('Conectar: sem linha de estatísticas', () => {
      const tree = build('mix', 'square', 'connect', { ...CONNECT_8B, spotifyLogo: LOGO });
      expect(texts(tree).some((t) => /TOP 25|TOP 10/.test(t))).toBe(false);
      expect(images(tree)).toEqual([LOGO]);
    });

    it('sem músicas, a seção TOP MÚSICAS some; com 1 artista não quebra', () => {
      const tree = build('mix', 'story', 'upload', {
        ...UPLOAD_8B,
        topArtists: ['Solo'],
        topTracks: [],
      });
      assertFlex(tree);
      expect(texts(tree)).toContain('SOLO');
      expect(texts(tree)).not.toContain('TOP MÚSICAS');
    });

    it('pior caso: artista longo truncado e música longa em 2 linhas', () => {
      const nodes = textNodes(build('mix', 'story', 'upload', STRESS_8B));
      const artist = nodes.find((n) => n.text.startsWith('ORQUESTRA'))!;
      expect(graphemeLength(artist.text)).toBeLessThanOrEqual(20);
      const song = nodes.find((n) => n.text.startsWith('UMA MÚSICA'))!;
      expect(song.style.lineClamp).toBe(2);
      expect(song.style.fontSize).toBe(MIX_STEPS.story.trackTwo.size);
    });
  });

  describe('logo do Encore (8b.9)', () => {
    it('o lockup vai no rodapé dos 4 templates e no cabeçalho do Básico, nos 3 modos', () => {
      const lockup = lockupDataUrl();
      expect(lockup).toMatch(/^data:image\/svg\+xml;base64,/);
      expect(atob(lockup.split(',')[1]!)).toContain('viewBox="0 0 308.3 56"');
      for (const template of CARD_TEMPLATES) {
        for (const format of ['story', 'square'] as const) {
          for (const mode of ['upload', 'demo', 'connect'] as const) {
            const tree = build(template, format, mode, { ...UPLOAD_8B, spotifyLogo: LOGO });
            const count = allImages(tree).filter((src) => src === lockup).length;
            expect(count).toBe(template === 'basic' ? 2 : 1);
            // O texto "encore" provisório saiu.
            expect(texts(tree)).not.toContain('encore');
          }
        }
      }
    });

    it('proporção fixa: 30 px de altura no rodapé do Stories e 26 px no Quadrado', () => {
      const sizes = (format: CardFormat) => {
        const out: [number, number][] = [];
        walk(build('tracks', format, 'upload', UPLOAD_8B), (node) => {
          if (node.type === 'img' && node.props.src === lockupDataUrl()) {
            out.push([Number(node.props.width), Number(node.props.height)]);
          }
        });
        return out;
      };
      expect(sizes('story')).toEqual([[165.2, 30]]);
      expect(sizes('square')).toEqual([[143.1, 26]]);
    });
  });

  describe('cartazes: peças comuns (§9.8)', () => {
    it('"Nome no cartaz" vale para os três', () => {
      for (const template of POSTERS) {
        const tree = build(template, 'story', 'upload', { ...UPLOAD_8B, posterName: 'Enzo' });
        expect(texts(tree)).toContain('FESTIVAL ENZO');
        expect(texts(tree)).toContain('ENCORE APRESENTA');
      }
    });

    it('cada cartaz tem os holofotes próprios no fundo', () => {
      const svgs = POSTERS.map((template) => backgroundSvg(template, 'story'));
      expect(new Set(svgs).size).toBe(3);
      expect(svgs[1]).toContain('rgb(61,224,255)');
      expect(svgs[2]).toContain('rgb(255,122,26)');
      // Mesma base "noite de show".
      for (const svg of svgs) expect(svg).toContain('#4A1247');
    });
  });

  describe('limpeza do nome da música (tidyTrack, §9.11)', () => {
    it.each([
      ['Ventilador no Talo - Remasterizado 2019', 'Ventilador no Talo'],
      ['Céu de Neon (feat. MC Brisa)', 'Céu de Neon'],
      ['Dança do Pelicano - Radio Edit', 'Dança do Pelicano'],
      ['Song [ft. Someone]', 'Song'],
      ['Song (with Someone Else)', 'Song'],
      ['Canção (part. Fulana)', 'Canção'],
      ['Canção (Participação Especial de Fulana)', 'Canção'],
      ['Song - feat. Someone', 'Song'],
      ['Song - 2011 Remaster', 'Song'],
      ['Song - Remastered 2009', 'Song'],
      ['Song - Remaster', 'Song'],
      ['Canção - Remasterizada', 'Canção'],
      ['Canção - Remasterização', 'Canção'],
      ['Song - Single Version', 'Song'],
      ['Canção - Versão Single', 'Canção'],
      ['Song - Edit', 'Song'],
      ['Song (FEAT. X) - REMASTERED 2011', 'Song'],
    ])('"%s" → "%s"', (input, expected) => {
      expect(tidyTrack(input)).toBe(expected);
    });

    it('mantém versões com sentido e volta o original se sobrar vazio', () => {
      expect(tidyTrack('Maré Alta (Ao Vivo no Circo Voador)')).toBe(
        'Maré Alta (Ao Vivo no Circo Voador)',
      );
      expect(tidyTrack('Carta (Versão Acústica)')).toBe('Carta (Versão Acústica)');
      expect(tidyTrack('Noite (Remix do DJ Caju)')).toBe('Noite (Remix do DJ Caju)');
      expect(tidyTrack('Featherweight')).toBe('Featherweight');
      expect(tidyTrack('Editora')).toBe('Editora');
      expect(tidyTrack('(feat. Alguém)')).toBe('(feat. Alguém)');
    });

    it('fitTrack: degraus de 1 linha e, acima do último, até 2 linhas truncadas', () => {
      const steps = TRACK_STEPS.story;
      expect(fitTrack('CÉU DE NEON', steps.head, steps.headTwo)).toEqual({
        text: 'CÉU DE NEON',
        size: 132,
        lines: 1,
      });
      expect(fitTrack('A'.repeat(30), steps.head, steps.headTwo)).toMatchObject({
        size: 76,
        lines: 1,
      });
      const two = fitTrack('A '.repeat(40).trim(), steps.head, steps.headTwo);
      expect(two.lines).toBe(2);
      expect(two.size).toBe(76);
      expect(graphemeLength(two.text)).toBe(52);
      // Fora da cobertura do Bricolage desce um degrau.
      expect(fitTrack('ЗВЕЗДА', steps.head, steps.headTwo).size).toBe(112);
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
