import { describe, expect, it } from 'vitest';

import { DatasetBuilder } from './history/dataset';
import type { MusicRecord } from './history/schema';
import {
  dayToIsoDate,
  dayToYearMonth,
  localIndex,
  localMidnightToUtc,
  resolveTimeZone,
  tzOffsetSeconds,
  weekdayOfDay,
} from './time';

const utc = (...args: [number, number, number, number?, number?]) =>
  Date.UTC(args[0], args[1] - 1, args[2], args[3] ?? 0, args[4] ?? 0) / 1000;

function dataset(times: number[]) {
  const builder = new DatasetBuilder();
  for (const ts of times) {
    const record: MusicRecord = {
      ts,
      ms: 60_000,
      track: 't',
      artist: 'a',
      album: 'b',
      uri: 'u',
      platform: 'web',
      skipped: false,
      shuffle: false,
    };
    builder.add(record);
  }
  return builder.build();
}

describe('resolveTimeZone', () => {
  it('aceita IANA válido e cai para UTC nos demais casos', () => {
    expect(resolveTimeZone('America/Sao_Paulo')).toBe('America/Sao_Paulo');
    expect(resolveTimeZone('Marte/Olympus')).toBe('UTC');
    expect(resolveTimeZone(undefined)).toBe('UTC');
    expect(resolveTimeZone('')).toBe('UTC');
  });
});

describe('tzOffsetSeconds', () => {
  it.each([
    ['UTC', utc(2024, 6, 1), 0],
    ['America/Sao_Paulo', utc(2024, 6, 1), -3 * 3600],
    ['Europe/Berlin', utc(2024, 1, 15), 3600],
    ['Europe/Berlin', utc(2024, 7, 15), 7200],
    ['Asia/Kolkata', utc(2024, 7, 15), 19_800],
  ])('%s em %i → %i', (tz, ts, expected) => {
    expect(tzOffsetSeconds(ts, tz)).toBe(expected);
  });
});

describe('localMidnightToUtc', () => {
  it('meia-noite local em São Paulo (UTC−3)', () => {
    expect(localMidnightToUtc(2024, 1, 1, 'America/Sao_Paulo')).toBe(utc(2024, 1, 1, 3));
  });

  it('dia de início do horário de verão em Berlim', () => {
    expect(localMidnightToUtc(2024, 3, 31, 'Europe/Berlin')).toBe(utc(2024, 3, 30, 23));
    expect(localMidnightToUtc(2024, 4, 1, 'Europe/Berlin')).toBe(utc(2024, 3, 31, 22));
  });

  it('normaliza mês 13 e dia 32', () => {
    expect(localMidnightToUtc(2024, 13, 1, 'UTC')).toBe(utc(2025, 1, 1));
    expect(localMidnightToUtc(2024, 1, 32, 'UTC')).toBe(utc(2024, 2, 1));
  });
});

describe('datas de dia', () => {
  it('converte dia em data ISO, ano/mês e dia da semana ISO', () => {
    const day = utc(2024, 1, 1) / 86_400;
    expect(dayToIsoDate(day)).toBe('2024-01-01');
    expect(dayToYearMonth(day)).toEqual({ year: 2024, month: 1 });
    expect(weekdayOfDay(0)).toBe(3); // 1970-01-01, quinta
    expect(weekdayOfDay(day)).toBe(0); // 2024-01-01, segunda
    expect(weekdayOfDay(-1)).toBe(2); // 1969-12-31, quarta
  });
});

describe('localIndex', () => {
  it('converte hora e dia locais e memoriza por (dataset, fuso)', () => {
    const ds = dataset([utc(2024, 1, 1, 2, 30), utc(2024, 1, 1, 4, 0)]);
    const sp = localIndex(ds, 'America/Sao_Paulo');
    // 02:30Z = 23:30 de domingo (31/12) em SP; 04:00Z = 01:00 de segunda.
    expect(Array.from(sp.weekHour)).toEqual([6 * 24 + 23, 0 * 24 + 1]);
    expect(Array.from(sp.day).map(dayToIsoDate)).toEqual(['2023-12-31', '2024-01-01']);
    expect(localIndex(ds, 'America/Sao_Paulo')).toBe(sp);
    expect(localIndex(ds, 'UTC')).not.toBe(sp);
  });

  it('dia de transição de horário de verão converte registro a registro', () => {
    const ds = dataset([utc(2024, 3, 31, 0, 30), utc(2024, 3, 31, 1, 30), utc(2024, 3, 31, 12)]);
    const berlin = localIndex(ds, 'Europe/Berlin');
    // 00:30Z = 01:30 CET; 01:30Z = 03:30 CEST; 12:00Z = 14:00 CEST (domingo = 6)
    expect(Array.from(berlin.weekHour)).toEqual([6 * 24 + 1, 6 * 24 + 3, 6 * 24 + 14]);
  });
});
