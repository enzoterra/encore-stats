/**
 * Gera as fixtures de teste do motor de upload em `tests/fixtures/` (07-estrategia-de-testes).
 * Tudo é sintético e determinístico: artistas e faixas inventados, IPs da faixa de documentação
 * (192.0.2.0/24, RFC 5737) e país "ZZ". Nenhum dado real de ninguém.
 *
 * Uso: `pnpm fixtures` (Node ≥ 22.18 executa TypeScript direto, sem build).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { strToU8, Zip, ZipDeflate, zipSync, type Zippable } from 'fflate';

/** Data "local" fixa: o fflate grava a data DOS a partir de campos locais, então é igual em qualquer fuso. */
const MTIME = new Date(2024, 0, 1, 12, 0, 0);
const HISTORY_DIR = 'Spotify Extended Streaming History';

type RawRecord = Record<string, string | number | boolean | null>;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function fakeId(random: () => number): string {
  let id = '';
  for (let i = 0; i < 22; i++) id += BASE62[Math.floor(random() * 62)];
  return id;
}

const FIXTURE_ARTISTS = [
  'Capivara Cósmica',
  'Neon Harbor Club',
  'Lua de Vinil',
  'The Paper Satellites',
  'Maré de Fevereiro',
  'Velvet Static Choir',
  'Os Faróis de Néon',
  'Midnight Cartographers',
];

const PLATFORMS_RAW = [
  'Android OS 13 API 33 (Fixture, Phone)',
  'iOS 17.1 (iPhone15,2)',
  'Windows 10 (10.0.19045; x64)',
  'web_player linux;chrome 120.0;desktop',
  'Partner android_tv Fixture;TV',
  'OS X 14.1 [arm 2]',
  'cast_to_device',
];

function isoSeconds(epochMs: number): string {
  return new Date(epochMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function baseRecord(epochMs: number, random: () => number): RawRecord {
  return {
    ts: isoSeconds(epochMs),
    platform: PLATFORMS_RAW[Math.floor(random() * PLATFORMS_RAW.length)]!,
    ms_played: 0,
    conn_country: 'ZZ',
    ip_addr: `192.0.2.${1 + Math.floor(random() * 250)}`,
    master_metadata_track_name: null,
    master_metadata_album_artist_name: null,
    master_metadata_album_album_name: null,
    spotify_track_uri: null,
    episode_name: null,
    episode_show_name: null,
    spotify_episode_uri: null,
    audiobook_title: null,
    audiobook_uri: null,
    audiobook_chapter_uri: null,
    audiobook_chapter_title: null,
    reason_start: 'trackdone',
    reason_end: 'trackdone',
    shuffle: random() < 0.4,
    skipped: false,
    offline: false,
    offline_timestamp: epochMs,
    incognito_mode: false,
  };
}

export type SyntheticOptions = {
  count: number;
  seed: number;
  /** Epoch em ms do primeiro registro. */
  start: number;
  /** Faixas distintas (catálogo). */
  tracks?: number;
};

/**
 * Registros de música no formato real do export (mesmas chaves e tipos), com ~15% de pulos
 * curtos e alguns registros antigos com `skipped: null`.
 */
export function syntheticRecords(options: SyntheticOptions): RawRecord[] {
  const random = mulberry32(options.seed);
  const catalogSize = options.tracks ?? 400;
  const catalog = Array.from({ length: catalogSize }, (_, i) => {
    const artist = FIXTURE_ARTISTS[i % FIXTURE_ARTISTS.length]!;
    return {
      name: `Faixa ${i + 1} (${artist.split(' ')[0]})`,
      artist,
      album: `Álbum ${1 + (i % 5)} de ${artist}`,
      uri: `spotify:track:${fakeId(random)}`,
    };
  });
  const records: RawRecord[] = [];
  let clock = options.start;
  for (let i = 0; i < options.count; i++) {
    const track = catalog[Math.floor(random() ** 2 * catalogSize)]!;
    const record = baseRecord(clock, random);
    const skip = random() < 0.15;
    record.ms_played = skip
      ? Math.floor(1_000 + random() * 20_000)
      : Math.floor(120_000 + random() * 180_000);
    record.master_metadata_track_name = track.name;
    record.master_metadata_album_artist_name = track.artist;
    record.master_metadata_album_album_name = track.album;
    record.spotify_track_uri = track.uri;
    record.reason_end = skip ? 'fwdbtn' : 'trackdone';
    record.skipped = i % 97 === 0 ? null : skip;
    records.push(record);
    clock += Number(record.ms_played) + Math.floor(random() * 600_000);
  }
  return records;
}

/** Episódios de podcast e capítulos de audiolivro (devem ser descartados). */
export function nonMusicRecords(start: number, seed: number): RawRecord[] {
  const random = mulberry32(seed);
  const out: RawRecord[] = [];
  for (let i = 0; i < 5; i++) {
    const record = baseRecord(start + i * 3_600_000, random);
    record.ms_played = 1_200_000;
    record.episode_name = `Episódio ${i + 1}: conversa fictícia`;
    record.episode_show_name = 'Podcast Imaginário';
    record.spotify_episode_uri = `spotify:episode:${fakeId(random)}`;
    out.push(record);
  }
  for (let i = 0; i < 3; i++) {
    const record = baseRecord(start + (10 + i) * 3_600_000, random);
    record.ms_played = 900_000;
    record.audiobook_title = 'O Livro que Não Existe';
    record.audiobook_uri = `spotify:show:${fakeId(random)}`;
    record.audiobook_chapter_uri = `spotify:episode:${fakeId(random)}`;
    record.audiobook_chapter_title = `Capítulo ${i + 1}`;
    out.push(record);
  }
  for (let i = 0; i < 2; i++) {
    // Faixa local: tem nome, mas não tem URI do Spotify.
    const record = baseRecord(start + (20 + i) * 3_600_000, random);
    record.ms_played = 200_000;
    record.master_metadata_track_name = `Gravação Caseira ${i + 1}`;
    record.master_metadata_album_artist_name = 'Artista Local';
    out.push(record);
  }
  return out;
}

const json = (value: unknown): Uint8Array => strToU8(JSON.stringify(value, null, 2));

function zipFiles(files: Record<string, Uint8Array>): Uint8Array {
  const zippable: Zippable = {};
  for (const [name, data] of Object.entries(files)) zippable[name] = [data, { mtime: MTIME }];
  return zipSync(zippable, { level: 6, mtime: MTIME });
}

/**
 * Zip bomb pequena no disco: um "histórico" de 150 MiB de espaços (~150 KiB compactado,
 * razão ~1000:1). Gerada com o `Zip` em streaming do fflate, que grava *data descriptor*:
 * o cabeçalho local não declara tamanhos, então a defesa precisa agir durante o streaming.
 */
function zipBomb(): Uint8Array {
  const parts: Uint8Array[] = [];
  const zip = new Zip((error, chunk) => {
    if (error) throw error;
    parts.push(chunk);
  });
  const entry = new ZipDeflate(`${HISTORY_DIR}/Streaming_History_Audio_2024_0.json`, { level: 9 });
  entry.mtime = MTIME; // o construtor do ZipDeflate ignora `mtime` nas opções
  zip.add(entry);
  const block = new Uint8Array(1024 * 1024).fill(0x20);
  entry.push(strToU8('['));
  for (let i = 0; i < 150; i++) entry.push(block);
  entry.push(strToU8(']'), true);
  zip.end();
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const T2023 = Date.UTC(2023, 0, 5, 8, 0, 0);
const T2024 = Date.UTC(2024, 0, 3, 8, 0, 0);

/** Conteúdo esperado da fixture válida (os testes usam como oráculo). */
export function validFixtureRecords(): { first: RawRecord[]; second: RawRecord[] } {
  return {
    first: syntheticRecords({ count: 120, seed: 11, start: T2023, tracks: 24 }),
    second: syntheticRecords({ count: 80, seed: 12, start: T2024, tracks: 24 }),
  };
}

export function buildFixtures(): Record<string, Uint8Array> {
  const { first, second } = validFixtureRecords();
  const random = mulberry32(99);
  const fakePdf = strToU8('%PDF-1.4\n% documento fictício de leia-me\n%%EOF\n');
  const podcastMix = [
    ...syntheticRecords({ count: 10, seed: 21, start: T2024, tracks: 6 }),
    ...nonMusicRecords(T2024 + 86_400_000, 22),
  ];
  const oneRecord = syntheticRecords({ count: 3, seed: 31, start: T2024, tracks: 3 });

  return {
    'valid-two-files.zip': zipFiles({
      [`${HISTORY_DIR}/Streaming_History_Audio_2023_0.json`]: json(first),
      [`${HISTORY_DIR}/Streaming_History_Audio_2024_1.json`]: json(second),
      [`${HISTORY_DIR}/Streaming_History_Video_2023-2024.json`]: json([
        { ts: isoSeconds(T2024), ms_played: 1000 },
      ]),
      [`${HISTORY_DIR}/ReadMe.pdf`]: fakePdf,
    }),
    'with-podcast-audiobook.zip': zipFiles({
      [`${HISTORY_DIR}/Streaming_History_Audio_2024_0.json`]: json(podcastMix),
    }),
    'zip-bomb.zip': zipBomb(),
    'path-traversal.zip': zipFiles({
      [`${HISTORY_DIR}/Streaming_History_Audio_2024_0.json`]: json(oneRecord),
      '../../Streaming_History_Audio_evil.json': json(oneRecord),
    }),
    'invalid-json.zip': zipFiles({
      [`${HISTORY_DIR}/Streaming_History_Audio_2024_0.json`]: strToU8(
        '[{"ts": "2024-01-01T00:00:00Z", "ms_played": 1234, "master_metadata_track_name": ',
      ),
    }),
    'unexpected-format.zip': zipFiles({
      [`${HISTORY_DIR}/Streaming_History_Audio_2024_0.json`]: json(
        Array.from({ length: 20 }, (_, i) => ({
          song: `Faixa ${i}`,
          plays: i,
          id: fakeId(random),
        })),
      ),
    }),
    'not-history.zip': zipFiles({
      'Spotify Account Data/Userdata.json': json({ username: 'usuario-ficticio', country: 'ZZ' }),
      'Spotify Account Data/Playlist1.json': json({ playlists: [] }),
      'Spotify Account Data/ReadMe.pdf': fakePdf,
    }),
    'account-data.zip': zipFiles({
      'Spotify Account Data/StreamingHistory_music_0.json': json([
        {
          endTime: '2024-01-01 10:00',
          artistName: 'Lua de Vinil',
          trackName: 'Faixa 1',
          msPlayed: 200000,
        },
      ]),
    }),
    'loose/Streaming_History_Audio_2025_0.json': json(
      syntheticRecords({ count: 30, seed: 41, start: Date.UTC(2025, 1, 1, 9), tracks: 10 }),
    ),
  };
}

export const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'tests',
  'fixtures',
);

function main(): void {
  const fixtures = buildFixtures();
  for (const [name, bytes] of Object.entries(fixtures)) {
    const path = join(FIXTURES_DIR, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
    process.stdout.write(`${name.padEnd(48)} ${String(bytes.length).padStart(9)} bytes\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
