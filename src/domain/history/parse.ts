import { MAX_INVALID_RATIO } from './constants';
import { displayName, fail } from './errors';
import {
  isMusic,
  looksLikeAccountData,
  rawHistoryRecordSchema,
  toMusicRecord,
  type MusicRecord,
} from './schema';

export type ParseCounts = {
  /** Itens no array do arquivo. */
  total: number;
  /** Itens que falharam na validação do schema. */
  invalid: number;
  /** Registros de música entregues ao `onMusic`. */
  music: number;
  /** Registros válidos que não são música (podcast, audiolivro, faixa local). */
  nonMusic: number;
};

const decoder = new TextDecoder();

/**
 * Lê um `Streaming_History_Audio_*.json`, valida cada item com `safeParse` e entrega só os
 * registros de música. Regras:
 * - JSON malformado → `INVALID_JSON`;
 * - raiz que não é array, ou array em que nenhum item é válido → `UNEXPECTED_FORMAT`
 *   (ou `WRONG_EXPORT` se o conteúdo for do export "Dados da conta");
 * - mais de 5% de itens inválidos → `INVALID_RECORDS` (o arquivo inteiro é rejeitado).
 *
 * Como uma falha aborta todo o processamento, entregar os registros antes da contagem final
 * não deixa resultado parcial para trás.
 */
export function parseHistoryJson(
  entry: string,
  bytes: Uint8Array,
  onMusic: (record: MusicRecord) => void,
): ParseCounts {
  let data: unknown;
  try {
    data = JSON.parse(decoder.decode(bytes));
  } catch {
    fail({ code: 'INVALID_JSON', entry: displayName(entry) });
  }
  if (!Array.isArray(data)) fail({ code: 'UNEXPECTED_FORMAT', entry: displayName(entry) });

  const counts: ParseCounts = { total: data.length, invalid: 0, music: 0, nonMusic: 0 };
  for (const item of data as unknown[]) {
    const parsed = rawHistoryRecordSchema.safeParse(item);
    if (!parsed.success) {
      counts.invalid++;
      continue;
    }
    if (isMusic(parsed.data)) {
      counts.music++;
      onMusic(toMusicRecord(parsed.data));
    } else {
      counts.nonMusic++;
    }
  }

  if (counts.total > 0 && counts.invalid === counts.total) {
    if (looksLikeAccountData(data[0])) fail({ code: 'WRONG_EXPORT' });
    fail({ code: 'UNEXPECTED_FORMAT', entry: displayName(entry) });
  }
  if (counts.invalid > counts.total * MAX_INVALID_RATIO) {
    fail({
      code: 'INVALID_RECORDS',
      entry: displayName(entry),
      invalid: counts.invalid,
      total: counts.total,
    });
  }
  return counts;
}
