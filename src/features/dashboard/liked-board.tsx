'use client';

import { CalendarRange } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, type Ref, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { type LikedByArtist, topLikedArtists } from '@/domain/history';
import { type LikedEntry, LikedOthers, LikedWinner } from '@/features/liked/liked-artists';

/** Quantos artistas o quadro mostra (o nº 1 em destaque + 9 na lista). */
export const LIKED_TOP = 10;

/**
 * Seção "Suas curtidas" do painel Upload/demo (Iteração 8c): título, selo "de qualquer época" e a
 * legenda que explica por que o quadro não muda com o período (o `YourLibrary.json` não tem a
 * data de cada curtida). O conteúdo é o quadro, o convite ou o progresso do envio.
 */
export function LikedSection({
  children,
  headingRef,
}: {
  children: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const t = useTranslations('Dashboard.liked');
  return (
    <section
      aria-labelledby="liked-title"
      data-testid="liked-section"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id="liked-title"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-h2 outline-none lg:text-h2-lg"
          >
            {t('title')}
          </h2>
          <Badge>
            <CalendarRange aria-hidden="true" />
            {t('badge')}
          </Badge>
        </div>
        <p className="max-w-prose text-body-sm text-fg-muted">{t('lead')}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * Quadro "Curtidas por artista" (10-design.md §8.11, mesmas peças do Conectar): o artista com
 * mais músicas curtidas em destaque, os próximos 9 e o total. Sem capa nem link do Spotify: o
 * upload não tem esses dados (a capa vira o bloco com a inicial).
 */
export function LikedBoard({ library }: { library: LikedByArtist }) {
  const t = useTranslations('Dashboard.liked');
  const summary = useMemo(() => topLikedArtists(library, LIKED_TOP), [library]);
  const entries: LikedEntry[] = summary.top.map((artist) => ({
    key: artist.name,
    name: artist.name,
    count: artist.count,
  }));
  const [winner, ...others] = entries;

  return (
    <div data-testid="liked-board" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
      {winner ? (
        <div className="grid gap-6 xl:grid-cols-12 xl:gap-8 [&>*]:min-w-0">
          <div className="flex flex-col gap-4 xl:col-span-5">
            <LikedWinner entry={winner} />
            <p className="text-caption text-fg-subtle tabular-nums" data-testid="liked-total">
              {t('total', {
                total: summary.total,
                artists: summary.artistCount,
              })}
            </p>
          </div>
          <div className="xl:col-span-7">
            <LikedOthers entries={others} live={false} columns />
          </div>
        </div>
      ) : (
        <p className="text-body-sm text-fg-muted">{t('empty')}</p>
      )}
    </div>
  );
}
