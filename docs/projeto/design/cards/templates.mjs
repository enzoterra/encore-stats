// Encore — protótipo de referência dos templates de card para satori 0.33 (S3.3).
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
        ? { type: 'img', props: { src: d.spotifyLogo, width: 210, height: 63 } }
        : h('div', { width: 210, height: 63, border: `2px dashed ${C.muted}`, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
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
// Template 2 — LINE-UP DE FESTIVAL (sempre tipográfico, sem capas)
// =====================================================================
function festival(fmt, mode, d) {
  const story = fmt === 'story';
  const f = FORMATS[fmt];
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

  // Título em linha única: "FESTIVAL <NOME>" (nome opcional digitado no modal, ≤ 20 grafemas, nunca sai do aparelho)
  const title = fit(d.posterName ? `${U(d.t.festOf)} ${U(d.posterName.trim())}` : U(d.t.festDefault),
    story ? [{ max: 18, size: 104 }, { max: 24, size: 84 }, { max: 30, size: 68 }] : [{ max: 18, size: 72 }, { max: 24, size: 60 }, { max: 30, size: 50 }]);

  const divider = h('div', { width: '100%', alignItems: 'center', gap: 20 },
    h('div', { flexGrow: 1, height: 3, background: C.magenta }),
    h('div', { width: 14, height: 14, background: C.yellow, transform: 'rotate(45deg)' }),
    h('div', { flexGrow: 1, height: 3, background: C.magenta }),
  );

  const header = h('div', { flexDirection: 'column', alignItems: 'center', gap: story ? 14 : 8, width: '100%' },
    h('div', { gap: 12, alignItems: 'center' },
      text({ fontFamily: F.body, fontWeight: 700, fontSize: story ? 28 : 22, color: C.cyan, letterSpacing: 8 }, U(d.t.presents)),
      mode === 'demo' ? demoTag(d) : null),
    text({ fontFamily: F.condensed, fontWeight: 800, fontSize: title.size, color: C.magenta, lineHeight: 0.95, textAlign: 'center', ...oneLine }, title.text),
    text({ fontFamily: F.body, fontWeight: 700, fontSize: story ? 30 : 24, color: C.ink, background: C.yellow, padding: story ? '10px 28px' : '6px 20px', borderRadius: 999, letterSpacing: 3 }, U(d.periodLabel)),
  );

  const lineup = h('div', { flexDirection: 'column', alignItems: 'center', gap: story ? 28 : 16, width: '100%' },
    ...head,
    divider,
    text({ fontFamily: F.condensed, fontWeight: 800, fontSize: story ? 62 : 44, color: C.text, lineHeight: 1.1, textAlign: 'center', justifyContent: 'center', lineClamp: 3 }, tier2),
    text({ fontFamily: F.body, fontWeight: 600, fontSize: story ? 32 : 24, color: C.muted, lineHeight: 1.45, textAlign: 'center', justifyContent: 'center', letterSpacing: 1, lineClamp: story ? 5 : 3 }, tier3),
  );

  const stats = d.stats?.length
    ? text({ fontFamily: F.body, fontWeight: 700, fontSize: story ? 28 : 22, color: C.orange, letterSpacing: 3, textAlign: 'center', justifyContent: 'center', width: '100%' }, U(d.stats.join('  ·  ')))
    : null;

  return h('div', { width: f.width, height: f.height, flexDirection: 'column', backgroundImage: stageBg, backgroundColor: C.bg, padding: `${f.padTop}px ${f.padX}px ${f.padBottom}px`, justifyContent: 'space-between', alignItems: 'center', gap: 32 },
    h('div', { flexDirection: 'column', alignItems: 'center', gap: story ? 64 : 28, width: '100%' }, header, lineup),
    h('div', { flexDirection: 'column', gap: story ? 40 : 20, width: '100%' }, stats, footer(mode, d, !story)),
  );
}

export function render(template, format, mode, data) {
  return template === 'festival' ? festival(format, mode, data) : basic(format, mode, data);
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
