// Encore — gerador dos 3 conceitos de logo (8b.7) e das pranchas de apresentação.
// Protótipo de design, não é código de produção. Todo texto vira path (harfbuzz), então os SVGs
// não dependem de fonte instalada. Rodar da raiz do projeto:
//   node docs/projeto/design/logo/build-logo.mjs
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { render, FONT_FILES } from '../cards/templates.mjs';

const require = createRequire(import.meta.url);
const HERE = fileURLToPath(new URL('.', import.meta.url)).replace(/[\\/]$/, '');
const FONTS = `${HERE}/../../../../public/fonts/ttf`;
const BOARDS = `${HERE}/pranchas`;
await mkdir(BOARDS, { recursive: true });
await initWasm(await readFile(new URL(import.meta.resolve('@resvg/resvg-wasm/index_bg.wasm'))));
const hb = await require('harfbuzzjs');

// ---------- paleta Palco Neon (10-design.md §2) ----------
const P = {
  bg: '#0E0B1A', s1: '#17122A', s2: '#211A3A', s3: '#2B2248', line: '#342A52',
  fg: '#F5F1FF', muted: '#B8AED6', subtle: '#968CB8',
  magenta: '#FF3D8B', yellow: '#FFE14D', orange: '#FF7A1A', cyan: '#3DE0FF',
};

// ---------- texto → path ----------
const fmt = (n) => { const v = Math.round(n * 100) / 100; return Object.is(v, -0) ? '0' : String(v); };
function mapPath(d, fn) {
  return d.replace(/([MLCQZ])([^MLCQZ]*)/g, (_, cmd, args) => {
    if (cmd === 'Z') return 'Z';
    const n = args.trim().split(/[\s,]+/).map(Number);
    const out = [];
    for (let i = 0; i < n.length; i += 2) { const [x, y] = fn(n[i], n[i + 1]); out.push(`${fmt(x)} ${fmt(y)}`); }
    return cmd + out.join(' ');
  });
}
async function loadFont(file) {
  const face = hb.createFace(hb.createBlob(await readFile(`${FONTS}/${file}`)), 0);
  return { font: hb.createFont(face), upem: face.upem };
}
const F = {
  display: await loadFont('BricolageGrotesque-ExtraBold.ttf'),
  cond: await loadFont('BricolageGrotesqueCondensed-ExtraBold.ttf'),
  semi: await loadFont('BricolageGrotesque-SemiBold.ttf'),
  inter: await loadFont('Inter-Regular.ttf'),
  interSemi: await loadFont('Inter-SemiBold.ttf'),
  interBold: await loadFont('Inter-Bold.ttf'),
};
function shape(f, str) {
  const b = hb.createBuffer(); b.addText(str); b.guessSegmentProperties(); hb.shape(f.font, b);
  const g = b.json(); b.destroy(); return g;
}
/** Largura do texto em px. tracking em em. */
function measure(f, str, size, tracking = 0) {
  const g = shape(f, str); const s = size / f.upem;
  return g.reduce((w, x) => w + x.ax * s, 0) + tracking * size * Math.max(0, g.length - 1);
}
/** d do texto com a linha de base em y. anchor: start | middle | end. */
function textD(f, str, { size, x = 0, y = 0, tracking = 0, anchor = 'start' }) {
  const g = shape(f, str); const s = size / f.upem;
  const w = measure(f, str, size, tracking);
  let pen = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  let d = '';
  for (const gl of g) {
    const gx = pen + gl.dx * s, gy = y - gl.dy * s;
    const raw = f.font.glyphToPath(gl.g);
    if (raw) d += mapPath(raw, (px, py) => [gx + px * s, gy - py * s]);
    pen += gl.ax * s + tracking * size;
  }
  return { d, width: w, end: pen - tracking * size };
}
const text = (f, str, o) => `<path fill="${o.fill}" d="${textD(f, str, o).d}"/>`;
function wrap(f, str, size, maxW) {
  const lines = []; let cur = '';
  for (const w of str.split(' ')) {
    const t = cur ? `${cur} ${w}` : w;
    if (measure(f, t, size) > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
const para = (f, str, { size, x, y, lh, maxW, fill }) =>
  wrap(f, str, size, maxW).map((l, i) => text(f, l, { size, x, y: y + i * lh, fill })).join('');

// Métricas da Bricolage ExtraBold (upem 1000): altura-x 528, redondas de -14 a 542, caixa-alta 660.
const XH = 0.528, OV_TOP = 0.542, OV_BOT = 0.014, CAP = 0.66;

// =====================================================================
// SÍMBOLOS (grade de 64 × 64). Cada um recebe origem (x, y) e escala k (px por unidade).
// =====================================================================

/** Conceito 1 — Ingresso: ingresso inclinado, corpo magenta com o "e" em tinta, canhoto amarelo com o losango do lineup. */
const TILT = -8;
function ticket({ x = 0, y = 0, k = 1, eColor = P.bg, tilt = TILT } = {}) {
  const X = (v) => fmt(x + v * k), Y = (v) => fmt(y + v * k), R = (v) => fmt(v * k);
  const top = 14, bot = 50, L = 4, Rt = 60, rx = 6, px = 42, g = 1.1, n = 6;
  const dy = Math.sqrt(n * n - g * g);
  const body = `M${X(L + rx)} ${Y(top)}H${X(px - n)}A${R(n)} ${R(n)} 0 0 0 ${X(px - g)} ${Y(top + dy)}V${Y(bot - dy)}A${R(n)} ${R(n)} 0 0 0 ${X(px - n)} ${Y(bot)}H${X(L + rx)}A${R(rx)} ${R(rx)} 0 0 1 ${X(L)} ${Y(bot - rx)}V${Y(top + rx)}A${R(rx)} ${R(rx)} 0 0 1 ${X(L + rx)} ${Y(top)}Z`;
  const stub = `M${X(px + g)} ${Y(top + dy)}A${R(n)} ${R(n)} 0 0 0 ${X(px + n)} ${Y(top)}H${X(Rt - rx)}A${R(rx)} ${R(rx)} 0 0 1 ${X(Rt)} ${Y(top + rx)}V${Y(bot - rx)}A${R(rx)} ${R(rx)} 0 0 1 ${X(Rt - rx)} ${Y(bot)}H${X(px + n)}A${R(n)} ${R(n)} 0 0 0 ${X(px + g)} ${Y(bot - dy)}Z`;
  // losango do divisor do card Festival, no centro do canhoto
  const dx = (px + g + Rt) / 2, dd = 5;
  const diamond = `M${X(dx)} ${Y(32 - dd)}L${X(dx + dd)} ${Y(32)}L${X(dx)} ${Y(32 + dd)}L${X(dx - dd)} ${Y(32)}Z`;
  // "e" da Bricolage ExtraBold centrado no corpo (altura óptica 25 unidades)
  const size = (25 / (OV_TOP + OV_BOT)) * k;
  const cx = x + ((L + px - g) / 2) * k, cy = y + 32 * k;
  const e = textD(F.display, 'e', { size, x: cx - 0.022 * size - 0.25 * size, y: cy + ((OV_TOP - OV_BOT) / 2) * size });
  return `<g transform="rotate(${tilt} ${X(32)} ${Y(32)})"><path fill="${P.magenta}" d="${body}"/><path fill="${P.yellow}" d="${stub}"/><path fill="${P.bg}" d="${diamond}"/><path fill="${eColor}" d="${e.d}"/></g>`;
}
// caixa do ingresso já inclinado (grade de 64): 56 × 36 girado 8° → 60,5 × 43,4, centrado em 32
const TICKET_BOX = { x0: 1.77, y0: 10.3, x1: 62.23, y1: 53.7 };

/** Conceito 2 — Bis: o "e" que dá a volta e termina numa seta. Traço em degradê magenta → laranja → amarelo.
 *  th: ângulo onde o arco termina (0° = ponta direita da barra, 90° = base).
 *  v1/v2 (sem `dir`): a seta nasce no corte radial do traço; bIn/bOut = meia-largura para dentro/para fora e
 *  len = comprimento da ponta, tudo em traços; phi gira a ponta (+ para fora).
 *  v3+ (com `dir`): o traço sai do arco num gancho curto (`hook`, em traços) que vira para `dir` (graus de tela,
 *  −90 = para cima) e termina numa seta triangular simétrica (meia-largura `head`, comprimento `len`), com a base
 *  perpendicular ao traço, como a perna do G que volta para a barra. A barra fica mais fina (`barW`), sobe um pouco
 *  (`barUp`) e vai reta até a borda de fora, deixando o vão em esquina onde a seta aponta. */
function loopE({ cx, cy, ro, w, th, bIn = 0.8, bOut = 0.8, len = 1.05, phi = 0, arrow = true, dir = null, hook = 0.5, head = 0.9, back = 0.12, barW = 0.68, barUp = 0.32, style = dir === null ? 'v1' : 'v3', turn = 0, id }) {
  const modern = style === 'v3'; // v1/v2: barra grossa com junção redonda; v3: barra fina até a borda
  const rc = ro - w / 2, t = (th * Math.PI) / 180, f = (phi * Math.PI) / 180;
  const Px = cx + rc * Math.cos(t), Py = cy + rc * Math.sin(t);
  const nx = Math.cos(t), ny = Math.sin(t), tgx = Math.sin(t), tgy = -Math.cos(t);
  const grad = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fmt(cx - ro)}" y1="${fmt(cy - ro)}" x2="${fmt(cx + ro)}" y2="${fmt(cy + ro)}"><stop offset="0" stop-color="${P.magenta}"/><stop offset="0.55" stop-color="${P.orange}"/><stop offset="1" stop-color="${P.yellow}"/></linearGradient>`;
  const arcTo = `A${fmt(rc)} ${fmt(rc)} 0 1 0 ${fmt(Px)} ${fmt(Py)}`;
  const rim = w * 0.04; // meia espessura do contorno que arredonda os cantos da seta
  let body, rect, a0, V, hookPts = [];
  if (!modern) {
    // v1/v2: barra com a espessura do traço, emendada no arco com junção redonda
    const tx = tgx * Math.cos(f) + nx * Math.sin(f), ty = tgy * Math.cos(f) + ny * Math.sin(f);
    const A = [Px + nx * w * bOut, Py + ny * w * bOut], T = [Px + tx * w * len, Py + ty * w * len], Bi = [Px - nx * w * bIn, Py - ny * w * bIn];
    body = `<path d="M${fmt(cx - rc)} ${fmt(cy)}H${fmt(cx + rc)}${arcTo}" fill="none" stroke="url(#${id})" stroke-width="${fmt(w)}" stroke-linejoin="round"/>`;
    if (arrow) body += `<path d="M${A.map(fmt).join(' ')}L${T.map(fmt).join(' ')}L${Bi.map(fmt).join(' ')}Z" fill="url(#${id})" stroke="url(#${id})" stroke-width="${fmt(rim * 2)}" stroke-linejoin="round"/>`;
    rect = [cx - rc, cx + rc, cy - w / 2, cy + w / 2]; a0 = 0;
    V = arrow ? [A, T, Bi] : [[Px + (nx * w) / 2, Py + (ny * w) / 2], [Px - (nx * w) / 2, Py - (ny * w) / 2]];
  } else {
    // v3+: barra mais fina, levantada, reta até a borda de fora (o lado direito acompanha o círculo externo)
    const hb = (barW * w) / 2, up = barUp * w, yb = cy - up, xr = Math.sqrt(rc * rc - up * up);
    const yT = yb - hb, yB = yb + hb, xT = cx + Math.sqrt(ro * ro - (yT - cy) ** 2), xB = cx + Math.sqrt(ro * ro - (yB - cy) ** 2);
    const xL = cx - xr;
    a0 = Math.atan2(-up, xr);
    body = `<path d="M${fmt(xL)} ${fmt(yT)}H${fmt(xT)}A${fmt(ro)} ${fmt(ro)} 0 0 1 ${fmt(xB)} ${fmt(yB)}H${fmt(xL)}Z" fill="url(#${id})"/>`;
    rect = [xL, Math.min(xT, xB), yT, yB];
    let d = `M${fmt(cx + xr)} ${fmt(yb)}${arcTo}`;
    if (dir !== null) {
      // dir = 'tan': a seta segue a tangente do próprio arco, sem gancho; `turn` gira a ponta (− = para dentro)
      const dr = dir === 'tan' ? Math.atan2(tgy, tgx) + (turn * Math.PI) / 180 : (dir * Math.PI) / 180, dx = Math.cos(dr), dy = Math.sin(dr);
      const h = dir === 'tan' ? 0 : hook;
      const C = [Px + tgx * h * w, Py + tgy * h * w], E = [C[0] + dx * h * w, C[1] + dy * h * w];
      if (h > 0) d += `Q${fmt(C[0])} ${fmt(C[1])} ${fmt(E[0])} ${fmt(E[1])}`;
      if (h > 0) for (let i = 0; i <= 24; i++) { const u = i / 24; hookPts.push([(1 - u) ** 2 * Px + 2 * u * (1 - u) * C[0] + u * u * E[0], (1 - u) ** 2 * Py + 2 * u * (1 - u) * C[1] + u * u * E[1]]); }
      const mx = -dy, my = dx, Q0 = [E[0] - dx * back * w, E[1] - dy * back * w];
      const A = [Q0[0] + mx * head * w, Q0[1] + my * head * w], T = [Q0[0] + dx * len * w, Q0[1] + dy * len * w], Bi = [Q0[0] - mx * head * w, Q0[1] - my * head * w];
      body += `<path d="${d}" fill="none" stroke="url(#${id})" stroke-width="${fmt(w)}"/>`;
      body += `<path d="M${A.map(fmt).join(' ')}L${T.map(fmt).join(' ')}L${Bi.map(fmt).join(' ')}Z" fill="url(#${id})" stroke="url(#${id})" stroke-width="${fmt(rim * 2)}" stroke-linejoin="round"/>`;
      V = [A, T, Bi];
    } else {
      body += `<path d="${d}" fill="none" stroke="url(#${id})" stroke-width="${fmt(w)}"/>`;
      V = [[Px + (nx * w) / 2, Py + (ny * w) / 2], [Px - (nx * w) / 2, Py - (ny * w) / 2]];
    }
  }
  const hasHead = V.length === 3;
  // respiro: menor distância entre a seta (e o gancho) e a barra + o começo do arco
  const pts = [];
  for (let e = 0; e < V.length; e++) for (let i = 0; i <= 80; i++) { const p = V[e], q = V[(e + 1) % V.length]; pts.push({ p: [p[0] + ((q[0] - p[0]) * i) / 80, p[1] + ((q[1] - p[1]) * i) / 80], r: hasHead ? rim : 0 }); }
  for (const p of hookPts.slice(6)) pts.push({ p, r: w / 2 }); // o começo do gancho encosta no próprio arco
  const segQ = (p, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1]; const k = Math.min(1, Math.max(0, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy))); return [a[0] + k * vx, a[1] + k * vy]; };
  const butt = [[cx + (rc - w / 2) * Math.cos(a0), cy + (rc - w / 2) * Math.sin(a0)], [cx + (rc + w / 2) * Math.cos(a0), cy + (rc + w / 2) * Math.sin(a0)]];
  const nearest = (p) => {
    const out = [[Math.min(Math.max(p[0], rect[0]), rect[1]), Math.min(Math.max(p[1], rect[2]), rect[3])], segQ(p, butt[0], butt[1])];
    const r = Math.hypot(p[0] - cx, p[1] - cy), ph = Math.atan2(p[1] - cy, p[0] - cx);
    let dphi = a0 - ph; while (dphi < 0) dphi += 2 * Math.PI; while (dphi >= 2 * Math.PI) dphi -= 2 * Math.PI;
    if (dphi <= (150 * Math.PI) / 180) { const rr = Math.min(Math.max(r, rc - w / 2), rc + w / 2); out.push([cx + rr * Math.cos(ph), cy + rr * Math.sin(ph)]); }
    if (!modern) { const j = [cx + rc, cy], dj = Math.hypot(p[0] - j[0], p[1] - j[1]); out.push(dj <= w / 2 ? p : [j[0] + ((p[0] - j[0]) * w) / 2 / dj, j[1] + ((p[1] - j[1]) * w) / 2 / dj]); }
    return out;
  };
  let best = { d: Infinity };
  for (const { p, r } of pts) for (const q of nearest(p)) { const L = Math.hypot(p[0] - q[0], p[1] - q[1]); if (L - r < best.d) best = { d: L - r, p, q, r, L }; }
  const L = best.L || 1;
  const gapLine = [best.q, [best.p[0] + ((best.q[0] - best.p[0]) * best.r) / L, best.p[1] + ((best.q[1] - best.p[1]) * best.r) / L]];
  const ext = hasHead ? V : [];
  return {
    defs: grad, gap: best.d, gapLine, body,
    maxX: Math.max(cx + ro, ...ext.map((v) => v[0] + rim)), maxY: Math.max(cy + ro, ...ext.map((v) => v[1] + rim)),
  };
}
// v1 = versão apresentada (seta colada na barra); v2 = ajuste pedido pelo cliente em 2026-09-28
const BIS = {
  v1: {
    lockup: { ro: 0.272, w: 0.15, th: 55, bIn: 0.72, bOut: 0.72, len: 0.95, phi: 0 },
    tile: { ro: 21.5, w: 10.5, th: 56, bIn: 0.8, bOut: 0.8, len: 1.05, phi: 0 },
  },
  v2: {
    // o traço termina antes (76°), a seta é assimétrica (quase nada para dentro), a ponta é mais longa e gira 8° para fora
    lockup: { ro: 0.28, w: 0.135, th: 76, bIn: 0.55, bOut: 0.98, len: 1.2, phi: 8 },
    tile: { ro: 23, w: 10, th: 76, bIn: 0.55, bOut: 0.98, len: 1.2, phi: 8 },
    // favicon de 16 px: sem seta, traço mais fino e contraformas maiores, para o "e" não virar mancha
    small: { ro: 24, w: 9, th: 60, arrow: false },
  },
  // Ajuste 2 (cliente, 2026-09-28): a seta volta a fechar no "e", como a perna do G, com proporção legível.
  // As três usam a barra mais fina e levantada (barW 0,68 · barUp 0,32), reta até a borda de fora, e seta triangular
  // simétrica com a base perpendicular ao traço. `len` foi calculado para o respiro-alvo no lockup (em traços).
  v3: { // 3 · alinhada com a barra: a seta segue o próprio círculo e para rente à ponta da barra (respiro 0,40 traço)
    lockup: { ro: 0.28, w: 0.135, th: 40, dir: 'tan', head: 0.72, len: 0.84 },
    tile: { ro: 23, w: 10, th: 40, dir: 'tan', head: 0.72, len: 0.84 },
  },
  v4: { // 4 · tocando a barra por baixo: o traço desce mais, a ponta gira 18° para dentro e aponta para a barra (0,38 traço)
    lockup: { ro: 0.28, w: 0.135, th: 52, dir: 'tan', turn: -18, head: 0.72, back: 0.25, len: 1.22 },
    tile: { ro: 23, w: 10, th: 52, dir: 'tan', turn: -18, head: 0.72, back: 0.25, len: 1.22 },
  },
  v5: { // 5 · encaixada no vão: traço e barra mais leves, ponta fina que entra na esquina sob a barra (0,30 traço)
    lockup: { ro: 0.28, w: 0.125, barW: 0.6, th: 32, dir: 'tan', head: 0.62, len: 0.83 },
    tile: { ro: 23, w: 9.2, barW: 0.6, th: 32, dir: 'tan', head: 0.62, len: 0.83 },
  },
};
// favicon de 16 px das variações 3 a 5: mesmo desenho de barra, sem seta
for (const v of ['v3', 'v4', 'v5']) BIS[v].small = { ro: 24, w: 9, th: 50, style: 'v3', barW: 0.75, barUp: 0.3, arrow: false };
const REC = 'v3'; // variação recomendada; os SVGs finais do conceito 2 saem dela até o cliente escolher
/** Placa escura (favicon/ícone) com o "e" de bis. */
function bisTile({ x = 0, y = 0, k = 1, id = 'bis', rx = 14, full = false, v = REC, small = false }) {
  const g = small ? BIS[v].small ?? BIS[v].tile : BIS[v].tile;
  const e = loopE({ ...g, cx: x + 32 * k, cy: y + 32 * k, ro: g.ro * k, w: g.w * k, id });
  const tile = `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(64 * k)}" height="${fmt(64 * k)}" rx="${full ? 0 : fmt(rx * k)}" fill="${P.bg}"/>`;
  return { defs: e.defs, body: tile + e.body, e };
}

/** Conceito 3 — Cartaz: "E" em estêncil de três faixas (headliner amarelo, 2ª linha branca, 3ª magenta) sobre o palco. */
function stageBg({ x, y, s, id, rx }) {
  return {
    defs: `<radialGradient id="${id}m" gradientUnits="userSpaceOnUse" cx="${fmt(x + 0.1 * s)}" cy="${fmt(y + 0.04 * s)}" r="${fmt(0.8 * s)}"><stop offset="0" stop-color="${P.magenta}" stop-opacity="0.6"/><stop offset="1" stop-color="${P.magenta}" stop-opacity="0"/></radialGradient>`
      + `<radialGradient id="${id}c" gradientUnits="userSpaceOnUse" cx="${fmt(x + 0.92 * s)}" cy="${fmt(y + 0.08 * s)}" r="${fmt(0.62 * s)}"><stop offset="0" stop-color="${P.cyan}" stop-opacity="0.45"/><stop offset="1" stop-color="${P.cyan}" stop-opacity="0"/></radialGradient>`
      + `<linearGradient id="${id}v" gradientUnits="userSpaceOnUse" x1="0" y1="${fmt(y)}" x2="0" y2="${fmt(y + s)}"><stop offset="0" stop-color="#0E0B1A"/><stop offset="0.6" stop-color="#140E28"/><stop offset="1" stop-color="#3A1045"/></linearGradient>`,
    body: ['v', 'm', 'c'].map((t) => `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(s)}" height="${fmt(s)}" rx="${fmt(rx)}" fill="url(#${id}${t})"/>`).join(''),
  };
}
function stencilE({ x, y, k, colors = [P.yellow, P.fg, P.magenta] }) {
  // caixa do E: 30 × 40 unidades; haste 11, braços 9,5; o estêncil corta a haste em 3 tiers
  const W = 30, H = 40, stem = 11, arm = 9.5, gap = 2.6, arms = [30, 25.5, 30];
  const cut1 = 13.2, cut2 = 26.8; // cortes na haste, dentro das contraformas
  const X = (v) => fmt(x + v * k), Y = (v) => fmt(y + v * k);
  const cy2 = (H - arm) / 2;
  const bands = [
    `M${X(0)} ${Y(0)}H${X(arms[0])}V${Y(arm)}H${X(stem)}V${Y(cut1 - gap / 2)}H${X(0)}Z`,
    `M${X(0)} ${Y(cut1 + gap / 2)}H${X(stem)}V${Y(cy2)}H${X(arms[1])}V${Y(cy2 + arm)}H${X(stem)}V${Y(cut2 - gap / 2)}H${X(0)}Z`,
    `M${X(0)} ${Y(cut2 + gap / 2)}H${X(stem)}V${Y(H - arm)}H${X(arms[2])}V${Y(H)}H${X(0)}Z`,
  ];
  return bands.map((d, i) => `<path fill="${colors[i]}" d="${d}"/>`).join('');
}
function posterTile({ x = 0, y = 0, k = 1, id = 'st', rx = 14, full = false }) {
  const bg = stageBg({ x, y, s: 64 * k, id, rx: full ? 0 : rx * k });
  return { defs: bg.defs, body: bg.body + stencilE({ x: x + 17 * k, y: y + 12 * k, k }) };
}

// =====================================================================
// LOCKUPS (wordmark em corpo F; tudo em coordenadas absolutas)
// =====================================================================
function lockup(concept, F0 = 100, id = `c${concept}`, v = REC) {
  if (concept === 1) {
    const th = 2.0 * XH * F0, k = th / (TICKET_BOX.y1 - TICKET_BOX.y0); // altura do ingresso inclinado = 2 × altura-x
    const B = th / 2 + ((OV_TOP - OV_BOT) / 2) * F0; // centro do ingresso = centro óptico do wordmark
    const x0 = -TICKET_BOX.x0 * k, y0 = -TICKET_BOX.y0 * k;
    const gap = 0.3 * th;
    const wx = (TICKET_BOX.x1 - TICKET_BOX.x0) * k + gap - 0.022 * F0;
    const wm = textD(F.display, 'encore', { size: F0, x: wx, y: B, tracking: -0.02 });
    return { w: wm.end, h: th, defs: '', body: ticket({ x: x0, y: y0, k }) + `<path fill="${P.fg}" d="${wm.d}"/>` };
  }
  if (concept === 2) {
    const g = BIS[v].lockup, ro = g.ro * F0, w = g.w * F0;
    const B = Math.max(OV_TOP * F0, ro + ((OV_TOP - OV_BOT) / 2) * F0); // o topo do "e" nunca sai da caixa
    const wm = textD(F.display, 'encor', { size: F0, x: -0.022 * F0, y: B, tracking: -0.02 });
    const cx = wm.end - 0.02 * F0 + 0.018 * F0 + ro, cy = B - ((OV_TOP - OV_BOT) / 2) * F0;
    const e = loopE({ ...g, cx, cy, ro, w, id });
    return { w: e.maxX + 0.02 * F0, h: Math.max(B + OV_BOT * F0, e.maxY), defs: e.defs, body: `<path fill="${P.magenta}" d="${wm.d}"/>` + e.body, e };
  }
  // concept 3
  const cap = CAP * F0, s = 1.5 * cap, k = s / 64;
  const tile = posterTile({ x: 0, y: 0, k, id });
  const B = s / 2 + cap / 2, gap = 0.26 * s;
  const wm = textD(F.cond, 'ENCORE', { size: F0 * 1.02, x: s + gap - 0.02 * F0, y: B, tracking: 0.01 });
  return { w: wm.end, h: s, defs: tile.defs, body: tile.body + `<path fill="${P.magenta}" d="${wm.d}"/>` };
}
function symbol(concept, px = 64, id = `s${concept}`, full = false, o = {}) {
  const k = px / 64;
  if (concept === 1) {
    if (!full) return { w: px, h: px, defs: '', body: ticket({ k }) };
    const bg = stageBg({ x: 0, y: 0, s: px, id, rx: 0 });
    const kk = k * 0.74, off = (px - 64 * kk) / 2;
    return { w: px, h: px, defs: bg.defs, body: bg.body + ticket({ x: off, y: off, k: kk }) };
  }
  if (concept === 2) return { w: px, h: px, ...bisTile({ k, id, full, ...o }) };
  return { w: px, h: px, ...posterTile({ k, id, full }) };
}
const svgDoc = (o, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(o.w)} ${fmt(o.h)}" width="${fmt(o.w)}" height="${fmt(o.h)}" role="img" aria-label="${title}"><title>${title}</title>${o.defs ? `<defs>${o.defs}</defs>` : ''}${o.body}</svg>\n`;
/** Posiciona um desenho (w, h, defs, body) dentro de outro SVG, com escala. */
const place = (o, x, y, scale = 1) => ({ defs: o.defs, body: `<g transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale)})">${o.body}</g>` });
const png = (svg, width) => new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: 'rgba(0,0,0,0)' }).render().asPng();
const dataUri = (mime, buf) => `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;

// ---------- arquivos vetoriais ----------
const CONCEPTS = [
  {
    n: 1, name: 'Ingresso', header: 22, cardH: 44,
    idea: 'O ingresso do seu próprio festival.',
    why: 'Um ingresso inclinado, como o que a gente segura na fila do show. O corpo magenta leva o "e" da marca e o canhoto destacável é o amarelo do chip de período dos cards, com o losango do divisor do lineup. Cada card compartilhado vira o ingresso de um festival que só você viu. Os entalhes deixam a silhueta reconhecível em 16 px, e o símbolo funciona sem placa, no claro e no escuro.',
  },
  {
    n: 2, name: 'Bis', header: 22, cardH: 30,
    idea: 'O bis vem no fim: a última letra é o próprio bis.',
    why: 'Encore é o bis, o "de novo!" do fim do show. O último "e" do nome vira um traço que dá a volta e termina numa seta que fecha a letra de volta na barra, como a perna do G, em degradê magenta, laranja e amarelo. Versão desta prancha: variação 3 do ajuste 2 (recomendada), com a barra mais fina e respiro claro entre a ponta e a barra. No favicon de 16 px entra uma versão sem seta.',
  },
  {
    n: 3, name: 'Cartaz', header: 22, cardH: 44,
    idea: 'O cartaz do festival inteiro num ícone.',
    why: 'Um "E" em estêncil, como as letras pintadas nos cases de equipamento de turnê, dividido em três faixas que repetem a hierarquia do lineup: headliner em amarelo, segunda linha em branco, terceira em magenta. A placa usa o mesmo fundo de holofotes magenta e ciano do card Festival, e o nome vem em caixa-alta condensada, como o título "ENCORE FEST".',
  },
];
const ONLY = Number(process.argv[2]) || null; // ex.: `node build-logo.mjs 2` gera só o conceito 2
for (const c of CONCEPTS.filter((x) => !ONLY || x.n === ONLY)) {
  const L = lockup(c.n);
  await writeFile(`${HERE}/conceito-${c.n}.svg`, svgDoc(L, `Encore, conceito ${c.n} (${c.name})`));
  await writeFile(`${HERE}/conceito-${c.n}-simbolo.svg`, svgDoc(symbol(c.n, 64), `Encore, símbolo do conceito ${c.n}`));
  await writeFile(`${HERE}/conceito-${c.n}-icone-app.svg`, svgDoc(symbol(c.n, 180, `a${c.n}`, true), `Encore, ícone de app do conceito ${c.n}`));
  if (c.n === 2) await writeFile(`${HERE}/conceito-2-favicon-16.svg`, svgDoc(symbol(2, 64, 's2m', false, { small: true }), 'Encore, favicon de 16 px'));
}
/** Símbolo usado no favicon de 16 px (o conceito 2 tem versão simplificada, sem seta). */
const sym16 = (n, id) => (n === 2 ? symbol(2, 64, id, false, { small: true }) : symbol(n, 64, id));

// ---------- card story com o logo aplicado (substitui o wordmark de texto do rodapé) ----------
const cardFonts = await Promise.all(FONT_FILES.map(async (f) => ({ name: f.name, weight: f.weight, style: 'normal', data: await readFile(`${FONTS}/${f.file}`) })));
const artists = ['Lua Vermelha', 'Os Ventiladores', 'Marina Sal', 'DJ Caju', 'Neon Tropical', 'Banda Farol', 'Clara Nuvem', 'Tiago Maré', 'Coletivo Samambaia', 'Ana Trovão', 'Rádio Pitanga', 'Los Pelicanos', 'Júlia Estrela', 'Quarteto Cometa', 'MC Brisa', 'Vitória Régia', 'Duo Aurora', 'Felipe Lagoa', 'Orquestra de Garagem', 'Selvagem Sutil', 'Nina Bossa', 'Os Carambolas', 'Kiko Veludo', 'Sereia Elétrica', 'Pedro Mangue'];
const cardData = {
  locale: 'pt-BR', siteLabel: 'encore.app', topArtists: artists, topTracks: [],
  t: { presents: 'Encore apresenta', festOf: 'Festival', festDefault: 'Encore Fest', uploadFooter: 'Do seu histórico do Spotify · processado no seu aparelho', demoFooter: '', demoTag: 'DEMO' },
  periodLabel: '2024', stats: ['48.213 min', '9.214 plays', '612 artistas'],
};
function swapWordmark(node, img) {
  if (!node || typeof node !== 'object') return node;
  if (node.props?.children === 'encore' && node.props.style?.fontWeight === 800) return img;
  const ch = node.props?.children;
  if (Array.isArray(ch)) node.props.children = ch.map((x) => swapWordmark(x, img));
  else if (ch && typeof ch === 'object') node.props.children = swapWordmark(ch, img);
  return node;
}
async function cardPng(c, width) {
  const L = lockup(c.n, 100, `k${c.n}`);
  const h = c.cardH, w = (L.w / L.h) * h;
  const img = { type: 'img', props: { src: dataUri('image/svg+xml', svgDoc(L, 'Encore')), width: Math.round(w), height: h } };
  const tree = swapWordmark(render('festival', 'story', 'upload', structuredClone(cardData)), img);
  const svg = await satori(tree, { width: 1080, height: 1920, fonts: cardFonts });
  return png(svg, width);
}

// =====================================================================
// PRANCHAS
// =====================================================================
const label = (s, x, y, fill = P.cyan) => text(F.interBold, s.toLocaleUpperCase('pt-BR'), { size: 12, x, y, fill, tracking: 0.14 });
const panel = (x, y, w, h, fill = P.s1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="${fill}"/>`;
function fit(o, maxW, maxH) { return Math.min(maxW / o.w, maxH / o.h); }

/** Cabeçalho do site em tamanho real (56 px), igual ao 10-design.md §8.18. */
function siteHeader(c, x, y, w, id) {
  const L = lockup(c.n, 100, id);
  const s = c.header / 100; // wordmark no corpo do cabeçalho
  const lw = L.w * s, lh = L.h * s;
  const lx = x + 20, ly = y + (56 - lh) / 2;
  const pl = place(L, lx, ly, s);
  const bx = lx + lw + 14;
  const demo = `<rect x="${fmt(bx)}" y="${y + 18}" width="52" height="20" rx="10" fill="${P.cyan}"/>` + text(F.interBold, 'DEMO', { size: 11, x: bx + 26, y: y + 32, fill: P.bg, anchor: 'middle', tracking: 0.08 });
  const seal = text(F.interSemi, 'Seus dados ficam no seu aparelho', { size: 13, x: x + w - 96, y: y + 33, fill: P.muted, anchor: 'end' });
  const lang = `<rect x="${x + w - 80}" y="${y + 14}" width="60" height="28" rx="8" fill="none" stroke="${P.line}"/>` + text(F.interSemi, 'PT-BR', { size: 12, x: x + w - 50, y: y + 32, fill: P.fg, anchor: 'middle' });
  return {
    defs: pl.defs,
    body: `<rect x="${x}" y="${y}" width="${w}" height="56" fill="${P.bg}"/><rect x="${x}" y="${y + 55}" width="${w}" height="1" fill="${P.line}"/>` + pl.body + demo + seal + lang,
  };
}
/** Aba de navegador com favicon de 16 px. */
function tab(c, x, y, dark, fav16) {
  const bar = dark ? '#1B1530' : '#DEDAE6', tabc = dark ? P.s3 : '#FFFFFF', tc = dark ? P.fg : '#1C1830';
  return `<rect x="${x}" y="${y}" width="300" height="40" rx="10" fill="${bar}"/>`
    + `<path d="M${x + 8} ${y + 40}V${y + 14}Q${x + 8} ${y + 6} ${x + 16} ${y + 6}H${x + 224}Q${x + 232} ${y + 6} ${x + 232} ${y + 14}V${y + 40}Z" fill="${tabc}"/>`
    + `<image href="${fav16}" x="${x + 20}" y="${y + 15}" width="16" height="16"/>`
    + text(F.inter, 'Encore · Seu ano em música', { size: 12, x: x + 44, y: y + 28, fill: tc })
    + text(F.inter, '×', { size: 14, x: x + 214, y: y + 28, fill: dark ? P.subtle : '#6B6580', anchor: 'middle' });
}

async function board(c) {
  const W = 1600, H = 1000;
  const defs = []; let body = '';
  const add = (o) => { if (o.defs) defs.push(o.defs); body += o.body; };
  body += `<rect width="${W}" height="${H}" fill="${P.bg}"/>`;
  body += text(F.display, `Conceito ${c.n} · ${c.name}`, { size: 40, x: 64, y: 88, fill: P.fg, tracking: -0.02 });
  body += text(F.interSemi, c.idea, { size: 20, x: 64, y: 124, fill: '#FF7AB0' });
  body += para(F.inter, c.why, { size: 16, x: 64, y: 152, lh: 22, maxW: 1056, fill: P.muted });
  body += text(F.interSemi, c.n === 2 ? 'Encore · logo escolhida · variação 3 do ajuste 2 (recomendada) · set/2026' : 'Encore · proposta de logo · set/2026', { size: 13, x: W - 64, y: 60, fill: P.subtle, anchor: 'end' });

  // A. lockup
  const top = 232;
  body += panel(64, top, 700, 280) + label('Lockup horizontal', 88, top + 32);
  const L = lockup(c.n, 100, `bl${c.n}`); const sL = fit(L, 540, 120);
  add(place(L, 64 + (700 - L.w * sL) / 2, top + 150 - (L.h * sL) / 2, sL));
  // A2. símbolo
  body += panel(784, top, 336, 280) + label('Só o símbolo', 808, top + 32);
  const S = symbol(c.n, 64, `bs${c.n}`);
  add(place(S, 784 + (336 - 160) / 2, top + 72, 160 / 64));

  // B. cabeçalho real
  const hy = top + 304;
  body += panel(64, hy, 1056, 128) + label('Cabeçalho do site · tamanho real (56 px)', 88, hy + 32);
  add(siteHeader(c, 88, hy + 52, 1008, `bh${c.n}`));

  // C. favicon
  const fy = hy + 152;
  body += panel(64, fy, 700, 252) + label('Favicon · 16 e 32 px, tamanho real', 88, fy + 32);
  const symSvg = svgDoc(symbol(c.n, 64, `f${c.n}`), 'f');
  const fav16 = dataUri('image/png', png(svgDoc(sym16(c.n, `f16${c.n}`), 'f'), 16)), fav32 = dataUri('image/png', png(symSvg, 32));
  body += tab(c, 88, fy + 56, true, fav16) + tab(c, 88, fy + 112, false, fav16);
  body += text(F.inter, 'aba escura e aba clara', { size: 12, x: 88, y: fy + 180, fill: P.subtle });
  body += `<image href="${fav32}" x="440" y="${fy + 72}" width="32" height="32"/>` + text(F.inter, '32 px', { size: 12, x: 456, y: fy + 124, fill: P.subtle, anchor: 'middle' });
  body += `<image href="${fav16}" x="440" y="${fy + 150}" width="16" height="16"/>` + text(F.inter, '16 px', { size: 12, x: 448, y: fy + 186, fill: P.subtle, anchor: 'middle' });
  body += `<rect x="535" y="${fy + 55}" width="130" height="130" rx="6" fill="#FFFFFF" opacity="0.04"/>`;
  body += `<image href="${fav16}" x="540" y="${fy + 60}" width="120" height="120" image-rendering="optimizeSpeed"/>`;
  body += text(F.inter, c.n === 2 ? '16 px (versão sem seta) ampliado 7,5×' : '16 px ampliado 7,5×', { size: 12, x: 600, y: fy + 206, fill: P.subtle, anchor: 'middle' });

  // D. ícone de app
  body += panel(784, fy, 336, 252) + label('Ícone de app · 180 px', 808, fy + 32);
  const icon = svgDoc(symbol(c.n, 180, `i${c.n}`, true), 'i');
  const iconPng = dataUri('image/png', png(icon, 180));
  body += `<clipPath id="ios${c.n}"><rect x="862" y="${fy + 52}" width="180" height="180" rx="40"/></clipPath><image href="${iconPng}" x="862" y="${fy + 52}" width="180" height="180" clip-path="url(#ios${c.n})"/>`;

  // E. card story
  body += panel(1144, top - 24, 392, 736) + label('Aplicado no card (story)', 1168, top + 8);
  const card = dataUri('image/png', await cardPng(c, 344));
  body += `<clipPath id="cc${c.n}"><rect x="1168" y="${top + 28}" width="344" height="611.56" rx="14"/></clipPath><image href="${card}" x="1168" y="${top + 28}" width="344" height="611.56" clip-path="url(#cc${c.n})"/>`;
  body += text(F.inter, 'Rodapé do card Festival com o logo no lugar do texto', { size: 12, x: 1340, y: top + 668, fill: P.subtle, anchor: 'middle' });
  body += text(F.inter, '(prévia a 1/3 do tamanho; o rodapé fica dentro da área segura)', { size: 12, x: 1340, y: top + 686, fill: P.subtle, anchor: 'middle' });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs.join('')}</defs>${body}</svg>`;
  await writeFile(`${BOARDS}/prancha-conceito-${c.n}.png`, png(svg, W));
}

async function comparison() {
  const W = 1600, H = 880;
  const defs = []; let body = `<rect width="${W}" height="${H}" fill="${P.bg}"/>`;
  const add = (o) => { if (o.defs) defs.push(o.defs); body += o.body; };
  body += text(F.display, 'Encore · 3 conceitos de logo', { size: 40, x: 64, y: 88, fill: P.fg, tracking: -0.02 });
  body += text(F.inter, 'Mesma paleta Palco Neon dos cards, três ideias de festival. Escolha uma para seguir; ajustes de cor e proporção vêm depois.', { size: 16, x: 64, y: 122, fill: P.muted });
  const cw = 469;
  for (const [i, c] of CONCEPTS.entries()) {
    const x = 64 + i * (cw + 32), y = 160;
    body += panel(x, y, cw, 656);
    body += text(F.interBold, String(c.n).padStart(2, '0'), { size: 13, x: x + 24, y: y + 38, fill: P.cyan, tracking: 0.14 });
    body += text(F.display, c.name, { size: 28, x: x + 56, y: y + 40, fill: P.fg, tracking: -0.02 });
    const L = lockup(c.n, 100, `cl${c.n}`); const s = fit(L, cw - 96, 84);
    add(place(L, x + (cw - L.w * s) / 2, y + 128 - (L.h * s) / 2, s));
    body += `<rect x="${x + 24}" y="${y + 196}" width="${cw - 48}" height="1" fill="${P.line}"/>`;
    const icon = dataUri('image/png', png(svgDoc(symbol(c.n, 180, `ci${c.n}`, true), 'i'), 180));
    body += `<clipPath id="ci${c.n}"><rect x="${x + 32}" y="${y + 224}" width="180" height="180" rx="40"/></clipPath><image href="${icon}" x="${x + 32}" y="${y + 224}" width="180" height="180" clip-path="url(#ci${c.n})"/>`;
    body += text(F.inter, 'app · 180 px', { size: 12, x: x + 122, y: y + 426, fill: P.subtle, anchor: 'middle' });
    const sym = svgDoc(symbol(c.n, 64, `cf${c.n}`), 'f');
    const f32 = dataUri('image/png', png(sym, 32)), f16 = dataUri('image/png', png(svgDoc(sym16(c.n, `cf16${c.n}`), 'f'), 16));
    body += `<image href="${f32}" x="${x + 262}" y="${y + 262}" width="32" height="32"/>` + text(F.inter, '32', { size: 12, x: x + 278, y: y + 318, fill: P.subtle, anchor: 'middle' });
    body += `<image href="${f16}" x="${x + 330}" y="${y + 270}" width="16" height="16"/>` + text(F.inter, '16', { size: 12, x: x + 338, y: y + 318, fill: P.subtle, anchor: 'middle' });
    body += `<rect x="${x + 372}" y="${y + 262}" width="32" height="32" rx="6" fill="#F5F1FF"/><image href="${f16}" x="${x + 380}" y="${y + 270}" width="16" height="16"/>` + text(F.inter, 'claro', { size: 12, x: x + 388, y: y + 318, fill: P.subtle, anchor: 'middle' });
    body += text(F.interSemi, c.idea, { size: 15, x: x + 24, y: y + 470, fill: '#FF7AB0' });
    body += para(F.inter, c.why, { size: 14, x: x + 24, y: y + 498, lh: 20, maxW: cw - 48, fill: P.muted });
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs.join('')}</defs>${body}</svg>`;
  await writeFile(`${BOARDS}/prancha-comparativa.png`, png(svg, W));
}

/** Antes/depois do ajuste da seta do conceito 2 (pedido do cliente em 2026-09-28). */
async function adjustBoard() {
  const W = 1600, H = 1050;
  const defs = []; let body = `<rect width="${W}" height="${H}" fill="${P.bg}"/>`;
  const add = (o) => { if (o.defs) defs.push(o.defs); body += o.body; };
  body += text(F.display, 'Conceito 2 · Bis · ajuste da seta', { size: 40, x: 64, y: 88, fill: P.fg, tracking: -0.02 });
  body += text(F.inter, 'A ponta da seta estava colada na barra do "e". Agora o traço termina antes, a seta fica mais longa e quase não avança para dentro da letra.', { size: 16, x: 64, y: 122, fill: P.muted });
  body += text(F.interSemi, 'Encore · logo escolhida · set/2026', { size: 13, x: W - 64, y: 60, fill: P.subtle, anchor: 'end' });
  const px = (v) => (v <= 0.05 ? 'encostada' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} px`);
  for (const [i, v] of ['v1', 'v2'].entries()) {
    const x0 = 64 + i * 752, top = 160, cw = 720;
    body += panel(x0, top, cw, 850);
    body += text(F.interBold, i ? 'DEPOIS' : 'ANTES', { size: 13, x: x0 + 24, y: top + 36, fill: i ? P.cyan : P.subtle, tracking: 0.14 });
    body += text(F.interSemi, i ? 'seta com respiro visível' : 'seta colada na barra do "e"', { size: 15, x: x0 + 100, y: top + 36, fill: i ? P.fg : P.muted });
    // A. ícone inteiro + seta ampliada, com a medida do respiro
    const ky = top + 60;
    const tile = bisTile({ k: 300 / 64, id: `aj${v}`, v });
    add(place({ defs: tile.defs, body: tile.body }, x0 + 24, ky));
    const zk = 300 / 34, zx = x0 + 348, zy = ky; // recorte da grade (26..60) × (26..60)
    const zt = bisTile({ k: zk, id: `az${v}`, v, x: zx - 26 * zk, y: zy - 26 * zk });
    body += `<clipPath id="zc${v}"><rect x="${zx}" y="${zy}" width="348" height="300" rx="16"/></clipPath>`;
    defs.push(zt.defs);
    body += `<g clip-path="url(#zc${v})"><rect x="${zx}" y="${zy}" width="348" height="300" fill="${P.bg}"/>${zt.body}`;
    const [g0, g1] = zt.e.gapLine;
    if (zt.e.gap > 0.5) body += `<path d="M${fmt(g0[0])} ${fmt(g0[1])}L${fmt(g1[0])} ${fmt(g1[1])}" stroke="${P.cyan}" stroke-width="3" stroke-linecap="round"/><circle cx="${fmt(g0[0])}" cy="${fmt(g0[1])}" r="5" fill="${P.cyan}"/><circle cx="${fmt(g1[0])}" cy="${fmt(g1[1])}" r="5" fill="${P.cyan}"/>`;
    else body += `<circle cx="${fmt(g0[0])}" cy="${fmt(g0[1])}" r="22" fill="none" stroke="${P.cyan}" stroke-width="3" stroke-dasharray="6 6"/>`;
    body += `</g><rect x="${zx}" y="${zy}" width="348" height="300" rx="16" fill="none" stroke="${P.line}"/>`;
    const g180 = (bisTile({ k: 180 / 64, id: 'm', v }).e.gap);
    body += text(F.inter, `ícone · respiro no ícone de 180 px: ${px(g180)}`, { size: 13, x: x0 + 24, y: ky + 326, fill: P.muted });
    body += text(F.inter, 'seta ampliada', { size: 13, x: zx + 174, y: ky + 326, fill: P.subtle, anchor: 'middle' });
    // B. cabeçalho a 22 px, real e ampliado
    const by = ky + 360;
    const L = lockup(2, 100, `al${v}`, v), s = 0.22;
    const hw = Math.ceil(L.w * s) + 16, hh = 36;
    const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${hw}" height="${hh}" viewBox="0 0 ${hw} ${hh}"><defs>${L.defs}</defs><rect width="${hw}" height="${hh}" fill="${P.bg}"/><g transform="translate(8 ${fmt((hh - L.h * s) / 2)}) scale(${s})">${L.body}</g></svg>`;
    const hp = dataUri('image/png', png(head, hw));
    body += `<image href="${hp}" x="${x0 + 24}" y="${by}" width="${hw}" height="${hh}"/>`;
    body += `<image href="${hp}" x="${x0 + 150}" y="${by}" width="${hw * 5}" height="${hh * 5}" image-rendering="optimizeSpeed"/>`;
    body += text(F.inter, 'cabeçalho, 22 px', { size: 13, x: x0 + 24, y: by + 56, fill: P.muted });
    body += text(F.inter, `respiro: ${px(L.e.gap * s)}`, { size: 13, x: x0 + 24, y: by + 76, fill: P.muted });
    body += text(F.inter, 'ampliado 5×', { size: 13, x: x0 + 150 + (hw * 5) / 2, y: by + hh * 5 + 20, fill: P.subtle, anchor: 'middle' });
    // C. favicon 32 e 16
    const fy = by + 220;
    const s32 = dataUri('image/png', png(svgDoc(symbol(2, 64, `f32${v}`, false, { v }), 'f'), 32));
    const s16 = dataUri('image/png', png(svgDoc(v === 'v1' ? symbol(2, 64, `f16${v}`, false, { v }) : symbol(2, 64, 'f16s', false, { v: 'v2', small: true }), 'f'), 16));
    const g32 = bisTile({ k: 0.5, id: 'm', v }).e.gap;
    body += `<image href="${s32}" x="${x0 + 24}" y="${fy}" width="32" height="32"/><image href="${s32}" x="${x0 + 72}" y="${fy}" width="160" height="160" image-rendering="optimizeSpeed"/>`;
    body += text(F.inter, `32 px · respiro: ${px(g32)}`, { size: 13, x: x0 + 24, y: fy + 184, fill: P.muted });
    body += `<image href="${s16}" x="${x0 + 290}" y="${fy}" width="16" height="16"/><image href="${s16}" x="${x0 + 322}" y="${fy}" width="160" height="160" image-rendering="optimizeSpeed"/>`;
    body += text(F.inter, i ? '16 px · versão sem seta, "e" limpo' : '16 px · mesma seta, vira mancha', { size: 13, x: x0 + 290, y: fy + 184, fill: P.muted });
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs.join('')}</defs>${body}</svg>`;
  await writeFile(`${BOARDS}/conceito-2-ajuste.png`, png(svg, W));
}

/** Ajuste 2 do conceito 2: original, ajuste 1 e as variações novas lado a lado (pedido do cliente em 2026-09-28). */
async function adjustBoard2() {
  const W = 1600, H = 1150;
  const defs = []; let body = `<rect width="${W}" height="${H}" fill="${P.bg}"/>`;
  const add = (o) => { if (o.defs) defs.push(o.defs); body += o.body; };
  body += text(F.display, 'Conceito 2 · Bis · ajuste 2: a seta fecha no "e"', { size: 40, x: 64, y: 88, fill: P.fg, tracking: -0.02 });
  body += text(F.inter, 'Como a perna do G, o traço volta para a barra. As variações 3 a 5 mudam o ponto de encontro, a espessura da ponta e o tamanho do respiro. Escolha pelo número.', { size: 16, x: 64, y: 122, fill: P.muted });
  body += text(F.interSemi, 'Encore · logo escolhida · set/2026', { size: 13, x: W - 64, y: 60, fill: P.subtle, anchor: 'end' });
  const px = (v) => (v <= 0.6 ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} px (encosta)` : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} px`);
  const cols = [
    { v: 'v1', n: 1, name: 'Original', note: 'seta grossa, encavalada na barra' },
    { v: 'v2', n: 2, name: 'Ajuste 1', note: 'ponta solta embaixo (não aprovado)' },
    { v: 'v3', n: 3, name: 'Alinhada com a barra', note: 'segue o círculo e para rente à barra' },
    { v: 'v4', n: 4, name: 'Tocando por baixo', note: 'gira para dentro e aponta para a barra' },
    { v: 'v5', n: 5, name: 'Encaixada no vão', note: 'traço leve, ponta fina na esquina' },
  ];
  const cw = 276, gapc = 23;
  for (const [i, c] of cols.entries()) {
    const x0 = 64 + i * (cw + gapc), top = 156, rec = c.v === REC, old = c.n <= 2;
    body += panel(x0, top, cw, 956);
    if (rec) body += `<rect x="${x0}" y="${top}" width="${cw}" height="956" rx="20" fill="none" stroke="${P.yellow}" stroke-width="2"/>`;
    body += text(F.display, String(c.n), { size: 34, x: x0 + 20, y: top + 50, fill: old ? P.subtle : P.fg });
    body += text(F.interSemi, c.name, { size: 15, x: x0 + 52, y: top + 34, fill: old ? P.muted : P.fg });
    body += text(F.inter, c.note, { size: 12, x: x0 + 52, y: top + 52, fill: P.subtle });
    if (rec) body += `<rect x="${x0 + cw - 118}" y="${top - 12}" width="106" height="24" rx="12" fill="${P.yellow}"/>` + text(F.interBold, 'RECOMENDADA', { size: 11, x: x0 + cw - 65, y: top + 4, fill: P.bg, anchor: 'middle', tracking: 0.08 });
    // A. ícone de 180 px
    const iy = top + 76;
    body += label('Ícone · 180 px', x0 + 20, iy);
    const icon = dataUri('image/png', png(svgDoc(symbol(2, 180, `a2${c.v}`, true, { v: c.v }), 'i'), 180));
    body += `<clipPath id="ai${c.v}"><rect x="${x0 + 48}" y="${iy + 14}" width="180" height="180" rx="40"/></clipPath><image href="${icon}" x="${x0 + 48}" y="${iy + 14}" width="180" height="180" clip-path="url(#ai${c.v})"/>`;
    // B. seta ampliada (recorte vetorial da grade 26..60 × 22..56), com a medida do respiro
    const zy = iy + 222, zs = 236, zk = zs / 34, zx = x0 + 20;
    body += label('Seta ampliada', x0 + 20, zy);
    const zt = bisTile({ k: zk, id: `z2${c.v}`, v: c.v, x: zx - 26 * zk, y: zy + 14 - 22 * zk });
    defs.push(zt.defs);
    body += `<clipPath id="zc2${c.v}"><rect x="${zx}" y="${zy + 14}" width="${zs}" height="${zs}" rx="14"/></clipPath><g clip-path="url(#zc2${c.v})"><rect x="${zx}" y="${zy + 14}" width="${zs}" height="${zs}" fill="${P.bg}"/>${zt.body}`;
    const [g0, g1] = zt.e.gapLine;
    if (zt.e.gap > 0.6 * zk) body += `<path d="M${fmt(g0[0])} ${fmt(g0[1])}L${fmt(g1[0])} ${fmt(g1[1])}" stroke="${P.cyan}" stroke-width="2.5" stroke-linecap="round"/><circle cx="${fmt(g0[0])}" cy="${fmt(g0[1])}" r="4" fill="${P.cyan}"/><circle cx="${fmt(g1[0])}" cy="${fmt(g1[1])}" r="4" fill="${P.cyan}"/>`;
    else body += `<circle cx="${fmt((g0[0] + g1[0]) / 2)}" cy="${fmt((g0[1] + g1[1]) / 2)}" r="18" fill="none" stroke="${P.cyan}" stroke-width="2.5" stroke-dasharray="5 5"/>`;
    body += `</g><rect x="${zx}" y="${zy + 14}" width="${zs}" height="${zs}" rx="14" fill="none" stroke="${P.line}"/>`;
    // C. cabeçalho a 22 px, real e ampliado 3×
    const hy = zy + 280;
    body += label('Cabeçalho · 22 px', x0 + 20, hy);
    const L = lockup(2, 100, `h2${c.v}`, c.v), s = 0.22, hw = Math.ceil(L.w * s) + 12, hh = 28;
    const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${hw}" height="${hh}" viewBox="0 0 ${hw} ${hh}"><defs>${L.defs}</defs><rect width="${hw}" height="${hh}" fill="${P.bg}"/><g transform="translate(6 ${fmt((hh - L.h * s) / 2)}) scale(${s})">${L.body}</g></svg>`;
    const hp = dataUri('image/png', png(head, hw));
    body += `<image href="${hp}" x="${x0 + 20}" y="${hy + 14}" width="${hw}" height="${hh}"/>`;
    body += `<image href="${hp}" x="${x0 + 20}" y="${hy + 52}" width="${hw * 3}" height="${hh * 3}" image-rendering="optimizeSpeed"/>`;
    // D. favicon 32 e 16 (real) + 16 ampliado
    const fy = hy + 160;
    body += label('Favicon · 32 e 16 px', x0 + 20, fy);
    const s32 = dataUri('image/png', png(svgDoc(symbol(2, 64, `f32${c.v}`, false, { v: c.v }), 'f'), 32));
    const s16 = dataUri('image/png', png(svgDoc(symbol(2, 64, `f16${c.v}`, false, { v: c.v, small: c.v !== 'v1' }), 'f'), 16));
    body += `<image href="${s32}" x="${x0 + 20}" y="${fy + 16}" width="32" height="32"/><image href="${s16}" x="${x0 + 64}" y="${fy + 24}" width="16" height="16"/>`;
    body += `<image href="${s32}" x="${x0 + 96}" y="${fy + 16}" width="72" height="72" image-rendering="optimizeSpeed"/><image href="${s16}" x="${x0 + 180}" y="${fy + 16}" width="72" height="72" image-rendering="optimizeSpeed"/>`;
    body += text(F.inter, '32 real · 16 real · 32 ×2,25 · 16 ×4,5', { size: 11, x: x0 + 20, y: fy + 106, fill: P.subtle });
    // E. respiros medidos
    const ry = fy + 132;
    const g22 = L.e.gap * s, g32 = bisTile({ k: 0.5, id: 'm', v: c.v }).e.gap, g180 = bisTile({ k: 180 / 64, id: 'm', v: c.v }).e.gap;
    body += label('Respiro seta ↔ barra', x0 + 20, ry);
    [['22 px', g22], ['32 px', g32], ['180 px', g180]].forEach(([k, g], j) => {
      body += text(F.inter, k, { size: 13, x: x0 + 20, y: ry + 24 + j * 20, fill: P.muted }) + text(F.interSemi, px(g), { size: 13, x: x0 + cw - 20, y: ry + 24 + j * 20, fill: g <= 0.6 ? '#FF8A8E' : P.fg, anchor: 'end' });
    });
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs.join('')}</defs>${body}</svg>`;
  await writeFile(`${BOARDS}/conceito-2-ajuste-2.png`, png(svg, W));
}

for (const c of CONCEPTS.filter((x) => !ONLY || x.n === ONLY)) await board(c);
if (!ONLY) await comparison();
// a prancha do ajuste 1 (conceito-2-ajuste.png) fica como registro; regerar só com `node build-logo.mjs ajuste1`
if (process.argv[2] === 'ajuste1') await adjustBoard();
if (!ONLY || ONLY === 2) await adjustBoard2();
console.log('ok: SVGs em', HERE, '· pranchas em', BOARDS);
