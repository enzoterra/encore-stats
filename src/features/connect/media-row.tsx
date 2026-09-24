'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

import { useConnectBundle } from './connect-provider';
import { Cover } from './cover';
import { SpotifyIcon } from './spotify-brand';

/**
 * Linha de metadado do Spotify (10-design.md §8.5 e §10):
 * - no modo real, a linha inteira é um link para o `url` da resposta (open.spotify.com), com o
 *   ícone oficial de 21 px e o texto "Abrir/Ouvir no Spotify";
 * - no Demo não há link nem ícone (dado fictício, `api.demo === true`);
 * - capa ao lado, nunca sob o texto; nome em até 2 linhas, completo no `title`.
 */
export function MediaRow({
  rank,
  name,
  sub,
  image,
  url,
  action = 'open',
  trailing,
  size = 48,
  showLabel = false,
}: {
  rank?: number;
  name: string;
  sub?: ReactNode;
  image?: string;
  url: string;
  /** "Abrir no Spotify" (artista) ou "Ouvir no Spotify" (faixa). */
  action?: 'open' | 'play';
  trailing?: ReactNode;
  size?: 40 | 48;
  /** Texto "Abrir/Ouvir no Spotify" visível em telas largas (listas com espaço). */
  showLabel?: boolean;
}) {
  const t = useTranslations('Connect.top');
  const tCommon = useTranslations('Common');
  const { source } = useConnectBundle();
  const live = source.kind === 'live';
  const label = action === 'play' ? t('play') : t('open');

  const body = (
    <>
      {rank !== undefined ? (
        <span
          aria-hidden="true"
          className={cn(
            'w-8 shrink-0 font-display text-[20px] font-extrabold tabular-nums',
            rank <= 3 ? 'text-accent' : 'text-fg-subtle',
          )}
        >
          {rank}
        </span>
      ) : null}
      <Cover src={image} name={name} size={size} />
      <span className="flex min-w-0 flex-1 flex-col">
        {rank !== undefined ? <span className="sr-only">{`${rank}. `}</span> : null}
        <span title={name} className="line-clamp-2 font-semibold [overflow-wrap:anywhere]">
          {name}
        </span>
        {sub ? (
          <span className="line-clamp-2 text-body-sm [overflow-wrap:anywhere] text-fg-muted">
            {sub}
          </span>
        ) : null}
      </span>
      {trailing ? (
        <span className="shrink-0 text-body-sm whitespace-nowrap text-fg-muted tabular-nums">
          {trailing}
        </span>
      ) : null}
      {live ? (
        <span className="flex shrink-0 items-center gap-2 text-caption font-semibold text-fg-muted">
          {showLabel ? <span className="hidden uppercase xl:inline">{label}</span> : null}
          <SpotifyIcon />
          <span className="sr-only">{`${label} ${tCommon('externalLink')}`}</span>
        </span>
      ) : null}
    </>
  );

  const rowClass = 'flex min-h-16 items-center gap-3 py-2';
  return (
    <li className="border-b border-line">
      {live ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            rowClass,
            '-mx-2 rounded-sm px-2 transition-colors duration-(--duration-fast) hover:bg-surface-2',
          )}
        >
          {body}
        </a>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}
