'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { LikedArtistsCounter, savedPageOffsets, type LikedArtistCount } from '@/domain/api-stats';
import type { SavedPage } from '@/domain/spotify-types';

import { BffError, isBffError } from './bff-client';
import { TTL } from './connect-client';
import { useConnectBundle } from './connect-provider';
import { runPool, sleep } from './limiter';
import { readSession, writeSession } from './session-cache';

/** Varredura com concorrência 3 (03-arquitetura, "Varredura de curtidas"). */
export const SCAN_CONCURRENCY = 3;
/** Tentativas por página quando o Spotify pede pausa (429). */
const MAX_RATE_LIMIT_WAITS = 3;

export type LikedSummary = {
  userId: string;
  /** Impressão digital da biblioteca: `total` + `addedAt` da curtida mais recente. */
  total: number;
  firstAddedAt: string | null;
  scannedAt: number;
  pages: number;
  top: LikedArtistCount[];
};

export type ScanState =
  | { status: 'idle' }
  | { status: 'checking'; summary: LikedSummary }
  | {
      status: 'running';
      pagesDone: number;
      pagesTotal: number;
      /** Segundos de pausa pedidos pelo Spotify (429) antes de seguir. */
      waitingSeconds: number | null;
    }
  | { status: 'done'; summary: LikedSummary; changed: boolean }
  | { status: 'error'; error: BffError };

const cacheKey = (userId: string) => `liked.${userId}`;

function fingerprint(page: SavedPage): Pick<LikedSummary, 'total' | 'firstAddedAt'> {
  return { total: page.total, firstAddedAt: page.items[0]?.addedAt ?? null };
}

export type ScanEvents = {
  onCancelled?: () => void;
  onUnchanged?: () => void;
};

/**
 * Varredura de curtidas sob demanda (RF-18, US-10):
 * - lê `/me/tracks` em páginas de 50 com concorrência 3, agregando com `LikedArtistsCounter`
 *   (só `Map<artistId, count>`, sem guardar as faixas);
 * - progresso por páginas; cancelar = `AbortController` e nenhum resultado parcial;
 * - 429 numa página: espera o `retryAfter` e tenta de novo a mesma página;
 * - o resultado fica 12 h no sessionStorage. Antes de revarrer, uma chamada barata (`limit=1`)
 *   compara `total` e o 1º `addedAt`: se forem iguais, reaproveita o resultado.
 */
export function useLikedScan(userId: string, events: ScanEvents = {}) {
  const { source, report, likedRef } = useConnectBundle();
  const persist = source.kind === 'live';
  // Segunda visita (< 12 h): o resultado guardado aparece já na primeira renderização.
  const [state, setState] = useState<ScanState>(() => {
    const cached = persist ? readSession<LikedSummary>(cacheKey(userId)) : undefined;
    return cached?.userId === userId ? { status: 'checking', summary: cached } : { status: 'idle' };
  });
  const controller = useRef<AbortController | null>(null);
  const eventsRef = useRef(events);
  // O card de compartilhar usa o resultado mais recente (curtidas do artista nº 1).
  const summary = state.status === 'done' || state.status === 'checking' ? state.summary : null;
  useEffect(() => {
    if (summary) likedRef.current = summary.top;
  }, [likedRef, summary]);
  useEffect(() => {
    eventsRef.current = events;
  });

  const save = useCallback(
    (summary: LikedSummary) => {
      if (persist) writeSession(cacheKey(summary.userId), summary, TTL.saved);
    },
    [persist],
  );

  const abortCurrent = () => {
    controller.current?.abort(new DOMException('cancelled', 'AbortError'));
    controller.current = null;
  };

  const fail = useCallback(
    (error: unknown, signal: AbortSignal) => {
      if (signal.aborted) return;
      report(error);
      setState({ status: 'error', error: isBffError(error) ? error : new BffError('INTERNAL', 0) });
    },
    [report],
  );

  const scan = useCallback(async () => {
    abortCurrent();
    const ctrl = new AbortController();
    controller.current = ctrl;
    const { signal } = ctrl;
    const counter = new LikedArtistsCounter();
    let pagesDone = 0;
    let pagesTotal = 0;
    // Páginas esperando o `retryAfter` de um 429 (as outras seguem em paralelo).
    let waiting = 0;
    let waitSeconds: number | null = null;
    const emit = () =>
      setState({
        status: 'running',
        pagesDone,
        pagesTotal,
        waitingSeconds: waiting > 0 ? waitSeconds : null,
      });
    emit();

    const fetchPage = async (offset: number): Promise<SavedPage> => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await source.saved(offset, 50, { signal, fresh: true });
        } catch (error) {
          if (
            isBffError(error) &&
            error.code === 'RATE_LIMITED' &&
            attempt < MAX_RATE_LIMIT_WAITS &&
            !signal.aborted
          ) {
            const seconds = error.retryAfter ?? 5;
            waiting++;
            waitSeconds = Math.max(waitSeconds ?? 0, seconds);
            emit();
            try {
              await sleep(seconds * 1000, signal);
            } finally {
              waiting--;
              if (waiting === 0) waitSeconds = null;
            }
            emit();
            continue;
          }
          if (isBffError(error) && error.code === 'UPSTREAM' && attempt === 0) continue;
          throw error;
        }
      }
    };

    try {
      const first = await fetchPage(0);
      counter.addPage(first);
      const offsets = savedPageOffsets(first.total);
      pagesTotal = offsets.length;
      pagesDone = Math.min(1, pagesTotal);
      emit();
      await runPool(offsets.slice(1), SCAN_CONCURRENCY, async (offset) => {
        const page = await fetchPage(offset);
        if (signal.aborted) return;
        counter.addPage(page);
        pagesDone++;
        emit();
      });
      if (signal.aborted) return;
      const summary: LikedSummary = {
        userId,
        ...fingerprint(first),
        scannedAt: Date.now(),
        pages: pagesTotal,
        top: counter.top(10),
      };
      save(summary);
      setState({ status: 'done', summary, changed: false });
    } catch (error) {
      fail(error, signal);
      // Nenhuma página nova depois de um erro; as que estão em voo são descartadas.
      ctrl.abort(new DOMException('failed', 'AbortError'));
    } finally {
      if (controller.current === ctrl) controller.current = null;
    }
  }, [fail, save, source, userId]);

  /** Validação barata: `limit=1` e compara a impressão digital com o resultado guardado. */
  const probe = useCallback(
    async (summary: LikedSummary, { rescanIfChanged }: { rescanIfChanged: boolean }) => {
      abortCurrent();
      const ctrl = new AbortController();
      controller.current = ctrl;
      try {
        const probe = await source.saved(0, 1, { signal: ctrl.signal, fresh: true });
        if (ctrl.signal.aborted) return;
        const now = fingerprint(probe);
        const same = now.total === summary.total && now.firstAddedAt === summary.firstAddedAt;
        if (same) {
          setState({ status: 'done', summary, changed: false });
          if (rescanIfChanged) eventsRef.current.onUnchanged?.();
        } else if (rescanIfChanged) {
          controller.current = null;
          void scan();
        } else setState({ status: 'done', summary, changed: true });
      } catch (error) {
        if (ctrl.signal.aborted) return;
        report(error);
        // A conferência falhou (ex.: 429): o resultado guardado continua válido por 12 h.
        setState({ status: 'done', summary, changed: false });
      } finally {
        if (controller.current === ctrl) controller.current = null;
      }
    },
    [report, scan, source],
  );

  // Com resultado guardado, confere em segundo plano se a biblioteca mudou (só na montagem).
  const initial = useRef(state);
  useEffect(() => {
    const first = initial.current;
    if (first.status === 'checking') void probe(first.summary, { rescanIfChanged: false });
    return abortCurrent;
  }, [probe]);

  const start = useCallback(() => {
    if (state.status === 'done' && !state.changed) {
      setState({ status: 'checking', summary: state.summary });
      void probe(state.summary, { rescanIfChanged: true });
    } else void scan();
  }, [probe, scan, state]);

  const cancel = useCallback(() => {
    abortCurrent();
    setState({ status: 'idle' });
    eventsRef.current.onCancelled?.();
  }, []);

  useEffect(() => abortCurrent, []);

  return { state, start, cancel, retry: scan };
}
