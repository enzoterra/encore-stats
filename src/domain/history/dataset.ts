import { isValidPlay, type MusicRecord } from './schema';
import { PLATFORMS, platformIndex, type PlatformCode } from './platform';

export type DatasetTrack = { name: string; artist: number; album: number; uri: string };

/**
 * Álbum com o artista (melhoria sobre o `albums: string[]` do 03): dois artistas com um álbum
 * de mesmo nome ("Greatest Hits") não se misturam no top de álbuns, e a UI mostra o artista.
 */
export type DatasetAlbum = { name: string; artist: number };

/**
 * Dataset colunar (03-arquitetura): uma posição por registro de música, ordenado por `ts`.
 * Os dicionários guardam cada string uma vez; as colunas são TypedArrays transferíveis.
 */
export type Dataset = {
  dict: {
    artists: string[];
    tracks: DatasetTrack[];
    albums: DatasetAlbum[];
    /** Sempre `PLATFORMS` (ordem fixa). */
    platforms: readonly PlatformCode[];
  };
  cols: {
    /** Epoch em segundos (UTC), crescente. */
    ts: Uint32Array;
    /** `ms_played`. */
    ms: Uint32Array;
    /** Índice em `dict.tracks`. */
    track: Uint32Array;
    /** Índice em `dict.platforms`. */
    platform: Uint8Array;
    /** `FLAG_*`. */
    flags: Uint8Array;
  };
  /** `ts` do primeiro e do último registro (0/0 se vazio). */
  range: { from: number; to: number };
};

/** bit0: pulada (regra em `isSkip`). */
export const FLAG_SKIPPED = 1;
/** bit1: modo aleatório. */
export const FLAG_SHUFFLE = 2;
/** bit2: play válido (≥ 30 s). */
export const FLAG_VALID = 4;

const INITIAL_CAPACITY = 1 << 14;

/**
 * Constrói o Dataset de forma incremental: o chamador entrega registros de um arquivo por vez
 * e descarta o JSON em seguida (RNF-04). Ao final, `build()` ordena por `ts` (estável).
 */
export class DatasetBuilder {
  private readonly artistIds = new Map<string, number>();
  private readonly albumIds = new Map<string, number>();
  private readonly trackIds = new Map<string, number>();
  private readonly artists: string[] = [];
  private readonly albums: DatasetAlbum[] = [];
  private readonly tracks: DatasetTrack[] = [];
  private length = 0;
  private ts = new Uint32Array(INITIAL_CAPACITY);
  private ms = new Uint32Array(INITIAL_CAPACITY);
  private track = new Uint32Array(INITIAL_CAPACITY);
  private platform = new Uint8Array(INITIAL_CAPACITY);
  private flags = new Uint8Array(INITIAL_CAPACITY);

  get size(): number {
    return this.length;
  }

  add(record: MusicRecord): void {
    if (this.length === this.ts.length) this.grow();
    const i = this.length++;
    this.ts[i] = record.ts;
    this.ms[i] = record.ms;
    this.track[i] = this.trackId(record);
    this.platform[i] = platformIndex(record.platform);
    this.flags[i] =
      (record.skipped ? FLAG_SKIPPED : 0) |
      (record.shuffle ? FLAG_SHUFFLE : 0) |
      (isValidPlay(record.ms) ? FLAG_VALID : 0);
  }

  build(): Dataset {
    const n = this.length;
    const order = sortedOrder(this.ts, n);
    const ts = permute(this.ts, order, n, Uint32Array);
    const cols = {
      ts,
      ms: permute(this.ms, order, n, Uint32Array),
      track: permute(this.track, order, n, Uint32Array),
      platform: permute(this.platform, order, n, Uint8Array),
      flags: permute(this.flags, order, n, Uint8Array),
    };
    return {
      dict: {
        artists: this.artists.slice(),
        tracks: this.tracks.slice(),
        albums: this.albums.slice(),
        platforms: PLATFORMS,
      },
      cols,
      range: n === 0 ? { from: 0, to: 0 } : { from: ts[0]!, to: ts[n - 1]! },
    };
  }

  private trackId(record: MusicRecord): number {
    const known = this.trackIds.get(record.uri);
    if (known !== undefined) return known;
    const artist = this.artistId(record.artist);
    const id = this.tracks.length;
    this.tracks.push({
      name: record.track,
      artist,
      album: this.albumId(artist, record.album),
      uri: record.uri,
    });
    this.trackIds.set(record.uri, id);
    return id;
  }

  private artistId(name: string): number {
    const known = this.artistIds.get(name);
    if (known !== undefined) return known;
    const id = this.artists.length;
    this.artists.push(name);
    this.artistIds.set(name, id);
    return id;
  }

  private albumId(artist: number, name: string): number {
    const key = `${artist}\u0000${name}`;
    const known = this.albumIds.get(key);
    if (known !== undefined) return known;
    const id = this.albums.length;
    this.albums.push({ name, artist });
    this.albumIds.set(key, id);
    return id;
  }

  private grow(): void {
    const capacity = this.ts.length * 2;
    this.ts = resize(this.ts, capacity, Uint32Array);
    this.ms = resize(this.ms, capacity, Uint32Array);
    this.track = resize(this.track, capacity, Uint32Array);
    this.platform = resize(this.platform, capacity, Uint8Array);
    this.flags = resize(this.flags, capacity, Uint8Array);
  }
}

type TypedArrayCtor<T> = new (length: number) => T;

function resize<T extends Uint32Array | Uint8Array>(
  source: T,
  capacity: number,
  Ctor: TypedArrayCtor<T>,
): T {
  const next = new Ctor(capacity);
  next.set(source);
  return next;
}

/** Ordem estável por `ts`; `null` quando já está ordenado (caso comum: arquivos cronológicos). */
function sortedOrder(ts: Uint32Array, n: number): Uint32Array | null {
  let sorted = true;
  for (let i = 1; i < n; i++) {
    if (ts[i]! < ts[i - 1]!) {
      sorted = false;
      break;
    }
  }
  if (sorted) return null;
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  return order.sort((a, b) => ts[a]! - ts[b]! || a - b);
}

function permute<T extends Uint32Array | Uint8Array>(
  source: T,
  order: Uint32Array | null,
  n: number,
  Ctor: TypedArrayCtor<T>,
): T {
  const out = new Ctor(n);
  if (order === null) {
    out.set(source.subarray(0, n));
    return out;
  }
  for (let i = 0; i < n; i++) out[i] = source[order[i]!]!;
  return out;
}

export function emptyDataset(): Dataset {
  return new DatasetBuilder().build();
}

/** Buffers das colunas, para `Comlink.transfer` / `postMessage` sem cópia. */
export function datasetTransferables(dataset: Dataset): ArrayBuffer[] {
  const { ts, ms, track, platform, flags } = dataset.cols;
  return [ts.buffer, ms.buffer, track.buffer, platform.buffer, flags.buffer] as ArrayBuffer[];
}
