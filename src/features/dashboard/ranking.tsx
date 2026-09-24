'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Segmented } from '@/components/ui/segmented';
import type { UploadStats } from '@/domain/stats';

import { type Format } from './use-format';

type Kind = 'artists' | 'tracks' | 'albums';
const KINDS: readonly Kind[] = ['artists', 'tracks', 'albums'];

type Row = { key: string; name: string; sub: string; ms: number; plays: number };

/**
 * Ranking (RF-08, 10-design.md §8.5): top 10 com barra de proporção e "Ver top 50".
 * No Upload/Demo não há links "Abrir no Spotify" (só no Conectar, com dados da API).
 */
export function RankingSection({ top, format }: { top: UploadStats['top']; format: Format }) {
  const t = useTranslations('Dashboard.top');
  const [kind, setKind] = useState<Kind>('artists');
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const plays = (count: number) => t('plays', { count });
  const rows: Row[] =
    kind === 'artists'
      ? top.artists.map((a) => ({
          key: `a${a.artist}`,
          name: a.name,
          sub: plays(a.plays),
          ms: a.ms,
          plays: a.plays,
        }))
      : kind === 'tracks'
        ? top.tracks.map((tr) => ({
            key: `t${tr.track}`,
            name: tr.name,
            sub: `${tr.artist} · ${plays(tr.plays)}`,
            ms: tr.ms,
            plays: tr.plays,
          }))
        : top.albums.map((al) => ({
            key: `l${al.album}`,
            name: al.name,
            sub: `${al.artist} · ${plays(al.plays)}`,
            ms: al.ms,
            plays: al.plays,
          }));
  const visible = expanded ? rows : rows.slice(0, 10);
  const max = rows[0]?.plays ?? 1;

  return (
    <section aria-labelledby="top-title" className="flex flex-col gap-3">
      <h2 id="top-title" className="font-display text-h2 lg:text-h2-lg">
        {t('title')}
      </h2>
      <Segmented
        label={t('kindLabel')}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setOpen(null);
        }}
        options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
      />
      {rows.length === 0 ? (
        <p className="py-6 text-body-sm text-fg-muted">{t('empty')}</p>
      ) : (
        <ol
          aria-label={t('listLabel', { count: visible.length, kind: t(`kinds.${kind}`) })}
          data-testid={`ranking-${kind}`}
          className="flex flex-col"
        >
          {visible.map((row, index) => {
            const isOpen = open === row.key;
            return (
              // O toque expande o nome para 2 linhas (guideline: ver o metadado inteiro). O texto
              // completo já está no DOM para o leitor de tela; é só um auxílio visual.
              <li
                key={row.key}
                onClick={() => setOpen(isOpen ? null : row.key)}
                className="grid min-h-14 grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line py-2"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'font-display text-[20px] font-extrabold tabular-nums',
                    index < 3 ? 'text-accent' : 'text-fg-subtle',
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="sr-only">{`${index + 1}. `}</span>
                  <span
                    title={row.name}
                    className={cn('block font-semibold', isOpen ? 'line-clamp-2' : 'truncate')}
                  >
                    {row.name}
                  </span>
                  <span
                    className={cn(
                      'block text-body-sm text-fg-muted',
                      isOpen ? 'line-clamp-2' : 'truncate',
                    )}
                  >
                    {row.sub}
                  </span>
                </span>
                <span className="text-body-sm whitespace-nowrap text-fg-muted tabular-nums">
                  {format.duration(row.ms)}
                </span>
                {index < 10 ? (
                  <span
                    aria-hidden="true"
                    className="col-start-2 col-end-4 mt-1.5 h-[3px] overflow-hidden rounded-full bg-surface-2"
                  >
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(2, Math.round((row.plays / max) * 100))}%` }}
                    />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      {rows.length > 10 ? (
        <Button
          variant="ghost"
          className="self-start"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t('less') : t('more')}
        </Button>
      ) : null}
    </section>
  );
}
