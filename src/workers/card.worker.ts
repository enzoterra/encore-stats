/**
 * Web Worker dos cards (RF-20, ADR 4). Roda satori → SVG → resvg-wasm → PNG fora da thread
 * principal. Não faz rede: fontes e WASM chegam da thread principal na inicialização, e os dados
 * do card nunca saem do aparelho.
 */
import { expose, transfer } from 'comlink';

import { provideHarfBuzzWasm } from '@/features/cards/harfbuzz-browser';

import { createCardWorkerApi, type CardWorkerApi } from './card-worker-api';

const api = createCardWorkerApi({
  beforeInit: (assets) => provideHarfBuzzWasm(assets.harfbuzzWasm),
});

const exposed: CardWorkerApi = {
  init: (assets) => api.init(assets),
  isReady: () => api.isReady(),
  async render(request) {
    const result = await api.render(request);
    return transfer(result, [result.png.buffer as ArrayBuffer]);
  },
};

expose(exposed);

export type { CardWorkerApi } from './card-worker-api';
