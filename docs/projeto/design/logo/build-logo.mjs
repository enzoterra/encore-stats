// Encore — gerador dos 3 conceitos de logo (8b.7), dos ajustes do conceito 2 (8b.8, 8c.1) e das pranchas.
// Protótipo de design, não é código de produção. Todo texto vira path (harfbuzz), então os SVGs
// não dependem de fonte instalada. Rodar da raiz do projeto:
//   node docs/projeto/design/logo/build-logo.mjs            (tudo)
//   node docs/projeto/design/logo/build-logo.mjs 2          (só o conceito 2 e a prancha do ajuste 3)
//   node docs/projeto/design/logo/build-logo.mjs 2 --giro=-16   (outro ângulo para o "e"; o padrão está em GIRO)
//   node docs/projeto/design/logo/build-logo.mjs medir      (só imprime as medidas do "e")
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
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
    V: ext, rim, cx, cy, ro,
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
// =====================================================================
// AJUSTE 3 (8c.1, cliente em 2026-09-28): o "e" com seta gira para a esquerda e é redesenhado com as
// proporções da Bricolage ExtraBold. Tudo em unidades de corpo (F0 = 1), medido antes do giro.
//  - caixa: elipse 51,2 × 55,6 (o "o" da fonte tem 52,3 × 55,6; o círculo de 56 × 56 ficava 7% mais largo)
//  - traço com contraste, como a fonte: 16,0 nas laterais e 12,6 em cima e embaixo (Bricolage 800: laterais
//    16,1, horizontais 12,7 / 12,1); o traço monolinear de 13,5 deixava as laterais leves e o topo pesado
//  - barra 8,8 (a do "e" da fonte tem 8,9), 2,2 acima do centro: o olho do "e" volta a ter 8,6 de altura (era 5,6)
//  - seta: meia-largura 0,80 traço e comprimento 1,22 traço (ângulo da ponta 67°, era 81°), mirando a quina de
//    baixo da barra (`aim`); a base é o próprio corte do traço, num path único, então não há emenda nem degrau;
//    a ponta tem cantos com raio de 0,05 traço
//  - o fim do traço é calculado para o respiro-alvo entre a ponta e a barra (em traços verticais)
//  Medidas completas: `node build-logo.mjs medir` e LOGO.md, "Ajuste 3".
// =====================================================================
const E3 = {
  rxO: 0.256, ryO: 0.278, side: 0.16, vert: 0.126,
  barW: 0.088, barUp: 0.022,
  head: 0.8, len: 1.22, tipR: 0.05, gapT: 0.45, aim: true,
  arrow: true,
};
// favicon de 16 px: sem seta, traço mais leve e contraformas maiores (o "e" não pode virar mancha em 16 px)
const E3_SMALL = { ...E3, side: 0.13, vert: 0.108, barW: 0.082, barUp: 0.012, arrow: false, end: 52 };
/** Ângulo de giro do "e" (graus; negativo = anti-horário). Trocar aqui ou com `--giro=-16` na linha de comando. */
const GIRO_ARG = process.argv.find((a) => a.startsWith('--giro='));
const GIRO = GIRO_ARG ? Number(GIRO_ARG.slice(7)) : -12; // vale para o ajuste 4 (SVGs finais)
const GIROS = [-8, -12, -16]; // ângulos das pranchas dos ajustes 3 e 4
/** O favicon de 16 px (sem seta) gira junto? Decisão do ajuste 3: sim (ver LOGO.md). */
const GIRA_16 = true;

const rotP = (p, deg) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]], sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]], mul2 = (a, k) => [a[0] * k, a[1] * k];
const len2 = (a) => Math.hypot(a[0], a[1]), nrm2 = (a) => mul2(a, 1 / len2(a)), dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];
/** Raiz da reta M + sN com a elipse (a, b) centrada na origem: a positiva (outer) ou a negativa mais perto de 0 (inner). */
function lineEllipse(M, N, a, b, sign) {
  const A = (N[0] ** 2) / a ** 2 + (N[1] ** 2) / b ** 2, B = 2 * ((M[0] * N[0]) / a ** 2 + (M[1] * N[1]) / b ** 2), C = (M[0] ** 2) / a ** 2 + (M[1] ** 2) / b ** 2 - 1;
  const D = Math.sqrt(Math.max(0, B * B - 4 * A * C)), r1 = (-B + D) / (2 * A), r2 = (-B - D) / (2 * A);
  return sign > 0 ? Math.max(r1, r2) : Math.max(...[r1, r2].filter((r) => r < 0));
}
/** Geometria do "e" do ajuste 3 em coordenadas locais (centro da elipse na origem, unidade u, sem giro). */
function e3Local(p, u, rot = 0) {
  const ax = p.rxO * u, bx = (p.rxO - p.side) * u;
  // compensa o giro: a altura da elipse girada continua 55,6 (a mesma dos redondos da fonte)
  const a0 = (rot * Math.PI) / 180, H = p.ryO * u;
  const ay = Math.sqrt(Math.max(H * H, (H * H - ax * ax * Math.sin(a0) ** 2) / Math.cos(a0) ** 2)), by = ay - p.vert * u;
  const yb = -p.barUp * u, hb = (p.barW * u) / 2, yT = yb - hb, yB = yb + hb;
  const xO = (y) => ax * Math.sqrt(1 - (y / ay) ** 2), xI = (y) => bx * Math.sqrt(1 - Math.min(1, (y / by) ** 2));
  const xL = -(xO(yb) + xI(yb)) / 2; // a barra começa no meio do traço da esquerda (fica escondida nele)
  const S0 = [xO(yb), yb], S1 = [xI(yb), yb]; // começo do traço: corte horizontal, dentro da barra
  const mx = (ax + bx) / 2, my = (ay + by) / 2, corner = [xO(yB), yB];
  const cut = (endDeg) => {
    const f = (endDeg * Math.PI) / 180;
    const M = [mx * Math.cos(f), my * Math.sin(f)];
    const Tt = nrm2([mx * Math.sin(f), -my * Math.cos(f)]); // sentido do traço (φ decrescendo = anti-horário na tela)
    // a seta mira a ponta de baixo da barra (fecha o "e" como a perna do G); a base é perpendicular à mira
    let T = Tt, Bc = M, Co, Ci, N;
    for (let i = 0; i < 4; i++) {
      if (p.aim) T = nrm2(sub2(corner, Bc));
      N = [T[1], -T[0]]; if (dot2(N, M) < 0) N = mul2(N, -1);
      Co = add2(M, mul2(N, lineEllipse(M, N, ax, ay, 1))); Ci = add2(M, mul2(N, lineEllipse(M, N, bx, by, -1)));
      Bc = mul2(add2(Co, Ci), 0.5);
    }
    const t = len2(sub2(Co, Ci));
    const hw = p.head * t, tip = add2(Bc, mul2(T, p.len * t));
    const turn = (Math.atan2(T[1], T[0]) - Math.atan2(Tt[1], Tt[0])) * 180 / Math.PI;
    return { M, T, N, Co, Ci, t, Bc, bo: add2(Bc, mul2(N, hw)), bi: sub2(Bc, mul2(N, hw)), tip, turn };
  };
  // contorno da barra e do ombro (começo do traço até o topo), para medir o respiro
  const barPoly = [];
  for (let i = 0; i <= 40; i++) barPoly.push([xL + ((xO(yT) - xL) * i) / 40, yT]);
  for (let i = 0; i <= 20; i++) { const y = yT + ((yB - yT) * i) / 20; barPoly.push([xO(y), y]); }
  for (let i = 0; i <= 40; i++) barPoly.push([xO(yB) - ((xO(yB) - xL) * i) / 40, yB]);
  for (let i = 0; i <= 60; i++) { const f = Math.asin(yb / ay) - ((Math.PI / 2) * i) / 60; barPoly.push([ax * Math.cos(f), ay * Math.sin(f)]); }
  const tri = (c) => {
    const pts = [];
    for (const [P0, P1] of [[c.bo, c.tip], [c.tip, c.bi], [c.bi, c.Ci], [c.Co, c.bo]]) for (let i = 0; i <= 40; i++) pts.push(add2(P0, mul2(sub2(P1, P0), i / 40)));
    return pts;
  };
  const gapOf = (c) => {
    let best = { d: Infinity };
    for (const a of tri(c)) for (const b of barPoly) { const d = len2(sub2(a, b)); if (d < best.d) best = { d, a, b }; }
    return best;
  };
  // fim do traço: busca o ângulo que dá o respiro-alvo (em traços verticais)
  let end = p.end;
  if (p.arrow && end == null) {
    const target = p.gapT * p.vert * u;
    let lo = 10, hi = 80;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (gapOf(cut(m)).d < target) lo = m; else hi = m; }
    end = (lo + hi) / 2;
  }
  const c = cut(end);
  const g = p.arrow ? gapOf(c) : { d: NaN };
  const inShape = (q) => {
    if (q[1] >= yT && q[1] <= yB && q[0] >= xL && (q[0] / ax) ** 2 + (q[1] / ay) ** 2 <= 1) return true;
    const inO = (q[0] / ax) ** 2 + (q[1] / ay) ** 2 <= 1, inI = (q[0] / bx) ** 2 + (q[1] / by) ** 2 < 1;
    if (inO && !inI && !(q[0] > 0 && q[1] > yb && dot2(sub2(q, c.Bc), c.T) > 0)) return true;
    if (!p.arrow) return false;
    const s = (P0, P1) => (P1[0] - P0[0]) * (q[1] - P0[1]) - (P1[1] - P0[1]) * (q[0] - P0[0]);
    const d1 = s(c.bo, c.tip), d2 = s(c.tip, c.bi), d3 = s(c.bi, c.bo);
    return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
  };
  return { ax, ay, bx, by, yb, yT, yB, xO, xI, xL, S0, S1, c, end, gap: g.d, gapPts: [g.a, g.b], inShape };
}
/** "e" do ajuste 3, girado `rot` graus em volta do centro (cx, cy). Devolve paths finais, sem transform. */
function bisE3({ cx, cy, u, rot = GIRO, id, p = E3 }) {
  const L = e3Local(p, u, rot);
  const W = (q) => { const r = rotP(q, rot); return [cx + r[0], cy + r[1]]; };
  const pt = (q) => W(q).map(fmt).join(' ');
  const R = fmt(rot);
  const { ax, ay, bx, by, yT, yB, xO, xL, S0, S1, c } = L;
  const bar = `M${pt([xL, yT])}L${pt([xO(yT), yT])}A${fmt(ax)} ${fmt(ay)} ${R} 0 1 ${pt([xO(yB), yB])}L${pt([xL, yB])}Z`;
  // cantos da ponta arredondados (raio tipR × traço), com quadráticas
  const fil = (P0, V, P1) => { const r = p.tipR * c.t; const a = add2(V, mul2(nrm2(sub2(P0, V)), r)), b = add2(V, mul2(nrm2(sub2(P1, V)), r)); return `L${pt(a)}Q${pt(V)} ${pt(b)}`; };
  let loop = `M${pt(S0)}A${fmt(ax)} ${fmt(ay)} ${R} 1 0 ${pt(c.Co)}`;
  if (p.arrow) loop += fil(c.Co, c.bo, c.tip) + fil(c.bo, c.tip, c.bi) + fil(c.tip, c.bi, c.Ci);
  loop += `L${pt(c.Ci)}A${fmt(bx)} ${fmt(by)} ${R} 1 1 ${pt(S1)}Z`;
  const g0 = W([-ax, -ay]), g1 = W([ax, ay]);
  const defs = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fmt(g0[0])}" y1="${fmt(g0[1])}" x2="${fmt(g1[0])}" y2="${fmt(g1[1])}"><stop offset="0" stop-color="${P.magenta}"/><stop offset="0.55" stop-color="${P.orange}"/><stop offset="1" stop-color="${P.yellow}"/></linearGradient>`;
  const body = `<path d="${bar}" fill="url(#${id})"/><path d="${loop}" fill="url(#${id})"/>`;
  // caixa da tinta (contorno externo girado + ponta) e centroide, por amostragem
  const outline = [];
  for (let i = 0; i < 720; i++) { const f = (i * Math.PI) / 360; outline.push(W([ax * Math.cos(f), ay * Math.sin(f)])); }
  if (p.arrow) outline.push(W(c.bo), W(c.tip), W(c.bi));
  const xs = outline.map((q) => q[0]), ys = outline.map((q) => q[1]);
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  let sx = 0, sy = 0, n = 0; const N = 220;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const q = [box.x0 + ((box.x1 - box.x0) * (i + 0.5)) / N, box.y0 + ((box.y1 - box.y0) * (j + 0.5)) / N];
    const l = rotP([q[0] - cx, q[1] - cy], -rot);
    if (L.inShape(l)) { sx += q[0]; sy += q[1]; n++; }
  }
  const ink = (n / (N * N)) * (box.x1 - box.x0) * (box.y1 - box.y0);
  return {
    defs, body, box, centroid: [sx / n, sy / n], ink, outline, L,
    gap: L.gap, gapLine: L.gapPts[0] ? [W(L.gapPts[1]), W(L.gapPts[0])] : null,
    maxX: box.x1, maxY: box.y1,
  };
}

// v6 = ajuste 3 (recomendado): o "e" redesenhado e girado GIRO graus
BIS.v6 = { kind: 'e3', lockup: E3, small: E3_SMALL };
// REC (a versão dos SVGs finais) está no bloco do ajuste 4, abaixo

// =====================================================================
// AJUSTE 4 (8c.1, cliente em 2026-09-28): o ajuste 3 foi reprovado ("distorcido, diferente do E original").
// O "e" é exatamente o da variação 3 (os mesmos paths de `conceito-2*-v3.svg`), só GIRADO como um bloco
// rígido em volta do centro do círculo: arco, barra, seta e degradê giram juntos. Só rotação e translação;
// nenhuma escala, nenhuma mudança de forma. Os raios, `stroke-width` e o contorno da seta são os mesmos.
// =====================================================================
BIS.v7 = { kind: 'rigid', base: 'v3' };
const REC = 'v7'; // versão dos SVGs finais do conceito 2 (ajuste 4). A variação 3 fica em `-v3`, o ajuste 3 em `-ajuste3`

/** Gira um `d` (M/L/H/V/A/Q/Z absolutos) `deg` graus em volta de (cx, cy) e translada (ox, oy). */
function rotateD(d, deg, cx, cy, ox = 0, oy = 0) {
  const R = (x, y) => { const p = rotP([x - cx, y - cy], deg); return `${fmt(cx + p[0] + ox)} ${fmt(cy + p[1] + oy)}`; };
  let cur = [0, 0], start = [0, 0];
  return d.replace(/([MLHVAQZ])([^MLHVAQZ]*)/g, (_, c, args) => {
    const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    if (c === 'Z') { cur = start; return 'Z'; }
    if (c === 'H') { cur = [n[0], cur[1]]; return `L${R(...cur)}`; }
    if (c === 'V') { cur = [cur[0], n[0]]; return `L${R(...cur)}`; }
    if (c === 'A') { cur = [n[5], n[6]]; return `A${fmt(n[0])} ${fmt(n[1])} ${fmt(n[2] + deg)} ${n[3]} ${n[4]} ${R(...cur)}`; }
    const out = []; for (let i = 0; i < n.length; i += 2) out.push(R(n[i], n[i + 1]));
    cur = [n[n.length - 2], n[n.length - 1]]; if (c === 'M') start = cur;
    return c + out.join(' ');
  });
}
/** Gira os paths e as pontas do degradê (userSpaceOnUse) de um desenho: o resultado é só paths, sem transform. */
function rotateArt({ defs, body }, deg, cx, cy, ox = 0, oy = 0) {
  const P2 = (x, y) => { const p = rotP([x - cx, y - cy], deg); return [cx + p[0] + ox, cy + p[1] + oy]; };
  const d2 = defs.replace(/x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g, (_, a, b, c, e) => {
    const p = P2(+a, +b), q = P2(+c, +e); return `x1="${fmt(p[0])}" y1="${fmt(p[1])}" x2="${fmt(q[0])}" y2="${fmt(q[1])}"`;
  });
  return { defs: d2, body: body.replace(/ d="([^"]+)"/g, (_, d) => ` d="${rotateD(d, deg, cx, cy, ox, oy)}"`) };
}
/** Tinta de um desenho renderizado (resvg): caixa, centroide e área. */
function inkStats(defs, body, box, ss = 6) {
  const w = Math.ceil((box.x1 - box.x0) * ss), h = Math.ceil((box.y1 - box.y0) * ss);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${fmt(box.x0)} ${fmt(box.y0)} ${fmt(w / ss)} ${fmt(h / ss)}"><defs>${defs}</defs>${body}</svg>`;
  const px = new Resvg(svg, { background: 'rgba(0,0,0,0)' }).render().pixels;
  let a = 0, sx = 0, sy = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const al = px[(j * w + i) * 4 + 3] / 255; if (!al) continue;
    a += al; sx += al * (i + 0.5); sy += al * (j + 0.5);
    if (al > 0.5) { x0 = Math.min(x0, i); x1 = Math.max(x1, i + 1); y0 = Math.min(y0, j); y1 = Math.max(y1, j + 1); }
  }
  const X = (v) => box.x0 + v / ss, Y = (v) => box.y0 + v / ss;
  return { area: a / ss / ss, c: [X(sx / a), Y(sy / a)], box: { x0: X(x0), x1: X(x1), y0: Y(y0), y1: Y(y1) } };
}
const optical = (st) => [((st.box.x0 + st.box.x1) / 2 + st.c[0]) / 2, ((st.box.y0 + st.box.y1) / 2 + st.c[1]) / 2];
/** "e" da variação 3 girado. O círculo não muda com o giro; só a seta e a barra mudam de lugar. */
function rigidE(g, cx, cy, deg, id, ox = 0, oy = 0) {
  const e = loopE({ ...g, id, cx, cy });
  const r = rotateArt(e, deg, cx, cy, ox, oy);
  const V = e.V.map((v) => { const p = rotP([v[0] - cx, v[1] - cy], deg); return [cx + p[0] + ox, cy + p[1] + oy]; });
  const ro = g.ro;
  return {
    ...r, orig: e, V, rim: e.rim, cx: cx + ox, cy: cy + oy, cx0: cx, cy0: cy, ox, oy, deg, ro, gap: e.gap,
    minX: Math.min(cx + ox - ro, ...V.map((v) => v[0] - e.rim)), maxX: Math.max(cx + ox + ro, ...V.map((v) => v[0] + e.rim)),
    minY: Math.min(cy + oy - ro, ...V.map((v) => v[1] - e.rim)), maxY: Math.max(cy + oy + ro, ...V.map((v) => v[1] + e.rim)),
  };
}
/** Lockup do ajuste 4: "encor" da variação 3, sem mudança nenhuma, + o "e" dela girado em volta do centro. */
function lockupRigid(F0, id, deg) {
  const g = BIS.v3.lockup, ro = g.ro * F0, w = g.w * F0;
  const B = Math.max(OV_TOP * F0, ro + ((OV_TOP - OV_BOT) / 2) * F0);
  const wm = textD(F.display, 'encor', { size: F0, x: -0.022 * F0, y: B, tracking: -0.02 });
  const cx = wm.end - 0.02 * F0 + 0.018 * F0 + ro, cy = B - ((OV_TOP - OV_BOT) / 2) * F0;
  // espaço r–e: o lado esquerdo do "e" é o próprio círculo, que o giro não muda. Se a seta ou a barra girada
  // chegassem mais perto do "r" que a variação 3, o "e" seria afastado por translação (dx).
  const rPts = samplePath(textD(F.display, 'r', { size: F0, x: wm.end - measure(F.display, 'r', F0), y: B }).d);
  const pts = (e) => { const o = []; for (let i = 0; i < 720; i++) o.push([e.cx + ro * Math.cos((i * Math.PI) / 360), e.cy + ro * Math.sin((i * Math.PI) / 360)]); return o.concat(e.V); };
  const g0 = { ...g, ro, w };
  const ref = reSpace(rPts, pts(rigidE(g0, cx, cy, 0, id)), B, F0);
  let dx = 0, e = rigidE(g0, cx, cy, deg, id), sp = reSpace(rPts, pts(e), B, F0);
  for (let i = 0; i < 8 && sp.min < ref.min - 0.01; i++) { dx += ref.min - sp.min; e = rigidE(g0, cx, cy, deg, id, dx); sp = reSpace(rPts, pts(e), B, F0); }
  // linha de base e altura-x: o círculo continua de 0 a 56 (o giro não move o centro); só a seta mexe na caixa
  const h = Math.max(B + OV_BOT * F0, e.maxY), top = Math.min(0, e.minY);
  return { w: e.maxX + 0.02 * F0, h, top, defs: e.defs, body: `<path fill="${P.magenta}" d="${wm.d}"/>` + e.body, e, space: { ...sp, ref }, dx, B, cx, cy };
}
/** Placa do ajuste 4: o "e" da placa da variação 3, girado, e transladado para manter o mesmo centro óptico dela. */
function rigidTile({ x = 0, y = 0, k = 1, id, rot = GIRO, small = false }) {
  const g0 = small ? BIS.v3.small : BIS.v3.tile, r = small && !GIRA_16 ? 0 : rot;
  const g = { ...g0, ro: g0.ro * k, w: g0.w * k }, cx = x + 32 * k, cy = y + 32 * k;
  const key = `${small}:${r}`;
  if (!rigidTile.off[key]) {
    // centro óptico (média da caixa e do centroide) medido na grade de 64, antes e depois do giro
    const box = { x0: 0, x1: 64, y0: 0, y1: 64 };
    const gg = { ...g0 }, a = rigidE(gg, 32, 32, 0, 'o0'), b = rigidE(gg, 32, 32, r, 'o1');
    const oa = optical(inkStats(a.defs, a.body, box, 8)), ob = optical(inkStats(b.defs, b.body, box, 8));
    rigidTile.off[key] = [oa[0] - ob[0], oa[1] - ob[1]];
  }
  const [ox, oy] = rigidTile.off[key];
  return rigidE(g, cx, cy, r, id, ox * k, oy * k);
}
rigidTile.off = {};

/** Posição do "e" do ajuste 3 na placa de 64: centro óptico = média da caixa e do centroide, 0,5 acima do meio. */
function e3Tile({ x = 0, y = 0, k = 1, id, rot = GIRO, small = false }) {
  const p = small ? E3_SMALL : E3, r = small && !GIRA_16 ? 0 : rot;
  const u = (small ? 88 : 83) * k; // o "e" com a seta ocupa 74% da placa (o da variação 3 ocupava 75%)
  const probe = bisE3({ cx: 0, cy: 0, u, rot: r, id, p });
  const ox = ((probe.box.x0 + probe.box.x1) / 2 + probe.centroid[0]) / 2, oy = ((probe.box.y0 + probe.box.y1) / 2 + probe.centroid[1]) / 2;
  return bisE3({ cx: x + 32 * k - ox, cy: y + (32 - 0.5) * k - oy, u, rot: r, id, p });
}
/** Área de tinta de um desenho (px² na escala do desenho), renderizando com o resvg. */
function inkArea(defs, body, box, ss = 4) {
  const w = Math.ceil((box.x1 - box.x0) * ss) + 4, h = Math.ceil((box.y1 - box.y0) * ss) + 4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${fmt(box.x0 - 2 / ss)} ${fmt(box.y0 - 2 / ss)} ${fmt(w / ss)} ${fmt(h / ss)}"><defs>${defs}</defs>${body.replace(/url\(#[^)]+\)/g, '#000')}</svg>`;
  const img = new Resvg(svg, { background: 'rgba(0,0,0,0)' }).render();
  const px = img.pixels; let a = 0; for (let i = 3; i < px.length; i += 4) a += px[i] / 255;
  return a / (ss * ss);
}
/** Medidas do "e": fonte × variação 3 × ajuste 3 (impressas por `node build-logo.mjs medir`). */
async function measureReport() {
  const F0 = 100, B = OV_TOP * F0, out = [];
  const pr = (...a) => out.push(a.join(' '));
  // "e" da Bricolage ExtraBold (o primeiro de "encor")
  const eD = textD(F.display, 'e', { size: F0, x: 0, y: B }).d, eP = samplePath(eD, 40);
  const bxE = { x0: Math.min(...eP.map((q) => q[0])), x1: Math.max(...eP.map((q) => q[0])), y0: Math.min(...eP.map((q) => q[1])), y1: Math.max(...eP.map((q) => q[1])) };
  const scanX = (y) => { const xs = []; for (let i = 0; i < eP.length; i++) { const a = eP[i], b = eP[(i + 1) % eP.length]; if ((a[1] - y) * (b[1] - y) < 0) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])); } return xs.sort((m, n) => m - n); };
  const scanY = (x) => { const ys = []; for (let i = 0; i < eP.length; i++) { const a = eP[i], b = eP[(i + 1) % eP.length]; if ((a[0] - x) * (b[0] - x) < 0) ys.push(a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0])); } return ys.sort((m, n) => m - n); };
  const xs = scanX(38), xs2 = scanX(14), ys = scanY((bxE.x0 + bxE.x1) / 2);
  pr('FONTE e: caixa', fmt(bxE.x1 - bxE.x0), 'x', fmt(bxE.y1 - bxE.y0), '| cortes y=38:', xs.map(fmt).join(','), '| y=14:', xs2.map(fmt).join(','), '| cortes em x=meio:', ys.map(fmt).join(','));
  { // espaço r–e da variação 3 (círculo de raio 28, linha de base em 54,4)
    const g = BIS.v3.lockup, ro = g.ro * F0, B3 = ro + ((OV_TOP - OV_BOT) / 2) * F0;
    const wm = textD(F.display, 'encor', { size: F0, x: -0.022 * F0, y: B3, tracking: -0.02 });
    const rP = samplePath(textD(F.display, 'r', { size: F0, x: wm.end - measure(F.display, 'r', F0), y: B3 }).d);
    const cx = wm.end - 0.02 * F0 + 0.018 * F0 + ro, cy = B3 - ((OV_TOP - OV_BOT) / 2) * F0, circ = [];
    for (let i = 0; i < 720; i++) circ.push([cx + ro * Math.cos((i * Math.PI) / 360), cy + ro * Math.sin((i * Math.PI) / 360)]);
    const sp = reSpace(rP, circ, B3, F0), ref = fontReSpace(F0, B3);
    pr('V3 r–e: área', fmt(sp.area), '(fonte', fmt(ref.area) + ') mín', fmt(sp.min), '(fonte', fmt(ref.min) + ')');
  }
  const oD = textD(F.display, 'o', { size: F0, x: 0, y: B }).d, oP = samplePath(oD, 40);
  pr('FONTE o: largura', fmt(Math.max(...oP.map((q) => q[0])) - Math.min(...oP.map((q) => q[0]))));
  const fontInk = inkArea('', `<path d="${eD}" fill="#000"/>`, bxE);
  pr('FONTE e: tinta', fmt(fontInk), 'densidade', fmt(fontInk / ((bxE.x1 - bxE.x0) * (bxE.y1 - bxE.y0))));
  // variação 3
  const L3 = lockup(2, F0, 'm3', 'v3'), g3 = BIS.v3.lockup;
  const box3 = { x0: 250, x1: L3.w, y0: 0, y1: L3.h };
  const ink3 = inkArea(L3.defs, L3.body.replace(/^<path fill="#FF3D8B" d="[^"]+"\/>/, ''), box3);
  pr('V3 e: diâmetro', fmt(2 * g3.ro * F0), 'traço', fmt(g3.w * F0), 'barra', fmt(g3.barW ?? 0.68) + '×traço =', fmt((BIS.v3.lockup.barW ?? 0.68) * g3.w * F0), '| olho', fmt(g3.ro * F0 - g3.w * F0 - (0.32 * g3.w * F0 + 0.34 * g3.w * F0)), '| tinta', fmt(ink3), 'densidade', fmt(ink3 / ((box3.x1 - box3.x0) * (2 * g3.ro * F0))), '| respiro', fmt(L3.e.gap), '| ponta', fmt((2 * Math.atan(g3.head / g3.len) * 180) / Math.PI) + '°');
  for (const rot of [0, ...GIROS]) {
    const L = lockup(2, F0, 'm6', 'v6', rot), e = L.e, Lc = e.L;
    const ink = inkArea(e.defs, e.body, e.box);
    const eye = (-Lc.yT) - 0; // do centro ao topo da barra
    pr(`E3 ${rot}°: caixa ${fmt(2 * Lc.ax)}x${fmt(2 * Lc.ay)} laterais ${fmt(Lc.ax - Lc.bx)} topo ${fmt(Lc.ay - Lc.by)} barra ${fmt(Lc.yB - Lc.yT)} olho ${fmt(Lc.by - (-Lc.yT))} | fim ${fmt(Lc.end)}° giro da ponta ${fmt(Lc.c.turn)}° traço no fim ${fmt(Lc.c.t)} respiro ${fmt(e.gap)} (${fmt(e.gap * 0.22)} px a 22) | ponta ${fmt((2 * Math.atan(E3.head / E3.len) * 180) / Math.PI)}° | caixa tinta y ${fmt(e.box.y0)}..${fmt(e.box.y1)} x ${fmt(e.box.x0)}..${fmt(e.box.x1)} | tinta ${fmt(ink)} dens ${fmt(ink / ((e.box.x1 - e.box.x0) * (e.box.y1 - e.box.y0)))} | r–e área ${fmt(L.space.area)} (fonte ${fmt(L.space.ref.area)}) mín ${fmt(L.space.min)} (fonte ${fmt(L.space.ref.min)}) | lockup ${fmt(L.w)}x${fmt(L.h)}`);
    for (const k of [0.5, 180 / 64]) { const t = bisTile({ k, id: 'q', rot, v: 'v6' }); pr(`   placa ${fmt(64 * k)}: respiro ${fmt(t.e.gap)} px, caixa ${fmt(t.e.box.x0)}..${fmt(t.e.box.x1)} × ${fmt(t.e.box.y0)}..${fmt(t.e.box.y1)}, centroide ${t.e.centroid.map(fmt).join(',')}`); }
  }
  for (const rot of GIROS) {
    const L = lockup(2, F0, 'm7', 'v7', rot), a = proveRigid(L.e), t = bisTile({ k: 180 / 64, id: 'q7', rot }).e, b = proveRigid(t, 3);
    pr(`AJUSTE 4 ${rot}°: lockup ${fmt(L.w)}x${fmt(L.h)} r–e mín ${fmt(L.space.min)} (reto ${fmt(L.space.ref.min)}) dx ${fmt(L.dx)} | prova lockup: coord ${a.coord} px máx ${a.max} média ${fmt(a.mean)} >32 ${fmt(a.overPct)}% longe da borda ${a.maxFlat} | ícone: coord ${b.coord} px máx ${b.max} >32 ${fmt(b.overPct)}% longe da borda ${b.maxFlat} | translação na placa ${fmt(t.ox / (180 / 64))}, ${fmt(t.oy / (180 / 64))}`);
  }
  console.log(out.join('\n'));
}
/** Placa escura (favicon/ícone) com o "e" de bis. */
function bisTile({ x = 0, y = 0, k = 1, id = 'bis', rx = 14, full = false, v = REC, small = false, rot = GIRO }) {
  const tile = `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(64 * k)}" height="${fmt(64 * k)}" rx="${full ? 0 : fmt(rx * k)}" fill="${P.bg}"/>`;
  if (BIS[v].kind === 'e3') { const e = e3Tile({ x, y, k, id, rot, small }); return { defs: e.defs, body: tile + e.body, e }; }
  if (BIS[v].kind === 'rigid') { const e = rigidTile({ x, y, k, id, rot, small }); return { defs: e.defs, body: tile + e.body, e }; }
  const g = small ? BIS[v].small ?? BIS[v].tile : BIS[v].tile;
  const e = loopE({ ...g, cx: x + 32 * k, cy: y + 32 * k, ro: g.ro * k, w: g.w * k, id });
  return { defs: e.defs, body: tile + e.body, e };
}

// ---------- medidas (para o LOGO.md e para o espaçamento r–e) ----------
/** Pontos de um `d` (M/L/Q/C/Z), amostrados. */
function samplePath(d, steps = 16) {
  const out = []; let cur = [0, 0], start = [0, 0];
  for (const [, cmd, args] of d.matchAll(/([MLQCZ])([^MLQCZ]*)/g)) {
    const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    if (cmd === 'M') { cur = [n[0], n[1]]; start = cur; out.push(cur); }
    else if (cmd === 'L') { for (let i = 1; i <= steps; i++) out.push(add2(cur, mul2(sub2([n[0], n[1]], cur), i / steps))); cur = [n[0], n[1]]; }
    else if (cmd === 'Q') { const c1 = [n[0], n[1]], e = [n[2], n[3]]; for (let i = 1; i <= steps; i++) { const t = i / steps; out.push([(1 - t) ** 2 * cur[0] + 2 * t * (1 - t) * c1[0] + t * t * e[0], (1 - t) ** 2 * cur[1] + 2 * t * (1 - t) * c1[1] + t * t * e[1]]); } cur = e; }
    else if (cmd === 'C') { const c1 = [n[0], n[1]], c2 = [n[2], n[3]], e = [n[4], n[5]]; for (let i = 1; i <= steps; i++) { const t = i / steps, s = 1 - t; out.push([s ** 3 * cur[0] + 3 * s * s * t * c1[0] + 3 * s * t * t * c2[0] + t ** 3 * e[0], s ** 3 * cur[1] + 3 * s * s * t * c1[1] + 3 * s * t * t * c2[1] + t ** 3 * e[1]]); } cur = e; }
    else if (cmd === 'Z') { for (let i = 1; i <= steps; i++) out.push(add2(cur, mul2(sub2(start, cur), i / steps))); cur = start; }
  }
  return out;
}
/** Perfil por faixa de y: borda direita (max x) ou esquerda (min x). */
function profile(pts, y0, y1, side, bins = 200) {
  const out = new Array(bins).fill(null);
  for (const [x, y] of pts) { if (y < y0 || y > y1) continue; const i = Math.min(bins - 1, Math.floor(((y - y0) / (y1 - y0)) * bins)); if (out[i] === null || (side === 'right' ? x > out[i] : x < out[i])) out[i] = x; }
  return out;
}
/** Área branca entre o "r" e o "e" na faixa da altura-x (limitada a `cap` por linha) e a menor distância entre os dois. */
function reSpace(rPts, ePts, B, F0) {
  const y0 = B - XH * F0, y1 = B, cap = 0.2 * F0, bins = 200;
  const rr = profile(rPts, y0, y1, 'right', bins), el = profile(ePts, y0, y1, 'left', bins);
  let area = 0; for (let i = 0; i < bins; i++) if (rr[i] !== null && el[i] !== null) area += Math.min(cap, el[i] - rr[i]) * ((y1 - y0) / bins);
  const rMax = Math.max(...rPts.map((q) => q[0]));
  let min = Infinity; for (const a of rPts) if (a[0] > rMax - 0.3 * F0) for (const b of ePts) min = Math.min(min, len2(sub2(a, b)));
  return { area, min };
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
/** Espaço r–e de referência: o "e" da própria Bricolage depois do "r", com o mesmo tracking do wordmark. */
function fontReSpace(F0, B) {
  const all = shape(F.display, 'encore'), s = F0 / F.display.upem;
  let pen = -0.022 * F0; const pos = [];
  for (const g of all) { pos.push(pen + g.dx * s); pen += g.ax * s - 0.02 * F0; }
  const glyph = (i) => samplePath(mapPath(F.display.font.glyphToPath(all[i].g), (px, py) => [pos[i] + px * s, B - py * s]));
  return reSpace(glyph(4), glyph(5), B, F0);
}
/** Lockup do ajuste 3: "encor" reto + o "e" girado, posto para o branco r–e igualar o da fonte. */
function lockupE3(F0, id, rot) {
  const B = OV_TOP * F0;
  const wm = textD(F.display, 'encor', { size: F0, x: -0.022 * F0, y: B, tracking: -0.02 });
  const rPen = wm.end - measure(F.display, 'r', F0);
  const rD = textD(F.display, 'r', { size: F0, x: rPen, y: B }).d, rPts = samplePath(rD);
  const cy = B - ((OV_TOP - OV_BOT) / 2) * F0; // centro óptico da altura-x (redondos de −14 a 542)
  const ref = fontReSpace(F0, B);
  const at = (cx) => bisE3({ cx, cy, u: F0, rot, id });
  let cx = wm.end + E3.rxO * F0;
  for (let i = 0; i < 6; i++) { const sp = reSpace(rPts, at(cx).outline, B, F0); cx += (ref.area - sp.area) / (XH * F0); }
  // e nunca mais perto do "r" que o "e" da fonte (a ponta do braço do "r" é o ponto crítico)
  for (let i = 0; i < 8; i++) { const sp = reSpace(rPts, at(cx).outline, B, F0); if (sp.min >= ref.min - 0.01) break; cx += (ref.min - sp.min) * 1.2; }
  const e = at(cx), sp = reSpace(rPts, e.outline, B, F0);
  return { w: e.maxX + 0.02 * F0, h: Math.max(B + OV_BOT * F0, e.maxY), defs: e.defs, body: `<path fill="${P.magenta}" d="${wm.d}"/>` + e.body, e, space: { ...sp, ref }, cy, B };
}
function lockup(concept, F0 = 100, id = `c${concept}`, v = REC, rot = GIRO) {
  if (concept === 2 && BIS[v].kind === 'e3') return lockupE3(F0, id, rot);
  if (concept === 2 && BIS[v].kind === 'rigid') return lockupRigid(F0, id, rot);
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
    why: 'Encore é o bis, o "de novo!" do fim do show. O último "e" do nome vira um traço que dá a volta e termina numa seta que fecha a letra de volta na barra, como a perna do G, em degradê magenta, laranja e amarelo. Versão desta prancha: ajuste 4, o mesmo "e" da variação 3, só girado ' + String(-GIRO).replace('.', ',') + '° para a esquerda (sentido anti-horário). No favicon de 16 px entra uma versão sem seta.',
  },
  {
    n: 3, name: 'Cartaz', header: 22, cardH: 44,
    idea: 'O cartaz do festival inteiro num ícone.',
    why: 'Um "E" em estêncil, como as letras pintadas nos cases de equipamento de turnê, dividido em três faixas que repetem a hierarquia do lineup: headliner em amarelo, segunda linha em branco, terceira em magenta. A placa usa o mesmo fundo de holofotes magenta e ciano do card Festival, e o nome vem em caixa-alta condensada, como o título "ENCORE FEST".',
  },
];
// `node build-logo.mjs medir` só imprime as medidas do "e" (fonte, variação 3 e ajuste 3) e não grava nada
if (process.argv.includes('medir')) { await measureReport(); process.exit(0); }
// ex.: `node build-logo.mjs 2` gera só o conceito 2; `node build-logo.mjs 2 --giro=-16` troca o ângulo do "e"
const ONLY = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a))) || null;
for (const c of CONCEPTS.filter((x) => !ONLY || x.n === ONLY)) {
  const L = lockup(c.n);
  await writeFile(`${HERE}/conceito-${c.n}.svg`, svgDoc(L, `Encore, conceito ${c.n} (${c.name})`));
  await writeFile(`${HERE}/conceito-${c.n}-simbolo.svg`, svgDoc(symbol(c.n, 64), `Encore, símbolo do conceito ${c.n}`));
  await writeFile(`${HERE}/conceito-${c.n}-icone-app.svg`, svgDoc(symbol(c.n, 180, `a${c.n}`, true), `Encore, ícone de app do conceito ${c.n}`));
  if (c.n === 2) await writeFile(`${HERE}/conceito-2-favicon-16.svg`, svgDoc(symbol(2, 64, 's2m', false, { small: true }), 'Encore, favicon de 16 px'));
  if (c.n === 2) {
    // registro da variação 3 do ajuste 2 (a versão aplicada no app até o 8c.3)
    await writeFile(`${HERE}/conceito-2-v3.svg`, svgDoc(lockup(2, 100, 'c2', 'v3'), 'Encore, conceito 2 (Bis)'));
    await writeFile(`${HERE}/conceito-2-simbolo-v3.svg`, svgDoc(symbol(2, 64, 's2', false, { v: 'v3' }), 'Encore, símbolo do conceito 2'));
    await writeFile(`${HERE}/conceito-2-icone-app-v3.svg`, svgDoc(symbol(2, 180, 'a2', true, { v: 'v3' }), 'Encore, ícone de app do conceito 2'));
    await writeFile(`${HERE}/conceito-2-favicon-16-v3.svg`, svgDoc(symbol(2, 64, 's2m', false, { v: 'v3', small: true }), 'Encore, favicon de 16 px'));
    // registro do ajuste 3 (reprovado: o redesenho do "e" distorceu a letra), a −12°
    await writeFile(`${HERE}/conceito-2-ajuste3.svg`, svgDoc(lockup(2, 100, 'c2', 'v6', -12), 'Encore, conceito 2 (Bis)'));
    await writeFile(`${HERE}/conceito-2-simbolo-ajuste3.svg`, svgDoc(symbol(2, 64, 's2', false, { v: 'v6', rot: -12 }), 'Encore, símbolo do conceito 2'));
    await writeFile(`${HERE}/conceito-2-icone-app-ajuste3.svg`, svgDoc(symbol(2, 180, 'a2', true, { v: 'v6', rot: -12 }), 'Encore, ícone de app do conceito 2'));
    await writeFile(`${HERE}/conceito-2-favicon-16-ajuste3.svg`, svgDoc(symbol(2, 64, 's2m', false, { v: 'v6', rot: -12, small: true }), 'Encore, favicon de 16 px'));
  }
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
async function cardPng(c, width, { v = REC, rot = GIRO, png: asPng = true } = {}) {
  const L = lockup(c.n, 100, `k${c.n}`, v, rot);
  const h = c.cardH, w = (L.w / L.h) * h;
  const img = { type: 'img', props: { src: dataUri('image/svg+xml', svgDoc(L, 'Encore')), width: Math.round(w), height: h } };
  const tree = swapWordmark(render('festival', 'story', 'upload', structuredClone(cardData)), img);
  const svg = await satori(tree, { width: 1080, height: 1920, fonts: cardFonts });
  return asPng ? png(svg, width) : svg;
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
  body += text(F.interSemi, c.n === 2 ? `Encore · logo escolhida · ajuste 4, "e" girado −${-GIRO}° · set/2026` : 'Encore · proposta de logo · set/2026', { size: 13, x: W - 64, y: 60, fill: P.subtle, anchor: 'end' });

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
/** Ajuste 3 do conceito 2: correções de proporção e o "e" girado em 3 ângulos (pedido do cliente em 2026-09-28). */
async function adjustBoard3() {
  const W = 1600, H = 1560;
  const defs = []; let body = `<rect width="${W}" height="${H}" fill="${P.bg}"/>`;
  const nf = (v, d = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const deg = (r) => (r === 0 ? '0°' : `−${nf(Math.abs(r))}°`);
  body += text(F.display, 'Conceito 2 · Bis · ajuste 3: o "e" gira para a esquerda', { size: 40, x: 64, y: 88, fill: P.fg, tracking: -0.02 });
  body += text(F.inter, 'Só o "e" com a seta gira, no sentido anti-horário; "encor" continua reto. Antes do giro, o "e" foi redesenhado com as proporções da Bricolage ExtraBold.', { size: 16, x: 64, y: 122, fill: P.muted });
  body += text(F.interSemi, 'Encore · logo · set/2026', { size: 13, x: W - 64, y: 60, fill: P.subtle, anchor: 'end' });

  // ---------- A. correções de proporção ----------
  const top = 156, ah = 422;
  body += panel(64, top, W - 128, ah) + label('Proporções do "e", sem giro · mesma escala, linhas de base, altura-x e overshoot', 88, top + 34);
  const F0 = 100, B = OV_TOP * F0, cy0 = B - ((OV_TOP - OV_BOT) / 2) * F0, k = 3.6;
  const gx = 88, gy = top + 70; // origem da área dos três "e"
  const slots = [
    { name: 'Bricolage 800', sub: 'o "e" de "encor"', x: 0 },
    { name: 'Variação 3', sub: 'aplicada hoje', x: 240 },
    { name: 'Ajuste 3', sub: 'corrigido, antes do giro', x: 490 },
  ];
  const guides = [[0, ''], [B - XH * F0, 'altura-x'], [B, 'linha de base'], [B + OV_BOT * F0, '']];
  for (const [y, name] of guides) {
    body += `<rect x="${gx}" y="${fmt(gy + y * k)}" width="690" height="1" fill="${name === 'linha de base' || name === 'altura-x' ? P.cyan : P.line}" opacity="${name === 'linha de base' || name === 'altura-x' ? 0.55 : 1}"/>`;
    if (name) body += text(F.inter, name, { size: 11, x: gx + 690, y: gy + y * k + (name === 'altura-x' ? -6 : 14), fill: P.subtle, anchor: 'end' });
  }
  const eFont = textD(F.display, 'e', { size: F0, x: 0, y: B });
  body += `<g transform="translate(${fmt(gx + slots[0].x)} ${fmt(gy)}) scale(${k})"><path fill="${P.magenta}" d="${eFont.d}"/></g>`;
  const g3 = BIS.v3.lockup, e3old = loopE({ ...g3, cx: 28, cy: cy0, ro: g3.ro * F0, w: g3.w * F0, id: 'pa3' });
  defs.push(e3old.defs);
  body += `<g transform="translate(${fmt(gx + slots[1].x)} ${fmt(gy)}) scale(${k})">${e3old.body}</g>`;
  const eNew = bisE3({ cx: E3.rxO * F0, cy: cy0, u: F0, rot: 0, id: 'pa6' });
  defs.push(eNew.defs);
  body += `<g transform="translate(${fmt(gx + slots[2].x)} ${fmt(gy)}) scale(${k})">${eNew.body}</g>`;
  for (const s of slots) {
    body += text(F.interSemi, s.name, { size: 14, x: gx + s.x, y: gy + 56 * k + 34, fill: P.fg });
    body += text(F.inter, s.sub, { size: 12, x: gx + s.x, y: gy + 56 * k + 52, fill: P.subtle });
  }
  // tabela antes → depois
  const Lc = eNew.L, c = Lc.c;
  const tipIn = (Lc.xO(Lc.yB) - c.tip[0]) / Lc.c.t; // quanto a ponta fica para dentro da ponta da barra, em traços
  const fontInk = inkArea('', `<path d="${eFont.d}" fill="#000"/>`, { x0: 0, x1: 54, y0: -1, y1: 57 });
  const ink3 = inkArea(e3old.defs, e3old.body, { x0: 0, x1: 62, y0: -1, y1: 60 }), ink6 = inkArea(eNew.defs, eNew.body, eNew.box);
  const pct = (a) => `${a >= fontInk ? '+' : '−'}${nf((Math.abs(a - fontInk) / fontInk) * 100)}%`;
  const L22 = (v, r) => lockup(2, 100, 'm', v, r);
  const gaps = (v, r) => [L22(v, r).e.gap * 0.22, bisTile({ k: 0.5, id: 'm', v, rot: r }).e.gap, bisTile({ k: 180 / 64, id: 'm', v, rot: r }).e.gap];
  const gOld = gaps('v3', 0), gNew = gaps('v6', 0);
  const rows = [
    ['', 'variação 3', 'ajuste 3', 'Bricolage'],
    ['caixa (L × A)', '56 × 56', `${nf(2 * Lc.ax)} × ${nf(2 * Lc.ay)}`, '49,8 × 55,6'],
    ['traço nas laterais', '13,5', nf(Lc.ax - Lc.bx), '16,1'],
    ['traço em cima / embaixo', '13,5', nf(Lc.ay - Lc.by), '12,7 / 12,1'],
    ['barra', '9,2', nf(Lc.yB - Lc.yT), '8,9'],
    ['olho (contraforma de cima)', '5,6', nf(Lc.by + Lc.yT), '9,3'],
    ['tinta, perto do "e" da fonte', pct(ink3), pct(ink6), '1.889 u²'],
    ['ponta: meia-largura × compr.', '0,72 × 0,84 traço', `${nf(E3.head, 2)} × ${nf(E3.len, 2)} traço`, ''],
    ['ângulo da ponta · aba lateral', '81° · 0,22 traço', `${nf((2 * Math.atan(E3.head / E3.len) * 180) / Math.PI, 0)}° · ${nf(E3.head - 0.5, 2)} traço`, ''],
    ['emenda seta / traço', '2 peças sobrepostas', '1 contorno, sem degrau', ''],
    ['ponta sob a barra', 'na borda de fora', `${nf(tipIn, 2)} traço para dentro`, ''],
    ['respiro 22 / 32 / 180 px', gOld.map((g) => nf(g)).join(' / '), gNew.map((g) => nf(g)).join(' / '), ''],
  ];
  const tx = 830, ty = top + 70, colx = [tx, tx + 226, tx + 396, tx + 580];
  rows.forEach((r, i) => {
    const y = ty + i * 25;
    if (i === 0) { r.forEach((cell, j) => { if (cell) body += text(F.interBold, cell.toLocaleUpperCase('pt-BR'), { size: 11, x: colx[j], y, fill: j === 2 ? P.yellow : P.cyan, tracking: 0.1 }); }); return; }
    body += `<rect x="${tx}" y="${y - 17}" width="${W - 88 - tx}" height="1" fill="${P.line}"/>`;
    body += text(F.inter, r[0], { size: 13, x: colx[0], y, fill: P.muted });
    body += text(F.inter, r[1], { size: 13, x: colx[1], y, fill: P.subtle });
    body += text(F.interSemi, r[2], { size: 13, x: colx[2], y, fill: P.fg });
    if (r[3]) body += text(F.inter, r[3], { size: 12, x: colx[3], y, fill: P.subtle });
  });
  body += para(F.inter, 'Unidades de corpo 100 (o lockup tem 56 de altura). "Traço" = espessura no fim do traço, onde nasce a seta. O "o" da fonte tem 52,3 de largura. A tinta fica um pouco abaixo da do "e" da fonte de propósito: o amarelo do degradê brilha mais que o magenta e pesa mais no olho.', { size: 12, x: tx, y: ty + rows.length * 25 + 2, lh: 17, maxW: W - 88 - tx, fill: P.subtle });

  // ---------- B. colunas: atual + 3 ângulos ----------
  const cols = [
    { v: 'v3', rot: 0, title: 'Atual', note: 'variação 3 aplicada no app' },
    ...GIROS.map((r) => ({ v: 'v6', rot: r, title: deg(r), note: r === -8 ? 'sutil: quase reto' : r === -12 ? 'giro claro, sem tombar' : 'o mais dinâmico' })),
  ];
  const cw = 353, gapc = 16, cTop = top + ah + 28, ch = H - cTop - 40;
  for (const [i, col] of cols.entries()) {
    const x0 = 64 + i * (cw + gapc), rec = col.v === 'v6' && col.rot === -12, old = col.v === 'v3', id = `j${i}`;
    body += panel(x0, cTop, cw, ch);
    if (rec) body += `<rect x="${x0}" y="${cTop}" width="${cw}" height="${ch}" rx="20" fill="none" stroke="${P.yellow}" stroke-width="2"/>` + `<rect x="${x0 + cw - 118}" y="${cTop - 12}" width="106" height="24" rx="12" fill="${P.yellow}"/>` + text(F.interBold, 'RECOMENDADA', { size: 11, x: x0 + cw - 65, y: cTop + 4, fill: P.bg, anchor: 'middle', tracking: 0.08 });
    body += text(F.display, col.title, { size: 30, x: x0 + 20, y: cTop + 46, fill: old ? P.subtle : P.fg, tracking: -0.02 });
    body += text(F.inter, col.note, { size: 13, x: x0 + (old ? 110 : 100), y: cTop + 42, fill: P.subtle });
    // lockup ampliado
    let y = cTop + 76;
    const L = lockup(2, 100, `${id}l`, col.v, col.rot), sL = (cw - 40) / L.w;
    add(place(L, x0 + 20, y + 8, sL));
    y += 8 + L.h * sL + 30;
    // cabeçalho a 22 px, real e ampliado 3×
    body += label('Cabeçalho · 22 px (12 px de altura)', x0 + 20, y);
    const s = 0.22, hw = Math.ceil(L.w * s) + 12, hh = 28;
    const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${hw}" height="${hh}" viewBox="0 0 ${hw} ${hh}"><defs>${L.defs}</defs><rect width="${hw}" height="${hh}" fill="${P.bg}"/><g transform="translate(6 ${fmt((hh - L.h * s) / 2)}) scale(${s})">${L.body}</g></svg>`;
    const hp = dataUri('image/png', png(head, hw));
    body += `<image href="${hp}" x="${x0 + 20}" y="${y + 14}" width="${hw}" height="${hh}"/>`;
    body += `<image href="${hp}" x="${x0 + 20}" y="${y + 50}" width="${hw * 3}" height="${hh * 3}" image-rendering="optimizeSpeed"/>`;
    y += 50 + hh * 3 + 30;
    // símbolo 32 e favicon 16
    body += label('Símbolo 32 px · favicon 16 px', x0 + 20, y);
    const s32 = dataUri('image/png', png(svgDoc(symbol(2, 64, `${id}f`, false, { v: col.v, rot: col.rot }), 'f'), 32));
    const s16 = dataUri('image/png', png(svgDoc(symbol(2, 64, `${id}g`, false, { v: col.v, rot: col.rot, small: true }), 'f'), 16));
    body += `<image href="${s32}" x="${x0 + 20}" y="${y + 18}" width="32" height="32"/><image href="${s16}" x="${x0 + 64}" y="${y + 26}" width="16" height="16"/>`;
    body += `<image href="${s32}" x="${x0 + 100}" y="${y + 18}" width="96" height="96" image-rendering="optimizeSpeed"/><image href="${s16}" x="${x0 + 212}" y="${y + 18}" width="96" height="96" image-rendering="optimizeSpeed"/>`;
    body += text(F.inter, '32 · 16 reais', { size: 11, x: x0 + 20, y: y + 72, fill: P.subtle });
    body += text(F.inter, '32 ×3', { size: 11, x: x0 + 148, y: y + 130, fill: P.subtle, anchor: 'middle' }) + text(F.inter, '16 ×6, sem seta', { size: 11, x: x0 + 260, y: y + 130, fill: P.subtle, anchor: 'middle' });
    y += 150;
    // ícone de app
    body += label('Ícone de app · 180 px', x0 + 20, y);
    const icon = dataUri('image/png', png(svgDoc(symbol(2, 180, `${id}i`, true, { v: col.v, rot: col.rot }), 'i'), 180));
    body += `<clipPath id="${id}ic"><rect x="${x0 + (cw - 180) / 2}" y="${y + 16}" width="180" height="180" rx="40"/></clipPath><image href="${icon}" x="${x0 + (cw - 180) / 2}" y="${y + 16}" width="180" height="180" clip-path="url(#${id}ic)"/>`;
    y += 16 + 180 + 30;
    // rodapé do card story (recorte a 60%)
    body += label('Rodapé do card story · 60%', x0 + 20, y);
    const card = dataUri('image/png', await cardPng(CONCEPTS[1], 648, { v: col.v, rot: col.rot }));
    const cx = x0 + 20, cyy = y + 16, cwid = cw - 40, chh = 76;
    body += `<clipPath id="${id}cc"><rect x="${cx}" y="${cyy}" width="${cwid}" height="${chh}" rx="10"/></clipPath><image href="${card}" x="${fmt(cx - 12)}" y="${fmt(cyy - 925)}" width="648" height="1152" clip-path="url(#${id}cc)"/>`;
    y += 16 + chh + 30;
    // medidas
    const g = old ? gOld : gaps('v6', col.rot);
    const sp = old ? { area: 507, min: 2.83 } : L.space;
    body += label('Medidas', x0 + 20, y);
    const lines = [
      ['respiro 22 / 32 / 180 px', g.map((v) => nf(v)).join(' / ')],
      ['r–e: branco · menor distância', `${nf(sp.area, 0)} u² · ${nf(sp.min)}`],
      ['largura do lockup (corpo 100)', nf(L.w)],
    ];
    lines.forEach(([a, b], j) => { body += text(F.inter, a, { size: 12, x: x0 + 20, y: y + 22 + j * 19, fill: P.muted }) + text(F.interSemi, b, { size: 12, x: x0 + cw - 20, y: y + 22 + j * 19, fill: P.fg, anchor: 'end' }); });
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs.join('')}</defs>${body}</svg>`;
  await writeFile(`${BOARDS}/conceito-2-ajuste-3.png`, png(svg, W));
  function add(o) { if (o.defs) defs.push(o.defs); body += o.body; }
}
// ---------- conferência do ajuste 4: o "e" girado, desgirado, é o mesmo "e" da variação 3 ----------
/** PNG RGBA mínimo (zlib do Node), para a imagem de diferença. */
function encodePng(w, h, rgba) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function rasterize(defs, body, box, ss) {
  const w = Math.round((box.x1 - box.x0) * ss), h = Math.round((box.y1 - box.y0) * ss);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${fmt(box.x0)} ${fmt(box.y0)} ${fmt(box.x1 - box.x0)} ${fmt(box.y1 - box.y0)}"><rect x="${fmt(box.x0)}" y="${fmt(box.y0)}" width="100%" height="100%" fill="${P.bg}"/><defs>${defs}</defs>${body}</svg>`;
  return { w, h, px: new Resvg(svg).render().pixels };
}
/** Números de um `d`, depois de normalizar H/V para L (rotateD com 0°). */
function dNums(d) { return rotateD(d, 0, 0, 0).match(/-?\d+(\.\d+)?/g).map(Number); }
/**
 * Compara o "e" girado (e) com o original (e.orig): (1) coordenadas — desgira os paths finais e mede o maior desvio
 * em relação aos paths da variação 3; (2) pixels — renderiza o girado dentro de um rotate() inverso e compara.
 */
function proveRigid(e, ss = 8) {
  const inv = (d) => rotateD(rotateD(d, 0, 0, 0, -e.ox, -e.oy), -e.deg, e.cx0, e.cy0);
  const dsO = [...e.orig.body.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]), dsR = [...e.body.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
  let coord = 0, flagsOk = true;
  dsO.forEach((d, i) => {
    const a = dNums(d), b = dNums(inv(dsR[i]));
    const ca = rotateD(d, 0, 0, 0).replace(/[^A-Z]/g, ''), cb = inv(dsR[i]).replace(/[^A-Z]/g, '');
    if (ca !== cb || a.length !== b.length) flagsOk = false;
    // no arco, o 3º número (rotação do eixo) muda com o giro, mas num círculo ele não tem efeito: ignora
    const skip = new Set(); let idx = 0; for (const [, c, args] of rotateD(d, 0, 0, 0).matchAll(/([MLAQZ])([^MLAQZ]*)/g)) { const n = args.trim() ? args.trim().split(/\s+/).length : 0; if (c === 'A') skip.add(idx + 2); idx += n; }
    a.forEach((v, j) => { if (!skip.has(j)) coord = Math.max(coord, Math.abs(v - b[j])); });
  });
  const sw = (b) => [...b.matchAll(/stroke-width="([^"]+)"/g)].map((m) => m[1]).join(',');
  const pad = e.ro * 1.2 + 2;
  const box = { x0: e.cx0 - pad, x1: e.cx0 + pad, y0: e.cy0 - pad, y1: e.cy0 + pad };
  const A = rasterize(e.orig.defs, e.orig.body, box, ss);
  const Bd = rasterize(e.defs, `<g transform="rotate(${fmt(-e.deg)} ${fmt(e.cx0)} ${fmt(e.cy0)}) translate(${fmt(-e.ox)} ${fmt(-e.oy)})">${e.body}</g>`, box, ss);
  const n = A.w * A.h, diff = new Uint8Array(n); let max = 0, sum = 0, over = 0, maxFlat = 0;
  for (let i = 0; i < n; i++) { let d = 0; for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(A.px[i * 4 + c] - Bd.px[i * 4 + c])); diff[i] = d; max = Math.max(max, d); sum += d; if (d > 32) over++; }
  // longe da borda (o pixel e os 8 vizinhos quase iguais no original): só o degradê
  for (let y = 1; y < A.h - 1; y++) for (let x = 1; x < A.w - 1; x++) {
    const i = y * A.w + x; let flat = true;
    for (let dy = -1; dy <= 1 && flat; dy++) for (let dx = -1; dx <= 1; dx++) { const j = i + dy * A.w + dx; let m = 0; for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(A.px[j * 4 + c] - A.px[i * 4 + c])); if (m > 6) { flat = false; break; } }
    if (flat) maxFlat = Math.max(maxFlat, diff[i]);
  }
  const img = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { const v = Math.min(255, diff[i] * 8); img[i * 4] = 14 + (v * 0.2) | 0; img[i * 4 + 1] = Math.min(255, 11 + v); img[i * 4 + 2] = Math.min(255, 26 + v); img[i * 4 + 3] = 255; }
  return { coord, flagsOk, strokes: [sw(e.orig.body), sw(e.body)], max, mean: sum / n, over, overPct: (over / n) * 100, maxFlat, n, box, diffPng: encodePng(A.w, A.h, img) };
}

/** Ajuste 4: a variação 3 só girada, em 3 ângulos, com a conferência de que a forma não mudou. */
async function adjustBoard4() {
  const W = 1600, H = 1500;
  const defs = []; let body = `<rect width="${W}" height="${H}" fill="${P.bg}"/>`;
  const add = (o) => { if (o.defs) defs.push(o.defs); body += o.body; };
  const nf = (v, d = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const deg = (r) => (r === 0 ? '0°' : `−${nf(Math.abs(r))}°`);
  body += text(F.display, 'Conceito 2 · Bis · ajuste 4: o mesmo "e", só girado', { size: 40, x: 64, y: 88, fill: P.fg, tracking: -0.02 });
  body += text(F.inter, 'O "e" da variação 3, aplicado no app, gira inteiro no sentido anti-horário: arco, barra, seta e degradê. Nada muda de forma, espessura ou tamanho; "encor" continua reto.', { size: 16, x: 64, y: 122, fill: P.muted });
  body += text(F.interSemi, 'Encore · logo · set/2026', { size: 13, x: W - 64, y: 60, fill: P.subtle, anchor: 'end' });

  // ---------- A. conferência ----------
  const top = 156, ah = 342;
  body += panel(64, top, W - 128, ah) + label(`Conferência · o "e" girado ${deg(GIRO)}, desgirado, sobre o original`, 88, top + 34);
  const Lr = lockup(2, 100, 'pv', REC, GIRO), pf = proveRigid(Lr.e);
  const ks = 2.9, bw = (pf.box.x1 - pf.box.x0) * ks;
  const tiles = [
    ['Original (variação 3)', { defs: Lr.e.orig.defs, body: Lr.e.orig.body }],
    [`Girado ${deg(GIRO)}`, { defs: Lr.e.defs, body: Lr.e.body }],
    ['Desgirado', { defs: Lr.e.defs, body: `<g transform="rotate(${fmt(-GIRO)} ${fmt(Lr.e.cx0)} ${fmt(Lr.e.cy0)}) translate(${fmt(-Lr.e.ox)} ${fmt(-Lr.e.oy)})">${Lr.e.body}</g>` }],
  ];
  tiles.forEach(([name, o], i) => {
    const x = 88 + i * (bw + 16), y = top + 58;
    const png1 = dataUri('image/png', png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(pf.box.x0)} ${fmt(pf.box.y0)} ${fmt(pf.box.x1 - pf.box.x0)} ${fmt(pf.box.y1 - pf.box.y0)}"><rect x="${fmt(pf.box.x0)}" y="${fmt(pf.box.y0)}" width="100%" height="100%" fill="${P.bg}"/><defs>${o.defs}</defs>${o.body}</svg>`, Math.round(bw * 2)));
    body += `<image href="${png1}" x="${fmt(x)}" y="${y}" width="${fmt(bw)}" height="${fmt(bw)}"/><rect x="${fmt(x)}" y="${y}" width="${fmt(bw)}" height="${fmt(bw)}" rx="10" fill="none" stroke="${P.line}"/>`;
    body += text(F.interSemi, name, { size: 13, x: x, y: y + bw + 22, fill: P.fg });
  });
  {
    const x = 88 + 3 * (bw + 16), y = top + 58;
    body += `<image href="${dataUri('image/png', pf.diffPng)}" x="${fmt(x)}" y="${y}" width="${fmt(bw)}" height="${fmt(bw)}"/><rect x="${fmt(x)}" y="${y}" width="${fmt(bw)}" height="${fmt(bw)}" rx="10" fill="none" stroke="${P.line}"/>`;
    body += text(F.interSemi, 'Diferença ×8', { size: 13, x, y: y + bw + 22, fill: P.fg });
    body += text(F.inter, 'preto = igual; só o contorno aparece', { size: 12, x, y: y + bw + 40, fill: P.subtle });
  }
  body += text(F.inter, 'O desgirado é o arquivo girado com um rotate() inverso aplicado na renderização.', { size: 12, x: 88, y: top + 58 + bw + 40, fill: P.subtle });
  // tabela das provas
  const tx = 88 + 4 * (bw + 16) + 16, ty = top + 70;
  const rows = [['', 'coord. máx.', 'pixel máx.', 'média', 'pixels > 32/255']];
  for (const r of GIROS) {
    const a = proveRigid(lockup(2, 100, 'pl', REC, r).e), b = proveRigid(bisTile({ k: 180 / 64, id: 'pi', full: true, rot: r }).e, 3);
    rows.push([`lockup ${deg(r)}`, nf(a.coord, 3), `${a.max}/255`, nf(a.mean, 2), `${nf(a.overPct, 3)}%`]);
    rows.push([`ícone 180 ${deg(r)}`, nf(b.coord, 3), `${b.max}/255`, nf(b.mean, 2), `${nf(b.overPct, 3)}%`]);
  }
  const colx = [tx, tx + 140, tx + 232, tx + 316, tx + 384];
  rows.forEach((r, i) => {
    const y = ty + i * 24;
    if (i === 0) { r.forEach((c, j) => { if (c) body += text(F.interBold, c.toLocaleUpperCase('pt-BR'), { size: 10, x: colx[j], y, fill: P.cyan, tracking: 0.08 }); }); return; }
    body += `<rect x="${tx}" y="${y - 16}" width="${W - 88 - tx}" height="1" fill="${P.line}"/>`;
    r.forEach((c, j) => { body += text(j ? F.interSemi : F.inter, c, { size: 13, x: colx[j], y, fill: j ? P.fg : P.muted }); });
  });
  body += para(F.inter, `Coordenada máxima: maior desvio entre os paths finais desgirados e os da variação 3, em unidades de corpo 100 (vem só do arredondamento em 2 casas). Pixel: renderização a 8× (ícone a 3×) do desgirado contra o original. A diferença fica só no contorno, pelo antialiasing; longe da borda é ${pf.maxFlat}/255. Raio, stroke-width (${pf.strokes[0]} → ${pf.strokes[1]}), seta e degradê são os mesmos.`, { size: 12, x: tx, y: ty + rows.length * 24 + 4, lh: 17, maxW: W - 88 - tx, fill: P.subtle });

  // ---------- B. colunas: atual + 3 ângulos ----------
  const cols = [
    { v: 'v3', rot: 0, title: 'Atual', note: 'variação 3, reta, aplicada no app' },
    ...GIROS.map((r) => ({ v: REC, rot: r, title: deg(r), note: r === -8 ? 'sutil: quase reto' : r === -12 ? 'giro claro, sem tombar' : 'o mais dinâmico' })),
  ];
  const cw = 353, gapc = 16, cTop = top + ah + 28, ch = H - cTop - 40;
  for (const [i, col] of cols.entries()) {
    const x0 = 64 + i * (cw + gapc), rec = col.v === REC && col.rot === GIRO, old = col.v === 'v3', id = `k${i}`;
    body += panel(x0, cTop, cw, ch);
    if (rec) body += `<rect x="${x0}" y="${cTop}" width="${cw}" height="${ch}" rx="20" fill="none" stroke="${P.yellow}" stroke-width="2"/><rect x="${x0 + cw - 118}" y="${cTop - 12}" width="106" height="24" rx="12" fill="${P.yellow}"/>` + text(F.interBold, 'RECOMENDADA', { size: 11, x: x0 + cw - 65, y: cTop + 4, fill: P.bg, anchor: 'middle', tracking: 0.08 });
    body += text(F.display, col.title, { size: 30, x: x0 + 20, y: cTop + 46, fill: old ? P.subtle : P.fg, tracking: -0.02 });
    body += text(F.inter, col.note, { size: 13, x: x0 + (old ? 110 : 100), y: cTop + 42, fill: P.subtle });
    let y = cTop + 76;
    const L = lockup(2, 100, `${id}l`, col.v, col.rot), sL = (cw - 40) / L.w;
    add(place(L, x0 + 20, y + 8, sL));
    y += 8 + L.h * sL + 30;
    body += label('Cabeçalho · 22 px (12 px de altura)', x0 + 20, y);
    const s = 0.22, hw = Math.ceil(L.w * s) + 12, hh = 28;
    const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${hw}" height="${hh}" viewBox="0 0 ${hw} ${hh}"><defs>${L.defs}</defs><rect width="${hw}" height="${hh}" fill="${P.bg}"/><g transform="translate(6 ${fmt((hh - L.h * s) / 2)}) scale(${s})">${L.body}</g></svg>`;
    const hp = dataUri('image/png', png(head, hw));
    body += `<image href="${hp}" x="${x0 + 20}" y="${y + 14}" width="${hw}" height="${hh}"/><image href="${hp}" x="${x0 + 20}" y="${y + 50}" width="${hw * 3}" height="${hh * 3}" image-rendering="optimizeSpeed"/>`;
    y += 50 + hh * 3 + 30;
    body += label('Símbolo 32 px · favicon 16 px', x0 + 20, y);
    const s32 = dataUri('image/png', png(svgDoc(symbol(2, 64, `${id}f`, false, { v: col.v, rot: col.rot }), 'f'), 32));
    const s16 = dataUri('image/png', png(svgDoc(symbol(2, 64, `${id}g`, false, { v: col.v, rot: col.rot, small: true }), 'f'), 16));
    body += `<image href="${s32}" x="${x0 + 20}" y="${y + 18}" width="32" height="32"/><image href="${s16}" x="${x0 + 64}" y="${y + 26}" width="16" height="16"/>`;
    body += `<image href="${s32}" x="${x0 + 100}" y="${y + 18}" width="96" height="96" image-rendering="optimizeSpeed"/><image href="${s16}" x="${x0 + 212}" y="${y + 18}" width="96" height="96" image-rendering="optimizeSpeed"/>`;
    body += text(F.inter, '32 · 16 reais', { size: 11, x: x0 + 20, y: y + 72, fill: P.subtle });
    body += text(F.inter, '32 ×3', { size: 11, x: x0 + 148, y: y + 130, fill: P.subtle, anchor: 'middle' }) + text(F.inter, '16 ×6, sem seta', { size: 11, x: x0 + 260, y: y + 130, fill: P.subtle, anchor: 'middle' });
    y += 150;
    body += label('Ícone de app · 180 px', x0 + 20, y);
    const icon = dataUri('image/png', png(svgDoc(symbol(2, 180, `${id}i`, true, { v: col.v, rot: col.rot }), 'i'), 180));
    body += `<clipPath id="${id}ic"><rect x="${x0 + (cw - 180) / 2}" y="${y + 16}" width="180" height="180" rx="40"/></clipPath><image href="${icon}" x="${x0 + (cw - 180) / 2}" y="${y + 16}" width="180" height="180" clip-path="url(#${id}ic)"/>`;
    y += 16 + 180 + 30;
    body += label('Rodapé do card story · 60%', x0 + 20, y);
    const card = dataUri('image/png', await cardPng(CONCEPTS[1], 648, { v: col.v, rot: col.rot }));
    const cx = x0 + 20, cyy = y + 16, cwid = cw - 40, chh = 76;
    body += `<clipPath id="${id}cc"><rect x="${cx}" y="${cyy}" width="${cwid}" height="${chh}" rx="10"/></clipPath><image href="${card}" x="${fmt(cx - 12)}" y="${fmt(cyy - 925)}" width="648" height="1152" clip-path="url(#${id}cc)"/>`;
    y += 16 + chh + 30;
    body += label('Medidas', x0 + 20, y);
    const t32 = bisTile({ k: 0.5, id: 'm', v: col.v, rot: col.rot }).e, t180 = bisTile({ k: 180 / 64, id: 'm', v: col.v, rot: col.rot }).e;
    const g22 = L.e.gap * 0.22;
    const off = old ? [0, 0] : [t180.ox / (180 / 64), t180.oy / (180 / 64)];
    const spc = old ? lockup(2, 100, 'm', REC, 0).space : L.space;
    const lines = [
      ['respiro 22 / 32 / 180 px', [g22, t32.gap, t180.gap].map((v) => nf(v)).join(' / ')],
      ['r–e: menor distância', `${nf(spc.min, 2)}${!old && L.dx ? ` (afastado ${nf(L.dx, 2)})` : ''}`],
      ['lockup (corpo 100)', `${nf(L.w, 2)} × ${nf(L.h, 1)}`],
      ['translação na placa (grade 64)', old ? '—' : `${nf(off[0], 2)} , ${nf(off[1], 2)}`],
    ];
    lines.forEach(([a, b], j) => { body += text(F.inter, a, { size: 12, x: x0 + 20, y: y + 22 + j * 19, fill: P.muted }) + text(F.interSemi, b, { size: 12, x: x0 + cw - 20, y: y + 22 + j * 19, fill: P.fg, anchor: 'end' }); });
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs.join('')}</defs>${body}</svg>`;
  await writeFile(`${BOARDS}/conceito-2-ajuste-4.png`, png(svg, W));
}
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
    const x0 = 64 + i * (cw + gapc), top = 156, rec = c.v === 'v3', old = c.n <= 2;
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
// a prancha do ajuste 2 (conceito-2-ajuste-2.png) também fica como registro: `node build-logo.mjs ajuste2`
if (process.argv[2] === 'ajuste2') await adjustBoard2();
// a prancha do ajuste 3 (reprovado) fica como registro: `node build-logo.mjs ajuste3`
if (process.argv[2] === 'ajuste3') await adjustBoard3();
if (!ONLY || ONLY === 2) await adjustBoard4();
console.log('ok: SVGs em', HERE, '· pranchas em', BOARDS);
