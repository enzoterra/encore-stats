import { createSpotifyRoute, TTL } from '@/server/bff';
import { artistParamsSchema } from '@/server/bff-params';
import { reduceSingleArtist } from '@/server/spotify-mappers';

export const dynamic = 'force-dynamic';

/** Um artista (gêneros e foto), sob demanda: `id` base62 de 22 caracteres. */
export const GET = createSpotifyRoute({
  route: '/api/spotify/artist/[id]',
  maxAge: TTL.artist,
  params: artistParamsSchema,
  handler: async (client, { id }) => reduceSingleArtist(await client.get(`/artists/${id}`)),
});
