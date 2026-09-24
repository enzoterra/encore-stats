/**
 * Modelo dos cards de compartilhamento (RF-20..RF-22, 10-design.md §9). Os textos chegam já
 * traduzidos e formatados pela UI; os templates só fazem layout, truncamento e caixa alta.
 */

export const CARD_TEMPLATES = ['festival', 'basic'] as const;
export const CARD_FORMATS = ['story', 'square'] as const;

export type CardTemplate = (typeof CARD_TEMPLATES)[number];
export type CardFormat = (typeof CARD_FORMATS)[number];
/** Upload e Demo são tipográficos; só o Conectar leva capa e o logo do Spotify (§9.6). */
export type CardMode = 'upload' | 'demo' | 'connect';

export type CardFormatSpec = {
  width: number;
  height: number;
  padTop: number;
  padBottom: number;
  padX: number;
};

/** Canvas e áreas seguras (§9.1): Stories deixa livres ~250 px no topo e ~280 px na base. */
export const FORMATS: Readonly<Record<CardFormat, CardFormatSpec>> = {
  story: { width: 1080, height: 1920, padTop: 250, padBottom: 280, padX: 72 },
  square: { width: 1080, height: 1080, padTop: 72, padBottom: 72, padX: 72 },
};

/** Textos fixos do card, no idioma da interface. */
export type CardStrings = {
  topArtist: string;
  artists: string;
  tracks: string;
  presents: string;
  festOf: string;
  festDefault: string;
  demoTag: string;
  uploadFooter: string;
  demoFooter: string;
};

export type CardTrack = { name: string; artist: string };

export type CardData = {
  locale: string;
  t: CardStrings;
  /** Domínio do site sem protocolo (rodapé); sem ele, o rodapé mostra só a marca. */
  siteLabel?: string;
  /** Chip do período ou da janela ("2024", "Últimos 6 meses"). */
  periodLabel: string;
  /** Até 25 artistas, do nº 1 em diante. */
  topArtists: string[];
  topTracks: CardTrack[];
  /** Linha abaixo do herói do Básico ("1.284 plays · fã desde mar. 2019"). */
  heroSub?: string;
  /** Bloco de destaque do Básico; sem ele, o bloco some. */
  stat?: { value: string; label: string };
  /** Linha de estatísticas do Festival. */
  stats: string[];
  /** "Nome no cartaz" do Festival (opcional, digitado no modal). */
  posterName?: string;
  /** Capa da música nº 1 (Conectar/Básico), como data URL. Sem ela, o card é tipográfico. */
  cover?: string;
  /** Logo completo oficial do Spotify (branco), como data URL. Só no Conectar. */
  spotifyLogo?: string;
};

export type CardRequest = {
  template: CardTemplate;
  format: CardFormat;
  mode: CardMode;
  data: CardData;
};

/** Dimensões do PNG exportado (§9.7: 1080 px de largura). */
export function cardSize(format: CardFormat): { width: number; height: number } {
  const { width, height } = FORMATS[format];
  return { width, height };
}
