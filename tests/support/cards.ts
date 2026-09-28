import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { CardData } from '@/features/cards/model';
import type { CardFont } from '@/features/cards/render';
import { FONT_FILES } from '@/features/cards/templates';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Fontes TTF de `public/fonts/ttf`, como o navegador recebe. */
export function loadCardFonts(): CardFont[] {
  return FONT_FILES.map((font) => {
    const buffer = readFileSync(`${ROOT}public/fonts/ttf/${font.file}`);
    return {
      name: font.name,
      weight: font.weight,
      data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };
  });
}

export function loadResvgWasm(): Buffer {
  return readFileSync(`${ROOT}node_modules/@resvg/resvg-wasm/index_bg.wasm`);
}

export function spotifyLogoDataUrl(): string {
  const svg = readFileSync(`${ROOT}public/brand/spotify-full-logo-white.svg`);
  return `data:image/svg+xml;base64,${svg.toString('base64')}`;
}

/** Capa fictícia (SVG quadrado) para o card do Conectar. */
export const FAKE_COVER = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3DE0FF"/><stop offset="1" stop-color="#7A2BFF"/></linearGradient></defs><rect width="640" height="640" fill="url(#g)"/><circle cx="320" cy="320" r="170" fill="none" stroke="#fff" stroke-width="18"/></svg>',
).toString('base64')}`;

export const CARD_STRINGS: CardData['t'] = {
  topArtist: 'Artista nº 1',
  artists: 'Top artistas',
  tracks: 'Top músicas',
  presents: 'Encore apresenta',
  festOf: 'Festival',
  festDefault: 'Encore Fest',
  demoTag: 'DEMO',
  uploadFooter: 'Do seu histórico do Spotify · processado no seu aparelho',
  demoFooter: 'Modo demo · artistas e músicas fictícios',
};

export const ARTISTS = [
  'Lua Vermelha',
  'Os Ventiladores',
  'Marina Sal',
  'DJ Caju',
  'Neon Tropical',
  'Banda Farol',
  'Clara Nuvem',
  'Tiago Maré',
  'Coletivo Samambaia',
  'Ana Trovão',
  'Rádio Pitanga',
  'Los Pelicanos',
  'Júlia Estrela',
  'Quarteto Cometa',
  'MC Brisa',
  'Vitória Régia',
  'Duo Aurora',
  'Felipe Lagoa',
  'Orquestra de Garagem',
  'Selvagem Sutil',
  'Nina Bossa',
  'Os Carambolas',
  'Kiko Veludo',
  'Sereia Elétrica',
  'Pedro Mangue',
];

export const TRACKS = [
  { name: 'Céu de Neon', artist: 'Lua Vermelha' },
  { name: 'Ventilador no Talo', artist: 'Os Ventiladores' },
  { name: 'Maré Alta (ao vivo)', artist: 'Tiago Maré' },
  { name: 'Caju Maduro', artist: 'DJ Caju' },
  { name: 'Farol Aceso às Três da Manhã', artist: 'Banda Farol' },
];

export const UPLOAD_DATA: CardData = {
  locale: 'pt-BR',
  t: CARD_STRINGS,
  siteLabel: 'encore.app',
  periodLabel: '2024',
  topArtists: ARTISTS,
  topTracks: TRACKS,
  heroSub: '1.284 plays · fã desde mar. 2019',
  stat: { value: '48.213', label: 'minutos de música em 2024' },
  stats: ['48.213 min', '9.214 plays', '612 artistas'],
  trackStats: ['9.214 plays', '1.873 músicas', '48.213 min'],
  mixStats: ['48.213 min', '9.214 plays', '612 artistas'],
};

export const CONNECT_DATA: CardData = {
  ...UPLOAD_DATA,
  periodLabel: 'Últimos 6 meses',
  heroSub: 'em alta: subiu 3 posições',
  stat: { value: '214', label: 'músicas curtidas de Lua Vermelha' },
  stats: ['Top 25 artistas', 'últimos 6 meses'],
  trackStats: ['Top 5 músicas', 'últimos 6 meses'],
  mixStats: [],
  cover: FAKE_COVER,
  posterName: 'Enzo',
};

/** Top músicas / Mix (Iteração 8b): 10 músicas com nomes longos e "ruído de catálogo" reais. */
export const TRACKS_10 = [
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

export const UPLOAD_8B: CardData = { ...UPLOAD_DATA, topTracks: TRACKS_10 };

/** Conectar: artistas da faixa juntados por ", ", como vem da API; sem capa nos cartazes. */
export const CONNECT_8B: CardData = {
  ...CONNECT_DATA,
  cover: undefined,
  topTracks: TRACKS_10.map((track, i) =>
    i === 1
      ? { ...track, artist: 'Lua Vermelha, MC Brisa' }
      : i === 5
        ? { ...track, artist: 'DJ Caju, Neon Tropical, Ana Trovão' }
        : track,
  ),
  trackStats: ['Top 10 músicas', 'últimos 6 meses'],
  mixStats: [],
};

/** Pior caso: título longo, nº 1 de 84 grafemas, cirílico, `[feat. …]` e "- 2011 Remaster". */
export const STRESS_8B: CardData = {
  ...UPLOAD_8B,
  posterName: 'Maria Eduarda',
  topArtists: [
    'Orquestra Sinfônica de Garagem do Bairro Alto',
    'Ñandú & Los Çãopeões',
    'Жанна Агузарова',
    ...ARTISTS.slice(3),
  ],
  topTracks: [
    {
      name: 'Uma Música Com Título Realmente Muito Comprido Que Não Acaba Nunca (Remix Estendido)',
      artist: 'Orquestra Sinfônica de Garagem do Bairro Alto',
    },
    { name: 'Звезда по имени Солнце', artist: 'Кино' },
    {
      name: 'Ñandú Bailando Sobre o Çãopeão [feat. Los Pelicanos & Quarteto Cometa]',
      artist: 'Ñandú & Los Çãopeões',
    },
    ...TRACKS_10.slice(3, 9),
    {
      name: 'Coração de Estudante Que Mora Longe da Família - 2011 Remaster',
      artist: 'Vitória Régia e Os Irmãos da Lua Cheia',
    },
  ],
};

/** Período com poucos dados: 2 artistas, 4 músicas (os blocos vazios somem). */
export const SHORT_8B: CardData = {
  ...UPLOAD_8B,
  periodLabel: 'Mar. 2024',
  topArtists: ARTISTS.slice(0, 2),
  topTracks: TRACKS_10.slice(0, 4),
  trackStats: ['38 plays', '4 músicas', '112 min'],
  mixStats: ['112 min', '38 plays', '2 artistas'],
};
