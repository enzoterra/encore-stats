'use client';

import { Heart } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode } from 'react';

import { cn } from '@/components/ui/cn';
import { Cover } from '@/features/connect/cover';
import { MediaRowView } from '@/features/connect/media-row';

/**
 * Peças visuais do quadro "Curtidas por artista" (10-design.md §8.11), iguais no Conectar e no
 * Upload/demo (Iteração 8c). Não dependem do `<ConnectProvider>`: quem chama diz se o dado é real
 * (`live`, com links do Spotify) e passa capa/link quando existirem. No Upload não há capa nem
 * link: a capa vira o bloco com a inicial, como na demo do Conectar.
 *
 * Os textos compartilhados ficam em `Connect.liked` (winner, count, othersTitle, othersLabel).
 */
export type LikedEntry = {
  /** Chave estável da linha (ID do artista no Conectar, nome no Upload). */
  key: string;
  name: string;
  count: number;
  image?: string;
  url?: string;
};

/** Coração + número; o leitor de tela ouve "12 músicas curtidas". */
export function LikedCount({ count }: { count: number }) {
  const t = useTranslations('Connect.liked');
  const locale = useLocale();
  return (
    <span className="inline-flex items-center gap-1">
      <Heart aria-hidden="true" className="size-3.5 text-primary-fg" />
      <span aria-hidden="true">{new Intl.NumberFormat(locale).format(count)}</span>
      <span className="sr-only">{t('count', { count })}</span>
    </span>
  );
}

/** Destaque do artista nº 1: capa (ou inicial), nome em `metric` e quantas curtidas. */
export function LikedWinner({
  entry,
  children,
}: {
  entry: LikedEntry;
  /** Ex.: "Abrir no Spotify" no Conectar real. */
  children?: ReactNode;
}) {
  const t = useTranslations('Connect.liked');
  return (
    <div className="flex items-center gap-4" data-testid="liked-winner">
      <Cover src={entry.image} name={entry.name} size={96} />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-overline text-info uppercase">{t('winner')}</p>
        <p className="font-display text-metric [overflow-wrap:anywhere] lg:text-metric-lg">
          {entry.name}
        </p>
        <p className="text-body-strong">{t('count', { count: entry.count })}</p>
        {children}
      </div>
    </div>
  );
}

/** Do 2º em diante: lista numerada a partir de 2, com o coração e a contagem à direita. */
export function LikedOthers({
  entries,
  live,
  columns = false,
}: {
  entries: readonly LikedEntry[];
  live: boolean;
  /** Duas colunas a partir do `md` (quadro largo do Upload/demo). */
  columns?: boolean;
}) {
  const t = useTranslations('Connect.liked');
  if (entries.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h3 className="text-overline text-fg-muted uppercase">{t('othersTitle')}</h3>
      <ol
        aria-label={t('othersLabel')}
        start={2}
        className={cn('flex flex-col', columns && 'md:block md:columns-2 md:gap-x-8')}
      >
        {entries.map((entry, index) => (
          <MediaRowView
            key={entry.key}
            rank={index + 2}
            name={entry.name}
            image={entry.image}
            url={entry.url}
            live={live}
            size={40}
            trailing={<LikedCount count={entry.count} />}
          />
        ))}
      </ol>
    </div>
  );
}
