import 'server-only';

/**
 * Log estruturado do BFF com **allowlist** de campos (RNF-11, PADROES §1).
 *
 * Só metadados: rota, método, status, duração, código de erro e contadores. Campos fora da
 * lista são descartados, e strings só passam se forem curtas e de um alfabeto restrito (sem
 * espaço, `?`, `=` ou `&`): um token, um `code`, uma query ou um nome de música não chegam ao
 * log nem por engano. O resto vira `"[redacted]"`.
 */

type FieldKind = 'string' | 'number' | 'boolean';

const ALLOWED_FIELDS = {
  route: 'string',
  method: 'string',
  status: 'number',
  durationMs: 'number',
  code: 'string',
  outcome: 'string',
  reason: 'string',
  upstreamStatus: 'number',
  attempt: 'number',
  retryAfter: 'number',
  refreshed: 'boolean',
  cleared: 'boolean',
  dropped: 'number',
} as const satisfies Record<string, FieldKind>;

export type LogFields = {
  [K in keyof typeof ALLOWED_FIELDS]?: (typeof ALLOWED_FIELDS)[K] extends 'string'
    ? string
    : (typeof ALLOWED_FIELDS)[K] extends 'number'
      ? number
      : boolean;
};

export type LogLevel = 'info' | 'warn' | 'error';

export type LogRecord = { ts: string; level: LogLevel; event: string } & LogFields;

const SAFE_STRING = /^[A-Za-z0-9_./:[\]-]{1,64}$/;
const REDACTED = '[redacted]';

/** Mantém só os campos da allowlist, com o tipo certo e strings seguras. */
export function sanitizeFields(fields: Record<string, unknown>): LogFields {
  const clean: Record<string, unknown> = {};
  for (const [key, kind] of Object.entries(ALLOWED_FIELDS)) {
    const value = fields[key];
    if (value === undefined) continue;
    if (kind === 'number') {
      if (typeof value === 'number' && Number.isFinite(value)) clean[key] = Math.round(value);
    } else if (kind === 'boolean') {
      if (typeof value === 'boolean') clean[key] = value;
    } else if (typeof value === 'string') {
      clean[key] = SAFE_STRING.test(value) ? value : REDACTED;
    }
  }
  return clean as LogFields;
}

type Sink = (record: LogRecord) => void;

const consoleSink: Sink = (record) => {
  const line = JSON.stringify(record);
  // Único ponto do BFF autorizado a escrever no console (a regra `no-console` vale no resto).
  // eslint-disable-next-line no-console
  (record.level === 'info' ? console.info : record.level === 'warn' ? console.warn : console.error)(
    line,
  );
};

let sink: Sink = consoleSink;

/** Só para testes: captura os registros (ou volta ao console com `undefined`). */
export function setLogSink(next: Sink | undefined): void {
  sink = next ?? consoleSink;
}

export function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const safeEvent = SAFE_STRING.test(event) ? event : REDACTED;
  sink({ ts: new Date().toISOString(), level, event: safeEvent, ...sanitizeFields(fields) });
}
