import type * as Comlink from 'comlink';
import { strToU8 } from 'fflate';
import { describe, expect, it, vi } from 'vitest';

import { fileInput, fixtureInput } from '../../tests/support/history';
import type { ProcessOptions, ProcessProgress, ProcessResult } from '@/domain/history';

import { createHistoryWorkerApi } from './history-worker-api';

describe('createHistoryWorkerApi', () => {
  it('processa e marca as colunas do Dataset para transferência', async () => {
    const calls: [unknown, Transferable[]][] = [];
    const transfer = <T>(value: T, transfers: Transferable[]): T => {
      calls.push([value, transfers]);
      return value;
    };
    const api = createHistoryWorkerApi({ transfer });
    const progress: ProcessProgress[] = [];
    const result = await api.processHistory([fixtureInput('valid-two-files.zip')], (p) => {
      progress.push(p);
    });
    expect(result.ok).toBe(true);
    expect(progress.at(-1)?.stage).toBe('done');
    if (result.ok) {
      expect(calls).toHaveLength(1);
      expect(calls[0]![0]).toBe(result);
      expect(calls[0]![1]).toEqual([
        result.dataset.cols.ts.buffer,
        result.dataset.cols.ms.buffer,
        result.dataset.cols.track.buffer,
        result.dataset.cols.platform.buffer,
        result.dataset.cols.flags.buffer,
      ]);
    }
  });

  it('devolve o erro tipado sem lançar', async () => {
    const api = createHistoryWorkerApi();
    const result = await api.processHistory([fileInput('x.zip', strToU8('nope'))]);
    expect(result).toEqual({ ok: false, error: { code: 'INVALID_ZIP', file: 'x.zip' } });
  });

  it('cancel() aborta o job em andamento', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const fake = vi.fn(
      async (_files: unknown, options?: ProcessOptions): Promise<ProcessResult> => {
        await gate;
        return options?.signal?.aborted
          ? { ok: false, error: { code: 'CANCELLED' } }
          : { ok: false, error: { code: 'INTERNAL' } };
      },
    );
    const api = createHistoryWorkerApi({ process: fake });
    const pending = api.processHistory([]);
    api.cancel();
    release();
    await expect(pending).resolves.toEqual({ ok: false, error: { code: 'CANCELLED' } });
    api.cancel(); // sem job: não faz nada
  });

  it('um novo job cancela o anterior', async () => {
    const signals: { aborted: boolean }[] = [];
    const fake = vi.fn(
      async (_files: unknown, options?: ProcessOptions): Promise<ProcessResult> => {
        const signal = options!.signal!;
        signals.push(signal);
        await Promise.resolve();
        return { ok: false, error: { code: signal.aborted ? 'CANCELLED' : 'INTERNAL' } };
      },
    );
    const api = createHistoryWorkerApi({ process: fake });
    const first = api.processHistory([]);
    const second = api.processHistory([]);
    await expect(first).resolves.toMatchObject({ error: { code: 'CANCELLED' } });
    await expect(second).resolves.toMatchObject({ error: { code: 'INTERNAL' } });
    expect(signals[0]!.aborted).toBe(true);
  });

  it('ignora falhas do callback de progresso (proxy liberado)', async () => {
    const api = createHistoryWorkerApi({ limits: {} });
    const throwing = () => {
      throw new Error('proxy liberado');
    };
    const rejecting = () => Promise.reject(new Error('canal fechado')) as unknown as void;
    for (const onProgress of [throwing, rejecting]) {
      const result = await api.processHistory([fixtureInput('valid-two-files.zip')], onProgress);
      expect(result.ok).toBe(true);
    }
  });
});

describe('history.worker', () => {
  it('expõe a API via Comlink', async () => {
    vi.resetModules();
    const expose = vi.fn();
    vi.doMock('comlink', async (original) => ({
      ...(await original<typeof Comlink>()),
      expose,
    }));
    await import('./history.worker');
    expect(expose).toHaveBeenCalledTimes(1);
    const api = expose.mock.calls[0]![0] as Record<string, unknown>;
    expect(typeof api.processHistory).toBe('function');
    expect(typeof api.cancel).toBe('function');
    vi.doUnmock('comlink');
  });
});
