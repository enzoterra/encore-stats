/** Tipos mínimos do harfbuzzjs 0.10 (dependência do satori), usados pelo carregador do worker. */
declare module 'harfbuzzjs/hb.js' {
  type EmscriptenOptions = { wasmBinary?: ArrayBuffer | Uint8Array; locateFile?: () => string };
  const createHarfBuzz: (options?: EmscriptenOptions) => Promise<unknown>;
  export default createHarfBuzz;
}

declare module 'harfbuzzjs/hbjs.js' {
  const hbjs: (instance: unknown) => unknown;
  export default hbjs;
}
