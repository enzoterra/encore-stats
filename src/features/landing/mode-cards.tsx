import { FileArchive, FlaskConical, Radio } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Link } from '@/i18n/navigation';

function ModeCard({
  icon,
  badge,
  title,
  body,
  children,
  highlight = false,
  disabled = false,
  id,
}: {
  icon: ReactNode;
  badge: string;
  title: string;
  body: string;
  children: ReactNode;
  highlight?: boolean;
  disabled?: boolean;
  id: string;
}) {
  return (
    <article
      aria-labelledby={`${id}-title`}
      data-mode={id}
      className={cn(
        'relative flex flex-col gap-4 rounded-lg border p-5 sm:p-6',
        highlight ? 'border-primary bg-surface shadow-glow' : 'border-line bg-surface',
        disabled && 'bg-disabled-bg',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-11 place-items-center rounded-full [&_svg]:size-6',
            highlight ? 'bg-primary text-on-vibrant' : 'bg-surface-2 text-fg-muted',
          )}
        >
          {icon}
        </span>
        <Badge tone={highlight ? 'accent' : 'neutral'}>{badge}</Badge>
      </div>
      <div className="flex flex-col gap-2">
        <h3 id={`${id}-title`} className="font-display text-h3">
          {title}
        </h3>
        <p className="text-body-sm text-fg-muted">{body}</p>
      </div>
      <div className="mt-auto flex flex-col gap-3 pt-2">{children}</div>
    </article>
  );
}

/** Os 3 modos da landing (RF-01, 10-design.md §8.18): Upload em destaque, Conectar e Demo. */
export function ModeCards({ connectEnabled }: { connectEnabled: boolean }) {
  const t = useTranslations('Landing');
  return (
    <div className="grid gap-3 md:grid-cols-3 md:gap-4 lg:gap-6">
      <ModeCard
        id="upload"
        highlight
        icon={<FileArchive />}
        badge={t('upload.badge')}
        title={t('upload.title')}
        body={t('upload.body')}
      >
        <Link href="/upload" className={buttonClasses({ variant: 'primary', block: true })}>
          {t('upload.cta')}
        </Link>
        <Link
          href="/onboarding"
          className="self-center rounded-sm text-body-sm font-semibold text-primary-fg underline decoration-1 underline-offset-[3px] hover:decoration-2"
        >
          {t('upload.secondary')}
        </Link>
      </ModeCard>

      <ModeCard
        id="connect"
        disabled={!connectEnabled}
        icon={<Radio />}
        badge={t('connect.badge')}
        title={t('connect.title')}
        body={t('connect.body')}
      >
        {connectEnabled ? (
          <>
            <Link href="/connect" className={buttonClasses({ variant: 'secondary', block: true })}>
              {t('connect.cta')}
            </Link>
            <p className="text-center text-caption text-fg-subtle">{t('connect.limited')}</p>
          </>
        ) : (
          <>
            <Button variant="secondary" block disabled aria-describedby="connect-why">
              {t('connect.cta')}
            </Button>
            <p id="connect-why" className="text-body-sm text-fg-muted">
              <strong className="block font-semibold text-fg">{t('connect.disabled')}</strong>
              {t('connect.disabledWhy')}
            </p>
          </>
        )}
      </ModeCard>

      <ModeCard
        id="demo"
        icon={<FlaskConical />}
        badge={t('demo.badge')}
        title={t('demo.title')}
        body={t('demo.body')}
      >
        <Link href="/demo" className={buttonClasses({ variant: 'secondary', block: true })}>
          {t('demo.cta')}
        </Link>
      </ModeCard>
    </div>
  );
}
