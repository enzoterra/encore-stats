import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { validFixtureRecords } from '../../../scripts/make-fixtures';
import {
  chunkedInput,
  fileInput,
  fixtureBytes,
  fixtureInput,
} from '../../../tests/support/history';
import { FLAG_VALID } from './dataset';
import { processHistory, type ProcessProgress, type ProcessResult } from './process';
import { isSafeEntryName } from './unzip';

const HISTORY = 'Spotify Extended Streaming History/Streaming_History_Audio_2024_0.json';
const MTIME = new Date(2024, 0, 1, 12);

function zip(files: Record<string, Uint8Array | string>, level: 0 | 6 = 6): Uint8Array {
  const entries: Record<string, [Uint8Array, { mtime: Date }]> = {};
  for (const [name, data] of Object.entries(files)) {
    entries[name] = [typeof data === 'string' ? strToU8(data) : data, { mtime: MTIME }];
  }
  return zipSync(entries, { level, mtime: MTIME });
}

const record = (i: number) => ({
  ts: new Date(Date.UTC(2024, 5, 1) + i * 600_000).toISOString(),
  ms_played: i % 3 === 0 ? 10_000 : 180_000,
  master_metadata_track_name: `Faixa ${i % 4}`,
  master_metadata_album_artist_name: 'Artista Fictício',
  master_metadata_album_album_name: 'Álbum',
  spotify_track_uri: `spotify:track:${String(i % 4).padStart(22, 'x')}`,
  ip_addr: '192.0.2.77',
  conn_country: 'ZZ',
});

function errorCode(result: ProcessResult): string {
  return result.ok ? 'OK' : result.error.code;
}

function ok(result: ProcessResult) {
  if (!result.ok) throw new Error(`esperava sucesso, veio ${result.error.code}`);
  return result;
}

describe('processHistory — fixtures válidas', () => {
  it('zip válido com 2 arquivos: bate com o oráculo e ignora vídeo/PDF', async () => {
    const { dataset, report } = ok(await processHistory([fixtureInput('valid-two-files.zip')]));
    const { first, second } = validFixtureRecords();
    const all = [...first, ...second];
    expect(report).toEqual({ files: 2, records: 200, music: 200, nonMusic: 0, invalid: 0 });
    expect(dataset.cols.ts.length).toBe(200);

    const validPlays = all.filter((r) => Number(r.ms_played) >= 30_000).length;
    let flagged = 0;
    dataset.cols.flags.forEach((f) => (flagged += f & FLAG_VALID ? 1 : 0));
    expect(flagged).toBe(validPlays);

    const totalMs = all.reduce((sum, r) => sum + Number(r.ms_played), 0);
    expect(dataset.cols.ms.reduce((sum, ms) => sum + ms, 0)).toBe(totalMs);
    expect(new Set(all.map((r) => r.spotify_track_uri)).size).toBe(dataset.dict.tracks.length);

    const times = all.map((r) => Date.parse(String(r.ts)) / 1000).sort((a, b) => a - b);
    expect(dataset.range).toEqual({ from: times[0], to: times.at(-1) });
    for (let i = 1; i < dataset.cols.ts.length; i++) {
      expect(dataset.cols.ts[i]!).toBeGreaterThanOrEqual(dataset.cols.ts[i - 1]!);
    }
  });

  it('nada de ip_addr/conn_country no Dataset', async () => {
    const { dataset } = ok(await processHistory([fixtureInput('valid-two-files.zip')]));
    const serialized = JSON.stringify(dataset.dict);
    expect(serialized).not.toContain('192.0.2');
    expect(serialized).not.toContain('ZZ');
  });

  it('podcast, audiolivro e faixa local são descartados', async () => {
    const { dataset, report } = ok(
      await processHistory([fixtureInput('with-podcast-audiobook.zip')]),
    );
    expect(report).toMatchObject({ files: 1, music: 10, nonMusic: 10, invalid: 0 });
    expect(dataset.cols.ts.length).toBe(10);
    expect(dataset.dict.artists).not.toContain('Artista Local');
    expect(JSON.stringify(dataset.dict)).not.toMatch(/Podcast|Livro|Capítulo/);
  });

  it('aceita JSON solto e mistura com zip, ordenando por ts', async () => {
    const { dataset, report } = ok(
      await processHistory([
        fixtureInput('loose/Streaming_History_Audio_2025_0.json'),
        fixtureInput('valid-two-files.zip'),
      ]),
    );
    expect(report.files).toBe(3);
    expect(dataset.cols.ts.length).toBe(230);
    expect(dataset.cols.ts[0]).toBeLessThan(dataset.cols.ts[229]!);
  });

  it('aceita histórico na raiz do zip e tolera ≤ 5% inválidos', async () => {
    const data = Array.from({ length: 40 }, (_, i) => (i === 0 ? { quebrado: true } : record(i)));
    const bytes = zip({ 'Streaming_History_Audio_2024_0.json': JSON.stringify(data) });
    const { report } = ok(await processHistory([fileInput('h.zip', bytes)]));
    expect(report).toMatchObject({ music: 39, invalid: 1 });
  });

  it('cabeçalho do zip fatiado em pedaços de 1 byte', async () => {
    const bytes = fixtureBytes('valid-two-files.zip');
    const input = chunkedInput('v.zip', bytes, [1, 1, 1, 1, 4096]);
    expect(ok(await processHistory([input])).report.files).toBe(2);
  });

  it('emite progresso por etapa até "done"', async () => {
    const events: ProcessProgress[] = [];
    const input = fixtureInput('valid-two-files.zip');
    ok(await processHistory([input], { onProgress: (p) => events.push(p) }));
    const stages = events.map((e) => e.stage);
    expect(stages[0]).toBe('unzip');
    expect(stages).toContain('parse');
    expect(stages.at(-2)).toBe('aggregate');
    expect(stages.at(-1)).toBe('done');
    const last = events.at(-1)!;
    expect(last).toMatchObject({ bytesRead: input.size, bytesTotal: input.size, filesDone: 2 });
    expect(last.records).toBe(200);
  });

  it('emite progresso de leitura a cada 2 MiB', async () => {
    const data = Array.from({ length: 12_000 }, (_, i) => record(i));
    const bytes = zip({ [HISTORY]: JSON.stringify(data) }, 0);
    const events: ProcessProgress[] = [];
    ok(
      await processHistory([chunkedInput('big.zip', bytes, 256 * 1024)], {
        onProgress: (p) => events.push(p),
      }),
    );
    expect(events.filter((e) => e.stage === 'unzip').length).toBeGreaterThan(2);
  });
});

describe('processHistory — rejeições (erros tipados)', () => {
  it('zip bomb: aborta pela razão de compressão durante o streaming', async () => {
    const bytes = fixtureBytes('zip-bomb.zip');
    const input = chunkedInput('zip-bomb.zip', bytes, 16 * 1024);
    const result = await processHistory([input]);
    expect(result).toEqual({
      ok: false,
      error: { code: 'COMPRESSION_RATIO', file: 'zip-bomb.zip', entry: HISTORY, limit: 100 },
    });
    // Parou logo no começo: leu bem menos que o arquivo inteiro.
    expect(input.pulled()).toBeLessThan(bytes.length / 4);
  });

  it('zip bomb sem limite de razão: aborta pelo tamanho descompactado', async () => {
    const input = chunkedInput('zip-bomb.zip', fixtureBytes('zip-bomb.zip'), 16 * 1024);
    const result = await processHistory([input], {
      limits: { maxCompressionRatio: 1e9, maxEntryBytes: 4 * 1024 * 1024 },
    });
    expect(result.ok || result.error).toMatchObject({ code: 'ENTRY_TOO_LARGE', limit: 4194304 });
  });

  it('zip bomb: limite total', async () => {
    const result = await processHistory([fixtureInput('zip-bomb.zip')], {
      limits: { maxCompressionRatio: 1e9, maxTotalBytes: 2 * 1024 * 1024 },
    });
    expect(result.ok || result.error).toEqual({ code: 'TOTAL_TOO_LARGE', limit: 2097152 });
  });

  it('tamanho declarado no cabeçalho acima do limite: rejeita antes de inflar', async () => {
    const result = await processHistory([fixtureInput('valid-two-files.zip')], {
      limits: { maxEntryBytes: 1000 },
    });
    expect(errorCode(result)).toBe('ENTRY_TOO_LARGE');
  });

  it('razão declarada no cabeçalho acima do limite: rejeita antes de inflar', async () => {
    const bytes = zip({ [HISTORY]: `[${' '.repeat(3 * 1024 * 1024)}]` });
    const result = await processHistory([fileInput('a.zip', bytes)]);
    expect(errorCode(result)).toBe('COMPRESSION_RATIO');
  });

  it('path traversal (../) → UNSAFE_PATH', async () => {
    const result = await processHistory([fixtureInput('path-traversal.zip')]);
    expect(result.ok || result.error).toEqual({
      code: 'UNSAFE_PATH',
      file: 'path-traversal.zip',
      entry: '../../Streaming_History_Audio_evil.json',
    });
  });

  it('nome absoluto → UNSAFE_PATH', async () => {
    const bytes = zip({ '/etc/Streaming_History_Audio_x.json': '[]' });
    expect(errorCode(await processHistory([fileInput('a.zip', bytes)]))).toBe('UNSAFE_PATH');
  });

  it('JSON inválido → INVALID_JSON', async () => {
    const result = await processHistory([fixtureInput('invalid-json.zip')]);
    expect(result.ok || result.error).toEqual({ code: 'INVALID_JSON', entry: HISTORY });
  });

  it('formato inesperado → UNEXPECTED_FORMAT', async () => {
    expect(errorCode(await processHistory([fixtureInput('unexpected-format.zip')]))).toBe(
      'UNEXPECTED_FORMAT',
    );
  });

  it('muitos registros inválidos → INVALID_RECORDS', async () => {
    const data = Array.from({ length: 20 }, (_, i) => (i < 5 ? { x: i } : record(i)));
    const bytes = zip({ [HISTORY]: JSON.stringify(data) });
    expect(errorCode(await processHistory([fileInput('a.zip', bytes)]))).toBe('INVALID_RECORDS');
  });

  it('zip sem histórico → NO_HISTORY_FILES', async () => {
    expect(errorCode(await processHistory([fixtureInput('not-history.zip')]))).toBe(
      'NO_HISTORY_FILES',
    );
  });

  it('export "Dados da conta" → WRONG_EXPORT (zip e JSON solto)', async () => {
    expect(errorCode(await processHistory([fixtureInput('account-data.zip')]))).toBe(
      'WRONG_EXPORT',
    );
    const loose = fileInput('StreamingHistory_music_0.json', '[]');
    expect(errorCode(await processHistory([loose]))).toBe('WRONG_EXPORT');
  });

  it('mais de 200 entradas → TOO_MANY_ENTRIES', async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 201; i++) files[`f${i}.txt`] = 'x';
    const result = await processHistory([fileInput('many.zip', zip(files))]);
    expect(result.ok || result.error).toEqual({
      code: 'TOO_MANY_ENTRIES',
      file: 'many.zip',
      limit: 200,
    });
  });

  it('mais de 200 arquivos soltos → TOO_MANY_ENTRIES', async () => {
    const inputs = Array.from({ length: 201 }, (_, i) => fileInput(`h${i}.json`, '[]'));
    expect(errorCode(await processHistory(inputs))).toBe('TOO_MANY_ENTRIES');
  });

  it('extensão não suportada → UNSUPPORTED_FILE', async () => {
    const result = await processHistory([fileInput('foto.png', 'x')]);
    expect(result.ok || result.error).toEqual({ code: 'UNSUPPORTED_FILE', file: 'foto.png' });
  });

  it.each([
    ['não é zip', strToU8('isto não é um zip de verdade')],
    ['menor que a assinatura', strToU8('PK')],
    ['vazio', new Uint8Array(0)],
  ])('.zip inválido (%s) → INVALID_ZIP', async (_label, bytes) => {
    expect(errorCode(await processHistory([fileInput('a.zip', bytes)]))).toBe('INVALID_ZIP');
  });

  it('zip vazio (só o diretório central) → NO_HISTORY_FILES', async () => {
    expect(errorCode(await processHistory([fileInput('a.zip', zipSync({}))]))).toBe(
      'NO_HISTORY_FILES',
    );
  });

  it('zip truncado → INVALID_ZIP', async () => {
    const data = JSON.stringify(Array.from({ length: 200 }, (_, i) => record(i)));
    const bytes = zip({ [HISTORY]: data });
    const truncated = bytes.slice(0, Math.floor(bytes.length / 2));
    expect(errorCode(await processHistory([fileInput('a.zip', truncated)]))).toBe('INVALID_ZIP');
  });

  it('dados DEFLATE corrompidos → INVALID_ZIP', async () => {
    const data = JSON.stringify(Array.from({ length: 50 }, (_, i) => record(i)));
    const bytes = zip({ [HISTORY]: data });
    const nameLength = bytes[26]! | (bytes[27]! << 8);
    const start = 30 + nameLength;
    for (let i = start; i < start + 64; i++) bytes[i] = 0xff;
    expect(errorCode(await processHistory([fileInput('a.zip', bytes)]))).toBe('INVALID_ZIP');
  });

  it('método de compressão desconhecido → INVALID_ZIP', async () => {
    const bytes = zip({ [HISTORY]: JSON.stringify([record(1)]) });
    bytes[8] = 99; // campo "compression method" do cabeçalho local
    expect(errorCode(await processHistory([fileInput('a.zip', bytes)]))).toBe('INVALID_ZIP');
  });

  it('JSON solto maior que o limite (pelo tamanho declarado)', async () => {
    const result = await processHistory([fileInput('h.json', '[]')], {
      limits: { maxEntryBytes: 1 },
    });
    expect(errorCode(result)).toBe('ENTRY_TOO_LARGE');
  });

  it('JSON solto maior que o limite (tamanho declarado mentiroso)', async () => {
    const input = chunkedInput('h.json', strToU8(`[${' '.repeat(5000)}]`), 1000, 10);
    const result = await processHistory([input], { limits: { maxEntryBytes: 2000 } });
    expect(errorCode(result)).toBe('ENTRY_TOO_LARGE');
    expect(input.pulled()).toBeLessThan(5000);
  });

  it('JSONs soltos acima do limite total', async () => {
    const inputs = [fileInput('a.json', '[  ]'), fileInput('b.json', '[  ]')];
    expect(errorCode(await processHistory(inputs, { limits: { maxTotalBytes: 6 } }))).toBe(
      'TOTAL_TOO_LARGE',
    );
  });

  it('JSON solto que não é histórico → UNEXPECTED_FORMAT', async () => {
    const result = await processHistory([fileInput('Userdata.json', '{"username":"x"}')]);
    expect(errorCode(result)).toBe('UNEXPECTED_FORMAT');
  });

  it('erro inesperado vira INTERNAL, sem detalhes', async () => {
    const input = {
      name: 'a.json',
      size: 1,
      stream(): ReadableStream<Uint8Array> {
        throw new Error('segredo interno');
      },
    };
    expect(await processHistory([input])).toEqual({ ok: false, error: { code: 'INTERNAL' } });
  });
});

describe('processHistory — cancelamento', () => {
  it('sinal já abortado → CANCELLED', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await processHistory([fixtureInput('valid-two-files.zip')], {
      signal: controller.signal,
    });
    expect(result).toEqual({ ok: false, error: { code: 'CANCELLED' } });
  });

  it('abortar durante o processamento → CANCELLED', async () => {
    const controller = new AbortController();
    const result = await processHistory(
      [fixtureInput('valid-two-files.zip'), fixtureInput('with-podcast-audiobook.zip')],
      {
        signal: controller.signal,
        onProgress: (p) => {
          if (p.stage === 'parse') controller.abort();
        },
      },
    );
    expect(errorCode(result)).toBe('CANCELLED');
  });

  it('abortar durante a leitura de um JSON solto → CANCELLED', async () => {
    const controller = new AbortController();
    const input = chunkedInput('h.json', strToU8(JSON.stringify([record(1)])), 10);
    const stream = input.stream.bind(input);
    input.stream = () => {
      controller.abort();
      return stream();
    };
    const result = await processHistory([input], { signal: controller.signal });
    expect(errorCode(result)).toBe('CANCELLED');
  });

  it('abortar depois do último arquivo, antes de agregar → CANCELLED', async () => {
    const signal = { aborted: false };
    const result = await processHistory([fileInput('h.json', JSON.stringify([record(1)]))], {
      signal,
      onProgress: (p) => {
        if (p.stage === 'unzip' && p.filesDone === 1) signal.aborted = true;
      },
    });
    expect(errorCode(result)).toBe('CANCELLED');
  });
});

describe('isSafeEntryName', () => {
  it.each([
    ['Spotify Extended Streaming History/Streaming_History_Audio_2024.json', true],
    ['a..b/c.json', true],
    ['.../x.json', true],
    ['../x.json', false],
    ['a/../../x.json', false],
    ['a\\..\\x.json', false],
    ['..', false],
    ['/etc/passwd', false],
    ['\\\\server\\share\\x.json', false],
    ['C:/Windows/x.json', false],
    ['c:x.json', false],
    ['a\u0000.json', false],
    ['', false],
  ])('%j → %s', (name, expected) => {
    expect(isSafeEntryName(name)).toBe(expected);
  });
});
