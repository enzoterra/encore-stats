import { createSpotifyRoute, TTL } from '@/server/bff';
import { savedParamsSchema } from '@/server/bff-params';
import { reduceSavedPage } from '@/server/spotify-mappers';

export const dynamic = 'force-dynamic';

/** Uma página das músicas curtidas: `?offset=0..100000 (múltiplo de 50)&limit=1|50`. */
export const GET = createSpotifyRoute({
  route: '/api/spotify/saved',
  maxAge: TTL.saved,
  params: savedParamsSchema,
  handler: async (client, { offset, limit }) =>
    reduceSavedPage(
      await client.get('/me/tracks', { offset: String(offset), limit: String(limit) }),
    ),
});
