/**
 * Lembrete `.ics` (RFC 5545) gerado no cliente (RF-02): nenhum dado sai do aparelho.
 * Função pura, para testar em Node; o download fica em `reminder-button.tsx`.
 */
export type ReminderOptions = {
  /** Instante de criação (DTSTAMP). */
  now: Date;
  title: string;
  description: string;
  url: string;
  uid: string;
  /** Dias até o primeiro lembrete. */
  firstInDays?: number;
  /** Quantas ocorrências semanais. */
  weeks?: number;
};

/** Escapa texto conforme RFC 5545 §3.3.11. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Quebra linhas em 75 octetos (RFC 5545 §3.1), sem partir caracteres UTF-8. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = out.length === 0 ? 75 : 74; // continuação começa com um espaço
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

const pad = (n: number) => String(n).padStart(2, '0');

function utcStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function localDate(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/** Evento de dia inteiro, repetido toda semana, com alarme às 9h do dia. */
export function buildReminderIcs({
  now,
  title,
  description,
  url,
  uid,
  firstInDays = 7,
  weeks = 5,
}: ReminderOptions): string {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + firstInDays);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Encore//Lembrete do historico//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART;VALUE=DATE:${localDate(start)}`,
    `DTEND;VALUE=DATE:${localDate(end)}`,
    `RRULE:FREQ=WEEKLY;COUNT=${weeks}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `URL:${url}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(title)}`,
    'TRIGGER:PT9H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}
