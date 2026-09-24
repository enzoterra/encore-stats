'use client';

import { create } from 'zustand';

import type { DemoData } from '@/domain/demo';
import type { Dataset, ProcessReport } from '@/domain/history';

/** Histórico carregado por upload. Vive só na memória da aba (03-arquitetura, PADROES §1). */
export type LoadedUpload = {
  dataset: Dataset;
  timeZone: string;
  report: ProcessReport;
  /** Tempo real de processamento no navegador (ms), exibido no rodapé do dashboard. */
  elapsedMs: number;
};

type DatasetState = {
  upload: LoadedUpload | null;
  demo: DemoData | null;
  setUpload: (upload: LoadedUpload) => void;
  clearUpload: () => void;
  setDemo: (demo: DemoData) => void;
};

/**
 * Sem `persist`: nada vai para localStorage/IndexedDB. Recarregar a página apaga o histórico,
 * e a UI avisa disso. A troca de idioma é navegação do cliente e preserva o estado.
 */
export const useDatasetStore = create<DatasetState>((set) => ({
  upload: null,
  demo: null,
  setUpload: (upload) => set({ upload }),
  clearUpload: () => set({ upload: null }),
  setDemo: (demo) => set({ demo }),
}));
