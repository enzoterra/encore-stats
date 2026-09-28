/**
 * Templates Básico, Line-up (`festival`), Top músicas (`tracks`) e Mix (10-design.md §9), em árvores `{ type, props }` que o
 * satori aceita sem React. Só flexbox: todo `div` com mais de um filho tem `display: flex`, sem
 * grid nem `foreignObject`. Medidas, tokens e regras de truncamento seguem o protótipo validado
 * em `docs/projeto/design/cards/templates.mjs`. Funções puras: rodam no worker e nos testes.
 */
import {
  FORMATS,
  type CardData,
  type CardFormat,
  type CardMode,
  type CardRequest,
  type CardTemplate,
} from './model';
import { brandMark } from './brand';
import {
  cleanText,
  fit,
  graphemeLength,
  keepTogether,
  tidyTrack,
  truncate,
  type Fitted,
  type FontStep,
} from './text';

type Style = Record<string, string | number>;
export type CardChild = CardNode | string;
export type CardNode = {
  type: string;
  props: { style?: Style; children?: CardChild | CardChild[]; [key: string]: unknown };
};

/** Tokens do 10-design.md §2 usados no canvas. */
export const COLORS = {
  bg: '#0E0B1A',
  text: '#F5F1FF',
  muted: '#B8AED6',
  subtle: '#968CB8',
  magenta: '#FF3D8B',
  yellow: '#FFE14D',
  orange: '#FF7A1A',
  cyan: '#3DE0FF',
  ink: '#0E0B1A',
  /** `primary-fg`: artista das músicas nos cartazes (8,01:1 sobre o fundo, §9.8). */
  pink: '#FF7AB0',
} as const;

export const FONT_FAMILY = {
  display: 'Bricolage Grotesque',
  condensed: 'Bricolage Grotesque Condensed',
  body: 'Inter',
} as const;

/** Arquivos TTF estáticos (§13) servidos de `public/fonts/ttf`. */
export const FONT_FILES = [
  { name: FONT_FAMILY.display, weight: 800, file: 'BricolageGrotesque-ExtraBold.ttf' },
  { name: FONT_FAMILY.display, weight: 600, file: 'BricolageGrotesque-SemiBold.ttf' },
  { name: FONT_FAMILY.condensed, weight: 800, file: 'BricolageGrotesqueCondensed-ExtraBold.ttf' },
  { name: FONT_FAMILY.body, weight: 400, file: 'Inter-Regular.ttf' },
  { name: FONT_FAMILY.body, weight: 600, file: 'Inter-SemiBold.ttf' },
  { name: FONT_FAMILY.body, weight: 700, file: 'Inter-Bold.ttf' },
] as const;

/** Logo completo do Spotify: 210 px de largura no canvas (≈ 73 px num telefone de 375 pt). */
export const SPOTIFY_LOGO = { width: 210, height: 57 } as const;

/** Degraus de fonte (§9.3/§9.4). */
export const STEPS = {
  basicHero: {
    story: [
      { max: 10, size: 128 },
      { max: 14, size: 104 },
      { max: 18, size: 84 },
      { max: 24, size: 64 },
    ],
    square: [
      { max: 10, size: 96 },
      { max: 14, size: 80 },
      { max: 18, size: 64 },
      { max: 24, size: 52 },
    ],
  },
  festivalTitle: {
    story: [
      { max: 18, size: 104 },
      { max: 24, size: 84 },
      { max: 30, size: 68 },
    ],
    square: [
      { max: 18, size: 72 },
      { max: 24, size: 60 },
      { max: 30, size: 50 },
    ],
  },
  headliner: {
    story: [
      { max: 11, size: 150 },
      { max: 15, size: 120 },
      { max: 20, size: 96 },
    ],
    square: [
      { max: 11, size: 104 },
      { max: 15, size: 84 },
      { max: 20, size: 68 },
    ],
  },
} satisfies Record<string, Record<CardFormat, FontStep[]>>;

/** Último degrau das músicas longas: até 2 linhas nesse tamanho, truncado em `max` grafemas. */
export type TwoLineStep = { max: number; size: number };

/** Degraus do Top músicas (§9.9). Nº 1: 1 linha nos degraus, depois até 2 linhas. */
export const TRACK_STEPS = {
  story: {
    head: [
      { max: 14, size: 132 },
      { max: 18, size: 112 },
      { max: 24, size: 92 },
      { max: 30, size: 76 },
    ],
    headTwo: { max: 52, size: 76 },
    sub: [
      { max: 18, size: 84 },
      { max: 24, size: 68 },
      { max: 32, size: 56 },
    ],
  },
  square: {
    head: [
      { max: 14, size: 88 },
      { max: 18, size: 74 },
      { max: 24, size: 60 },
      { max: 32, size: 50 },
    ],
    headTwo: { max: 44, size: 50 },
    sub: [
      { max: 20, size: 50 },
      { max: 26, size: 42 },
      { max: 34, size: 36 },
    ],
  },
} satisfies Record<CardFormat, { head: FontStep[]; headTwo: TwoLineStep; sub: FontStep[] }>;

/** Músicas no Top músicas: 10 nos dois formatos (nº 1, nº 2–3 e o setlist nº 4–10). */
export const TRACKS_MAX = 10;

/** Degraus e espaçamentos do Mix (§9.10). */
export const MIX_STEPS = {
  story: {
    artist: STEPS.headliner.story,
    track: [
      { max: 14, size: 120 },
      { max: 18, size: 100 },
      { max: 24, size: 84 },
      { max: 30, size: 70 },
    ],
    trackTwo: { max: 52, size: 70 },
    trackSub: [
      { max: 18, size: 76 },
      { max: 24, size: 64 },
      { max: 32, size: 52 },
    ],
    gap: 30,
    artistGap: 16,
    trackGap: 26,
    artistSize: 30,
    subArtistSize: 24,
    topGap: 48,
  },
  square: {
    artist: [
      { max: 11, size: 100 },
      { max: 15, size: 82 },
      { max: 20, size: 64 },
    ],
    track: [
      { max: 14, size: 76 },
      { max: 18, size: 64 },
      { max: 24, size: 54 },
      { max: 32, size: 46 },
    ],
    trackTwo: { max: 44, size: 46 },
    trackSub: [
      { max: 18, size: 50 },
      { max: 24, size: 42 },
      { max: 32, size: 36 },
    ],
    gap: 16,
    artistGap: 4,
    trackGap: 10,
    artistSize: 18,
    subArtistSize: 16,
    topGap: 24,
  },
} satisfies Record<
  CardFormat,
  {
    artist: FontStep[];
    track: FontStep[];
    trackTwo: TwoLineStep;
    trackSub: FontStep[];
    [key: string]: unknown;
  }
>;

/** Separador do line-up: a quebra de linha só acontece aqui. */
export const LINEUP_SEPARATOR = '  •  ';

// ---------- utilitários ----------
function h(type: string, style: Style, ...children: (CardChild | null | false | undefined)[]) {
  const kids = children.filter((c): c is CardChild => c !== null && c !== false && c !== undefined);
  return { type, props: { style: { display: 'flex', ...style }, children: kids } } as CardNode;
}

function text(style: Style, value: string): CardNode {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: value } };
}

function img(src: string, width: number, height: number, style: Style = {}): CardNode {
  return { type: 'img', props: { src, width, height, style } };
}

const oneLine: Style = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const upper = (value: string, locale: string) => value.toLocaleUpperCase(locale);

// ---------- peças comuns ----------
function chip(label: string): CardNode {
  return text(
    {
      fontFamily: FONT_FAMILY.body,
      fontWeight: 700,
      fontSize: 28,
      color: COLORS.ink,
      background: COLORS.yellow,
      padding: '10px 24px',
      borderRadius: 999,
      letterSpacing: 1,
      ...oneLine,
    },
    truncate(label, 28),
  );
}

function demoTag(d: CardData): CardNode {
  return text(
    {
      fontFamily: FONT_FAMILY.body,
      fontWeight: 700,
      fontSize: 24,
      color: COLORS.ink,
      background: COLORS.cyan,
      padding: '8px 18px',
      borderRadius: 8,
      letterSpacing: 2,
    },
    d.t.demoTag,
  );
}

/**
 * Rodapé (§9.2, §9.6). Conectar: logo completo **oficial** do Spotify, branco, sozinho e com área
 * de proteção (16 px ≥ metade da altura do ícone); nunca dentro de frase. Upload: menção em texto,
 * sem logo. Demo: sem citar o Spotify.
 */
function footer(mode: CardMode, d: CardData, compact: boolean): CardNode {
  const left = h(
    'div',
    { flexDirection: 'column', gap: 8 },
    // Lockup da logo: 30 px no Stories (LOGO.md) e 26 px no Quadrado.
    brandMark(compact ? 26 : 30),
    d.siteLabel
      ? text({ fontFamily: FONT_FAMILY.body, fontSize: 22, color: COLORS.subtle }, d.siteLabel)
      : null,
  );
  const right =
    mode === 'connect'
      ? d.spotifyLogo
        ? h(
            'div',
            { flexDirection: 'column', alignItems: 'flex-end', padding: 16 },
            img(d.spotifyLogo, SPOTIFY_LOGO.width, SPOTIFY_LOGO.height),
          )
        : null
      : h(
          'div',
          { flexDirection: 'column', alignItems: 'flex-end', maxWidth: 520 },
          text(
            {
              fontFamily: FONT_FAMILY.body,
              fontSize: 22,
              color: COLORS.subtle,
              textAlign: 'right',
            },
            mode === 'demo' ? d.t.demoFooter : d.t.uploadFooter,
          ),
        );
  return h(
    'div',
    { width: '100%', justifyContent: 'space-between', alignItems: 'flex-end' },
    left,
    right,
  );
}

type Rgb = readonly [number, number, number];
type Radial = { x: number; y: number; color: Rgb; alpha: number; stop: number };
type Layers = { linear: [string, number][]; radials: Radial[] };

/** Base "noite de show" comum aos três cartazes (§9.4, §9.8). */
const STAGE_LINEAR: [string, number][] = [
  ['#0E0B1A', 0],
  ['#140E28', 0.55],
  ['#2A0F3D', 0.82],
  ['#4A1247', 1],
];
const MAGENTA: Rgb = [255, 61, 139];
const CYAN: Rgb = [61, 224, 255];
const ORANGE: Rgb = [255, 122, 26];

/**
 * Fundos (§9.3, §9.4, §9.8) em camadas CSS: a primeira radial fica por cima. O satori transforma
 * `background-image` em `<pattern>` com máscara do tamanho do canvas, e o resvg leva ~2,5 s para
 * pintar isso num Stories. Por isso o fundo é desenhado direto em SVG (`backgroundSvg`), com
 * gradientes equivalentes, e injetado antes do conteúdo: ~0,3 s.
 */
const BACKGROUNDS: Record<CardTemplate, Layers> = {
  festival: {
    linear: STAGE_LINEAR,
    radials: [
      { x: 0.12, y: 0.06, color: MAGENTA, alpha: 0.55, stop: 0.38 },
      { x: 0.9, y: 0.1, color: CYAN, alpha: 0.4, stop: 0.34 },
    ],
  },
  // Top músicas: holofotes trocados de lado (ciano à esquerda, magenta à direita).
  tracks: {
    linear: STAGE_LINEAR,
    radials: [
      { x: 0.1, y: 0.06, color: CYAN, alpha: 0.4, stop: 0.34 },
      { x: 0.9, y: 0.08, color: MAGENTA, alpha: 0.55, stop: 0.38 },
    ],
  },
  // Mix: magenta à esquerda e laranja à direita (os dois "palcos").
  mix: {
    linear: STAGE_LINEAR,
    radials: [
      { x: 0.12, y: 0.06, color: MAGENTA, alpha: 0.55, stop: 0.38 },
      { x: 0.9, y: 0.1, color: ORANGE, alpha: 0.38, stop: 0.34 },
    ],
  },
  basic: {
    linear: [
      ['#0E0B1A', 0],
      ['#17122A', 1],
    ],
    radials: [{ x: 1, y: 0, color: [255, 122, 26], alpha: 0.35, stop: 0.4 }],
  },
};

/** `radial-gradient(circle at x y, …)`: raio até o canto mais distante (padrão do CSS). */
function farthestCorner(x: number, y: number, width: number, height: number): number {
  return Math.max(
    ...[
      [0, 0],
      [width, 0],
      [0, height],
      [width, height],
    ].map(([cx, cy]) => Math.hypot(cx! - x, cy! - y)),
  );
}

export function backgroundSvg(template: CardTemplate, format: CardFormat): string {
  const { width, height } = FORMATS[format];
  const { linear, radials } = BACKGROUNDS[template];
  const rgb = (c: Rgb) => `rgb(${c.join(',')})`;
  const defs = [
    `<linearGradient id="encore-bg-l" x1="0" y1="0" x2="0" y2="1">${linear
      .map(([color, offset]) => `<stop offset="${offset}" stop-color="${color}"/>`)
      .join('')}</linearGradient>`,
    ...radials.map((r, i) => {
      const cx = r.x * width;
      const cy = r.y * height;
      const radius = farthestCorner(cx, cy, width, height).toFixed(1);
      return (
        `<radialGradient id="encore-bg-r${i}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${radius}">` +
        `<stop offset="0" stop-color="${rgb(r.color)}" stop-opacity="${r.alpha}"/>` +
        `<stop offset="${r.stop}" stop-color="${rgb(r.color)}" stop-opacity="0"/></radialGradient>`
      );
    }),
  ].join('');
  // Pinta de baixo para cima: linear, depois as radiais da última para a primeira.
  const rect = (fill: string) =>
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${fill}"/>`;
  const layers = [
    rect('url(#encore-bg-l)'),
    ...radials.map((_, i) => rect(`url(#encore-bg-r${i})`)).reverse(),
  ].join('');
  return `<defs>${defs}</defs>${layers}`;
}

/** Dados normalizados: sem controle/bidi e sem nomes vazios. */
function normalize(d: CardData): CardData {
  const artists = d.topArtists.map(cleanText).filter(Boolean);
  const tracks = d.topTracks
    .map((t) => ({ name: cleanText(t.name), artist: cleanText(t.artist) }))
    .filter((t) => t.name);
  const poster = d.posterName ? cleanText(d.posterName) : '';
  return { ...d, topArtists: artists, topTracks: tracks, posterName: poster || undefined };
}

// =====================================================================
// Template 1 — BÁSICO (§9.3)
// =====================================================================
function basic(format: CardFormat, mode: CardMode, d: CardData): CardNode {
  const story = format === 'story';
  const f = FORMATS[format];
  const loc = d.locale;
  const hero = fit(d.topArtists[0] ?? '', STEPS.basicHero[format]);

  const label = (value: string) =>
    text(
      {
        fontFamily: FONT_FAMILY.body,
        fontWeight: 700,
        fontSize: story ? 24 : 20,
        color: COLORS.cyan,
        letterSpacing: 4,
      },
      upper(value, loc),
    );
  const rank = (n: number, size: number, width: number) =>
    text(
      {
        fontFamily: FONT_FAMILY.display,
        fontWeight: 800,
        fontSize: size,
        color: COLORS.yellow,
        width,
        flexShrink: 0,
      },
      String(n),
    );

  const stat = d.stat
    ? h(
        'div',
        {
          flexDirection: 'column',
          background: COLORS.magenta,
          borderRadius: 24,
          padding: story ? '22px 32px' : '20px 28px',
          gap: 2,
          flexShrink: 0,
          maxWidth: story ? 936 : 460,
        },
        text(
          {
            fontFamily: FONT_FAMILY.display,
            fontWeight: 800,
            fontSize: story ? 80 : 64,
            color: COLORS.ink,
            lineHeight: 1,
            ...oneLine,
          },
          truncate(d.stat.value, 14),
        ),
        text(
          {
            fontFamily: FONT_FAMILY.body,
            fontWeight: 600,
            fontSize: story ? 30 : 24,
            color: COLORS.ink,
            ...oneLine,
          },
          truncate(d.stat.label, story ? 48 : 30),
        ),
      )
    : null;

  // Conectar: capa da música nº 1, quadrada, sem corte nem sobreposição, raio 16 px (§9.6).
  const cover =
    mode === 'connect' && d.cover
      ? h(
          'div',
          { flexDirection: 'column', flexShrink: 0 },
          img(d.cover, story ? 260 : 220, story ? 260 : 220, { borderRadius: 16 }),
        )
      : null;

  const header = h(
    'div',
    { width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: 24 },
    brandMark(story ? 33 : 27),
    h(
      'div',
      { gap: 12, alignItems: 'center', flexShrink: 1 },
      mode === 'demo' ? demoTag(d) : null,
      chip(d.periodLabel),
    ),
  );

  const heroBlock = h(
    'div',
    { flexDirection: 'column', gap: 8 },
    text(
      {
        fontFamily: FONT_FAMILY.body,
        fontWeight: 600,
        fontSize: story ? 32 : 24,
        color: COLORS.muted,
      },
      d.t.topArtist,
    ),
    text(
      {
        fontFamily: FONT_FAMILY.display,
        fontWeight: 800,
        fontSize: hero.size,
        color: COLORS.text,
        lineHeight: 1,
        letterSpacing: -2,
        ...oneLine,
      },
      hero.text,
    ),
    d.heroSub
      ? text(
          {
            fontFamily: FONT_FAMILY.body,
            fontWeight: 600,
            fontSize: story ? 30 : 24,
            color: COLORS.orange,
            ...oneLine,
          },
          truncate(d.heroSub, story ? 48 : 40),
        )
      : null,
  );

  const artists = d.topArtists.slice(1, 5);
  const artistRows = (budget: number, rankSize: number, nameSize: number, width: number) =>
    artists.map((name, i) =>
      h(
        'div',
        { alignItems: 'baseline', gap: 20, width: '100%' },
        rank(i + 2, rankSize, width),
        text(
          {
            fontFamily: FONT_FAMILY.body,
            fontWeight: 600,
            fontSize: nameSize,
            color: COLORS.text,
            lineHeight: 1.15,
            flexShrink: 1,
            ...oneLine,
          },
          truncate(name, budget),
        ),
      ),
    );

  if (format === 'story') {
    const tracks = d.topTracks.slice(0, 5);
    return h(
      'div',
      {
        width: f.width,
        height: f.height,
        flexDirection: 'column',
        backgroundColor: 'transparent',
        padding: `${f.padTop}px ${f.padX}px ${f.padBottom}px`,
        justifyContent: 'space-between',
        gap: 32,
      },
      h(
        'div',
        { flexDirection: 'column', gap: 40 },
        header,
        heroBlock,
        artists.length > 0 || cover
          ? h(
              'div',
              { gap: 32, alignItems: 'flex-start', justifyContent: 'space-between' },
              h(
                'div',
                { flexDirection: 'column', gap: 12, flexGrow: 1, flexShrink: 1 },
                artists.length > 0 ? label(d.t.artists) : null,
                ...artistRows(18, 40, 34, 56),
              ),
              cover,
            )
          : null,
        tracks.length > 0
          ? h(
              'div',
              { flexDirection: 'column', gap: 12 },
              label(d.t.tracks),
              ...tracks.map((t, i) =>
                h(
                  'div',
                  { alignItems: 'baseline', gap: 20 },
                  rank(i + 1, 40, 56),
                  h(
                    'div',
                    { flexDirection: 'column', flexShrink: 1 },
                    text(
                      {
                        fontFamily: FONT_FAMILY.body,
                        fontWeight: 600,
                        fontSize: 34,
                        color: COLORS.text,
                        lineHeight: 1.15,
                        ...oneLine,
                      },
                      truncate(t.name, 23),
                    ),
                    text(
                      {
                        fontFamily: FONT_FAMILY.body,
                        fontSize: 24,
                        color: COLORS.muted,
                        lineHeight: 1.2,
                        ...oneLine,
                      },
                      truncate(t.artist, 24),
                    ),
                  ),
                ),
              ),
            )
          : null,
        stat,
      ),
      footer(mode, d, false),
    );
  }

  // 1:1 — a capa (Conectar) ocupa o lugar do bloco de destaque.
  const tracks = d.topTracks.slice(0, 4);
  return h(
    'div',
    {
      width: f.width,
      height: f.height,
      flexDirection: 'column',
      backgroundColor: 'transparent',
      padding: f.padX,
      justifyContent: 'space-between',
    },
    header,
    h(
      'div',
      { gap: 40, alignItems: 'flex-end', justifyContent: 'space-between' },
      h('div', { flexDirection: 'column', flexShrink: 1, minWidth: 0 }, heroBlock),
      cover ?? stat,
    ),
    h(
      'div',
      { gap: 48 },
      h(
        'div',
        { flexDirection: 'column', gap: 12, width: 420 },
        artists.length > 0 ? label(d.t.artists) : null,
        ...artistRows(16, 34, 30, 44),
      ),
      tracks.length > 0
        ? h(
            'div',
            { flexDirection: 'column', gap: 12, width: 420 },
            label(d.t.tracks),
            ...tracks.map((t, i) =>
              h(
                'div',
                { alignItems: 'baseline', gap: 16 },
                rank(i + 1, 34, 44),
                text(
                  {
                    fontFamily: FONT_FAMILY.body,
                    fontWeight: 600,
                    fontSize: 30,
                    color: COLORS.text,
                    flexShrink: 1,
                    ...oneLine,
                  },
                  truncate(t.name, 18),
                ),
              ),
            ),
          )
        : null,
    ),
    footer(mode, d, true),
  );
}

// =====================================================================
// Família "cartaz de festival" (Line-up, Top músicas, Mix): peças comuns (§9.8)
// =====================================================================

/** Headliners nº 1–3: nº 2 e nº 3 a 80% do degrau e com o mesmo tamanho (o menor dos dois). */
function podium(names: readonly string[], steps: readonly FontStep[]): Fitted[] {
  const fits = names.slice(0, 3).map((name, i) =>
    fit(
      name,
      steps.map((step) => ({ ...step, size: i === 0 ? step.size : Math.round(step.size * 0.8) })),
    ),
  );
  if (fits.length === 3) {
    const size = Math.min(fits[1]!.size, fits[2]!.size);
    fits[1]!.size = size;
    fits[2]!.size = size;
  }
  return fits;
}

/** Nº 2 e nº 3 com o mesmo tamanho (o menor dos dois). */
function sameSize(fits: Fitted[]): Fitted[] {
  if (fits.length === 2) {
    const size = Math.min(fits[0]!.size, fits[1]!.size);
    fits[0]!.size = size;
    fits[1]!.size = size;
  }
  return fits;
}

/** Headliners do Line-up (§9.4). */
export function headliners(artists: readonly string[], format: CardFormat, locale: string) {
  return podium(
    artists.slice(0, 3).map((name) => upper(name, locale)),
    STEPS.headliner[format],
  );
}

/** Linha do line-up: nomes com espaços inquebráveis, separados por " • ". */
export function lineup(names: readonly string[], locale: string): string {
  return names
    .map((name) => keepTogether(truncate(upper(name, locale), 22)))
    .join(LINEUP_SEPARATOR);
}

/** Título em linha única: "ENCORE FEST" ou "FESTIVAL {NOME}" (§9.4), igual nos três cartazes. */
export function festivalTitle(d: CardData, format: CardFormat) {
  const name = d.posterName?.trim();
  const raw = name ? `${d.t.festOf} ${name}` : d.t.festDefault;
  return fit(upper(raw, d.locale), STEPS.festivalTitle[format]);
}

/** Cabeçalho do cartaz: "ENCORE APRESENTA" (+ DEMO) · título magenta · chip do período. */
function posterHeader(format: CardFormat, mode: CardMode, d: CardData): CardNode {
  const story = format === 'story';
  const U = (value: string) => upper(value, d.locale);
  const title = festivalTitle(d, format);
  return h(
    'div',
    { flexDirection: 'column', alignItems: 'center', gap: story ? 14 : 8, width: '100%' },
    h(
      'div',
      { gap: 12, alignItems: 'center' },
      text(
        {
          fontFamily: FONT_FAMILY.body,
          fontWeight: 700,
          fontSize: story ? 28 : 22,
          color: COLORS.cyan,
          letterSpacing: 8,
        },
        U(d.t.presents),
      ),
      mode === 'demo' ? demoTag(d) : null,
    ),
    text(
      {
        fontFamily: FONT_FAMILY.condensed,
        fontWeight: 800,
        fontSize: title.size,
        color: COLORS.magenta,
        lineHeight: 0.95,
        textAlign: 'center',
        ...oneLine,
      },
      title.text,
    ),
    text(
      {
        fontFamily: FONT_FAMILY.body,
        fontWeight: 700,
        fontSize: story ? 30 : 24,
        color: COLORS.ink,
        background: COLORS.yellow,
        padding: story ? '10px 28px' : '6px 20px',
        borderRadius: 999,
        letterSpacing: 3,
        ...oneLine,
      },
      U(truncate(d.periodLabel, 28)),
    ),
  );
}

const rule = () => h('div', { flexGrow: 1, height: 3, background: COLORS.magenta });

/** Divisor: linha magenta de 3 px + losango amarelo de 14 px no centro. */
function posterDivider(): CardNode {
  return h(
    'div',
    { width: '100%', alignItems: 'center', gap: 20 },
    rule(),
    h('div', { width: 14, height: 14, background: COLORS.yellow, transform: 'rotate(45deg)' }),
    rule(),
  );
}

/** "Placa de palco": rótulo da seção (ink sobre magenta, 5,82:1) no centro de um divisor. */
function stageSign(label: string, format: CardFormat, d: CardData): CardNode {
  const story = format === 'story';
  return h(
    'div',
    { width: '100%', alignItems: 'center', gap: 20 },
    rule(),
    text(
      {
        fontFamily: FONT_FAMILY.body,
        fontWeight: 700,
        fontSize: story ? 26 : 20,
        color: COLORS.ink,
        background: COLORS.magenta,
        padding: story ? '8px 22px' : '6px 16px',
        borderRadius: 8,
        letterSpacing: story ? 5 : 4,
        flexShrink: 0,
      },
      upper(label, d.locale),
    ),
    rule(),
  );
}

/** Linha de estatísticas laranja, em caixa alta; some se a lista vier vazia. */
function posterStats(format: CardFormat, d: CardData, stats: readonly string[]): CardNode | null {
  return stats.length > 0
    ? text(
        {
          fontFamily: FONT_FAMILY.body,
          fontWeight: 700,
          fontSize: format === 'story' ? 28 : 22,
          color: COLORS.orange,
          letterSpacing: 3,
          textAlign: 'center',
          justifyContent: 'center',
          width: '100%',
        },
        upper(stats.join('  ·  '), d.locale),
      )
    : null;
}

/** Moldura comum: conteúdo no topo; estatísticas + rodapé na base, dentro da área segura. */
function posterFrame(
  format: CardFormat,
  mode: CardMode,
  d: CardData,
  top: CardNode[],
  stats: readonly string[],
  topGap: number,
): CardNode {
  const story = format === 'story';
  const f = FORMATS[format];
  return h(
    'div',
    {
      width: f.width,
      height: f.height,
      flexDirection: 'column',
      backgroundColor: 'transparent',
      padding: `${f.padTop}px ${f.padX}px ${f.padBottom}px`,
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 32,
    },
    h('div', { flexDirection: 'column', alignItems: 'center', gap: topGap, width: '100%' }, ...top),
    h(
      'div',
      { flexDirection: 'column', gap: story ? 40 : 20, width: '100%' },
      posterStats(format, d, stats),
      footer(mode, d, !story),
    ),
  );
}

/** Nome em destaque centralizado, em linha única (headliners e artistas do Mix). */
function centered(value: string, size: number, color: string, lineHeight: number): CardNode {
  return text(
    {
      fontFamily: FONT_FAMILY.condensed,
      fontWeight: 800,
      fontSize: size,
      color,
      lineHeight,
      textAlign: 'center',
      justifyContent: 'center',
      width: '100%',
      ...oneLine,
    },
    value,
  );
}

// ---------- nomes de música ----------
type PosterTrack = { name: string; artist: string };

/** Músicas para os cartazes: limpeza de feat./remaster (§9.11) e caixa alta pelo locale. */
function posterTracks(d: CardData, max: number): PosterTrack[] {
  return d.topTracks.slice(0, max).map((t) => ({
    name: upper(tidyTrack(t.name), d.locale),
    artist: t.artist ? upper(t.artist, d.locale) : '',
  }));
}

export type FittedTrack = Fitted & { lines: 1 | 2 };

/** Degraus de uma linha; acima do último orçamento, até 2 linhas no tamanho `twoLine`. */
export function fitTrack(
  value: string,
  steps: readonly FontStep[],
  twoLine: TwoLineStep,
): FittedTrack {
  if (graphemeLength(value) <= steps[steps.length - 1]!.max) {
    return { ...fit(value, steps), lines: 1 };
  }
  return { text: truncate(value, twoLine.max), size: twoLine.size, lines: 2 };
}

/** Bloco "música + artista", centralizado; o artista vem em rosa (§9.8). */
function trackBlock(
  track: { text: string; size: number; lines: 1 | 2; artist: string; color: string },
  artistSize: number,
  gap: number,
): CardNode {
  return h(
    'div',
    { flexDirection: 'column', alignItems: 'center', gap, width: '100%' },
    text(
      {
        fontFamily: FONT_FAMILY.condensed,
        fontWeight: 800,
        fontSize: track.size,
        color: track.color,
        lineHeight: 0.95,
        textAlign: 'center',
        justifyContent: 'center',
        width: '100%',
        ...(track.lines > 1
          ? { lineClamp: track.lines, overflow: 'hidden', wordBreak: 'break-word' }
          : oneLine),
      },
      track.text,
    ),
    track.artist
      ? text(
          {
            fontFamily: FONT_FAMILY.body,
            fontWeight: 700,
            fontSize: artistSize,
            color: COLORS.pink,
            letterSpacing: 3,
            textAlign: 'center',
            justifyContent: 'center',
            maxWidth: '100%',
            ...oneLine,
          },
          truncate(track.artist, 32),
        )
      : null,
  );
}

/**
 * Nº 1 (amarelo, até 2 linhas) e nº 2–3 (brancos, mesmo tamanho) de uma lista de músicas.
 * `sizes` = [artista do nº 1, artista dos nº 2–3]; `gaps` idem, entre o nome e o artista.
 */
function podiumTracks(
  list: readonly PosterTrack[],
  steps: { head: readonly FontStep[]; headTwo: TwoLineStep; sub: readonly FontStep[] },
  sizes: readonly [number, number],
  gaps: readonly [number, number],
): CardNode[] {
  const [first, ...rest] = list;
  if (!first) return [];
  const head = fitTrack(first.name, steps.head, steps.headTwo);
  const subs = sameSize(rest.slice(0, 2).map((t) => fit(t.name, steps.sub)));
  return [
    trackBlock({ ...head, artist: first.artist, color: COLORS.yellow }, sizes[0], gaps[0]),
    ...subs.map((r, i) =>
      trackBlock(
        { ...r, lines: 1, artist: rest[i]!.artist, color: COLORS.text },
        sizes[1],
        gaps[1],
      ),
    ),
  ];
}

// =====================================================================
// Template 2 — LINE-UP DE FESTIVAL (§9.4, sempre tipográfico, sem capas)
// =====================================================================
function festival(format: CardFormat, mode: CardMode, d: CardData): CardNode {
  const story = format === 'story';
  const loc = d.locale;
  const headColors = [COLORS.yellow, COLORS.text, COLORS.text];
  const head = headliners(d.topArtists, format, loc).map((r, i) =>
    centered(r.text, r.size, headColors[i]!, 0.92),
  );
  const tier2 = lineup(d.topArtists.slice(3, 10), loc);
  const tier3 = lineup(d.topArtists.slice(10, story ? 25 : 20), loc);

  const lineupBlock = h(
    'div',
    { flexDirection: 'column', alignItems: 'center', gap: story ? 28 : 16, width: '100%' },
    ...head,
    tier2 ? posterDivider() : null,
    tier2
      ? text(
          {
            fontFamily: FONT_FAMILY.condensed,
            fontWeight: 800,
            fontSize: story ? 62 : 44,
            color: COLORS.text,
            lineHeight: 1.1,
            textAlign: 'center',
            justifyContent: 'center',
            lineClamp: 3,
          },
          tier2,
        )
      : null,
    tier3
      ? text(
          {
            fontFamily: FONT_FAMILY.body,
            fontWeight: 600,
            fontSize: story ? 32 : 24,
            color: COLORS.muted,
            lineHeight: 1.45,
            textAlign: 'center',
            justifyContent: 'center',
            letterSpacing: 1,
            lineClamp: story ? 5 : 3,
          },
          tier3,
        )
      : null,
  );

  return posterFrame(
    format,
    mode,
    d,
    [posterHeader(format, mode, d), lineupBlock],
    d.stats,
    story ? 64 : 28,
  );
}

// =====================================================================
// Template 3 — TOP MÚSICAS (§9.9, "o setlist do festival"; sempre tipográfico, sem capas)
// =====================================================================
function setlistNumber(n: number, size: number, width: number): CardNode {
  return text(
    {
      fontFamily: FONT_FAMILY.display,
      fontWeight: 800,
      fontSize: size,
      color: COLORS.yellow,
      width,
      flexShrink: 0,
    },
    String(n),
  );
}

/** Nº 4–10. Stories: uma coluna centralizada como bloco, com as linhas alinhadas à esquerda. */
function storySetlist(tail: readonly PosterTrack[]): CardNode {
  return h(
    'div',
    { flexDirection: 'column', alignItems: 'flex-start', gap: 10, maxWidth: '100%' },
    ...tail.map((t, i) =>
      h(
        'div',
        { alignItems: 'baseline', gap: 16, maxWidth: '100%' },
        setlistNumber(i + 4, 33, 52),
        text(
          {
            fontFamily: FONT_FAMILY.condensed,
            fontWeight: 800,
            fontSize: 46,
            color: COLORS.text,
            lineHeight: 1.05,
            flexShrink: 1,
            ...oneLine,
          },
          keepTogether(truncate(t.name, 30)),
        ),
        t.artist
          ? text(
              {
                fontFamily: FONT_FAMILY.body,
                fontWeight: 600,
                fontSize: 24,
                color: COLORS.muted,
                flexShrink: 0,
                ...oneLine,
              },
              truncate(t.artist, 20),
            )
          : null,
      ),
    ),
  );
}

/** Nº 4–10 no 1:1: duas colunas (nº 4–7 | nº 8–10), nome em cima e artista embaixo. */
function squareSetlist(tail: readonly PosterTrack[]): CardNode {
  const item = (t: PosterTrack, i: number) =>
    h(
      'div',
      { alignItems: 'baseline', gap: 10, width: '100%' },
      setlistNumber(i + 4, 26, 38),
      h(
        'div',
        { flexDirection: 'column', flexShrink: 1, minWidth: 0 },
        text(
          {
            fontFamily: FONT_FAMILY.condensed,
            fontWeight: 800,
            fontSize: 32,
            color: COLORS.text,
            lineHeight: 1.05,
            ...oneLine,
          },
          keepTogether(truncate(t.name, 28)),
        ),
        t.artist
          ? text(
              {
                fontFamily: FONT_FAMILY.body,
                fontWeight: 600,
                fontSize: 17,
                color: COLORS.muted,
                lineHeight: 1.25,
                ...oneLine,
              },
              truncate(t.artist, 30),
            )
          : null,
      ),
    );
  const right = tail.slice(4, 7);
  return h(
    'div',
    { width: '100%', gap: 32, alignItems: 'flex-start' },
    h('div', { flexDirection: 'column', gap: 10, width: 452 }, ...tail.slice(0, 4).map(item)),
    right.length > 0
      ? h(
          'div',
          { flexDirection: 'column', gap: 10, width: 452 },
          ...right.map((t, i) => item(t, i + 4)),
        )
      : null,
  );
}

function tracks(format: CardFormat, mode: CardMode, d: CardData): CardNode {
  const story = format === 'story';
  const list = posterTracks(d, TRACKS_MAX);
  const top = podiumTracks(
    list,
    TRACK_STEPS[format],
    story ? [30, 24] : [22, 18],
    story ? [12, 8] : [8, 4],
  );
  const tail = list.slice(3);
  const setlist = tail.length === 0 ? null : story ? storySetlist(tail) : squareSetlist(tail);

  const body = h(
    'div',
    { flexDirection: 'column', alignItems: 'center', gap: story ? 26 : 14, width: '100%' },
    stageSign(d.t.tracks, format, d),
    ...top,
    setlist ? posterDivider() : null,
    setlist,
  );
  return posterFrame(
    format,
    mode,
    d,
    [posterHeader(format, mode, d), body],
    d.trackStats,
    story ? 48 : 20,
  );
}

// =====================================================================
// Template 4 — MIX (§9.10, top 3 artistas + top 3 músicas; sempre tipográfico, sem capas)
// =====================================================================
function mix(format: CardFormat, mode: CardMode, d: CardData): CardNode {
  const story = format === 'story';
  const S = MIX_STEPS[format];
  const artists = podium(
    d.topArtists.slice(0, 3).map((name) => upper(name, d.locale)),
    S.artist,
  ).map((r, i) => centered(r.text, r.size, i === 0 ? COLORS.yellow : COLORS.text, 0.95));
  const songs = podiumTracks(
    posterTracks(d, 3),
    { head: S.track, headTwo: S.trackTwo, sub: S.trackSub },
    [S.artistSize, S.subArtistSize],
    story ? [10, 6] : [4, 2],
  );

  const body = h(
    'div',
    { flexDirection: 'column', alignItems: 'center', gap: S.gap, width: '100%' },
    stageSign(d.t.artists, format, d),
    h(
      'div',
      { flexDirection: 'column', alignItems: 'center', gap: S.artistGap, width: '100%' },
      ...artists,
    ),
    songs.length > 0 ? stageSign(d.t.tracks, format, d) : null,
    songs.length > 0
      ? h(
          'div',
          { flexDirection: 'column', alignItems: 'center', gap: S.trackGap, width: '100%' },
          ...songs,
        )
      : null,
  );
  return posterFrame(format, mode, d, [posterHeader(format, mode, d), body], d.mixStats, S.topGap);
}

const TEMPLATES: Record<CardTemplate, (f: CardFormat, m: CardMode, d: CardData) => CardNode> = {
  festival,
  tracks,
  mix,
  basic,
};

/**
 * Árvore do card. Upload e Demo nunca levam capa nem logo, mesmo que venham nos dados
 * (§9.6 e §10, itens 16 e 17); só o Básico leva capa, e só no Conectar.
 */
export function buildCard({ template, format, mode, data }: CardRequest): CardNode {
  const d = normalize(data);
  const safe: CardData =
    mode === 'connect'
      ? { ...d, cover: template === 'basic' ? d.cover : undefined }
      : { ...d, cover: undefined, spotifyLogo: undefined };
  return TEMPLATES[template](format, mode, safe);
}
