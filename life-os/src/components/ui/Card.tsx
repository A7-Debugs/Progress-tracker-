import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl bg-surface border border-line shadow-[var(--shadow)]', className)} {...props} />;
}

/** Card with a header row (title, optional link/action) and padded body. */
export function Panel({ title, subtitle, action, to, toLabel = 'View all', children, className, bodyClassName }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; to?: string; toLabel?: string; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-fg">{title}</h2>
          {subtitle && <p className="text-xs text-fg-3 mt-0.5">{subtitle}</p>}
        </div>
        {action}
        {to && (
          <Link to={to} className="shrink-0 inline-flex items-center gap-0.5 text-xs font-medium text-fg-3 hover:text-fg">
            {toLabel}
            <ChevronRight size={14} />
          </Link>
        )}
      </div>
      <div className={cn('px-4 pb-4 flex-1', bodyClassName)}>{children}</div>
    </Card>
  );
}
