import { describe, expect, it } from 'vitest';

import {
  artistSchema,
  meSchema,
  recentSchema,
  savedPageSchema,
  spotifyIdSchema,
  timeRangeSchema,
  trackSchema,
} from './spotify-types';

const id = '4Z8W4fKeB5YxbusRsdQVPb';

const artist = {
  id,
  name: 'Artista',
  genres: ['indie'],
  image: 'https://i.scdn.co/image/abc',
  url: `https://open.spotify.com/artist/${id}`,
};

const track = {
  id,
  name: 'Faixa',
  artists: [{ id, name: 'Artista' }],
  album: { id, name: 'Álbum', image: 'https://image-cdn-ak.spotifycdn.com/image/x' },
  url: `https://open.spotify.com/track/${id}`,
};

describe('spotify-types', () => {
  it('aceita respostas reduzidas válidas', () => {
    expect(artistSchema.parse(artist)).toEqual(artist);
    expect(trackSchema.parse(track)).toEqual(track);
    expect(recentSchema.parse({ playedAt: '2024-01-01T10:00:00.123Z', track }).track.id).toBe(id);
    expect(
      savedPageSchema.parse({
        total: 1,
        offset: 0,
        items: [{ addedAt: '2024-01-01T00:00:00Z', track: { id, artists: [{ id, name: 'A' }] } }],
      }).total,
    ).toBe(1);
    expect(meSchema.parse({ id: 'user', displayName: null }).displayName).toBeNull();
    expect(timeRangeSchema.options).toEqual(['short_term', 'medium_term', 'long_term']);
  });

  it.each([
    ['id curto', { id: 'abc' }],
    ['id com símbolo', { id: '4Z8W4fKeB5YxbusRsdQVP!' }],
    ['link javascript:', { url: 'javascript:alert(1)' }],
    ['link http', { url: `http://open.spotify.com/artist/${id}` }],
    ['link de outro host', { url: 'https://evil.example/artist' }],
    ['imagem de outro host', { image: 'https://evil.example/x.png' }],
    ['imagem com host parecido', { image: 'https://i.scdn.co.evil.example/x.png' }],
    ['nome vazio', { name: '' }],
  ])('recusa artista com %s', (_label, patch) => {
    expect(artistSchema.safeParse({ ...artist, ...patch }).success).toBe(false);
  });

  it('recusa faixa sem artistas e datas fora do ISO', () => {
    expect(trackSchema.safeParse({ ...track, artists: [] }).success).toBe(false);
    expect(recentSchema.safeParse({ playedAt: 'ontem', track }).success).toBe(false);
    expect(spotifyIdSchema.safeParse(id).success).toBe(true);
  });
});
