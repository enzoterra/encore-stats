/**
 * Substituto do pacote `harfbuzzjs` no bundle do navegador (alias em `next.config.ts`).
 *
 * O satori 0.33 faz o shaping do texto com o HarfBuzz (WASM). O pacote original busca o
 * `hb.wasm` ao lado do script, caminho que não existe depois do bundle. Aqui o módulo espera os
 * bytes do WASM, que a thread principal busca no próprio site e o worker recebe na inicialização:
 * o worker não faz rede e nada vem de CDN externo.
 */
import createHarfBuzz from 'harfbuzzjs/hb.js';
import hbjs from 'harfbuzzjs/hbjs.js';

let provide: (bytes: ArrayBuffer) => void = () => undefined;
const wasmBinary = new Promise<ArrayBuffer>((resolve) => {
  provide = resolve;
});

/** Entrega o `hb.wasm` (uma vez por worker). */
export function provideHarfBuzzWasm(bytes: ArrayBuffer): void {
  provide(bytes);
}

const harfbuzz: Promise<unknown> = wasmBinary.then(async (bytes) =>
  hbjs(await createHarfBuzz({ wasmBinary: bytes })),
);

export default harfbuzz;
