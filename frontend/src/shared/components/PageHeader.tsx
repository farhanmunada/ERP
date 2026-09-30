import type { ReactNode } from 'react';

interface PageHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly badge?: ReactNode;
  readonly actions?: ReactNode;
}

export function PageHeader({ title, description, badge, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">{title}</h1>
          {badge}
        </div>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
