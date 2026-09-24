/**
 * Templates Básico e Line-up de festival (10-design.md §9), em árvores `{ type, props }` que o
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
import { cleanText, fit, keepTogether, truncate, type FontStep } from './text';

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
function wordmark(size: number, color: string = COLORS.magenta): CardNode {
  return text(
    {
      fontFamily: FONT_FAMILY.display,
      fontWeight: 800,
      fontSize: size,
      color,
      letterSpacing: -1,
    },
    'encore',
  );
}

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
    { flexDirection: 'column', gap: 4 },
    wordmark(compact ? 34 : 40, COLORS.text),
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

/**
 * Fundos (§9.3, §9.4) em camadas CSS: a primeira radial fica por cima. O satori transforma
 * `background-image` em `<pattern>` com máscara do tamanho do canvas, e o resvg leva ~2,5 s para
 * pintar isso num Stories. Por isso o fundo é desenhado direto em SVG (`backgroundSvg`), com
 * gradientes equivalentes, e injetado antes do conteúdo: ~0,3 s.
 */
const BACKGROUNDS: Record<CardTemplate, Layers> = {
  festival: {
    linear: [
      ['#0E0B1A', 0],
      ['#140E28', 0.55],
      ['#2A0F3D', 0.82],
      ['#4A1247', 1],
    ],
    radials: [
      { x: 0.12, y: 0.06, color: [255, 61, 139], alpha: 0.55, stop: 0.38 },
      { x: 0.9, y: 0.1, color: [61, 224, 255], alpha: 0.4, stop: 0.34 },
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
    wordmark(story ? 44 : 36),
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
// Template 2 — LINE-UP DE FESTIVAL (§9.4, sempre tipográfico, sem capas)
// =====================================================================

/** Headliners nº 1–3: nº 2 e nº 3 a 80% do degrau e com o mesmo tamanho (o menor dos dois). */
export function headliners(artists: readonly string[], format: CardFormat, locale: string) {
  const steps = STEPS.headliner[format];
  const fits = artists.slice(0, 3).map((name, i) =>
    fit(
      upper(name, locale),
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

/** Linha do line-up: nomes com espaços inquebráveis, separados por " • ". */
export function lineup(names: readonly string[], locale: string): string {
  return names
    .map((name) => keepTogether(truncate(upper(name, locale), 22)))
    .join(LINEUP_SEPARATOR);
}

/** Título em linha única: "ENCORE FEST" ou "FESTIVAL {NOME}" (§9.4). */
export function festivalTitle(d: CardData, format: CardFormat) {
  const name = d.posterName?.trim();
  const raw = name ? `${d.t.festOf} ${name}` : d.t.festDefault;
  return fit(upper(raw, d.locale), STEPS.festivalTitle[format]);
}

function festival(format: CardFormat, mode: CardMode, d: CardData): CardNode {
  const story = format === 'story';
  const f = FORMATS[format];
  const loc = d.locale;
  const U = (value: string) => upper(value, loc);
  const headColors = [COLORS.yellow, COLORS.text, COLORS.text];
  const head = headliners(d.topArtists, format, loc).map((r, i) =>
    text(
      {
        fontFamily: FONT_FAMILY.condensed,
        fontWeight: 800,
        fontSize: r.size,
        color: headColors[i]!,
        lineHeight: 0.92,
        textAlign: 'center',
        justifyContent: 'center',
        width: '100%',
        ...oneLine,
      },
      r.text,
    ),
  );
  const tier2 = lineup(d.topArtists.slice(3, 10), loc);
  const tier3 = lineup(d.topArtists.slice(10, story ? 25 : 20), loc);
  const title = festivalTitle(d, format);

  const divider = h(
    'div',
    { width: '100%', alignItems: 'center', gap: 20 },
    h('div', { flexGrow: 1, height: 3, background: COLORS.magenta }),
    h('div', { width: 14, height: 14, background: COLORS.yellow, transform: 'rotate(45deg)' }),
    h('div', { flexGrow: 1, height: 3, background: COLORS.magenta }),
  );

  const header = h(
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

  const lineupBlock = h(
    'div',
    { flexDirection: 'column', alignItems: 'center', gap: story ? 28 : 16, width: '100%' },
    ...head,
    tier2 ? divider : null,
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

  const stats =
    d.stats.length > 0
      ? text(
          {
            fontFamily: FONT_FAMILY.body,
            fontWeight: 700,
            fontSize: story ? 28 : 22,
            color: COLORS.orange,
            letterSpacing: 3,
            textAlign: 'center',
            justifyContent: 'center',
            width: '100%',
          },
          U(d.stats.join('  ·  ')),
        )
      : null;

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
    h(
      'div',
      { flexDirection: 'column', alignItems: 'center', gap: story ? 64 : 28, width: '100%' },
      header,
      lineupBlock,
    ),
    h(
      'div',
      { flexDirection: 'column', gap: story ? 40 : 20, width: '100%' },
      stats,
      footer(mode, d, !story),
    ),
  );
}

/**
 * Árvore do card. Upload e Demo nunca levam capa nem logo, mesmo que venham nos dados
 * (§9.6 e §10, itens 16 e 17); o Festival nunca leva capa.
 */
export function buildCard({ template, format, mode, data }: CardRequest): CardNode {
  const d = normalize(data);
  const safe: CardData =
    mode === 'connect'
      ? { ...d, cover: template === 'basic' ? d.cover : undefined }
      : { ...d, cover: undefined, spotifyLogo: undefined };
  return template === 'festival' ? festival(format, mode, safe) : basic(format, mode, safe);
}
