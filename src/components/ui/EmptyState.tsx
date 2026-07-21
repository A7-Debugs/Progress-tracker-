import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 animate-fade-in">
      <div className="h-14 w-14 rounded-2xl bg-base-800 flex items-center justify-center mb-4">
        <Icon size={26} className="text-base-400" />
      </div>
      <h3 className="text-base font-semibold text-base-100">{title}</h3>
      {description && <p className="text-sm text-base-400 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
