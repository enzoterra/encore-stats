/**
 * Limites e regras do motor de upload (RF-05, RF-06, 08-seguranca.md "DoS local").
 * Os limites são injetáveis em `processHistory` para os testes; em produção valem os padrões.
 */
export type HistoryLimits = {
  /** Entradas por arquivo .zip (inclui diretórios e arquivos ignorados). */
  maxEntries: number;
  /** Tamanho máximo descompactado de um arquivo de histórico. */
  maxEntryBytes: number;
  /** Soma máxima descompactada de todos os arquivos de histórico. */
  maxTotalBytes: number;
  /** Razão máxima descompactado/compactado. */
  maxCompressionRatio: number;
  /** A razão só é avaliada depois deste volume descompactado (arquivos pequenos têm razão ruidosa). */
  ratioCheckMinBytes: number;
};

const MiB = 1024 * 1024;

export const DEFAULT_LIMITS: Readonly<HistoryLimits> = Object.freeze({
  maxEntries: 200,
  maxEntryBytes: 100 * MiB,
  maxTotalBytes: 1024 * MiB,
  maxCompressionRatio: 100,
  ratioCheckMinBytes: 1 * MiB,
});

/** Um play conta a partir de 30 s (RF-06). */
export const VALID_PLAY_MS = 30_000;

/** Um arquivo com mais de 5% de registros inválidos é rejeitado. */
export const MAX_INVALID_RATIO = 0.05;

/**
 * Tamanho dos pedaços entregues ao fflate. O inflate é síncrono e produz a saída de um
 * `push` de uma vez; com 16 KiB de entrada, a saída de um único `push` fica limitada a
 * ~16 MiB mesmo no pior caso do DEFLATE (~1032:1), o que permite abortar uma zip bomb
 * durante o streaming, antes de materializar o conteúdo.
 */
export const UNZIP_PUSH_BYTES = 16 * 1024;

/** Arquivos do "Histórico estendido de streaming" (só áudio). */
export const HISTORY_FILE_PATTERN = /^Streaming_History_Audio_[^/\\]*\.json$/i;

/** Arquivos do export "Dados da conta" (formato reduzido, não suportado). */
export const ACCOUNT_DATA_FILE_PATTERN = /^StreamingHistory(_music_|_podcast_)?\d*\.json$/i;

/** Comprimento máximo de nomes de faixa/artista/álbum aceitos num registro. */
export const MAX_NAME_LENGTH = 1024;
