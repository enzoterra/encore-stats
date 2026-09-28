import { strToU8, Zip, ZipDeflate, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { libraryFixture, SENSITIVE_CANARY } from '../../../scripts/make-fixtures';
import {
  chunkedInput,
  fileInput,
  fixtureBytes,
  fixtureInput,
} from '../../../tests/support/history';
import { EXPECTED_FIXTURE_LIBRARY } from '../../../tests/support/library';
import { DEFAULT_LIMITS } from './constants';
import {
  processHistory,
  processLibrary,
  type LibraryResult,
  type ProcessProgress,
  type ProcessResult,
} from './process';
import type { HistoryInput } from './unzip';

const LIBRARY_ENTRY = 'Spotify Account Data/YourLibrary.json';
const MTIME = new Date(2024, 0, 1, 12);

function zip(files: Record<string, Uint8Array | string>): Uint8Array {
  const entries: Record<string, [Uint8Array, { mtime: Date }]> = {};
  for (const [name, data] of Object.entries(files)) {
    entries[name] = [typeof data === 'string' ? strToU8(data) : data, { mtime: MTIME }];
  }
  return zipSync(entries, { level: 6, mtime: MTIME });
}

/** Zip em streaming (data descriptor): o cabeçalho local não declara tamanhos. */
function streamingZip(name: string, data: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  const archive = new Zip((error, chunk) => {
    if (error) throw error;
    parts.push(chunk);
  });
  const entry = new ZipDeflate(name, { level: 6 });
  archive.add(entry);
  entry.push(data, true);
  archive.end();
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Arquivo que falha se alguém tentar ler: prova de que o motor nunca abriu o arquivo. */
function unreadable(name: string): HistoryInput & { opened: () => boolean } {
  let opened = false;
  return {
    name,
    size: 100,
    opened: () => opened,
    stream(): ReadableStream<Uint8Array> {
      opened = true;
      throw new Error(`${name} não pode ser lido`);
    },
  };
}

function ok(result: ProcessResult) {
  if (!result.ok) throw new Error(`esperava sucesso, veio ${JSON.stringify(result.error)}`);
  return result;
}

function okLibrary(result: LibraryResult) {
  if (!result.ok) throw new Error(`esperava sucesso, veio ${JSON.stringify(result.error)}`);
  return result.library;
}

const libraryJson = () => fileInput('YourLibrary.json', JSON.stringify(libraryFixture()));

describe('processHistory — histórico + export "Dados da conta"', () => {
  it('só o histórico: sem `library` no resultado', async () => {
    const result = ok(await processHistory([fixtureInput('valid-two-files.zip')]));
    expect('library' in result).toBe(false);
  });

  it.each([
    [
      'dois zips',
      () => [fixtureInput('valid-two-files.zip'), fixtureInput('account-data-full.zip')],
    ],
    [
      'zip de curtidas antes do histórico',
      () => [fixtureInput('account-data-full.zip'), fixtureInput('valid-two-files.zip')],
    ],
    ['um zip com os dois exports', () => [fixtureInput('history-and-account-data.zip')]],
    [
      'zip do histórico + YourLibrary.json solto',
      () => [fixtureInput('valid-two-files.zip'), libraryJson()],
    ],
  ])('%s: curtidas por artista + o mesmo Dataset', async (_label, inputs) => {
    const alone = ok(await processHistory([fixtureInput('valid-two-files.zip')]));
    const result = ok(await processHistory(inputs()));
    expect(result.library).toEqual(EXPECTED_FIXTURE_LIBRARY);
    expect(result.report).toEqual(alone.report);
    expect(result.dataset).toEqual(alone.dataset);
  });

  it('JSONs soltos: histórico, curtidas e arquivos sensíveis que nunca são abertos', async () => {
    const sensitive = [
      'Userdata.json',
      'Identity.json',
      'Payments.json',
      'Follow.json',
      'Inferences.json',
      'SearchQueries.json',
      'StreamingHistory_music_0.json',
      'StreamingHistory_podcast_0.json',
      'Playlist1.json',
      'Marquee.json',
    ].map(unreadable);
    const result = ok(
      await processHistory([
        fixtureInput('loose/Streaming_History_Audio_2025_0.json'),
        ...sensitive,
        fixtureInput('loose/YourLibrary.json'),
      ]),
    );
    expect(result.report.files).toBe(1);
    expect(result.library).toEqual(EXPECTED_FIXTURE_LIBRARY);
    for (const file of sensitive) expect(file.opened(), file.name).toBe(false);
  });

  it('os arquivos sensíveis do zip nunca são descompactados (dados corrompidos passam)', async () => {
    // Em `account-data-poisoned.zip`, os dados DEFLATE de tudo o que não é o YourLibrary.json
    // são lixo: inflar qualquer um deles daria INVALID_ZIP.
    const result = ok(
      await processHistory([
        fixtureInput('valid-two-files.zip'),
        fixtureInput('account-data-poisoned.zip'),
      ]),
    );
    expect(result.library).toEqual(EXPECTED_FIXTURE_LIBRARY);
  });

  it('nada do export além das curtidas chega ao resultado', async () => {
    const result = ok(await processHistory([fixtureInput('history-and-account-data.zip')]));
    const serialized = JSON.stringify({ ...result, dataset: result.dataset.dict });
    expect(serialized).not.toContain(SENSITIVE_CANARY);
    expect(serialized).not.toContain('example.invalid');
    expect(serialized).not.toMatch(/Pessoa Fictícia|usuario-ficticio|busca fictícia/);
    // O histórico curto de 1 ano (StreamingHistory_music_*) não entra no Dataset.
    expect(result.dataset.dict.artists.join('|')).not.toContain('Histórico Curto');
    expect(Object.keys(result.library!)).toEqual(['total', 'artists']);
    for (const artist of result.library!.artists) {
      expect(Object.keys(artist)).toEqual(['name', 'count']);
    }
  });

  it.each([
    ['zip completo', () => [fixtureInput('account-data-full.zip')]],
    ['YourLibrary.json solto', () => [libraryJson()]],
    // O YourLibrary.json nem é interpretado sem histórico: o inválido dá o mesmo recado.
    ['zip com YourLibrary.json inválido', () => [fixtureInput('library-invalid.zip')]],
  ])('só as curtidas (%s) → WRONG_EXPORT com source library', async (_label, inputs) => {
    expect(await processHistory(inputs())).toEqual({
      ok: false,
      error: { code: 'WRONG_EXPORT', source: 'library' },
    });
  });

  it('export "Dados da conta" sem YourLibrary.json → WRONG_EXPORT', async () => {
    expect(await processHistory([fixtureInput('account-data.zip')])).toEqual({
      ok: false,
      error: { code: 'WRONG_EXPORT' },
    });
    const loose = [unreadable('Userdata.json'), unreadable('Payments.json')];
    expect(await processHistory(loose)).toEqual({ ok: false, error: { code: 'WRONG_EXPORT' } });
    for (const file of loose) expect(file.opened()).toBe(false);
  });

  it('YourLibrary.json inválido junto do histórico → UNEXPECTED_FORMAT com source library', async () => {
    const result = await processHistory([
      fixtureInput('valid-two-files.zip'),
      fixtureInput('library-invalid.zip'),
    ]);
    expect(result).toEqual({
      ok: false,
      error: { code: 'UNEXPECTED_FORMAT', entry: LIBRARY_ENTRY, source: 'library' },
    });
  });

  it('YourLibrary.json com JSON quebrado → INVALID_JSON com source library', async () => {
    const result = await processHistory([
      fixtureInput('valid-two-files.zip'),
      fileInput('YourLibrary.json', '{"tracks": [{"artist": '),
    ]);
    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_JSON', entry: 'YourLibrary.json', source: 'library' },
    });
  });

  it('YourLibrary.json maior que o limite (cabeçalho): rejeita antes de inflar', async () => {
    const result = await processHistory([
      fixtureInput('valid-two-files.zip'),
      fixtureInput('library-too-large.zip'),
    ]);
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'ENTRY_TOO_LARGE',
        file: 'library-too-large.zip',
        entry: LIBRARY_ENTRY,
        limit: DEFAULT_LIMITS.maxLibraryBytes,
        source: 'library',
      },
    });
  });

  it('YourLibrary.json maior que o limite durante o streaming (sem tamanho declarado)', async () => {
    const bytes = streamingZip(LIBRARY_ENTRY, strToU8(JSON.stringify(libraryFixture())));
    const result = await processHistory(
      [fixtureInput('valid-two-files.zip'), fileInput('conta.zip', bytes)],
      { limits: { maxLibraryBytes: 2000 } },
    );
    expect(result.ok || result.error).toEqual({
      code: 'ENTRY_TOO_LARGE',
      file: 'conta.zip',
      entry: LIBRARY_ENTRY,
      limit: 2000,
      source: 'library',
    });
  });

  it('YourLibrary.json solto maior que o limite (declarado e real)', async () => {
    const declared = await processHistory([fixtureInput('valid-two-files.zip'), libraryJson()], {
      limits: { maxLibraryBytes: 10 },
    });
    expect(declared.ok || declared.error).toMatchObject({
      code: 'ENTRY_TOO_LARGE',
      entry: 'YourLibrary.json',
      source: 'library',
    });
    const text = strToU8(JSON.stringify(libraryFixture()));
    const lying = chunkedInput('YourLibrary.json', text, 1000, 10);
    const real = await processHistory([fixtureInput('valid-two-files.zip'), lying], {
      limits: { maxLibraryBytes: 2000 },
    });
    expect(real.ok || real.error).toMatchObject({ code: 'ENTRY_TOO_LARGE', limit: 2000 });
    expect(lying.pulled()).toBeLessThan(text.length);
  });

  it('a soma de vários YourLibrary.json respeita o limite das curtidas', async () => {
    const size = strToU8(JSON.stringify(libraryFixture())).length;
    const result = await processHistory(
      [fixtureInput('valid-two-files.zip'), libraryJson(), libraryJson()],
      { limits: { maxLibraryBytes: size + 100 } },
    );
    expect(result.ok || result.error).toMatchObject({ code: 'ENTRY_TOO_LARGE', source: 'library' });
  });

  it('as curtidas contam no limite total', async () => {
    const history = fixtureInput('loose/Streaming_History_Audio_2025_0.json');
    const result = await processHistory([history, libraryJson()], {
      limits: { maxTotalBytes: history.size + 100 },
    });
    expect(result.ok || result.error).toMatchObject({ code: 'TOTAL_TOO_LARGE' });
  });

  it('razão de compressão do YourLibrary.json → COMPRESSION_RATIO com source library', async () => {
    const bytes = zip({ [LIBRARY_ENTRY]: `{"tracks": [${' '.repeat(3 * 1024 * 1024)}]}` });
    const result = await processHistory([
      fixtureInput('valid-two-files.zip'),
      fileInput('conta.zip', bytes),
    ]);
    expect(result.ok || result.error).toMatchObject({
      code: 'COMPRESSION_RATIO',
      entry: LIBRARY_ENTRY,
      source: 'library',
    });
  });

  it('razão real (streaming) do YourLibrary.json → COMPRESSION_RATIO', async () => {
    const bytes = streamingZip(
      LIBRARY_ENTRY,
      strToU8(`{"tracks": [${' '.repeat(3 * 1024 * 1024)}]}`),
    );
    const result = await processHistory([
      fixtureInput('valid-two-files.zip'),
      fileInput('conta.zip', bytes),
    ]);
    expect(result.ok || result.error).toMatchObject({
      code: 'COMPRESSION_RATIO',
      source: 'library',
    });
  });

  it('caminho inseguro no export "Dados da conta" → UNSAFE_PATH', async () => {
    const bytes = zip({ '../YourLibrary.json': JSON.stringify(libraryFixture()) });
    const result = await processHistory([
      fixtureInput('valid-two-files.zip'),
      fileInput('c.zip', bytes),
    ]);
    expect(result.ok || result.error).toMatchObject({ code: 'UNSAFE_PATH' });
  });

  it('progresso termina em "done" também com as curtidas', async () => {
    const events: ProcessProgress[] = [];
    ok(
      await processHistory([fixtureInput('history-and-account-data.zip')], {
        onProgress: (p) => events.push(p),
      }),
    );
    expect(events.at(-1)).toMatchObject({ stage: 'done', filesDone: 2, records: 200 });
  });

  it('cancelar durante a leitura das curtidas → CANCELLED', async () => {
    const signal = { aborted: false };
    const result = await processHistory([fixtureInput('history-and-account-data.zip')], {
      signal,
      onProgress: (p) => {
        if (p.stage === 'parse' && p.filesDone === 2) signal.aborted = true;
      },
    });
    expect(result).toEqual({ ok: false, error: { code: 'CANCELLED' } });
  });
});

describe('processLibrary — só as curtidas, para um histórico já carregado', () => {
  it.each([
    ['zip do export', () => [fixtureInput('account-data-full.zip')]],
    ['YourLibrary.json solto', () => [fixtureInput('loose/YourLibrary.json')]],
    ['zip com os dois exports', () => [fixtureInput('history-and-account-data.zip')]],
    ['zip com os dados sensíveis corrompidos', () => [fixtureInput('account-data-poisoned.zip')]],
  ])('%s', async (_label, inputs) => {
    expect(okLibrary(await processLibrary(inputs()))).toEqual(EXPECTED_FIXTURE_LIBRARY);
  });

  it('não descompacta o histórico (uma zip bomb de histórico passa sem ser inflada)', async () => {
    const bomb = chunkedInput('zip-bomb.zip', fixtureBytes('zip-bomb.zip'), 16 * 1024);
    const result = await processLibrary([bomb, fixtureInput('account-data-full.zip')]);
    expect(okLibrary(result)).toEqual(EXPECTED_FIXTURE_LIBRARY);
  });

  it('não abre JSONs soltos que não são o YourLibrary.json', async () => {
    const others = [
      unreadable('Streaming_History_Audio_2024_0.json'),
      unreadable('Userdata.json'),
      unreadable('qualquer.json'),
    ];
    const result = await processLibrary([...others, fixtureInput('loose/YourLibrary.json')]);
    expect(okLibrary(result)).toEqual(EXPECTED_FIXTURE_LIBRARY);
    for (const file of others) expect(file.opened(), file.name).toBe(false);
  });

  it('sem YourLibrary.json → NO_LIBRARY_FILE', async () => {
    for (const inputs of [
      [fixtureInput('valid-two-files.zip')],
      [fixtureInput('account-data.zip')],
      [unreadable('Userdata.json')],
      [],
    ]) {
      expect(await processLibrary(inputs)).toEqual({
        ok: false,
        error: { code: 'NO_LIBRARY_FILE' },
      });
    }
  });

  it('YourLibrary.json vazio de curtidas → total 0', async () => {
    const result = await processLibrary([fileInput('YourLibrary.json', '{"tracks": []}')]);
    expect(okLibrary(result)).toEqual({ total: 0, artists: [] });
  });

  it('progresso: filesDone e records (curtidas distintas) até "done"', async () => {
    const events: ProcessProgress[] = [];
    okLibrary(
      await processLibrary([fixtureInput('account-data-full.zip')], {
        onProgress: (p) => events.push(p),
      }),
    );
    expect(events.map((e) => e.stage)).toContain('parse');
    expect(events.at(-1)).toMatchObject({ stage: 'done', filesDone: 1, records: 30 });
  });

  it('erros tipados', async () => {
    expect(await processLibrary([fixtureInput('library-invalid.zip')])).toEqual({
      ok: false,
      error: { code: 'UNEXPECTED_FORMAT', entry: LIBRARY_ENTRY, source: 'library' },
    });
    expect(await processLibrary([fixtureInput('library-too-large.zip')])).toMatchObject({
      error: { code: 'ENTRY_TOO_LARGE', source: 'library' },
    });
    expect(await processLibrary([fileInput('foto.png', 'x')])).toEqual({
      ok: false,
      error: { code: 'UNSUPPORTED_FILE', file: 'foto.png' },
    });
    expect(await processLibrary([fileInput('a.zip', 'não é zip')])).toEqual({
      ok: false,
      error: { code: 'INVALID_ZIP', file: 'a.zip' },
    });
    const many = Array.from({ length: 201 }, (_, i) => fileInput(`h${i}.json`, '[]'));
    expect(await processLibrary(many)).toMatchObject({ error: { code: 'TOO_MANY_ENTRIES' } });
    const broken = { name: 'YourLibrary.json', size: 1, stream: unreadable('x').stream };
    expect(await processLibrary([broken])).toEqual({ ok: false, error: { code: 'INTERNAL' } });
  });

  it('cancelamento → CANCELLED', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(
      await processLibrary([fixtureInput('account-data-full.zip')], { signal: controller.signal }),
    ).toEqual({ ok: false, error: { code: 'CANCELLED' } });

    const signal = { aborted: false };
    const late = await processLibrary([fixtureInput('loose/YourLibrary.json')], {
      signal,
      onProgress: (p) => {
        if (p.stage === 'parse') signal.aborted = true;
      },
    });
    expect(late).toEqual({ ok: false, error: { code: 'CANCELLED' } });
  });
});
