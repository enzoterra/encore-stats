/**
 * Pipeline do card (ADR 4): árvore do template → satori → SVG → resvg-wasm → PNG.
 * Não depende de DOM: roda no Web Worker do navegador (`src/workers/card.worker.ts`) e no Node
 * (testes). O chamador entrega os bytes do WASM do resvg e as fontes TTF; nada aqui faz rede.
 */
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import type { ReactNode } from 'react';
import satori, { type Font } from 'satori';

import { cardSize, type CardRequest } from './model';
import { backgroundSvg, buildCard, COLORS } from './templates';

export type CardFont = { name: string; weight: 400 | 600 | 700 | 800; data: ArrayBuffer };

let resvgReady: Promise<void> | null = null;

/** Inicializa o resvg uma vez por contexto (o WASM fica em memória durante a sessão). */
export function initResvg(wasm: BufferSource | WebAssembly.Module): Promise<void> {
  resvgReady ??= initWasm(wasm).catch((error: unknown) => {
    resvgReady = null;
    throw error;
  });
  return resvgReady;
}

/** Converte as fontes para o formato do satori; manter o mesmo array reaproveita o cache dele. */
export function toSatoriFonts(fonts: readonly CardFont[]): Font[] {
  return fonts.map((font) => ({
    name: font.name,
    weight: font.weight,
    style: 'normal',
    data: font.data,
  }));
}

export async function renderCardSvg(request: CardRequest, fonts: Font[]): Promise<string> {
  const { width, height } = cardSize(request.format);
  const tree = buildCard(request) as unknown as ReactNode;
  const svg = await satori(tree, { width, height, fonts });
  // O fundo entra como primeiro desenho, por baixo de todo o conteúdo (ver `backgroundSvg`).
  return svg.replace(
    /^<svg[^>]*>/,
    (open) => open + backgroundSvg(request.template, request.format),
  );
}

/** PNG de 1080 px de largura, sem transparência (§9.7). Exige `initResvg` antes. */
export async function renderCardPng(request: CardRequest, fonts: Font[]): Promise<Uint8Array> {
  if (!resvgReady) throw new Error('resvg not initialized');
  await resvgReady;
  const svg = await renderCardSvg(request, fonts);
  const { width } = cardSize(request.format);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: COLORS.bg,
    font: { loadSystemFonts: false },
  });
  const image = resvg.render();
  try {
    return image.asPng();
  } finally {
    image.free();
    resvg.free();
  }
}
