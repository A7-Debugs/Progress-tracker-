import { NavLink } from 'react-router-dom';
import { CalendarCheck, Dumbbell, Gauge, User, Wallet } from 'lucide-react';
import { cn } from '@/lib/cn';

const ITEMS = [
  { to: '/', label: 'Today', icon: Gauge, end: true },
  { to: '/train', label: 'Train', icon: Dumbbell, end: false },
  { to: '/review', label: 'Review', icon: CalendarCheck, end: false },
  { to: '/finance', label: 'Money', icon: Wallet, end: false },
  { to: '/me', label: 'Me', icon: User, end: false },
];

export function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-30 border-t border-base-800 bg-base-950/90 backdrop-blur-lg safe-bottom">
      <div className="mx-auto max-w-lg grid grid-cols-5">
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
