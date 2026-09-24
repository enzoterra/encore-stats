/**
 * Lado da thread principal do pipeline de cards (S6.1). Só é importado pelo modal de
 * compartilhar, que por sua vez só é carregado quando o usuário toca em "Compartilhar": satori,
 * resvg, fontes e WASM ficam fora do bundle inicial (RNF-03).
 *
 * - Um worker por aba, criado no 1º uso e mantido na sessão: WASM inicializado e fontes ficam em
 *   memória, e os cards seguintes saem sem recarregar nada.
 * - Fontes (`public/fonts/ttf`) e WASM (emitidos pelo bundler em `/_next/static/media`) vêm do
 *   próprio site; nada de CDN externo. O cache HTTP cobre recargas.
 * - Capa do Conectar (ADR 9): `fetch` direto do `i.scdn.co`, que responde com CORS
 *   (`Access-Control-Allow-Origin: *`); sem cookie e sem referrer.
 */
import { transfer, wrap, type Remote } from 'comlink';

import type { CardAssets, CardWorkerApi } from '@/workers/card-worker-api';

import { isAllowedCoverUrl, MAX_COVER_BYTES, sniffImage, toDataUrl } from './assets';
import { cardSize, type CardRequest } from './model';
import { FONT_FILES } from './templates';

const SPOTIFY_LOGO_URL = '/brand/spotify-full-logo-white.svg';
const COVER_TIMEOUT_MS = 8000;

type Handle = { api: Remote<CardWorkerApi>; worker: Worker };

let handle: Promise<Handle> | null = null;
let logo: Promise<string> | null = null;
const covers = new Map<string, Promise<string | undefined>>();

async function fetchBytes(url: string | URL): Promise<ArrayBuffer> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`asset ${response.status}`);
  return response.arrayBuffer();
}

async function loadAssets(): Promise<CardAssets> {
  const [resvgWasm, harfbuzzWasm, ...fonts] = await Promise.all([
    fetchBytes(new URL('@resvg/resvg-wasm/index_bg.wasm', import.meta.url)),
    fetchBytes(new URL('harfbuzzjs/hb.wasm', import.meta.url)),
    ...FONT_FILES.map((font) => fetchBytes(`/fonts/ttf/${font.file}`)),
  ]);
  return {
    resvgWasm: resvgWasm!,
    harfbuzzWasm: harfbuzzWasm!,
    fonts: FONT_FILES.map((font, i) => ({
      name: font.name,
      weight: font.weight,
      data: fonts[i]!,
    })),
  };
}

function reset(worker?: Worker): void {
  worker?.terminate();
  handle = null;
}

function getWorker(): Promise<Handle> {
  handle ??= (async () => {
    const worker = new Worker(new URL('../../workers/card.worker.ts', import.meta.url), {
      type: 'module',
    });
    // Worker que cai (memória no iOS, por exemplo) é recriado na próxima tentativa.
    worker.addEventListener('error', () => reset(worker));
    const api = wrap<CardWorkerApi>(worker);
    try {
      const assets = await loadAssets();
      const buffers = [assets.resvgWasm, assets.harfbuzzWasm, ...assets.fonts.map((f) => f.data)];
      await api.init(transfer(assets, buffers));
    } catch (error) {
      reset(worker);
      throw error;
    }
    return { api, worker };
  })();
  return handle;
}

/** Começa a baixar e inicializar o pipeline (ao abrir o modal), sem gerar nada. */
export function warmUpCards(): void {
  void getWorker().catch(() => undefined);
}

export type GeneratedCard = { blob: Blob; width: number; height: number; renderMs: number };

export async function generateCard(request: CardRequest): Promise<GeneratedCard> {
  const { api } = await getWorker();
  const { png, ms } = await api.render(request);
  const blob = new Blob([png as Uint8Array<ArrayBuffer>], { type: 'image/png' });
  return { blob, ...cardSize(request.format), renderMs: ms };
}

/** Logo completo oficial do Spotify (branco), como data URL para o satori. */
export function loadSpotifyLogo(): Promise<string> {
  logo ??= (async () => {
    const bytes = new Uint8Array(await fetchBytes(SPOTIFY_LOGO_URL));
    return toDataUrl('image/svg+xml', bytes);
  })().catch((error: unknown) => {
    logo = null;
    throw error;
  });
  return logo;
}

/**
 * Capa da música nº 1 (ADR 9). Qualquer falha (host fora da allowlist, CORS, tempo, tamanho,
 * formato) devolve `undefined`: o card sai tipográfico, sem erro (§9.6).
 */
export function loadCover(url: string | undefined): Promise<string | undefined> {
  if (!url || !isAllowedCoverUrl(url)) return Promise.resolve(undefined);
  let pending = covers.get(url);
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetch(url, {
          mode: 'cors',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          signal: AbortSignal.timeout(COVER_TIMEOUT_MS),
        });
        const declared = Number(response.headers.get('content-length') ?? 0);
        if (!response.ok || declared > MAX_COVER_BYTES) return undefined;
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength > MAX_COVER_BYTES) return undefined;
        const kind = sniffImage(bytes);
        return kind ? toDataUrl(kind, bytes) : undefined;
      } catch {
        return undefined;
      }
    })();
    covers.set(url, pending);
    // Falhas não ficam em cache: a próxima abertura tenta de novo.
    void pending.then((value) => {
      if (value === undefined) covers.delete(url);
    });
  }
  return pending;
}
