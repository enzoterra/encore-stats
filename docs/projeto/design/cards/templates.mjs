// Encore — protótipo de referência dos templates de card para satori 0.33 (S3.3; Top músicas e Mix na Iteração 8b).
// NÃO é código de produção: é a prova de que o layout do 10-design.md §8 roda no satori
// (só flexbox, sem grid, fontes TTF estáticas). O dev-frontend reescreve em TSX em
// src/features/cards/, mantendo medidas, tokens e regras de truncamento.
//
// Uso: render(template, format, mode, data) -> árvore { type, props } que o satori aceita.

// ---------- tokens (espelham o 10-design.md §2 / §9) ----------
export const C = {
  bg: '#0E0B1A', s1: '#17122A', s2: '#211A3A', s3: '#2B2248',
  text: '#F5F1FF', muted: '#B8AED6', subtle: '#968CB8', border: '#342A52',
  magenta: '#FF3D8B', yellow: '#FFE14D', orange: '#FF7A1A', cyan: '#3DE0FF', ink: '#0E0B1A',
  pink: '#FF7AB0', // primary-fg: artista das músicas nos cartazes (8,01:1 sobre o fundo)
};
const F = { display: 'Bricolage Grotesque', condensed: 'Bricolage Grotesque Condensed', body: 'Inter' };

// ---------- formatos e áreas seguras (px no canvas) ----------
export const FORMATS = {
  story: { width: 1080, height: 1920, padTop: 250, padBottom: 280, padX: 72 }, // 9:16
  square: { width: 1080, height: 1080, padTop: 72, padBottom: 72, padX: 72 },  // 1:1
};

// ---------- utilitários ----------
const h = (type, style, ...children) => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.flat().filter((c) => c !== null && c !== false && c !== undefined) },
});
const text = (style, s) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children: s } });

const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
/** Trunca por grafemas (emoji/acentos combinados contam como 1) e acrescenta "…". */
export function truncate(s, max) {
  const g = [...seg.segment(s.trim())].map((x) => x.segment);
  if (g.length <= max) return s.trim();
  return g.slice(0, max - 1).join('').trimEnd() + '…';
}
const len = (s) => [...seg.segment(s)].length;

/** Escolhe o maior degrau de fonte cujo orçamento de caracteres comporta o texto; senão trunca no menor. */
export function fit(s, steps) {
  const start = outsideDisplayCoverage(s) ? 1 : 0;
  for (const st of steps.slice(Math.min(start, steps.length - 1))) if (len(s) <= st.max) return { text: s, size: st.size };
  const last = steps[steps.length - 1];
  return { text: truncate(s, last.max), size: last.size };
}

const upper = (s, locale) => s.toLocaleUpperCase(locale);
/** Bricolage cobre Latim/Latim estendido/vietnamita. Fora disso o satori cai no Inter (mais largo): desce 1 degrau. */
export const outsideDisplayCoverage = (s) => /[^\u0000-\u024F\u1E00-\u1EFF\u2000-\u206F\u20AC]/u.test(s);
/** Espaços inquebráveis dentro do nome: a quebra de linha só acontece entre nomes (nos separadores). */
const keep = (s) => s.replace(/ /g, '\u00A0');
/** Linha única com reticências como rede de segurança (além do truncamento por orçamento). */
const oneLine = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

// ---------- peças comuns ----------
function wordmark(size = 40, color = C.magenta) {
  return text({ fontFamily: F.display, fontWeight: 800, fontSize: size, color, letterSpacing: -1 }, 'encore');
}

function chip(label, bg = C.yellow) {
  return text({ fontFamily: F.body, fontWeight: 700, fontSize: 28, color: C.ink, background: bg, padding: '10px 24px', borderRadius: 999, letterSpacing: 1 }, label);
}

/** Rodapé com atribuição. Conectar: logo oficial do Spotify (branco). Upload/Demo: só texto. */
function footer(mode, d, compact = false) {
  const left = h('div', { flexDirection: 'column', gap: 4 },
    wordmark(compact ? 34 : 40, C.text),
    text({ fontFamily: F.body, fontSize: 22, color: C.subtle }, d.siteLabel),
  );
  let right;
  if (mode === 'connect') {
    // Logo completo (ícone + wordmark) BRANCO sobre fundo escuro, largura ≥ 210 px no canvas
    // (≈ 73 px exibido num telefone de 375 pt — acima do mínimo de 70 px das guidelines).
    // Área de proteção = metade da altura do ícone (≈ 32 px aqui) — nada encosta nele.
    // O logo fica SOZINHO (guideline: não usar o logo numa frase, ex.: "Dados de [logo]").
    right = h('div', { flexDirection: 'column', alignItems: 'flex-end', padding: 16 },
      d.spotifyLogo
        ? { type: 'img', props: { src: d.spotifyLogo, width: 210, height: 57 } } // proporção do SVG oficial (823 × 225)
        : h('div', { width: 210, height: 57, border: `2px dashed ${C.muted}`, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
            text({ fontFamily: F.body, fontSize: 15, color: C.muted }, 'logo Spotify oficial')),
    );
  } else {
    right = h('div', { flexDirection: 'column', alignItems: 'flex-end', gap: 6, maxWidth: 520 },
      text({ fontFamily: F.body, fontSize: 22, color: C.subtle, textAlign: 'right' }, mode === 'demo' ? d.t.demoFooter : d.t.uploadFooter),
    );
  }
  return h('div', { width: '100%', justifyContent: 'space-between', alignItems: 'flex-end' }, left, right);
}

function demoTag(d) {
  return text({ fontFamily: F.body, fontWeight: 700, fontSize: 24, color: C.ink, background: C.cyan, padding: '8px 18px', borderRadius: 8, letterSpacing: 2 }, d.t.demoTag);
}

// ---------- fundos (só gradientes, satori suporta linear/radial em backgroundImage) ----------
const stageBg = [
  'radial-gradient(circle at 12% 6%, rgba(255,61,139,0.55) 0%, rgba(255,61,139,0) 38%)',
  'radial-gradient(circle at 90% 10%, rgba(61,224,255,0.40) 0%, rgba(61,224,255,0) 34%)',
  'linear-gradient(180deg, #0E0B1A 0%, #140E28 55%, #2A0F3D 82%, #4A1247 100%)',
].join(', ');
// Top músicas: mesma noite de show, holofotes trocados de lado (ciano à esquerda, magenta à direita)
const tracksBg = [
  'radial-gradient(circle at 10% 6%, rgba(61,224,255,0.40) 0%, rgba(61,224,255,0) 34%)',
  'radial-gradient(circle at 90% 8%, rgba(255,61,139,0.55) 0%, rgba(255,61,139,0) 38%)',
  'linear-gradient(180deg, #0E0B1A 0%, #140E28 55%, #2A0F3D 82%, #4A1247 100%)',
].join(', ');
// Mix: magenta à esquerda e laranja à direita (os dois "palcos")
const mixBg = [
  'radial-gradient(circle at 12% 6%, rgba(255,61,139,0.55) 0%, rgba(255,61,139,0) 38%)',
  'radial-gradient(circle at 90% 10%, rgba(255,122,26,0.38) 0%, rgba(255,122,26,0) 34%)',
  'linear-gradient(180deg, #0E0B1A 0%, #140E28 55%, #2A0F3D 82%, #4A1247 100%)',
].join(', ');
const basicBg = [
  'radial-gradient(circle at 100% 0%, rgba(255,122,26,0.35) 0%, rgba(255,122,26,0) 40%)',
  'linear-gradient(180deg, #0E0B1A 0%, #17122A 100%)',
].join(', ');

// =====================================================================
// Template 1 — BÁSICO
// =====================================================================
function basic(fmt, mode, d) {
  const story = fmt === 'story';
  const f = FORMATS[fmt];
  const loc = d.locale;
  const hero = fit(d.topArtists[0], story
    ? [{ max: 10, size: 128 }, { max: 14, size: 104 }, { max: 18, size: 84 }, { max: 24, size: 64 }]
    : [{ max: 10, size: 96 }, { max: 14, size: 80 }, { max: 18, size: 64 }, { max: 24, size: 52 }]);
  const rows = (items, n, max) => items.slice(0, n).map((it, i) =>
    h('div', { alignItems: 'baseline', gap: 20, width: '100%' },
      text({ fontFamily: F.display, fontWeight: 800, fontSize: story ? 40 : 34, color: C.yellow, width: story ? 56 : 44 }, String(i + 2)), // artistas 2–5 (o nº 1 é o herói)
      h('div', { flexDirection: 'column', flexGrow: 1, flexShrink: 1 },
        text({ fontFamily: F.body, fontWeight: 600, fontSize: story ? 34 : 30, color: C.text, lineHeight: 1.15, ...oneLine }, truncate(it.name, max)),
        it.sub ? text({ fontFamily: F.body, fontSize: story ? 24 : 22, color: C.muted, lineHeight: 1.2, ...oneLine }, truncate(it.sub, 24)) : null,
      ),
    ));
  const label = (s) => text({ fontFamily: F.body, fontWeight: 700, fontSize: story ? 24 : 20, color: C.cyan, letterSpacing: 4 }, upper(s, loc));

  // bloco de destaque: vibrante com texto escuro (regra da marca)
  const stat = d.stat
    ? h('div', { flexDirection: 'column', background: C.magenta, borderRadius: 24, padding: story ? '22px 32px' : '20px 28px', gap: 2 },
        text({ fontFamily: F.display, fontWeight: 800, fontSize: story ? 80 : 64, color: C.ink, lineHeight: 1 }, d.stat.value),
        text({ fontFamily: F.body, fontWeight: 600, fontSize: story ? 30 : 24, color: C.ink }, d.stat.label))
    : null;

  const artists = d.topArtists.slice(1, 5).map((name) => ({ name }));
  const tracks = d.topTracks.slice(0, story ? 5 : 4).map((t) => ({ name: t.name, sub: story ? t.artist : null }));

  // Conectar: capa da música nº 1, quadrada, sem corte, sem sobreposição, raio 16 px no canvas (≈ 5,5 pt no telefone; guideline 4–8 px)
  const cover = mode === 'connect' && d.cover
    ? h('div', { flexDirection: 'column', gap: 12 },
        { type: 'img', props: { src: d.cover, width: story ? 260 : 220, height: story ? 260 : 220, style: { borderRadius: 16 } } })
    : null;

  const header = h('div', { width: '100%', justifyContent: 'space-between', alignItems: 'center' },
    wordmark(story ? 44 : 36),
    h('div', { gap: 12, alignItems: 'center' }, mode === 'demo' ? demoTag(d) : null, chip(d.periodLabel)),
  );

  const heroBlock = h('div', { flexDirection: 'column', gap: 8 },
    text({ fontFamily: F.body, fontWeight: 600, fontSize: story ? 32 : 24, color: C.muted }, d.t.topArtist),
    text({ fontFamily: F.display, fontWeight: 800, fontSize: hero.size, color: C.text, lineHeight: 1, letterSpacing: -2, ...oneLine }, hero.text),
    text({ fontFamily: F.body, fontWeight: 600, fontSize: story ? 30 : 24, color: C.orange }, d.heroSub),
  );

  if (story) {
    return h('div', { width: f.width, height: f.height, flexDirection: 'column', backgroundImage: basicBg, backgroundColor: C.bg, padding: `${f.padTop}px ${f.padX}px ${f.padBottom}px`, justifyContent: 'space-between', gap: 32 },
      h('div', { flexDirection: 'column', gap: 40 },
        header,
        heroBlock,
        h('div', { gap: 32, alignItems: 'flex-start' },
          h('div', { flexDirection: 'column', gap: 12, flexGrow: 1, flexShrink: 1 }, label(d.t.artists), ...rows(artists, 4, 18)),
          cover),
        h('div', { flexDirection: 'column', gap: 12 }, label(d.t.tracks),
          ...tracks.map((t, i) => h('div', { alignItems: 'baseline', gap: 20 },
            text({ fontFamily: F.display, fontWeight: 800, fontSize: 40, color: C.yellow, width: 56 }, String(i + 1)),
            h('div', { flexDirection: 'column', flexShrink: 1 },
              text({ fontFamily: F.body, fontWeight: 600, fontSize: 34, color: C.text, lineHeight: 1.15, ...oneLine }, truncate(t.name, 23)),
              text({ fontFamily: F.body, fontSize: 24, color: C.muted, lineHeight: 1.2, ...oneLine }, truncate(t.sub, 24)))))),
        stat,
      ),
      footer(mode, d),
    );
  }
  // 1:1
  return h('div', { width: f.width, height: f.height, flexDirection: 'column', backgroundImage: basicBg, backgroundColor: C.bg, padding: f.padX, justifyContent: 'space-between' },
    header,
    h('div', { gap: 40, alignItems: 'flex-end', justifyContent: 'space-between' },
      h('div', { flexDirection: 'column', flexShrink: 1 }, heroBlock),
      cover ?? stat),
    h('div', { gap: 48 },
      h('div', { flexDirection: 'column', gap: 12, width: 420 }, label(d.t.artists), ...rows(artists, 4, 16)),
      h('div', { flexDirection: 'column', gap: 12, width: 420 }, label(d.t.tracks),
        ...tracks.map((t, i) => h('div', { alignItems: 'baseline', gap: 16 },
          text({ fontFamily: F.display, fontWeight: 800, fontSize: 34, color: C.yellow, width: 44 }, String(i + 1)),
          text({ fontFamily: F.body, fontWeight: 600, fontSize: 30, color: C.text, ...oneLine }, truncate(t.name, 18)))))),
    footer(mode, d, true),
  );
}

// =====================================================================
// Família "cartaz de festival" (Line-up, Top músicas, Mix): peças comuns
// =====================================================================

/** Título em linha única: "ENCORE FEST" ou "FESTIVAL <NOME>" (nome opcional digitado no modal, ≤ 20 grafemas, nunca sai do aparelho). */
function posterTitle(fmt, d) {
  const U = (s) => upper(s, d.locale);
  return fit(d.posterName ? `${U(d.t.festOf)} ${U(d.posterName.trim())}` : U(d.t.festDefault),
    fmt === 'story' ? [{ max: 18, size: 104 }, { max: 24, size: 84 }, { max: 30, size: 68 }] : [{ max: 18, size: 72 }, { max: 24, size: 60 }, { max: 30, size: 50 }]);
}

/** Cabeçalho do cartaz: "ENCORE APRESENTA" (+ DEMO) · título magenta · chip do período. Igual nos 3 templates da família. */
function posterHeader(fmt, mode, d) {
  const story = fmt === 'story';
  const U = (s) => upper(s, d.locale);
  const title = posterTitle(fmt, d);
  return h('div', { flexDirection: 'column', alignItems: 'center', gap: story ? 14 : 8, width: '100%' },
    h('div', { gap: 12, alignItems: 'center' },
      text({ fontFamily: F.body, fontWeight: 700, fontSize: story ? 28 : 22, color: C.cyan, letterSpacing: 8 }, U(d.t.presents)),
      mode === 'demo' ? demoTag(d) : null),
    text({ fontFamily: F.condensed, fontWeight: 800, fontSize: title.size, color: C.magenta, lineHeight: 0.95, textAlign: 'center', ...oneLine }, title.text),
    text({ fontFamily: F.body, fontWeight: 700, fontSize: story ? 30 : 24, color: C.ink, background: C.yellow, padding: story ? '10px 28px' : '6px 20px', borderRadius: 999, letterSpacing: 3, ...oneLine }, U(truncate(d.periodLabel, 28))),
  );
}

/** Divisor: linha magenta de 3 px + losango amarelo de 14 px no centro. */
function posterDivider() {
  return h('div', { width: '100%', alignItems: 'center', gap: 20 },
    h('div', { flexGrow: 1, height: 3, background: C.magenta }),
    h('div', { width: 14, height: 14, background: C.yellow, transform: 'rotate(45deg)' }),
    h('div', { flexGrow: 1, height: 3, background: C.magenta }),
  );
}

/** "Placa de palco": rótulo da seção (ink sobre magenta, 5,82:1) no centro de um divisor. */
function stageSign(label, fmt, d) {
  const story = fmt === 'story';
  const sign = text({ fontFamily: F.body, fontWeight: 700, fontSize: story ? 26 : 20, color: C.ink, background: C.magenta, padding: story ? '8px 22px' : '6px 16px', borderRadius: 8, letterSpacing: story ? 5 : 4, flexShrink: 0 }, upper(label, d.locale));
  return h('div', { width: '100%', alignItems: 'center', gap: 20 },
    h('div', { flexGrow: 1, height: 3, background: C.magenta }),
    sign,
    h('div', { flexGrow: 1, height: 3, background: C.magenta }),
  );
}

function posterStats(fmt, d, stats) {
  const story = fmt === 'story';
  return stats?.length
    ? text({ fontFamily: F.body, fontWeight: 700, fontSize: story ? 28 : 22, color: C.orange, letterSpacing: 3, textAlign: 'center', justifyContent: 'center', width: '100%' }, upper(stats.join('  ·  '), d.locale))
    : null;
}

/** Moldura comum: conteúdo no topo, estatísticas + rodapé na base (dentro da área segura). */
function posterFrame(fmt, mode, d, bg, top, stats, topGap) {
  const story = fmt === 'story';
  const f = FORMATS[fmt];
  return h('div', { width: f.width, height: f.height, flexDirection: 'column', backgroundImage: bg, backgroundColor: C.bg, padding: `${f.padTop}px ${f.padX}px ${f.padBottom}px`, justifyContent: 'space-between', alignItems: 'center', gap: 32 },
    h('div', { flexDirection: 'column', alignItems: 'center', gap: topGap, width: '100%' }, ...top),
    h('div', { flexDirection: 'column', gap: story ? 40 : 20, width: '100%' }, posterStats(fmt, d, stats), footer(mode, d, !story)),
  );
}

// ---------- nomes de música ----------
/**
 * Limpa o "ruído de catálogo" do nome da música ANTES do orçamento de grafemas, só no card
 * (o dashboard mostra o nome completo): participações "(feat. X)", "[ft. X]", "(with X)",
 * "(part. X)", "- feat. X", e sufixos de remasterização/edição "- Remastered 2011",
 * "- Remasterizado", "- Radio Edit", "- Single Version". Versões com sentido ("Ao Vivo",
 * "Acústico", "Remix") ficam. Se sobrar vazio, volta o original.
 */
export function tidyTrack(name) {
  const s = name
    .replace(/\s*[([](?:feat\.?|ft\.?|with|part\.?|participação(?: especial)?(?: de)?)\s[^)\]]*[)\]]/giu, '')
    .replace(/\s+-\s+(?:feat\.?|ft\.?|part\.?)\s.*$/iu, '')
    .replace(/\s+-\s+(?:\d{4}\s+)?(?:remaster(?:ed|izad[oa])?|remasterização)(?:\s+\d{4})?(?:\s+(?:version|versão))?\s*$/iu, '')
    .replace(/\s+-\s+(?:radio edit|single version|versão single|edit)\s*$/iu, '')
    .trim();
  return s || name.trim();
}

/** Dois degraus de uma linha e um último de até 2 linhas (músicas são longas). `lines` informa quantas linhas o texto pode ocupar. */
function fitTrack(s, steps, twoLine) {
  const r = fit(s, steps);
  if (!twoLine || len(s) <= steps[steps.length - 1].max) return { ...r, lines: 1 };
  return { text: truncate(s, twoLine.max), size: twoLine.size, lines: 2 };
}

/** Bloco "música + artista", centralizado. */
function trackBlock({ name, artist, size, lines, color, artistSize, artistMax, gap }) {
  return h('div', { flexDirection: 'column', alignItems: 'center', gap, width: '100%' },
    text({ fontFamily: F.condensed, fontWeight: 800, fontSize: size, color, lineHeight: 0.95, textAlign: 'center', justifyContent: 'center', width: '100%', ...(lines > 1 ? { lineClamp: lines, overflow: 'hidden', wordBreak: 'break-word' } : oneLine) }, name),
    artist ? text({ fontFamily: F.body, fontWeight: 700, fontSize: artistSize, color: C.pink, letterSpacing: 3, textAlign: 'center', justifyContent: 'center', maxWidth: '100%', ...oneLine }, truncate(artist, artistMax)) : null,
  );
}

// =====================================================================
// Template 2 — LINE-UP DE FESTIVAL (sempre tipográfico, sem capas)
// =====================================================================
function festival(fmt, mode, d) {
  const story = fmt === 'story';
  const loc = d.locale;
  const U = (s) => upper(s, loc);
  const a = d.topArtists;
  const headSteps = story
    ? [{ max: 11, size: 150 }, { max: 15, size: 120 }, { max: 20, size: 96 }]
    : [{ max: 11, size: 104 }, { max: 15, size: 84 }, { max: 20, size: 68 }];
  const headColors = [C.yellow, C.text, C.text];
  const fits = a.slice(0, 3).map((n, i) => fit(U(n), headSteps.map((st) => ({ ...st, size: i === 0 ? st.size : Math.round(st.size * 0.8) }))));
  if (fits.length === 3) fits[1].size = fits[2].size = Math.min(fits[1].size, fits[2].size);
  const head = fits.map((r, i) =>
    text({ fontFamily: F.condensed, fontWeight: 800, fontSize: r.size, color: headColors[i], lineHeight: 0.92, textAlign: 'center', justifyContent: 'center', width: '100%', ...oneLine }, r.text));
  const sep = '  •  ';
  const tier2 = a.slice(3, 10).map((n) => keep(truncate(U(n), 22))).join(sep);
  const tier3 = a.slice(10, story ? 25 : 20).map((n) => keep(truncate(U(n), 22))).join(sep);

  const lineup = h('div', { flexDirection: 'column', alignItems: 'center', gap: story ? 28 : 16, width: '100%' },
    ...head,
    posterDivider(),
    text({ fontFamily: F.condensed, fontWeight: 800, fontSize: story ? 62 : 44, color: C.text, lineHeight: 1.1, textAlign: 'center', justifyContent: 'center', lineClamp: 3 }, tier2),
    text({ fontFamily: F.body, fontWeight: 600, fontSize: story ? 32 : 24, color: C.muted, lineHeight: 1.45, textAlign: 'center', justifyContent: 'center', letterSpacing: 1, lineClamp: story ? 5 : 3 }, tier3),
  );

  return posterFrame(fmt, mode, d, stageBg, [posterHeader(fmt, mode, d), lineup], d.stats, story ? 64 : 28);
}

// =====================================================================
// Template 3 — TOP MÚSICAS ("o setlist do festival"; sempre tipográfico, sem capas)
// =====================================================================
/** Degraus (§9.9). Nº 1: 1 linha nos degraus, depois até 2 linhas no último tamanho. */
export const TRACK_STEPS = {
  story: {
    head: [{ max: 14, size: 132 }, { max: 18, size: 112 }, { max: 24, size: 92 }, { max: 30, size: 76 }], headTwo: { max: 52, size: 76 },
    sub: [{ max: 18, size: 84 }, { max: 24, size: 68 }, { max: 32, size: 56 }],
  },
  square: {
    head: [{ max: 14, size: 88 }, { max: 18, size: 74 }, { max: 24, size: 60 }, { max: 32, size: 50 }], headTwo: { max: 44, size: 50 },
    sub: [{ max: 20, size: 50 }, { max: 26, size: 42 }, { max: 34, size: 36 }],
  },
};
export const TRACKS_MAX = { story: 10, square: 10 };

function tracksTpl(fmt, mode, d) {
  const story = fmt === 'story';
  const U = (s) => upper(s, d.locale);
  const S = TRACK_STEPS[fmt];
  const list = d.topTracks.slice(0, TRACKS_MAX[fmt]).map((t) => ({ name: U(tidyTrack(t.name)), artist: t.artist ? U(t.artist) : '' }));
  const [first, ...rest] = list;

  const head = first ? fitTrack(first.name, S.head, S.headTwo) : null;
  // nº 2 e nº 3 com o mesmo tamanho (o menor dos dois), como os headliners do Line-up
  const subs = rest.slice(0, 2).map((t) => fit(t.name, S.sub));
  if (subs.length === 2) subs[0].size = subs[1].size = Math.min(subs[0].size, subs[1].size);

  const top = [
    head && trackBlock({ name: head.text, artist: first.artist, size: head.size, lines: head.lines, color: C.yellow, artistSize: story ? 30 : 22, artistMax: 32, gap: story ? 12 : 8 }),
    ...subs.map((r, i) => trackBlock({ name: r.text, artist: rest[i].artist, size: r.size, lines: 1, color: C.text, artistSize: story ? 24 : 18, artistMax: 32, gap: story ? 8 : 4 })),
  ].filter(Boolean);

  // nº 4–10: "setlist" numerado, bloco centralizado com linhas alinhadas à esquerda
  const tail = rest.slice(2);
  const row = (t, i, nameSize, artSize, numW, nameMax, artMax) =>
    h('div', { alignItems: 'baseline', gap: story ? 16 : 12, maxWidth: '100%' },
      text({ fontFamily: F.display, fontWeight: 800, fontSize: Math.round(nameSize * 0.72), color: C.yellow, width: numW, flexShrink: 0 }, String(i + 4)),
      text({ fontFamily: F.condensed, fontWeight: 800, fontSize: nameSize, color: C.text, lineHeight: 1.05, flexShrink: 1, ...oneLine }, keep(truncate(t.name, nameMax))),
      t.artist ? text({ fontFamily: F.body, fontWeight: 600, fontSize: artSize, color: C.muted, flexShrink: 0, ...oneLine }, truncate(t.artist, artMax)) : null,
    );
  let setlist = null;
  if (tail.length && story) {
    setlist = h('div', { flexDirection: 'column', alignItems: 'flex-start', gap: 10, maxWidth: '100%' },
      ...tail.map((t, i) => row(t, i, 46, 24, 52, 30, 20)));
  } else if (tail.length) {
    // 1:1 — duas colunas de até 4 itens (nº 4–7 | nº 8–10), nome em cima e artista embaixo
    const item = (t, i) => h('div', { alignItems: 'baseline', gap: 10, width: '100%' },
      text({ fontFamily: F.display, fontWeight: 800, fontSize: 26, color: C.yellow, width: 38, flexShrink: 0 }, String(i + 4)),
      h('div', { flexDirection: 'column', flexShrink: 1, minWidth: 0 },
        text({ fontFamily: F.condensed, fontWeight: 800, fontSize: 32, color: C.text, lineHeight: 1.05, ...oneLine }, keep(truncate(t.name, 28))),
        t.artist ? text({ fontFamily: F.body, fontWeight: 600, fontSize: 17, color: C.muted, lineHeight: 1.25, ...oneLine }, truncate(t.artist, 30)) : null));
    const colA = tail.slice(0, 4), colB = tail.slice(4, 7);
    setlist = h('div', { width: '100%', gap: 32, alignItems: 'flex-start' },
      h('div', { flexDirection: 'column', gap: 10, width: 452 }, ...colA.map((t, i) => item(t, i))),
      colB.length ? h('div', { flexDirection: 'column', gap: 10, width: 452 }, ...colB.map((t, i) => item(t, i + 4))) : null);
  }

  const body = h('div', { flexDirection: 'column', alignItems: 'center', gap: story ? 26 : 14, width: '100%' },
    stageSign(d.t.tracks, fmt, d),
    ...top,
    setlist ? posterDivider() : null,
    setlist,
  );
  return posterFrame(fmt, mode, d, tracksBg, [posterHeader(fmt, mode, d), body], d.trackStats, story ? 48 : 20);
}

// =====================================================================
// Template 4 — MIX (top 3 artistas + top 3 músicas; sempre tipográfico, sem capas)
// =====================================================================
export const MIX_STEPS = {
  story: {
    artist: [{ max: 11, size: 150 }, { max: 15, size: 120 }, { max: 20, size: 96 }],
    track: [{ max: 14, size: 120 }, { max: 18, size: 100 }, { max: 24, size: 84 }, { max: 30, size: 70 }], trackTwo: { max: 52, size: 70 },
    trackSub: [{ max: 18, size: 76 }, { max: 24, size: 64 }, { max: 32, size: 52 }],
    gap: 30, artistGap: 16, trackGap: 26, artistSize: 30, subArtistSize: 24, topGap: 48,
  },
  square: {
    artist: [{ max: 11, size: 100 }, { max: 15, size: 82 }, { max: 20, size: 64 }],
    track: [{ max: 14, size: 76 }, { max: 18, size: 64 }, { max: 24, size: 54 }, { max: 32, size: 46 }], trackTwo: { max: 44, size: 46 },
    trackSub: [{ max: 18, size: 50 }, { max: 24, size: 42 }, { max: 32, size: 36 }],
    gap: 16, artistGap: 4, trackGap: 10, artistSize: 18, subArtistSize: 16, topGap: 24,
  },
};

/** Mix: duas "placas de palco" empilhadas — TOP ARTISTAS (3 nomes) e TOP MÚSICAS (3 músicas + artista). */
function mixTpl(fmt, mode, d) {
  const story = fmt === 'story';
  const U = (s) => upper(s, d.locale);
  const S = MIX_STEPS[fmt];

  // artistas: nº 1 amarelo, nº 2–3 em 80% do degrau e com o mesmo tamanho (como os headliners do Line-up)
  const aFits = d.topArtists.slice(0, 3).map((n, i) => fit(U(n), S.artist.map((st) => ({ ...st, size: i === 0 ? st.size : Math.round(st.size * 0.8) }))));
  if (aFits.length === 3) aFits[1].size = aFits[2].size = Math.min(aFits[1].size, aFits[2].size);
  const artists = aFits.map((r, i) => text({ fontFamily: F.condensed, fontWeight: 800, fontSize: r.size, color: i === 0 ? C.yellow : C.text, lineHeight: 0.95, textAlign: 'center', justifyContent: 'center', width: '100%', ...oneLine }, r.text));

  const tl = d.topTracks.slice(0, 3).map((t) => ({ name: U(tidyTrack(t.name)), artist: t.artist ? U(t.artist) : '' }));
  const t1 = tl[0] ? fitTrack(tl[0].name, S.track, S.trackTwo) : null;
  const tSubs = tl.slice(1).map((t) => fit(t.name, S.trackSub));
  if (tSubs.length === 2) tSubs[0].size = tSubs[1].size = Math.min(tSubs[0].size, tSubs[1].size);
  const tracks = [
    t1 && trackBlock({ name: t1.text, artist: tl[0].artist, size: t1.size, lines: t1.lines, color: C.yellow, artistSize: S.artistSize, artistMax: 32, gap: story ? 10 : 4 }),
    ...tSubs.map((r, i) => trackBlock({ name: r.text, artist: tl[i + 1].artist, size: r.size, lines: 1, color: C.text, artistSize: S.subArtistSize, artistMax: 32, gap: story ? 6 : 2 })),
  ].filter(Boolean);

  const body = h('div', { flexDirection: 'column', alignItems: 'center', gap: S.gap, width: '100%' },
    stageSign(d.t.artists, fmt, d),
    h('div', { flexDirection: 'column', alignItems: 'center', gap: S.artistGap, width: '100%' }, ...artists),
    tracks.length ? stageSign(d.t.tracks, fmt, d) : null,
    tracks.length ? h('div', { flexDirection: 'column', alignItems: 'center', gap: S.trackGap, width: '100%' }, ...tracks) : null,
  );
  return posterFrame(fmt, mode, d, mixBg, [posterHeader(fmt, mode, d), body], d.mixStats, S.topGap);
}

export function render(template, format, mode, data) {
  if (template === 'festival') return festival(format, mode, data);
  if (template === 'tracks') return tracksTpl(format, mode, data);
  if (template === 'mix') return mixTpl(format, mode, data);
  return basic(format, mode, data);
}

// Fontes que o pipeline registra no satori (arquivos em docs/projeto/design/fonts/ttf → public/fonts)
export const FONT_FILES = [
  { name: F.display, weight: 800, file: 'BricolageGrotesque-ExtraBold.ttf' },
  { name: F.display, weight: 600, file: 'BricolageGrotesque-SemiBold.ttf' },
  { name: F.condensed, weight: 800, file: 'BricolageGrotesqueCondensed-ExtraBold.ttf' },
  { name: F.body, weight: 400, file: 'Inter-Regular.ttf' },
  { name: F.body, weight: 600, file: 'Inter-SemiBold.ttf' },
  { name: F.body, weight: 700, file: 'Inter-Bold.ttf' },
];
