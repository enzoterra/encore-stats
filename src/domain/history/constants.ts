/**
 * Limites e regras do motor de upload (RF-05, RF-06, 08-seguranca.md "DoS local").
 * Os limites são injetáveis em `processHistory` para os testes; em produção valem os padrões.
 */
export type HistoryLimits = {
  /** Entradas por arquivo .zip (inclui diretórios e arquivos ignorados). */
  maxEntries: number;
  /** Tamanho máximo descompactado de um arquivo de histórico. */
  maxEntryBytes: number;
  /**
   * Soma máxima descompactada dos `YourLibrary.json` (curtidas) lidos numa execução. Um
   * `YourLibrary.json` formatado ocupa ~200 bytes por curtida: 32 MiB passam de 150 mil.
   */
  maxLibraryBytes: number;
  /** Soma máxima descompactada de todos os arquivos lidos (histórico + curtidas). */
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
  maxLibraryBytes: 32 * MiB,
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

/**
 * O único arquivo lido do export "Dados da conta": `YourLibrary.json`, e dele só as curtidas
 * (`tracks`), reduzidas ao nome do artista (minimização de dados, 08-seguranca.md).
 */
export const LIBRARY_FILE_PATTERN = /^YourLibrary(?: \(\d{1,3}\))?\.json$/i;

/**
 * Demais arquivos conhecidos do export "Dados da conta": perfil, identidade, pagamentos,
 * seguidores, inferências de anúncios, buscas, histórico curto de 1 ano, playlists etc.
 * **Nunca** são descompactados nem lidos, nem quando enviados soltos: o nome serve só para
 * reconhecer o export e explicar o erro `WRONG_EXPORT` (08-seguranca.md, "Dados da conta").
 */
export const ACCOUNT_DATA_FILE_PATTERN =
  /^(?:StreamingHistory(?:_music_|_podcast_|_audiobook_|_video_)?\d*|Userdata|Identity|Identifiers|Payments|Follow|Inferences|SearchQueries|Marquee|Playlist\d*|Wrapped\d*|YourSoundCapsule|FamilyPlan|DuoNewFamily|CustomerServiceHistory|MessageData|Messages|VoiceInput|YourVoiceInput|PreciseLocation|ConnectedDevices|PodcastInteractivity\w*)\.json$/i;

/** Comprimento máximo de nomes de faixa/artista/álbum aceitos num registro. */
export const MAX_NAME_LENGTH = 1024;
