import 'server-only';

import { z } from 'zod';

import {
  artistSchema,
  imageUrlSchema,
  meSchema,
  recentResponseSchema,
  savedPageSchema,
  spotifyIdSchema,
  topArtistsResponseSchema,
  topTracksResponseSchema,
  trackSchema,
  type Artist,
  type ArtistRef,
  type Me,
  type Recent,
  type SavedItem,
  type SavedPage,
  type Track,
} from '@/domain/spotify-types';

import { ApiError } from './api-errors';

/**
 * Validação (Zod) e **redução** das respostas do Spotify aos tipos de `src/domain/spotify-types.ts`
 * (API10 do OWASP API Top 10). Regras:
 * - Os schemas de entrada são tolerantes (campos extras são ignorados e campos que o Spotify
 *   removeu, como `genres`, viram padrão), mas a saída é sempre validada pelo schema do domínio.
 * - Item de lista inválido (ex.: faixa local sem ID) é descartado e contado; envelope inválido
 *   vira `UPSTREAM`.
 * - Links "Abrir no Spotify" são montados a partir do ID validado, nunca copiados da resposta.
 * - Imagem: a de largura mais próxima de 300 px entre as dos CDNs do Spotify.
 */

const MAX_NAME = 512;
const PREFERRED_IMAGE_WIDTH = 300;

const rawImagesSchema = z
  .array(
    z.object({
      url: z.string(),
      width: z.number().nullish(),
      height: z.number().nullish(),
    }),
  )
  .nullish()
  .catch(null);

const rawArtistRefSchema = z.object({ id: z.string().nullish(), name: z.string().nullish() });

const rawArtistSchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  genres: z.array(z.unknown()).nullish().catch(null),
  images: rawImagesSchema,
});

const rawTrackSchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  artists: z.array(z.unknown()).nullish(),
  album: z
    .object({ id: z.string().nullish(), name: z.string().nullish(), images: rawImagesSchema })
    .nullish(),
});

const itemsEnvelope = z.object({ items: z.array(z.unknown()).max(50) });

export type Reduced<T> = { data: T; dropped: number };

function invalidResponse(): ApiError {
  return new ApiError('UPSTREAM', { reason: 'invalid_response' });
}

function cleanName(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed.slice(0, MAX_NAME);
}

function pickImage(images: z.infer<typeof rawImagesSchema>): string | undefined {
  const valid = (images ?? []).filter((image) => imageUrlSchema.safeParse(image.url).success);
  if (valid.length === 0) return undefined;
  const distance = (width: number | null | undefined) =>
    Math.abs((width ?? PREFERRED_IMAGE_WIDTH) - PREFERRED_IMAGE_WIDTH);
  return valid.reduce((best, image) =>
    distance(image.width) < distance(best.width) ? image : best,
  ).url;
}

function openUrl(kind: 'artist' | 'track', id: string): string {
  return `https://open.spotify.com/${kind}/${id}`;
}

function reduceArtistRefs(raw: unknown[] | null | undefined): ArtistRef[] {
  const refs: ArtistRef[] = [];
  for (const item of raw ?? []) {
    const parsed = rawArtistRefSchema.safeParse(item);
    if (!parsed.success) continue;
    const id = parsed.data.id;
    const name = cleanName(parsed.data.name);
    if (!name || !spotifyIdSchema.safeParse(id).success) continue;
    refs.push({ id: id as string, name });
    if (refs.length === 50) break;
  }
  return refs;
}

export function reduceArtist(raw: unknown): Artist | null {
  const parsed = rawArtistSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { id, name, genres, images } = parsed.data;
  const genreNames = (genres ?? [])
    .filter((genre): genre is string => typeof genre === 'string')
    .map((genre) => genre.trim())
    .filter((genre) => genre.length > 0 && genre.length <= 128)
    .slice(0, 50);
  const result = artistSchema.safeParse({
    id,
    name: cleanName(name),
    genres: genreNames,
    image: pickImage(images),
    url: typeof id === 'string' ? openUrl('artist', id) : undefined,
  });
  return result.success ? result.data : null;
}

export function reduceTrack(raw: unknown): Track | null {
  const parsed = rawTrackSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { id, name, artists, album } = parsed.data;
  const result = trackSchema.safeParse({
    id,
    name: cleanName(name),
    artists: reduceArtistRefs(artists),
    album: {
      id: album?.id,
      name: cleanName(album?.name),
      image: pickImage(album?.images),
    },
    url: typeof id === 'string' ? openUrl('track', id) : undefined,
  });
  return result.success ? result.data : null;
}

function reduceList<T>(raw: unknown, reduceItem: (item: unknown) => T | null): Reduced<T[]> {
  const envelope = itemsEnvelope.safeParse(raw);
  if (!envelope.success) throw invalidResponse();
  const data: T[] = [];
  for (const item of envelope.data.items) {
    const reduced = reduceItem(item);
    if (reduced !== null) data.push(reduced);
  }
  return { data, dropped: envelope.data.items.length - data.length };
}

/** Garante o contrato final com o schema do domínio (defesa em profundidade). */
function ensure<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}

const rawMeSchema = z.object({
  id: z.string(),
  display_name: z.string().nullish(),
  images: rawImagesSchema,
});

export function reduceMe(raw: unknown): Reduced<Me> {
  const parsed = rawMeSchema.safeParse(raw);
  if (!parsed.success) throw invalidResponse();
  const displayName = parsed.data.display_name?.trim();
  const image = pickImage(parsed.data.images);
  return {
    data: ensure(meSchema, {
      id: parsed.data.id,
      displayName: displayName ? displayName.slice(0, 256) : null,
      ...(image ? { image } : {}),
    }),
    dropped: 0,
  };
}

export function reduceTopArtists(raw: unknown): Reduced<{ items: Artist[] }> {
  const { data, dropped } = reduceList(raw, reduceArtist);
  return { data: ensure(topArtistsResponseSchema, { items: data }), dropped };
}

export function reduceTopTracks(raw: unknown): Reduced<{ items: Track[] }> {
  const { data, dropped } = reduceList(raw, reduceTrack);
  return { data: ensure(topTracksResponseSchema, { items: data }), dropped };
}

const rawRecentItemSchema = z.object({ played_at: z.string(), track: z.unknown() });

export function reduceRecent(raw: unknown): Reduced<{ items: Recent[] }> {
  const { data, dropped } = reduceList(raw, (item): Recent | null => {
    const parsed = rawRecentItemSchema.safeParse(item);
    if (!parsed.success || !z.iso.datetime().safeParse(parsed.data.played_at).success) return null;
    const track = reduceTrack(parsed.data.track);
    return track ? { playedAt: parsed.data.played_at, track } : null;
  });
  return { data: ensure(recentResponseSchema, { items: data }), dropped };
}

const rawSavedEnvelope = z.object({
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  items: z.array(z.unknown()).max(50),
});

const rawSavedItemSchema = z.object({
  added_at: z.string(),
  track: z.object({ id: z.string().nullish(), artists: z.array(z.unknown()).nullish() }).nullish(),
});

export function reduceSavedPage(raw: unknown): Reduced<SavedPage> {
  const envelope = rawSavedEnvelope.safeParse(raw);
  if (!envelope.success) throw invalidResponse();
  const items: SavedItem[] = [];
  for (const item of envelope.data.items) {
    const parsed = rawSavedItemSchema.safeParse(item);
    if (!parsed.success || !parsed.data.track) continue;
    const { id, artists } = parsed.data.track;
    if (!spotifyIdSchema.safeParse(id).success) continue;
    if (!z.iso.datetime().safeParse(parsed.data.added_at).success) continue;
    items.push({
      addedAt: parsed.data.added_at,
      track: { id: id as string, artists: reduceArtistRefs(artists) },
    });
  }
  return {
    data: ensure(savedPageSchema, {
      total: envelope.data.total,
      offset: envelope.data.offset,
      items,
    }),
    dropped: envelope.data.items.length - items.length,
  };
}

export function reduceSingleArtist(raw: unknown): Reduced<Artist> {
  const artist = reduceArtist(raw);
  if (!artist) throw invalidResponse();
  return { data: artist, dropped: 0 };
}
