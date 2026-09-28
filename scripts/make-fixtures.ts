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

const ACCOUNT_DIR = 'Spotify Account Data';

/**
 * Marca posta em todo dado do export "Dados da conta" que o Encore **não** pode ler (arquivos
 * sensíveis e as partes do `YourLibrary.json` fora de `tracks`). Os testes provam que ela nunca
 * aparece no resultado.
 */
export const SENSITIVE_CANARY = 'ENCORE-CANARIO-NAO-LER';

type LibraryItem = { artist?: string | null; album?: string; track?: string; uri?: string };

/**
 * `YourLibrary.json` fictício no formato atual do export (chaves `tracks`, `albums`,
 * `artists`, `shows`, `episodes`, `bannedTracks`, `bannedArtists`, `other`; cada curtida com
 * `artist`, `album`, `track` e `uri`). Casos de borda de propósito: música repetida (mesmo
 * `uri`), itens antigos sem `uri` (um repetido), nome com espaços extras e em NFD, o mesmo nome
 * em minúsculas (outro artista), faixa local e item sem artista.
 */
export function libraryFixture(): Record<string, unknown> {
  const random = mulberry32(51);
  const track = (artist: string, i: number): LibraryItem => ({
    artist,
    album: `Álbum ${1 + (i % 3)} de ${artist.trim()}`,
    track: `Faixa ${i + 1} (${artist.trim().split(' ')[0]})`,
    uri: `spotify:track:${fakeId(random)}`,
  });
  const many = (artist: string, count: number, from = 0) =>
    Array.from({ length: count }, (_, i) => track(artist, from + i));
  const capivara = many('Capivara Cósmica', 7);
  const noUri = (i: number): LibraryItem => {
    const item = track('Velvet Static Choir', i);
    delete item.uri; // formato dos exports antigos, sem `uri`
    return item;
  };
  const tracks: LibraryItem[] = [
    ...capivara,
    { ...capivara[2]! }, // repetida (mesmo uri): conta uma vez
    ...many('Lua de Vinil', 5),
    ...many('Neon Harbor Club', 5),
    ...many('Maré de Fevereiro', 2),
    track('Maré de Fevereiro', 10), // NFD: junta com "Maré de Fevereiro"
    track('  Maré   de Fevereiro ', 11), // espaços extras: junta também
    ...many('The Paper Satellites', 3),
    track('lua de vinil', 20), // outra caixa: não junta (pode ser outro artista)
    noUri(0),
    noUri(1),
    noUri(1), // repetida sem uri (mesmo artista, álbum e faixa): conta uma vez
    track('Os Faróis de Néon', 0),
    track('Midnight Cartographers', 0),
    { artist: 'Artista Local', album: '', track: 'Gravação Caseira', uri: 'spotify:local:::x:1' },
    {
      artist: '',
      album: 'Sem Artista',
      track: 'Faixa Órfã',
      uri: `spotify:track:${fakeId(random)}`,
    },
  ];
  return {
    tracks,
    albums: [
      {
        artist: `Artista de Álbum ${SENSITIVE_CANARY}`,
        album: 'Álbum Salvo',
        uri: 'spotify:album:x',
      },
    ],
    shows: [
      { name: `Podcast Salvo ${SENSITIVE_CANARY}`, publisher: 'Editora', uri: 'spotify:show:x' },
    ],
    episodes: [{ name: `Episódio ${SENSITIVE_CANARY}`, show: 'Podcast', uri: 'spotify:episode:x' }],
    bannedTracks: [
      {
        artist: `Artista Banido ${SENSITIVE_CANARY}`,
        album: 'A',
        track: 'B',
        uri: 'spotify:track:y',
      },
    ],
    artists: [{ name: `Artista Seguido ${SENSITIVE_CANARY}`, uri: 'spotify:artist:x' }],
    bannedArtists: [{ name: `Banido ${SENSITIVE_CANARY}`, uri: 'spotify:artist:y' }],
    other: [SENSITIVE_CANARY],
  };
}

/**
 * Export "Dados da conta" completo e fictício: além do `YourLibrary.json`, os arquivos
 * sensíveis que o Encore nunca descompacta (perfil, identidade, pagamento, seguidores,
 * inferências, buscas, histórico de 1 ano, playlists, Marquee). Nenhum dado real: e-mail em
 * `example.invalid`, país "ZZ", sem número de cartão.
 */
export function accountDataFiles(library: unknown = libraryFixture()): Record<string, Uint8Array> {
  const fixture = { _fixture: SENSITIVE_CANARY };
  const fakePdf = strToU8('%PDF-1.4\n% leia-me fictício do export Dados da conta\n%%EOF\n');
  return {
    [`${ACCOUNT_DIR}/Userdata.json`]: json({
      username: 'usuario-ficticio',
      email: 'pessoa.ficticia@example.invalid',
      country: 'ZZ',
      createdFromFacebook: false,
      birthdate: '1990-01-01',
      gender: 'neutral',
      postalCode: null,
      mobileNumber: null,
      creationTime: '2015-01-01',
      ...fixture,
    }),
    [`${ACCOUNT_DIR}/Identity.json`]: json({
      displayName: 'Pessoa Fictícia',
      firstName: 'Pessoa',
      lastName: 'Fictícia',
      tasteMaker: false,
      imageUrl: '',
      verified: false,
      ...fixture,
    }),
    [`${ACCOUNT_DIR}/Payments.json`]: json({
      payment_method: 'Cartão fictício de teste',
      creation_date: '2020-01-01',
      country: 'ZZ',
      postal_code: '00000',
      ...fixture,
    }),
    [`${ACCOUNT_DIR}/Follow.json`]: json({
      followerCount: 0,
      followingUsersCount: 1,
      dismissingUsersCount: 0,
      ...fixture,
    }),
    [`${ACCOUNT_DIR}/Inferences.json`]: json({
      inferences: ['1P_Custom_Segmento_Ficticio', SENSITIVE_CANARY],
    }),
    [`${ACCOUNT_DIR}/SearchQueries.json`]: json([
      {
        platform: 'ANDROID',
        searchTime: '2024-01-01T10:00:00.000Z[UTC]',
        searchQuery: `busca fictícia ${SENSITIVE_CANARY}`,
        searchInteractionURIs: [],
      },
    ]),
    [`${ACCOUNT_DIR}/StreamingHistory_music_0.json`]: json([
      {
        endTime: '2024-01-01 10:00',
        artistName: `Artista do Histórico Curto ${SENSITIVE_CANARY}`,
        trackName: 'Faixa 1',
        msPlayed: 200000,
      },
    ]),
    [`${ACCOUNT_DIR}/StreamingHistory_podcast_0.json`]: json([
      {
        endTime: '2024-01-01 11:00',
        podcastName: `Podcast ${SENSITIVE_CANARY}`,
        episodeName: 'Episódio 1',
        msPlayed: 900000,
      },
    ]),
    [`${ACCOUNT_DIR}/Playlist1.json`]: json({
      playlists: [
        {
          name: `Playlist Fictícia ${SENSITIVE_CANARY}`,
          lastModifiedDate: '2024-01-01',
          items: [],
          description: null,
          numberOfFollowers: 0,
        },
      ],
    }),
    [`${ACCOUNT_DIR}/Marquee.json`]: json([
      { artistName: `Artista ${SENSITIVE_CANARY}`, segment: 'Super Listeners' },
    ]),
    [`${ACCOUNT_DIR}/YourLibrary.json`]: json(library),
    [`${ACCOUNT_DIR}/Read_Me_First.pdf`]: fakePdf,
  };
}

/**
 * Percorre os cabeçalhos locais de um zip do `zipSync` (sem data descriptor) e chama `patch`
 * com a posição do cabeçalho e dos dados de cada entrada. Usado para montar zips hostis.
 */
function patchLocalEntries(
  zip: Uint8Array,
  patch: (entry: {
    name: string;
    bytes: Uint8Array;
    header: number;
    start: number;
    length: number;
  }) => void,
): Uint8Array {
  const out = zip.slice();
  const view = new DataView(out.buffer);
  let offset = 0;
  while (offset + 30 <= out.length && view.getUint32(offset, true) === 0x04034b50) {
    const compressed = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(out.subarray(offset + 30, offset + 30 + nameLength));
    const dataStart = offset + 30 + nameLength + extraLength;
    patch({ name, bytes: out, header: offset, start: dataStart, length: compressed });
    offset = dataStart + compressed;
  }
  return out;
}

/**
 * Prova de que os arquivos sensíveis nunca são descompactados: no mesmo export, os dados
 * DEFLATE de **toda** entrada que não é o `YourLibrary.json` viram lixo (`0xFF`, bloco de tipo
 * reservado). Se o leitor tentasse inflar qualquer uma delas, o resultado seria `INVALID_ZIP`.
 */
function poisonedAccountData(): Uint8Array {
  return patchLocalEntries(zipFiles(accountDataFiles()), ({ name, bytes, start, length }) => {
    if (!name.endsWith('/YourLibrary.json')) bytes.fill(0xff, start, start + length);
  });
}

/**
 * Export "Dados da conta" cujo `YourLibrary.json` declara no cabeçalho local 64 MiB
 * descompactados, acima do limite das curtidas (32 MiB). Deve ser rejeitado antes de inflar.
 */
function oversizedLibrary(): Uint8Array {
  const files = { [`${ACCOUNT_DIR}/YourLibrary.json`]: json(libraryFixture()) };
  return patchLocalEntries(zipFiles(files), ({ bytes, header }) => {
    new DataView(bytes.buffer).setUint32(header + 22, 64 * 1024 * 1024, true);
  });
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
    // Export "Dados da conta" completo (curtidas + arquivos sensíveis que não podem ser lidos).
    'account-data-full.zip': zipFiles(accountDataFiles()),
    // O mesmo, com os dados de toda entrada que não é o YourLibrary.json corrompidos.
    'account-data-poisoned.zip': poisonedAccountData(),
    // Os dois exports num zip só (a pessoa juntou as pastas).
    'history-and-account-data.zip': zipFiles({
      [`${HISTORY_DIR}/Streaming_History_Audio_2023_0.json`]: json(first),
      [`${HISTORY_DIR}/Streaming_History_Audio_2024_1.json`]: json(second),
      ...accountDataFiles(),
    }),
    'library-invalid.zip': zipFiles({
      [`${ACCOUNT_DIR}/YourLibrary.json`]: json({
        tracks: Array.from({ length: 10 }, (_, i) => ({ artist: { nome: i }, track: 42 })),
      }),
      [`${ACCOUNT_DIR}/Userdata.json`]: json({ username: 'usuario-ficticio' }),
    }),
    'library-too-large.zip': oversizedLibrary(),
    'loose/YourLibrary.json': json(libraryFixture()),
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
