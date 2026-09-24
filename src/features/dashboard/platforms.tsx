'use client';

import { Globe, Laptop, Smartphone, Speaker, Tablet, Tv } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { PlatformShare } from '@/domain/stats';

import { type Format } from './use-format';

const ICONS = {
  android: Smartphone,
  ios: Tablet,
  desktop: Laptop,
  web: Globe,
  tv: Tv,
  other: Speaker,
} as const;

/** Plataforma mais usada (RF-10, 10-design.md §8.8): barras de uma cor, rótulo e % em texto. */
export function PlatformsSection({
  platforms,
  format,
}: {
  platforms: readonly PlatformShare[];
  format: Format;
}) {
  const t = useTranslations('Dashboard.platforms');
  const first = platforms[0];
  return (
    <section aria-labelledby="platforms-title" className="flex flex-col gap-3">
      <h2 id="platforms-title" className="font-display text-h2 lg:text-h2-lg">
        {t('title')}
      </h2>
      {first ? (
        <p className="text-body-sm text-fg-muted">
          {t('mostUsed', {
            platform: t(`names.${first.platform}`),
            share: format.percent(first.share),
          })}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3" data-testid="platforms">
        {platforms.map((p) => {
          const Icon = ICONS[p.platform];
          return (
            <li
              key={p.platform}
              className="grid grid-cols-[20px_1fr_auto] items-center gap-x-2.5 gap-y-1 text-body-sm"
            >
              <Icon aria-hidden="true" className="size-5 text-fg-muted" />
              <span>{t(`names.${p.platform}`)}</span>
              <b className="font-semibold tabular-nums">{format.percent(p.share)}</b>
              <span
                aria-hidden="true"
                className="col-start-2 col-end-4 h-2 overflow-hidden rounded-full bg-surface-2"
              >
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(1, Math.round(p.share * 100))}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
