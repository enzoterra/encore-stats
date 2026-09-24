/** Limita quantas promessas rodam ao mesmo tempo (fila FIFO). */
export function createLimiter(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    active--;
    queue.shift()?.();
  };
  return function run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        active++;
        task().then(resolve, reject).finally(next);
      };
      if (active < concurrency) start();
      else queue.push(start);
    });
  };
}

/**
 * Roda `worker` sobre `items` com no máximo `concurrency` em paralelo. Para no primeiro erro
 * (os que já estão em voo terminam, mas nenhum novo começa) e o repassa.
 */
export async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  let failed = false;
  let firstError: unknown;
  const lane = async () => {
    while (!failed && index < items.length) {
      const item = items[index++]!;
      try {
        await worker(item);
      } catch (error) {
        if (!failed) firstError = error;
        failed = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
  if (failed) throw firstError;
}

/** Espera `ms`, cancelável pelo `signal`. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
