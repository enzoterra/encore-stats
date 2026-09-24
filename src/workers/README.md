# src/workers

Web Workers. O worker **não** faz `fetch` (regra de lint): o upload nunca sai do navegador.

- `history.worker.ts`: expõe `HistoryWorkerApi` via Comlink (`processHistory(files, onProgress)`
  e `cancel()`). A lógica fica em `history-worker-api.ts`, testável em Node; o resultado é
  `{ ok: true, dataset, report }` com as colunas transferidas, ou `{ ok: false, error: { code } }`.

Uso na UI:

```ts
import * as Comlink from 'comlink';
import type { HistoryWorkerApi } from '@/workers/history.worker';

const worker = new Worker(new URL('../workers/history.worker.ts', import.meta.url), {
  type: 'module',
});
const api = Comlink.wrap<HistoryWorkerApi>(worker);
const result = await api.processHistory(files, Comlink.proxy(onProgress));
// Cancelar: api.cancel() (ou worker.terminate() como corte imediato).
```
