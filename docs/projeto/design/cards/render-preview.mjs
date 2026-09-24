import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { render, FONT_FILES } from './templates.mjs';

// Protótipo: gera as prévias PNG dos templates. Rodar de uma pasta com satori@0.33.5 e @resvg/resvg-wasm@2.6.2 instalados:
//   node docs/projeto/design/cards/render-preview.mjs [pasta-de-saída]
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, ''); // docs/projeto/design
const OUT = process.argv[2] || `${ROOT}/cards/preview`;
await mkdir(OUT, { recursive: true });
await initWasm(await readFile(new URL(import.meta.resolve('@resvg/resvg-wasm/index_bg.wasm'))));
const fonts = await Promise.all(FONT_FILES.map(async (f) => ({ name: f.name, weight: f.weight, style: 'normal', data: await readFile(`${ROOT}/../../../public/fonts/ttf/${f.file}`) })));

const t = {
  dataFrom: 'DADOS DE', uploadFooter: 'Do seu histórico do Spotify · processado no seu aparelho',
  demoFooter: 'Modo demo · artistas e músicas fictícios', demoTag: 'DEMO',
  topArtist: 'Artista nº 1', artists: 'Top artistas', tracks: 'Top músicas',
  presents: 'Encore apresenta', festOf: 'Festival', festDefault: 'Encore Fest',
};
const artists = ['Lua Vermelha', 'Os Ventiladores', 'Marina Sal', 'DJ Caju', 'Neon Tropical', 'Banda Farol', 'Clara Nuvem', 'Tiago Maré', 'Coletivo Samambaia', 'Ana Trovão', 'Rádio Pitanga', 'Los Pelicanos', 'Júlia Estrela', 'Quarteto Cometa', 'MC Brisa', 'Vitória Régia', 'Duo Aurora', 'Felipe Lagoa', 'Orquestra de Garagem', 'Selvagem Sutil', 'Nina Bossa', 'Os Carambolas', 'Kiko Veludo', 'Sereia Elétrica', 'Pedro Mangue'];
const tracks = [
  { name: 'Céu de Neon', artist: 'Lua Vermelha' }, { name: 'Ventilador no Talo', artist: 'Os Ventiladores' },
  { name: 'Maré Alta (ao vivo)', artist: 'Tiago Maré' }, { name: 'Caju Maduro', artist: 'DJ Caju' },
  { name: 'Farol Aceso às Três da Manhã', artist: 'Banda Farol' },
];
const cover = 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3DE0FF"/><stop offset="1" stop-color="#7A2BFF"/></linearGradient></defs><rect width="640" height="640" fill="url(#g)"/><circle cx="320" cy="320" r="170" fill="none" stroke="#fff" stroke-width="18"/><text x="320" y="600" font-size="36" text-anchor="middle" fill="#fff" font-family="sans-serif">capa ficticia</text></svg>`).toString('base64');

const base = { locale: 'pt-BR', t, siteLabel: 'encore.app', topArtists: artists, topTracks: tracks };
const upload = { ...base, periodLabel: '2024', heroSub: '1.284 plays · fã desde mar/2019', stat: { value: '48.213', label: 'minutos de música em 2024' }, stats: ['48.213 min', '9.214 plays', '612 artistas'] };
const connect = { ...base, periodLabel: 'Últimos 6 meses', heroSub: 'em alta: subiu 3 posições', stat: { value: '214', label: 'músicas curtidas de Lua Vermelha' }, stats: ['Top 25 artistas', 'últimos 6 meses'], cover, posterName: 'Enzo' };
const demo = { ...upload };
const stress = { ...upload, topArtists: ['Orquestra Sinfônica de Garagem do Bairro Alto', 'Ñandú & Los Çãopeões', 'Жанна Агузарова', ...artists.slice(3)], topTracks: [{ name: 'Uma Música Com Título Realmente Muito Comprido (Remix Estendido)', artist: 'Coletivo Com Nome Enorme Também' }, ...tracks.slice(1)], posterName: 'Maria Eduarda Albuquerque' };

const jobs = [
  ['festival', 'story', 'upload', upload], ['festival', 'story', 'connect', connect], ['festival', 'square', 'demo', demo],
  ['festival', 'square', 'upload', upload],
  ['basic', 'story', 'upload', upload], ['basic', 'story', 'connect', connect], ['basic', 'square', 'upload', upload], ['basic', 'square', 'connect', connect],
  ['festival', 'story', 'upload', stress, 'stress'], ['basic', 'story', 'upload', stress, 'stress'],
];
for (const [tpl, fmt, mode, data, tag] of jobs) {
  const W = 1080, H = fmt === 'story' ? 1920 : 1080;
  const t0 = performance.now();
  const svg = await satori(render(tpl, fmt, mode, data), { width: W, height: H, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  const name = `${tpl}-${fmt}-${mode}${tag ? '-' + tag : ''}.png`;
  await writeFile(`${OUT}/${name}`, png);
  console.log(name, (png.length / 1024).toFixed(0) + ' KB', (performance.now() - t0).toFixed(0) + ' ms');
}
