'use client';

import { create } from 'zustand';

import type { DemoData } from '@/domain/demo';
import type { Dataset, LikedByArtist, ProcessReport } from '@/domain/history';

/** Histórico carregado por upload. Vive só na memória da aba (03-arquitetura, PADROES §1). */
export type LoadedUpload = {
  dataset: Dataset;
  timeZone: string;
  report: ProcessReport;
  /** Tempo real de processamento no navegador (ms), exibido no rodapé do dashboard. */
  elapsedMs: number;
  /**
   * Curtidas por artista do export "Dados da conta" (opcional), enviadas junto do histórico ou
   * depois, com o painel aberto. Ausente = ainda não enviadas. Não depende do período.
   */
  library?: LikedByArtist;
};

type DatasetState = {
  upload: LoadedUpload | null;
  demo: DemoData | null;
  setUpload: (upload: LoadedUpload) => void;
  clearUpload: () => void;
  /** Junta as curtidas ao histórico já carregado (sem reler o histórico). */
  setUploadLibrary: (library: LikedByArtist) => void;
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
  setUploadLibrary: (library) =>
    set((state) => (state.upload ? { upload: { ...state.upload, library } } : state)),
  setDemo: (demo) => set({ demo }),
}));
