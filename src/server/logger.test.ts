import { afterEach, describe, expect, it, vi } from 'vitest';

import { log, sanitizeFields, setLogSink, type LogRecord } from './logger';

afterEach(() => {
  setLogSink(undefined);
  vi.restoreAllMocks();
});

describe('logger com allowlist', () => {
  it('mantém só os campos permitidos, com o tipo certo', () => {
    expect(
      sanitizeFields({
        route: '/api/spotify/top',
        status: 200,
        durationMs: 12.7,
        refreshed: true,
        token: 'segredo',
        code: 'RATE_LIMITED',
        body: { items: [] },
        query: 'code=abc&state=def',
        status2: 1,
        dropped: 'dois',
      }),
    ).toEqual({
      route: '/api/spotify/top',
      status: 200,
      durationMs: 13,
      refreshed: true,
      code: 'RATE_LIMITED',
    });
  });

  it('troca strings suspeitas (espaço, query, texto longo) por [redacted]', () => {
    expect(sanitizeFields({ reason: 'Música do Artista' }).reason).toBe('[redacted]');
    expect(sanitizeFields({ route: '/api/auth/callback?code=x' }).route).toBe('[redacted]');
    expect(sanitizeFields({ code: 'x'.repeat(65) }).code).toBe('[redacted]');
    expect(sanitizeFields({ status: Number.NaN }).status).toBeUndefined();
  });

  it('escreve JSON de uma linha no console por padrão', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    log('info', 'bff.request', { status: 200, at: 'token' });
    log('warn', 'auth.callback', { outcome: 'state' });
    log('error', 'evento com espaço');
    const record = JSON.parse(info.mock.calls[0]?.[0] as string) as LogRecord;
    expect(record).toMatchObject({ level: 'info', event: 'bff.request', status: 200 });
    expect(record).not.toHaveProperty('at');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(error.mock.calls[0]?.[0] as string)).toMatchObject({ event: '[redacted]' });
  });

  it('permite capturar os registros nos testes', () => {
    const records: LogRecord[] = [];
    setLogSink((record) => records.push(record));
    log('info', 'auth.login', { route: '/api/auth/login' });
    expect(records).toHaveLength(1);
    expect(records[0]?.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
