import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { render, FONT_FILES } from './templates.mjs';

// Protótipo: gera as prévias PNG dos templates. Rodar de uma pasta com satori@0.33.5 e @resvg/resvg-wasm@2.6.2 instalados:
//   node docs/projeto/design/cards/render-preview.mjs [pasta-de-saída] [--only=tracks,mix]
// (da raiz do repositório o Node já acha o satori e o resvg em node_modules)
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, ''); // docs/projeto/design
const args = process.argv.slice(2);
const OUT = args.find((a) => !a.startsWith('--')) || `${ROOT}/cards/preview`;
const ONLY = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
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
// Top músicas / Mix (Iteração 8b): 10 músicas com nomes longos e "ruído de catálogo" realistas
const tracks10 = [
  { name: 'Farol Aceso às Três da Manhã', artist: 'Banda Farol' },
  { name: 'Céu de Neon (feat. MC Brisa)', artist: 'Lua Vermelha' },
  { name: 'Ventilador no Talo - Remasterizado 2019', artist: 'Os Ventiladores' },
  { name: 'Maré Alta (Ao Vivo no Circo Voador)', artist: 'Tiago Maré' },
  { name: 'Saudade Que Não Cabe no Peito', artist: 'Marina Sal' },
  { name: 'Caju Maduro', artist: 'DJ Caju' },
  { name: 'Carta Para Quem Ficou (Versão Acústica)', artist: 'Clara Nuvem' },
  { name: 'Dança do Pelicano - Radio Edit', artist: 'Los Pelicanos' },
  { name: 'Sereia Elétrica', artist: 'Sereia Elétrica' },
  { name: 'Menina do Mangue, Moça da Maré', artist: 'Coletivo Samambaia' },
];
const trackStats = ['9.214 plays', '1.873 músicas', '48.213 min'];
const spotifyLogo = 'data:image/svg+xml;base64,' + (await readFile(`${ROOT}/../../../public/brand/spotify-full-logo-white.svg`)).toString('base64');
const cover = 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3DE0FF"/><stop offset="1" stop-color="#7A2BFF"/></linearGradient></defs><rect width="640" height="640" fill="url(#g)"/><circle cx="320" cy="320" r="170" fill="none" stroke="#fff" stroke-width="18"/><text x="320" y="600" font-size="36" text-anchor="middle" fill="#fff" font-family="sans-serif">capa ficticia</text></svg>`).toString('base64');

const base = { locale: 'pt-BR', t, siteLabel: 'encore.app', topArtists: artists, topTracks: tracks };
const upload = { ...base, periodLabel: '2024', heroSub: '1.284 plays · fã desde mar/2019', stat: { value: '48.213', label: 'minutos de música em 2024' }, stats: ['48.213 min', '9.214 plays', '612 artistas'] };
const connect = { ...base, periodLabel: 'Últimos 6 meses', heroSub: 'em alta: subiu 3 posições', stat: { value: '214', label: 'músicas curtidas de Lua Vermelha' }, stats: ['Top 25 artistas', 'últimos 6 meses'], cover, posterName: 'Enzo' };
const demo = { ...upload };
const stress = { ...upload, topArtists: ['Orquestra Sinfônica de Garagem do Bairro Alto', 'Ñandú & Los Çãopeões', 'Жанна Агузарова', ...artists.slice(3)], topTracks: [{ name: 'Uma Música Com Título Realmente Muito Comprido (Remix Estendido)', artist: 'Coletivo Com Nome Enorme Também' }, ...tracks.slice(1)], posterName: 'Maria Eduarda Albuquerque' };

// ---- Top músicas / Mix ----
const tEn = {
  ...t, uploadFooter: 'From your Spotify history · processed on your device', demoFooter: 'Demo mode · made-up artists and tracks',
  topArtist: 'No. 1 artist', artists: 'Top artists', tracks: 'Top tracks', presents: 'Encore presents',
};
const up8 = { ...upload, topTracks: tracks10, trackStats, mixStats: upload.stats };
const demo8 = { ...up8 };
// Conectar: artistas da faixa juntados por ", " (como vem da API); sem capa nos cartazes; logo oficial no rodapé
const tracksApi = tracks10.map((x, i) => (i === 1 ? { ...x, artist: 'Lua Vermelha, MC Brisa' } : i === 5 ? { ...x, artist: 'DJ Caju, Neon Tropical, Ana Trovão' } : x));
const connect8 = { ...connect, cover: undefined, spotifyLogo, topTracks: tracksApi, trackStats: ['Top 10 músicas', 'últimos 6 meses'], mixStats: [] };
const connect8En = { ...connect8, locale: 'en', t: tEn, periodLabel: 'Last 6 months', posterName: undefined, trackStats: ['Top 10 tracks', 'last 6 months'] };
const stress8 = {
  ...up8, posterName: 'Maria Eduarda Albuquerque',
  topArtists: ['Orquestra Sinfônica de Garagem do Bairro Alto', 'Ñandú & Los Çãopeões', 'Жанна Агузарова', ...artists.slice(3)],
  topTracks: [
    { name: 'Uma Música Com Título Realmente Muito Comprido Que Não Acaba Nunca (Remix Estendido)', artist: 'Orquestra Sinfônica de Garagem do Bairro Alto' },
    { name: 'Звезда по имени Солнце', artist: 'Кино' },
    { name: 'Ñandú Bailando Sobre o Çãopeão [feat. Los Pelicanos & Quarteto Cometa]', artist: 'Ñandú & Los Çãopeões' },
    ...tracks10.slice(3, 9),
    { name: 'Coração de Estudante Que Mora Longe da Família - 2011 Remaster', artist: 'Vitória Régia e Os Irmãos da Lua Cheia' },
  ],
};
// Período com poucos dados: 2 artistas, 4 músicas (os blocos vazios somem)
const short8 = { ...up8, periodLabel: 'Mar. 2024', topArtists: artists.slice(0, 2), topTracks: tracks10.slice(0, 4), trackStats: ['38 plays', '4 músicas', '112 min'], mixStats: ['112 min', '38 plays', '2 artistas'] };

const jobs = [
  ['festival', 'story', 'upload', upload], ['festival', 'story', 'connect', connect], ['festival', 'square', 'demo', demo],
  ['festival', 'square', 'upload', upload],
  ['basic', 'story', 'upload', upload], ['basic', 'story', 'connect', connect], ['basic', 'square', 'upload', upload], ['basic', 'square', 'connect', connect],
  ['festival', 'story', 'upload', stress, 'stress'], ['basic', 'story', 'upload', stress, 'stress'],
  // Iteração 8b — Top músicas e Mix
  ['tracks', 'story', 'upload', up8], ['tracks', 'square', 'upload', up8],
  ['tracks', 'story', 'connect', connect8], ['tracks', 'square', 'demo', demo8],
  ['tracks', 'story', 'upload', stress8, 'stress'], ['tracks', 'square', 'upload', stress8, 'stress'],
  ['tracks', 'square', 'upload', short8, 'short'],
  ['mix', 'story', 'upload', up8], ['mix', 'square', 'upload', up8],
  ['mix', 'story', 'demo', demo8], ['mix', 'square', 'connect', connect8],
  ['mix', 'story', 'connect', connect8En, 'en'],
  ['mix', 'story', 'upload', stress8, 'stress'], ['mix', 'square', 'upload', stress8, 'stress'],
];
for (const [tpl, fmt, mode, data, tag] of jobs.filter(([tpl]) => !ONLY || ONLY.includes(tpl))) {
  const W = 1080, H = fmt === 'story' ? 1920 : 1080;
  const t0 = performance.now();
  const svg = await satori(render(tpl, fmt, mode, data), { width: W, height: H, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  const name = `${tpl}-${fmt}-${mode}${tag ? '-' + tag : ''}.png`;
  await writeFile(`${OUT}/${name}`, png);
  console.log(name, (png.length / 1024).toFixed(0) + ' KB', (performance.now() - t0).toFixed(0) + ' ms');
}
