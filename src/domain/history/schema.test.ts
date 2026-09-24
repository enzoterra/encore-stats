import { describe, expect, it } from 'vitest';

import { normalizePlatform, platformIndex, PLATFORMS } from './platform';
import {
  isMusic,
  isSkip,
  isValidPlay,
  looksLikeAccountData,
  rawHistoryRecordSchema,
  toMusicRecord,
} from './schema';

const music = {
  ts: '2024-03-10T21:15:30Z',
  platform: 'Android OS 13 API 33 (Fixture, Phone)',
  ms_played: 185_000,
  conn_country: 'ZZ',
  ip_addr: '192.0.2.10',
  master_metadata_track_name: 'Faixa Um',
  master_metadata_album_artist_name: 'Lua de Vinil',
  master_metadata_album_album_name: 'Álbum Azul',
  spotify_track_uri: 'spotify:track:0123456789ABCDEFGHIJKL',
  episode_name: null,
  episode_show_name: null,
  spotify_episode_uri: null,
  audiobook_title: null,
  audiobook_uri: null,
  audiobook_chapter_uri: null,
  audiobook_chapter_title: null,
  reason_start: 'trackdone',
  reason_end: 'trackdone',
  shuffle: true,
  skipped: false,
  offline: false,
  offline_timestamp: 1710105330000,
  incognito_mode: false,
};

describe('rawHistoryRecordSchema', () => {
  it('descarta ip_addr, conn_country e campos não usados (strip)', () => {
    const parsed = rawHistoryRecordSchema.parse(music);
    expect(parsed).not.toHaveProperty('ip_addr');
    expect(parsed).not.toHaveProperty('conn_country');
    expect(parsed).not.toHaveProperty('offline_timestamp');
    expect(parsed).not.toHaveProperty('incognito_mode');
    expect(JSON.stringify(parsed)).not.toContain('192.0.2');
  });

  it('converte ts ISO em epoch (segundos)', () => {
    expect(rawHistoryRecordSchema.parse(music).ts).toBe(Date.UTC(2024, 2, 10, 21, 15, 30) / 1000);
  });

  it.each([
    ['ts inválido', { ts: 'ontem' }],
    ['ts antes de 1970', { ts: '1969-12-31T23:59:59Z' }],
    ['ts após 2106', { ts: '2107-01-01T00:00:00Z' }],
    ['ts não string', { ts: 123 }],
    ['ms negativo', { ms_played: -1 }],
    ['ms fracionário', { ms_played: 1.5 }],
    ['ms ausente', { ms_played: undefined }],
    ['nome gigante', { master_metadata_track_name: 'x'.repeat(5000) }],
    ['skipped não booleano', { skipped: 'yes' }],
  ])('rejeita %s', (_label, patch) => {
    expect(rawHistoryRecordSchema.safeParse({ ...music, ...patch }).success).toBe(false);
  });

  it('aceita campos opcionais ausentes (registros antigos)', () => {
    const parsed = rawHistoryRecordSchema.parse({ ts: music.ts, ms_played: 1 });
    expect(parsed.skipped).toBeUndefined();
    expect(isMusic(parsed)).toBe(false);
  });
});

describe('isMusic', () => {
  const parse = (patch: Record<string, unknown>) =>
    rawHistoryRecordSchema.parse({ ...music, ...patch });

  it('aceita faixa com URI e nome', () => {
    expect(isMusic(parse({}))).toBe(true);
  });

  it.each([
    ['sem URI (faixa local)', { spotify_track_uri: null }],
    ['sem nome', { master_metadata_track_name: null }],
    ['episódio', { episode_name: 'Ep. 1' }],
    ['show', { episode_show_name: 'Podcast' }],
    ['URI de episódio', { spotify_episode_uri: 'spotify:episode:x' }],
    ['audiolivro', { audiobook_title: 'Livro' }],
    ['URI de audiolivro', { audiobook_uri: 'spotify:show:x' }],
    ['capítulo', { audiobook_chapter_uri: 'spotify:episode:y' }],
    ['título de capítulo', { audiobook_chapter_title: 'Cap. 1' }],
  ])('recusa %s', (_label, patch) => {
    expect(isMusic(parse(patch))).toBe(false);
  });
});

describe('isSkip', () => {
  it.each([
    [true, 'trackdone', true],
    [false, 'fwdbtn', false],
    [null, 'fwdbtn', true],
    [undefined, 'fwdbtn', true],
    [null, 'trackdone', false],
    [null, null, false],
  ])('skipped=%s reason_end=%s → %s', (skipped, reason, expected) => {
    expect(isSkip({ skipped, reason_end: reason })).toBe(expected);
  });
});

describe('isValidPlay', () => {
  it('conta a partir de 30 s', () => {
    expect(isValidPlay(29_999)).toBe(false);
    expect(isValidPlay(30_000)).toBe(true);
  });
});

describe('toMusicRecord', () => {
  it('normaliza campos', () => {
    expect(toMusicRecord(rawHistoryRecordSchema.parse(music))).toEqual({
      ts: 1710105330,
      ms: 185_000,
      track: 'Faixa Um',
      artist: 'Lua de Vinil',
      album: 'Álbum Azul',
      uri: 'spotify:track:0123456789ABCDEFGHIJKL',
      platform: 'android',
      skipped: false,
      shuffle: true,
    });
  });

  it('usa string vazia quando artista/álbum faltam', () => {
    const record = toMusicRecord(
      rawHistoryRecordSchema.parse({
        ...music,
        master_metadata_album_artist_name: null,
        master_metadata_album_album_name: null,
        shuffle: null,
      }),
    );
    expect(record.artist).toBe('');
    expect(record.album).toBe('');
    expect(record.shuffle).toBe(false);
  });
});

describe('normalizePlatform', () => {
  it.each([
    ['Android OS 9 API 28 (samsung, SM-G960F)', 'android'],
    ['android', 'android'],
    ['iOS 14.4 (iPhone12,1)', 'ios'],
    ['ios', 'ios'],
    ['iPad', 'ios'],
    ['Windows 10 (10.0.19042; x64)', 'desktop'],
    ['OS X 10.15.7 [x86 8]', 'desktop'],
    ['osx', 'desktop'],
    ['linux', 'desktop'],
    ['web_player windows 10;chrome 88.0.4324.150;desktop', 'web'],
    ['web', 'web'],
    ['Partner android_tv Sony;BRAVIA', 'tv'],
    ['Samsung Tizen TV', 'tv'],
    ['LG webOS TV', 'tv'],
    ['roku', 'tv'],
    ['cast_to_device', 'other'],
    ['playstation', 'other'],
    ['', 'other'],
    [null, 'other'],
    [undefined, 'other'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizePlatform(raw)).toBe(expected);
  });

  it('índices seguem a ordem fixa de PLATFORMS', () => {
    PLATFORMS.forEach((code, index) => expect(platformIndex(code)).toBe(index));
  });
});

describe('looksLikeAccountData', () => {
  it('reconhece o formato "Dados da conta"', () => {
    expect(looksLikeAccountData({ endTime: '2024-01-01 10:00', msPlayed: 1, trackName: 'x' })).toBe(
      true,
    );
    expect(looksLikeAccountData({ endTime: 'x', msPlayed: 1, episodeName: 'e' })).toBe(true);
    expect(looksLikeAccountData({ endTime: 'x' })).toBe(false);
    expect(looksLikeAccountData(null)).toBe(false);
    expect(looksLikeAccountData('x')).toBe(false);
  });
});
