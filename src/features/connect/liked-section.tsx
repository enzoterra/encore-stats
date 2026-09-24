'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Heart, RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { missingArtistIds, type LikedArtistCount } from '@/domain/api-stats';
import type { Artist } from '@/domain/spotify-types';

import { connectKeys } from './connect-client';
import { useConnectBundle } from './connect-provider';
import { Cover } from './cover';
import { MediaRow } from './media-row';
import { useArtists, useNow } from './queries';
import { ConnectSection, SectionError } from './section';
import { SpotifyIcon } from './spotify-brand';
import { useConnectFormat } from './use-connect-format';
import { useLikedScan, type LikedSummary } from './use-liked-scan';

/** Artistas que já estão em cache (top de qualquer janela): não precisam de `/artist/:id`. */
function useKnownArtists(): Artist[] {
  const queryClient = useQueryClient();
  const { source } = useConnectBundle();
  return queryClient
    .getQueriesData<Artist[]>({ queryKey: [...connectKeys.all(source.kind), 'top', 'artists'] })
    .flatMap(([, data]) => data ?? []);
}

function artistUrl(entry: LikedArtistCount, info?: Artist): string {
  // O ID veio validado pelo schema (base62, 22 caracteres); o BFF monta o link do mesmo jeito.
  return info?.url ?? `https://open.spotify.com/artist/${entry.id}`;
}

function Result({
  summary,
  changed,
  onRefresh,
}: {
  summary: LikedSummary;
  changed: boolean;
  /** Ausente enquanto a conferência roda. */
  onRefresh?: () => void;
}) {
  const t = useTranslations('Connect.liked');
  const tTop = useTranslations('Connect.top');
  const tCommon = useTranslations('Common');
  const format = useConnectFormat();
  const now = useNow(60_000);
  const { source } = useConnectBundle();
  const known = useKnownArtists();
  const byId = new Map(known.map((a) => [a.id, a]));
  const fetched = useArtists(missingArtistIds(summary.top, known, 10));
  const info = (id: string) => byId.get(id) ?? fetched.get(id);

  if (summary.top.length === 0) {
    return <p className="text-body-sm text-fg-muted">{t('empty')}</p>;
  }
  const [winner, ...others] = summary.top;
  const winnerInfo = info(winner!.id);
  const live = source.kind === 'live';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4" data-testid="liked-winner">
        <Cover src={winnerInfo?.image} name={winner!.name} size={96} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-overline text-info uppercase">{t('winner')}</p>
          <p className="font-display text-metric [overflow-wrap:anywhere] lg:text-metric-lg">
            {winner!.name}
          </p>
          <p className="text-body-strong">{t('count', { count: winner!.count })}</p>
          {live ? (
            <a
              href={artistUrl(winner!, winnerInfo)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-sm py-1 text-caption font-semibold text-fg-muted uppercase hover:text-fg"
            >
              <SpotifyIcon />
              {tTop('open')}
              <span className="sr-only">{tCommon('externalLink')}</span>
            </a>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-caption text-fg-subtle">
          {t('updated', { when: format.ago(summary.scannedAt, now) })}
        </p>
        {onRefresh ? (
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw aria-hidden="true" />
            {t('refresh')}
          </Button>
        ) : null}
      </div>
      {changed ? (
        <p role="status" className="text-body-sm text-warning">
          {t('changed')}
        </p>
      ) : null}
      {others.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-overline text-fg-muted uppercase">{t('othersTitle')}</h3>
          <ol aria-label={t('othersLabel')} start={2} className="flex flex-col">
            {others.map((entry, index) => {
              const artist = info(entry.id);
              return (
                <MediaRow
                  key={entry.id}
                  rank={index + 2}
                  name={entry.name}
                  image={artist?.image}
                  url={artistUrl(entry, artist)}
                  size={40}
                  trailing={
                    <span className="inline-flex items-center gap-1">
                      <Heart aria-hidden="true" className="size-3.5 text-primary-fg" />
                      <span aria-hidden="true">{format.number(entry.count)}</span>
                      <span className="sr-only">{t('count', { count: entry.count })}</span>
                    </span>
                  }
                />
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Varredura de curtidas (RF-18, US-10, 10-design.md §8.11): idle → rodando (página X de Y,
 * cancelar) → pronto (artista + quantas, "atualizado há…", atualizar). Cancelar volta ao idle.
 */
export function LikedSection({ userId }: { userId: string }) {
  const t = useTranslations('Connect.liked');
  const { state, start, cancel, retry } = useLikedScan(userId, {
    onCancelled: () => toast(t('cancelled'), 'info'),
    onUnchanged: () => toast(t('unchanged'), 'success'),
  });

  return (
    <ConnectSection id="connect-liked" title={t('title')} testId="connect-liked">
      <div className="rounded-lg border border-line bg-surface p-4 sm:p-6">
        {state.status === 'idle' ? (
          <div className="flex flex-col items-start gap-4">
            <p className="flex items-start gap-2 text-body-sm text-fg-muted">
              <Heart aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-fg" />
              {t('body')}
            </p>
            <Button variant="primary" onClick={start}>
              <Heart aria-hidden="true" />
              {t('start')}
            </Button>
          </div>
        ) : null}

        {state.status === 'running' ? (
          <div role="group" aria-label={t('progressLabel')} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3 text-body-sm">
              <p className="font-semibold tabular-nums" data-testid="liked-progress">
                {state.pagesTotal > 0
                  ? t('progress', { done: state.pagesDone, total: state.pagesTotal })
                  : t('progressStarting')}
              </p>
              {state.pagesTotal > 0 ? (
                <span className="text-fg-muted tabular-nums">
                  {Math.round((state.pagesDone / state.pagesTotal) * 100)}%
                </span>
              ) : null}
            </div>
            <div
              role="progressbar"
              aria-label={t('progressLabel')}
              aria-valuemin={0}
              aria-valuemax={state.pagesTotal || 1}
              aria-valuenow={state.pagesDone}
              className="h-2 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-(--duration-base) ease-standard"
                style={{
                  width: `${state.pagesTotal ? Math.round((state.pagesDone / state.pagesTotal) * 100) : 2}%`,
                }}
              />
            </div>
            <p className="sr-only" aria-live="polite">
              {state.pagesTotal > 0
                ? `${t('progressLabel')}: ${Math.floor((state.pagesDone / state.pagesTotal) * 4) * 25}%`
                : t('progressStarting')}
            </p>
            {state.waitingSeconds ? (
              <p className="text-body-sm text-warning">
                {t('waiting', { seconds: state.waitingSeconds })}
              </p>
            ) : null}
            <Button variant="secondary" className="self-start" onClick={cancel}>
              <X aria-hidden="true" />
              {t('cancel')}
            </Button>
          </div>
        ) : null}

        {state.status === 'checking' ? (
          <div aria-busy="true" className="flex flex-col gap-3">
            <p role="status" className="text-body-sm text-fg-muted">
              {t('checking')}
            </p>
            <Result summary={state.summary} changed={false} />
          </div>
        ) : null}

        {state.status === 'done' ? (
          <Result summary={state.summary} changed={state.changed} onRefresh={start} />
        ) : null}

        {state.status === 'error' ? (
          <div className="flex flex-col gap-3">
            <p className="text-body-sm text-fg-muted">{t('error')}</p>
            <SectionError error={state.error} onRetry={() => void retry()} />
          </div>
        ) : null}
      </div>
    </ConnectSection>
  );
}

/** Enquanto `me` carrega: o card da varredura com a mesma altura, sem ação. */
export function LikedSkeleton() {
  const t = useTranslations('Connect.liked');
  return (
    <ConnectSection id="connect-liked" title={t('title')} testId="connect-liked">
      <div
        aria-busy="true"
        className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:p-6"
      >
        <Skeleton className="h-4 w-4/5 rounded-xs" />
        <Skeleton className="h-11 w-36 rounded-full" />
      </div>
    </ConnectSection>
  );
}
