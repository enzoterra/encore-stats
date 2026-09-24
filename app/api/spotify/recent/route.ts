import { createSpotifyRoute, TTL } from '@/server/bff';
import { noParamsSchema } from '@/server/bff-params';
import { reduceRecent } from '@/server/spotify-mappers';

export const dynamic = 'force-dynamic';

/** Últimas 50 tocadas. */
export const GET = createSpotifyRoute({
  route: '/api/spotify/recent',
  maxAge: TTL.recent,
  params: noParamsSchema,
  handler: async (client) =>
    reduceRecent(await client.get('/me/player/recently-played', { limit: '50' })),
});
