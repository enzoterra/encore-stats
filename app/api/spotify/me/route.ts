import { createSpotifyRoute, TTL } from '@/server/bff';
import { noParamsSchema } from '@/server/bff-params';
import { reduceMe } from '@/server/spotify-mappers';

export const dynamic = 'force-dynamic';

/** Perfil mínimo do dono da sessão: `{ id, displayName, image? }`. */
export const GET = createSpotifyRoute({
  route: '/api/spotify/me',
  maxAge: TTL.me,
  params: noParamsSchema,
  handler: async (client) => reduceMe(await client.get('/me')),
});
