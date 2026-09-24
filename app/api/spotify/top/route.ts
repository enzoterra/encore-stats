import { createSpotifyRoute, TTL } from '@/server/bff';
import { topParamsSchema } from '@/server/bff-params';
import { reduceTopArtists, reduceTopTracks } from '@/server/spotify-mappers';

export const dynamic = 'force-dynamic';

/** Top 50 de artistas ou músicas numa janela: `?type=artists|tracks&range=short_term|…`. */
export const GET = createSpotifyRoute({
  route: '/api/spotify/top',
  maxAge: TTL.top,
  params: topParamsSchema,
  handler: async (client, { type, range }) => {
    const body = await client.get(`/me/top/${type}`, { time_range: range, limit: '50' });
    return type === 'artists' ? reduceTopArtists(body) : reduceTopTracks(body);
  },
});
