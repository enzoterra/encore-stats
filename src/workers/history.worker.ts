/**
 * Web Worker do upload (RF-04). Descompacta, valida e agrega o histórico fora da thread
 * principal. Não faz rede: o conteúdo do upload nunca sai do dispositivo (RNF-01).
 */
import { expose } from 'comlink';

import { createHistoryWorkerApi } from './history-worker-api';

expose(createHistoryWorkerApi());

export type { HistoryWorkerApi } from './history-worker-api';
