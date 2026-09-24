/**
 * Catálogo **fictício** do modo Demo (ADR 8): nomes de artistas, álbuns e faixas inventados,
 * em PT e EN. Nenhum metadado vem do Spotify.
 */
export type DemoLang = 'pt' | 'en';

export const DEMO_ARTISTS: readonly { name: string; lang: DemoLang; genres: readonly string[] }[] =
  [
    { name: 'Capivara Cósmica', lang: 'pt', genres: ['indie brasileiro', 'psicodelia'] },
    { name: 'Lua de Vinil', lang: 'pt', genres: ['nova mpb', 'mpb'] },
    { name: 'Maré de Fevereiro', lang: 'pt', genres: ['bossa nova', 'mpb'] },
    { name: 'Os Faróis de Néon', lang: 'pt', genres: ['rock brasileiro', 'synthwave'] },
    { name: 'Varanda Elétrica', lang: 'pt', genres: ['indie brasileiro', 'dream pop'] },
    { name: 'Banda Garoa Fina', lang: 'pt', genres: ['folk', 'nova mpb'] },
    { name: 'Quintal Sonoro', lang: 'pt', genres: ['samba', 'samba-rock'] },
    { name: 'Duda Ventania', lang: 'pt', genres: ['pop brasileiro', 'electropop'] },
    { name: 'Serra Azul Trio', lang: 'pt', genres: ['jazz brasileiro', 'bossa nova'] },
    { name: 'Coletivo Relâmpago', lang: 'pt', genres: ['forró', 'indie brasileiro'] },
    { name: 'Marina Sereno', lang: 'pt', genres: ['nova mpb', 'folk'] },
    { name: 'Os Cometas de Papel', lang: 'pt', genres: ['rock brasileiro', 'indie rock'] },
    { name: 'Ladeira Quarenta e Dois', lang: 'pt', genres: ['samba-rock', 'funk brasileiro'] },
    { name: 'Tião Aurora e a Orquestra de Bolso', lang: 'pt', genres: ['mpb', 'jazz brasileiro'] },
    { name: 'Neblina Tropical', lang: 'pt', genres: ['chillwave', 'indie brasileiro'] },
    { name: 'Jaque Saudade', lang: 'pt', genres: ['sertanejo indie', 'folk'] },
    { name: 'Asfalto Morno', lang: 'pt', genres: ['post-punk', 'rock brasileiro'] },
    { name: 'Pipoca Sideral', lang: 'pt', genres: ['electropop', 'pop brasileiro'] },
    { name: 'Neon Harbor Club', lang: 'en', genres: ['synthwave', 'electropop'] },
    { name: 'The Paper Satellites', lang: 'en', genres: ['indie pop', 'dream pop'] },
    { name: 'Velvet Static Choir', lang: 'en', genres: ['shoegaze', 'dream pop'] },
    { name: 'Midnight Cartographers', lang: 'en', genres: ['indie rock', 'post-punk'] },
    { name: 'Lanterns for Friendly Ghosts', lang: 'en', genres: ['folk', 'alt-country'] },
    { name: 'Juniper and the Loose Wires', lang: 'en', genres: ['alt-country', 'indie rock'] },
    { name: 'Slow Orbit Mechanics', lang: 'en', genres: ['lo-fi', 'chillwave'] },
    { name: 'Postcard Weather', lang: 'en', genres: ['indie pop', 'lo-fi'] },
    { name: 'The Hollow Tidewater', lang: 'en', genres: ['shoegaze', 'post-punk'] },
    { name: 'Golden Afterglow Parade', lang: 'en', genres: ['electropop', 'indie pop'] },
    { name: 'Riverbed Radio Hour', lang: 'en', genres: ['folk', 'lo-fi'] },
    { name: 'Headlight Hymnal', lang: 'en', genres: ['indie rock', 'alt-country'] },
    { name: 'Mia Northfield-Okafor', lang: 'en', genres: ['indie pop', 'electropop'] },
    { name: 'The Quiet Voltage', lang: 'en', genres: ['synthwave', 'post-punk'] },
    { name: 'Satellite Sweetheart Society', lang: 'en', genres: ['dream pop', 'indie pop'] },
    { name: 'Amber Kite Assembly', lang: 'en', genres: ['lo-fi', 'jazz fusion'] },
    { name: 'Late Bloom Cooperative', lang: 'en', genres: ['folk', 'indie pop'] },
    { name: 'Cassette Lighthouse', lang: 'en', genres: ['chillwave', 'synthwave'] },
  ];

// prettier-ignore
const PT_NOUNS = [
  'Céu', 'Maré', 'Farol', 'Vinil', 'Asfalto', 'Varanda', 'Neblina', 'Cometa', 'Quintal',
  'Relâmpago', 'Ladeira', 'Serra', 'Saudade', 'Ventania', 'Garoa', 'Sereno', 'Aurora',
  'Poeira', 'Janela', 'Estrada', 'Domingo', 'Rádio', 'Travessia', 'Sol de Inverno',
];
// prettier-ignore
const PT_ADJECTIVES = [
  'Azul', 'Leve', 'Veloz', 'Feliz', 'Gentil', 'Solar', 'Lunar', 'Febril', 'Distante',
  'Urgente', 'Constante', 'Brilhante', 'Imortal', 'Tropical', 'Sutil',
];
const PT_PATTERNS: readonly ((n: string, a: string, m: string) => string)[] = [
  (n, a) => `${n} ${a}`,
  (n) => `Canção de ${n}`,
  (n, _a, m) => `${n} e ${m}`,
  (n) => `Antes de ${n}`,
  (_n, a) => `${a} Demais`,
  (n) => `Três da Manhã em ${n}`,
];

// prettier-ignore
const EN_NOUNS = [
  'Signal', 'Harbor', 'Satellite', 'Echo', 'Static', 'Lanterns', 'Afterglow', 'Postcard',
  'Riverbed', 'Headlights', 'Orbit', 'Velvet', 'Wires', 'Tides', 'Kitchen Light', 'Paper Moon',
  'Weather', 'Parade', 'Motel Pool', 'Northbound', 'Undertow', 'Bicycle', 'Telegram',
];
// prettier-ignore
const EN_ADJECTIVES = [
  'Electric', 'Quiet', 'Golden', 'Neon', 'Slow', 'Distant', 'Wild', 'Late', 'Hollow',
  'Bright', 'Borrowed', 'Tender', 'Crooked', 'Sleepless', 'Faraway',
];
const EN_PATTERNS: readonly ((n: string, a: string, m: string) => string)[] = [
  (n, a) => `${a} ${n}`,
  (n) => `Letters to the ${n}`,
  (n, _a, m) => `${n} & ${m}`,
  (n, a) => `${a} Like a ${n}`,
  (n) => `After the ${n}`,
  (n, a) => `${n} (${a} Mix)`,
];

export function demoTitle(lang: DemoLang, pick: <T>(items: readonly T[]) => T): string {
  const [nouns, adjectives, patterns] =
    lang === 'pt' ? [PT_NOUNS, PT_ADJECTIVES, PT_PATTERNS] : [EN_NOUNS, EN_ADJECTIVES, EN_PATTERNS];
  return pick(patterns)(pick(nouns), pick(adjectives), pick(nouns));
}

export function demoAlbumTitle(lang: DemoLang, pick: <T>(items: readonly T[]) => T): string {
  return lang === 'pt'
    ? `${pick(PT_NOUNS)} ${pick(PT_ADJECTIVES)}`
    : `${pick(EN_ADJECTIVES)} ${pick(EN_NOUNS)}`;
}
