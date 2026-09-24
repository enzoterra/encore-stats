import { describe, expect, it } from 'vitest';

import { buildReminderIcs, escapeIcsText, foldIcsLine } from './ics';

const base = {
  now: new Date(2026, 8, 24, 15, 30, 0),
  title: 'Encore: chegou o histórico do Spotify?',
  description: 'Veja se chegou; depois envie, em https://encore.app/pt-BR/upload',
  url: 'https://encore.app/pt-BR/upload',
  uid: 'abc@encore',
};

describe('buildReminderIcs (RF-02)', () => {
  it('gera um VCALENDAR válido com CRLF, evento de dia inteiro e repetição semanal', () => {
    const ics = buildReminderIcs(base);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261001');
    expect(ics).toContain('DTEND;VALUE=DATE:20261002');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;COUNT=5');
    expect(ics).toContain('UID:abc@encore');
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    expect(ics).toContain('BEGIN:VALARM');
  });

  it('escapa vírgula, ponto e vírgula, barra invertida e quebra de linha', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    expect(buildReminderIcs(base)).toContain('Veja se chegou\\; depois envie\\, em');
  });

  it('dobra linhas acima de 75 octetos sem partir caracteres UTF-8', () => {
    const line = `DESCRIPTION:${'ç'.repeat(80)}`;
    const folded = foldIcsLine(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    const encoder = new TextEncoder();
    for (const part of parts) expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(line);
  });

  it('respeita a antecedência e o número de semanas', () => {
    const ics = buildReminderIcs({ ...base, firstInDays: 1, weeks: 2 });
    expect(ics).toContain('DTSTART;VALUE=DATE:20260925');
    expect(ics).toContain('COUNT=2');
  });
});
