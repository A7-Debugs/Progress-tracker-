import { NavLink } from 'react-router-dom';
import { Dumbbell, LayoutGrid, LineChart, User } from 'lucide-react';
import { cn } from '@/lib/cn';

const ITEMS = [
  { to: '/', label: 'Today', icon: Dumbbell, end: true },
  { to: '/programs', label: 'Programs', icon: LayoutGrid, end: false },
  { to: '/analytics', label: 'Progress', icon: LineChart, end: false },
  { to: '/me', label: 'Me', icon: User, end: false },
];

export function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-30 border-t border-base-800 bg-base-950/90 backdrop-blur-lg safe-bottom">
      <div className="mx-auto max-w-lg grid grid-cols-4">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                isActive ? 'text-accent' : 'text-base-400',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.3 : 1.8} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
