import { describe, expect, it } from 'vitest';

import {
  rawArtist,
  rawMe,
  rawRecent,
  rawSaved,
  rawTop,
  rawTrack,
  spotifyId,
} from '../../tests/mocks/spotify';

import { ApiError } from './api-errors';
import {
  reduceArtist,
  reduceMe,
  reduceRecent,
  reduceSavedPage,
  reduceSingleArtist,
  reduceTopArtists,
  reduceTopTracks,
  reduceTrack,
} from './spotify-mappers';

describe('redução das respostas do Spotify', () => {
  it('artista: só os campos do domínio, imagem de ~300 px e link montado pelo ID', () => {
    const raw = rawArtist(1);
    expect(reduceArtist(raw)).toEqual({
      id: raw.id,
      name: 'Artista 1',
      genres: ['indie pop', 'mpb'],
      image: 'https://i.scdn.co/image/a1300',
      url: `https://open.spotify.com/artist/${raw.id}`,
    });
  });

  it('artista sem genres (campo removido) e sem imagens continua válido', () => {
    const raw: Record<string, unknown> = { ...rawArtist(2) };
    delete raw.genres;
    delete raw.images;
    expect(reduceArtist(raw)).toEqual({
      id: raw.id,
      name: 'Artista 2',
      genres: [],
      url: `https://open.spotify.com/artist/${raw.id}`,
    });
  });

  it('descarta imagens fora dos CDNs do Spotify e links adulterados', () => {
    const raw = {
      ...rawArtist(3),
      images: [{ url: 'https://evil.example/x.png', width: 300, height: 300 }],
      external_urls: { spotify: 'javascript:alert(1)' },
    };
    const artist = reduceArtist(raw);
    expect(artist?.image).toBeUndefined();
    expect(artist?.url).toBe(`https://open.spotify.com/artist/${raw.id}`);
  });

  it('música: artistas e álbum reduzidos; faixa local (sem ID) é descartada', () => {
    const track = reduceTrack(rawTrack(1));
    expect(track).toEqual({
      id: spotifyId('track', 1),
      name: 'Música 1',
      artists: [{ id: spotifyId('artist', 1), name: 'Artista 1' }],
      album: {
        id: spotifyId('album', 1),
        name: 'Álbum 1',
        image: 'https://i.scdn.co/image/al1300',
      },
      url: `https://open.spotify.com/track/${spotifyId('track', 1)}`,
    });
    expect(reduceTrack({ ...rawTrack(2), id: null, is_local: true })).toBeNull();
    expect(reduceTrack({ ...rawTrack(3), artists: [{ id: null, name: 'Local' }] })).toBeNull();
    expect(reduceTrack('lixo')).toBeNull();
  });

  it('nome longo é cortado em 512 caracteres; nome vazio descarta o item', () => {
    expect(reduceArtist({ ...rawArtist(1), name: 'x'.repeat(600) })?.name).toHaveLength(512);
    expect(reduceArtist({ ...rawArtist(1), name: '   ' })).toBeNull();
  });

  it('tops: descarta itens inválidos e conta quantos', () => {
    const raw = rawTop('tracks', 3);
    raw.items.push({ ...rawTrack(9), id: 'curto' });
    const { data, dropped } = reduceTopTracks(raw);
    expect(data.items).toHaveLength(3);
    expect(dropped).toBe(1);
    expect(reduceTopArtists(rawTop('artists', 2)).data.items).toHaveLength(2);
  });

  it('envelope inválido vira UPSTREAM', () => {
    expect(() => reduceTopArtists({ nada: [] })).toThrow(ApiError);
    expect(() => reduceTopArtists({ items: Array.from({ length: 51 }, () => ({})) })).toThrow(
      ApiError,
    );
    expect(() => reduceSavedPage({ items: [] })).toThrow(ApiError);
    expect(() => reduceMe({ display_name: 'sem id' })).toThrow(ApiError);
    expect(() => reduceSingleArtist({ id: 'x' })).toThrow(ApiError);
  });

  it('perfil: id, displayName e imagem; nada de e-mail ou país', () => {
    expect(reduceMe(rawMe).data).toEqual({
      id: 'usuario-teste',
      displayName: 'Pessoa Teste',
      image: 'https://i.scdn.co/image/me300',
    });
    expect(reduceMe({ id: 'x', display_name: null, images: [] }).data).toEqual({
      id: 'x',
      displayName: null,
    });
  });

  it('recentes: playedAt + música', () => {
    const { data } = reduceRecent(rawRecent(2));
    expect(data.items[0]).toMatchObject({
      playedAt: '2026-09-20T10:00:00.000Z',
      track: { id: spotifyId('track', 1) },
    });
    const bad = rawRecent(1);
    bad.items.push({ track: rawTrack(5), played_at: 'ontem', context: null });
    expect(reduceRecent(bad)).toMatchObject({ dropped: 1 });
  });

  it('curtidas: total, offset e só id + artistas de cada faixa', () => {
    const { data } = reduceSavedPage(rawSaved(50, 2, 120));
    expect(data).toEqual({
      total: 120,
      offset: 50,
      items: [
        {
          addedAt: '2025-01-01T12:00:00Z',
          track: {
            id: spotifyId('track', 51),
            artists: [{ id: spotifyId('artist', 51), name: 'Artista 51' }],
          },
        },
        {
          addedAt: '2025-01-02T12:00:00Z',
          track: {
            id: spotifyId('track', 52),
            artists: [{ id: spotifyId('artist', 52), name: 'Artista 52' }],
          },
        },
      ],
    });
    const raw = rawSaved(0, 1);
    raw.items.push(
      { added_at: 'x', track: rawTrack(7) },
      { added_at: '2025-01-01T00:00:00Z', track: { ...rawTrack(8), id: null } } as never,
      { added_at: '2025-01-01T00:00:00Z', track: null } as never,
    );
    expect(reduceSavedPage(raw)).toMatchObject({ dropped: 3 });
  });

  it('artista avulso', () => {
    expect(reduceSingleArtist(rawArtist(4)).data.id).toBe(spotifyId('artist', 4));
  });
});
