import { z } from 'zod';

import { MAX_NAME_LENGTH, VALID_PLAY_MS } from './constants';
import { normalizePlatform, type PlatformCode } from './platform';

const MAX_UINT32 = 0xffff_ffff;

const nullableName = z.string().max(MAX_NAME_LENGTH).nullish();
const nullableShort = z.string().max(256).nullish();

/**
 * Um registro do "Histórico estendido de streaming" (`Streaming_History_Audio_*.json`).
 *
 * Só os campos usados pelo Encore estão aqui. `z.object` do Zod 4 descarta (strip) as demais
 * chaves, então `ip_addr`, `conn_country`, `offline_timestamp` etc. nunca chegam ao Dataset
 * (PADROES §1, RNF-01). Os campos de episódio e audiolivro existem só para o predicado
 * `isMusic`.
 */
export const rawHistoryRecordSchema = z.object({
  /** ISO 8601 em UTC ("2021-03-04T12:34:56Z"); convertido para epoch em segundos. */
  ts: z
    .string()
    .max(64)
    .transform((value, ctx) => {
      const millis = Date.parse(value);
      const seconds = Math.floor(millis / 1000);
      if (Number.isNaN(millis) || seconds < 0 || seconds > MAX_UINT32) {
        ctx.addIssue({ code: 'custom', message: 'invalid ts' });
        return z.NEVER;
      }
      return seconds;
    }),
  ms_played: z.number().int().nonnegative().max(MAX_UINT32),
  master_metadata_track_name: nullableName,
  master_metadata_album_artist_name: nullableName,
  master_metadata_album_album_name: nullableName,
  spotify_track_uri: nullableShort,
  episode_name: nullableName,
  episode_show_name: nullableName,
  spotify_episode_uri: nullableShort,
  audiobook_title: nullableName,
  audiobook_uri: nullableShort,
  audiobook_chapter_uri: nullableShort,
  audiobook_chapter_title: nullableName,
  platform: nullableShort,
  reason_end: nullableShort,
  skipped: z.boolean().nullish(),
  shuffle: z.boolean().nullish(),
});

export type RawHistoryRecord = z.infer<typeof rawHistoryRecordSchema>;

/** Registro de música já normalizado, pronto para o Dataset. */
export type MusicRecord = {
  /** Epoch em segundos (UTC). */
  ts: number;
  ms: number;
  track: string;
  artist: string;
  album: string;
  uri: string;
  platform: PlatformCode;
  skipped: boolean;
  shuffle: boolean;
};

/**
 * É música quando há `spotify_track_uri` e nome da faixa, e todos os campos de episódio
 * (podcast) e de audiolivro estão vazios (RF-06). Faixas locais (sem URI) ficam de fora.
 */
export function isMusic(record: RawHistoryRecord): boolean {
  return (
    !!record.spotify_track_uri &&
    !!record.master_metadata_track_name &&
    !record.episode_name &&
    !record.episode_show_name &&
    !record.spotify_episode_uri &&
    !record.audiobook_title &&
    !record.audiobook_uri &&
    !record.audiobook_chapter_uri &&
    !record.audiobook_chapter_title
  );
}

/**
 * Regra de "pulada" (métrica "mais pulada", RF-11):
 * - `skipped === true` conta como pulo;
 * - `skipped === false` nunca conta (o campo explícito vence);
 * - sem `skipped` (registros antigos trazem `null`), conta quando `reason_end === 'fwdbtn'`,
 *   ou seja, o usuário avançou para a próxima faixa.
 */
export function isSkip(record: Pick<RawHistoryRecord, 'skipped' | 'reason_end'>): boolean {
  if (record.skipped === true) return true;
  if (record.skipped === false) return false;
  return record.reason_end === 'fwdbtn';
}

/** Play válido: `ms_played ≥ 30 s` (RF-06). */
export function isValidPlay(ms: number): boolean {
  return ms >= VALID_PLAY_MS;
}

/** Converte um registro validado de música. Chame só quando `isMusic(record)` for verdadeiro. */
export function toMusicRecord(record: RawHistoryRecord): MusicRecord {
  return {
    ts: record.ts,
    ms: record.ms_played,
    track: record.master_metadata_track_name ?? '',
    artist: record.master_metadata_album_artist_name ?? '',
    album: record.master_metadata_album_album_name ?? '',
    uri: record.spotify_track_uri ?? '',
    platform: normalizePlatform(record.platform),
    skipped: isSkip(record),
    shuffle: record.shuffle === true,
  };
}

/** Heurística: o item parece do export "Dados da conta" (`endTime`, `msPlayed`, `trackName`). */
export function looksLikeAccountData(item: unknown): boolean {
  return (
    typeof item === 'object' &&
    item !== null &&
    'endTime' in item &&
    'msPlayed' in item &&
    ('trackName' in item || 'episodeName' in item)
  );
}
