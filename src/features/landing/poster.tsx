import { useTranslations } from 'next-intl';

import { Logo } from '@/components/brand/logo';
import { DEMO_ARTISTS } from '@/domain/demo/catalog';

/**
 * Cartaz de festival decorativo do hero, só com artistas fictícios do Demo (ADR 8).
 * É uma amostra do card "Line-up de festival" (10-design.md §9.4), feita em HTML/CSS.
 */
export function PosterTeaser({ locale }: { locale: string }) {
  const t = useTranslations('Landing');
  const names = DEMO_ARTISTS.map((artist) => artist.name.toLocaleUpperCase(locale));
  const [first, second, third] = names;
  const tier2 = names.slice(3, 9);
  const tier3 = names.slice(9, 18);
  return (
    <figure className="mx-auto w-full max-w-[340px] lg:max-w-[380px]">
      <div
        aria-hidden="true"
        className="relative flex aspect-[9/14] flex-col items-center justify-between overflow-hidden rounded-xl border border-line bg-[linear-gradient(180deg,#0e0b1a_0%,#140e28_55%,#2a0f3d_82%,#4a1247_100%)] px-6 py-8 text-center shadow-e3"
      >
        <span className="pointer-events-none absolute -top-16 -left-16 size-64 rounded-full bg-[radial-gradient(circle,rgb(255_61_139/0.55),transparent_65%)]" />
        <span className="pointer-events-none absolute -top-10 -right-16 size-56 rounded-full bg-[radial-gradient(circle,rgb(61_224_255/0.4),transparent_65%)]" />
        <div className="relative flex w-full flex-col items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.3em] text-neon-cyan uppercase">
            {t('posterPresents')}
          </span>
          <span className="font-condensed text-[40px] leading-[0.95] font-extrabold text-primary uppercase">
            {t('posterTitle')}
          </span>
          <span className="rounded-full bg-accent px-3 py-0.5 text-[11px] font-bold tracking-[0.1em] text-on-vibrant uppercase">
            {t('posterPeriod')}
          </span>
        </div>
        <div className="relative flex w-full flex-col items-center gap-2">
          <span className="font-condensed w-full truncate text-[34px] leading-[0.95] font-extrabold text-accent">
            {first}
          </span>
          <span className="font-condensed w-full truncate text-[24px] leading-[0.95] font-extrabold text-fg">
            {second}
          </span>
          <span className="font-condensed w-full truncate text-[24px] leading-[0.95] font-extrabold text-fg">
            {third}
          </span>
          <span className="my-1 flex w-full items-center gap-2">
            <span className="h-0.5 flex-1 bg-primary" />
            <span className="size-2.5 rotate-45 bg-accent" />
            <span className="h-0.5 flex-1 bg-primary" />
          </span>
          <span className="font-condensed line-clamp-3 text-[17px] leading-[1.15] font-extrabold text-fg">
            {tier2.join('  •  ')}
          </span>
          <span className="line-clamp-3 text-[10px] leading-[1.5] font-semibold tracking-[0.04em] text-fg-muted">
            {tier3.join('  •  ')}
          </span>
        </div>
        <div className="relative flex w-full flex-col items-center gap-3">
          <span className="text-[10px] font-bold tracking-[0.1em] text-neon-orange uppercase">
            {t('posterStats')}
          </span>
          <span className="flex w-full items-end justify-between text-left">
            <span>
              <Logo id="poster" height={12} />
              <span className="sr-only">Encore</span>
            </span>
            <span className="rounded-full bg-info px-2 text-[9px] font-bold tracking-[0.12em] text-on-vibrant">
              DEMO
            </span>
          </span>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-caption text-fg-subtle">
        {t('posterCaption')}
      </figcaption>
    </figure>
  );
}
