import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { HistoryInput } from '@/domain/history';

export const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));

export function fixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES, name)));
}

/** `File` do Node (mesma API do navegador). */
export function fileInput(name: string, bytes: Uint8Array | string): HistoryInput {
  return new File([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], name);
}

export function fixtureInput(name: string): HistoryInput {
  return fileInput(name.split('/').pop()!, fixtureBytes(name));
}

/**
 * Entrada com pedaços de tamanho controlado e contagem do que foi efetivamente lido,
 * para provar que o streaming aborta antes de consumir o arquivo inteiro.
 */
export function chunkedInput(
  name: string,
  bytes: Uint8Array,
  chunkSizes: number | number[],
  declaredSize = bytes.length,
): HistoryInput & { pulled: () => number } {
  let pulled = 0;
  return {
    name,
    size: declaredSize,
    pulled: () => pulled,
    stream() {
      let offset = 0;
      let index = 0;
      return new ReadableStream<Uint8Array>({
        pull(controller) {
          if (offset >= bytes.length) {
            controller.close();
            return;
          }
          const size = Array.isArray(chunkSizes)
            ? (chunkSizes[Math.min(index, chunkSizes.length - 1)] ?? bytes.length)
            : chunkSizes;
          index++;
          const chunk = bytes.slice(offset, offset + size);
          offset += chunk.length;
          pulled += chunk.length;
          controller.enqueue(chunk);
        },
      });
    },
  };
}
