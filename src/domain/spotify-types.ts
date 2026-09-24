import { z } from 'zod';

/**
 * Respostas **reduzidas** do BFF (`/api/spotify/*`, 03-arquitetura). O BFF valida as
 * respostas do Spotify e devolve só estes campos; o cliente valida de novo (API10 do OWASP).
 * Os mesmos tipos alimentam o modo Demo (`src/domain/demo`).
 */

/** ID do Spotify: base62 com 22 caracteres. */
export const spotifyIdSchema = z.string().regex(/^[A-Za-z0-9]{22}$/);

/**
 * Link "Abrir no Spotify": só `https://open.spotify.com/...`. Bloqueia `javascript:` e hosts
 * arbitrários vindos de uma resposta adulterada (XSS/phishing).
 */
export const spotifyUrlSchema = z.url({ protocol: /^https$/, hostname: /^open\.spotify\.com$/ });

/** Capas e fotos: só os CDNs de imagem do Spotify (mesma allowlist da CSP `img-src`). */
export const imageUrlSchema = z.url({
  protocol: /^https$/,
  hostname: /^(i\.scdn\.co|([a-z0-9-]+\.)*spotifycdn\.com)$/,
});

const name = z.string().min(1).max(512);

export const artistRefSchema = z.object({ id: spotifyIdSchema, name });

export const artistSchema = z.object({
  id: spotifyIdSchema,
  name,
  genres: z.array(z.string().min(1).max(128)).max(50),
  image: imageUrlSchema.optional(),
  url: spotifyUrlSchema,
});

export const albumRefSchema = z.object({
  id: spotifyIdSchema,
  name,
  image: imageUrlSchema.optional(),
});

export const trackSchema = z.object({
  id: spotifyIdSchema,
  name,
  artists: z.array(artistRefSchema).min(1).max(50),
  album: albumRefSchema,
  url: spotifyUrlSchema,
});

export const savedItemSchema = z.object({
  addedAt: z.iso.datetime(),
  track: z.object({ id: spotifyIdSchema, artists: z.array(artistRefSchema).max(50) }),
});

/** Uma página de `/me/tracks` (máx. 50 itens). */
export const savedPageSchema = z.object({
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  items: z.array(savedItemSchema).max(50),
});

export const recentSchema = z.object({ playedAt: z.iso.datetime(), track: trackSchema });

export const meSchema = z.object({
  id: z.string().min(1).max(128),
  displayName: z.string().max(256).nullable(),
  image: imageUrlSchema.optional(),
});

export const TIME_RANGES = ['short_term', 'medium_term', 'long_term'] as const;
export const timeRangeSchema = z.enum(TIME_RANGES);

export const topArtistsResponseSchema = z.object({ items: z.array(artistSchema).max(50) });
export const topTracksResponseSchema = z.object({ items: z.array(trackSchema).max(50) });
export const recentResponseSchema = z.object({ items: z.array(recentSchema).max(50) });

export type SpotifyId = z.infer<typeof spotifyIdSchema>;
export type ArtistRef = z.infer<typeof artistRefSchema>;
export type Artist = z.infer<typeof artistSchema>;
export type AlbumRef = z.infer<typeof albumRefSchema>;
export type Track = z.infer<typeof trackSchema>;
export type SavedItem = z.infer<typeof savedItemSchema>;
export type SavedPage = z.infer<typeof savedPageSchema>;
export type Recent = z.infer<typeof recentSchema>;
export type Me = z.infer<typeof meSchema>;
export type TimeRange = z.infer<typeof timeRangeSchema>;
