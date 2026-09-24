/**
 * API do worker de cards (S6.1). Gera o PNG fora da thread principal (satori + resvg levam de
 * centenas de ms a alguns segundos) e guarda na memória do worker, durante a sessão, o WASM
 * inicializado e as fontes. Não faz rede: a thread principal busca os arquivos no próprio site e
 * os transfere na inicialização. Testável em Node.
 */
import type { CardRequest } from '@/features/cards/model';
import { initResvg, renderCardPng, toSatoriFonts, type CardFont } from '@/features/cards/render';

export type CardAssets = {
  fonts: CardFont[];
  resvgWasm: ArrayBuffer;
  harfbuzzWasm: ArrayBuffer;
};

export type CardRenderResult = { png: Uint8Array; ms: number };

export type CardWorkerApi = {
  /** Idempotente: a 2ª chamada reaproveita o que já foi carregado. */
  init(assets: CardAssets): Promise<void>;
  isReady(): boolean;
  render(request: CardRequest): Promise<CardRenderResult>;
};

export type CardWorkerHooks = {
  /** No navegador: entrega o `hb.wasm` ao HarfBuzz do satori (ver `harfbuzz-browser.ts`). */
  beforeInit?: (assets: CardAssets) => void;
  now?: () => number;
};

export function createCardWorkerApi(hooks: CardWorkerHooks = {}): CardWorkerApi {
  const now = hooks.now ?? (() => performance.now());
  let fonts: ReturnType<typeof toSatoriFonts> | null = null;
  let ready: Promise<void> | null = null;

  return {
    init(assets) {
      ready ??= (async () => {
        hooks.beforeInit?.(assets);
        await initResvg(assets.resvgWasm);
        fonts = toSatoriFonts(assets.fonts);
      })().catch((error: unknown) => {
        ready = null;
        throw error;
      });
      return ready;
    },
    isReady: () => fonts !== null,
    async render(request) {
      if (!ready || !fonts) throw new Error('card worker not initialized');
      await ready;
      const start = now();
      const png = await renderCardPng(request, fonts);
      return { png, ms: Math.round(now() - start) };
    },
  };
}
