import { CircleAlert, CircleCheck, Clock, Info, TriangleAlert } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from './cn';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const border: Record<AlertTone, string> = {
  info: 'border-l-info',
  success: 'border-l-success',
  warning: 'border-l-warning',
  danger: 'border-l-danger',
};
const iconColor: Record<AlertTone, string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};
const icons = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert };

/** Alerta (10-design.md §8.10/§8.12): superfície com borda esquerda de 4 px na cor do tipo. */
export function Alert({
  tone,
  title,
  children,
  actions,
  role,
  icon,
  className,
  titleAs: TitleTag = 'h2',
}: {
  tone: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  role?: 'alert' | 'status' | 'note';
  icon?: 'clock';
  className?: string;
  titleAs?: 'h2' | 'h3' | 'p';
}) {
  const Icon = icon === 'clock' ? Clock : icons[tone];
  return (
    <div
      role={role}
      className={cn(
        'flex gap-3 rounded-md border border-l-4 border-line bg-surface p-4',
        border[tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', iconColor[tone])} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 [overflow-wrap:anywhere]">
        {title ? <TitleTag className="text-h4 text-fg">{title}</TitleTag> : null}
        {children ? <div className="text-body-sm text-fg-muted">{children}</div> : null}
        {actions ? <div className="mt-2 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
