import 'server-only';

import { z } from 'zod';

import { spotifyIdSchema, timeRangeSchema } from '@/domain/spotify-types';

/**
 * Parâmetros das rotas `/api/spotify/*` (03, "Convenções do BFF"). Objetos estritos: parâmetro
 * desconhecido ou repetido é 400. Nada daqui vira host ou caminho livre: `type` e `id` só
 * entram na URL do Spotify depois de validados.
 */

const noPath = z.object({}).strict();
const noQuery = z.object({}).strict();

export const MAX_SAVED_OFFSET = 100_000;
export const SAVED_PAGE_SIZE = 50;

export const noParamsSchema = z
  .object({ query: noQuery, path: noPath })
  .transform((): null => null);

export const topParamsSchema = z
  .object({
    query: z.object({ type: z.enum(['artists', 'tracks']), range: timeRangeSchema }).strict(),
    path: noPath,
  })
  .transform(({ query }) => query);

const offsetSchema = z
  .string()
  .regex(/^(0|[1-9]\d{0,5})$/)
  .transform(Number)
  .pipe(z.number().int().min(0).max(MAX_SAVED_OFFSET).multipleOf(SAVED_PAGE_SIZE));

/** `limit=1` serve para validar o cache da varredura (03: comparar `total` e o 1º `addedAt`). */
const limitSchema = z.enum(['1', '50']).transform(Number);

export const savedParamsSchema = z
  .object({
    query: z
      .object({ offset: offsetSchema.default(0), limit: limitSchema.default(SAVED_PAGE_SIZE) })
      .strict(),
    path: noPath,
  })
  .transform(({ query }) => query);

export const artistParamsSchema = z
  .object({ query: noQuery, path: z.object({ id: spotifyIdSchema }).strict() })
  .transform(({ path }) => path);
