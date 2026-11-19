import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3, ChevronLeft, GraduationCap, HeartPulse, House, ListChecks, Swords, Timer } from 'lucide-react';
import { cn } from '@/lib/cn';
import { db } from '@/lib/db';
import { timerSeconds } from '@/lib/actions';
import { useTicker } from '@/lib/hooks';

export function Shell() {
  const settings = useLiveQuery(() => db.settings.get('settings'), []);
  const items = [
    { to: '/', label: 'Home', icon: House, end: true },
    { to: '/habits', label: 'Habits', icon: ListChecks, end: false },
    { to: '/academy', label: 'Academy', icon: GraduationCap, end: false },
    settings?.healthEnabled === false ? { to: '/quests', label: 'Quests', icon: Swords, end: false } : { to: '/health', label: 'Health', icon: HeartPulse, end: false },
    { to: '/progress', label: 'Progress', icon: BarChart3, end: false },
  ];
  return (
    <div className="flex flex-col min-h-dvh">
      <TimerPill />
      <div className="mx-auto w-full max-w-lg flex-1 flex flex-col">
        <main className="flex-1 pb-4">
          <Outlet />
        </main>
      </div>
      <nav className="sticky bottom-0 z-30 border-t border-base-800 bg-base-950/90 backdrop-blur-xl safe-bottom" aria-label="Main">
        <div className="mx-auto max-w-lg grid grid-cols-5">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn('relative flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 text-[11px] font-semibold transition-colors', isActive ? 'text-accent' : 'text-base-400')}
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />}
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** Shows a running revision session from anywhere in the app. */
function TimerPill() {
  const timer = useLiveQuery(() => db.timer.get('timer'), []);
  const loc = useLocation();
  const navigate = useNavigate();
  const t = useTicker(!!timer?.runningSince);
  if (!timer || loc.pathname.startsWith('/academy/session')) return null;
  const left = Math.max(0, timer.plannedMinutes * 60 - timerSeconds(timer, t));
  return (
    <button
      onClick={() => navigate('/academy/session')}
      className="fixed top-[max(0.5rem,env(safe-area-inset-top))] right-3 z-40 flex items-center gap-1.5 rounded-full bg-violet text-base-950 px-3 py-1.5 text-sm font-bold shadow-[0_0_20px_-4px_var(--color-violet)] animate-pop"
    >
      <Timer size={15} />
      {timer.runningSince ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : left === 0 ? 'Finish' : 'Paused'}
    </button>
  );
}

export function PageHeader({ title, back, right, subtitle }: { title: string; back?: boolean; right?: ReactNode; subtitle?: string }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 bg-base-950/85 backdrop-blur-xl safe-top">
      <div className="mx-auto max-w-lg flex items-center gap-2 h-14 px-3">
        {back && (
          <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="h-10 w-10 -ml-1 flex items-center justify-center rounded-xl text-base-200 hover:bg-base-800 shrink-0" aria-label="Back">
            <ChevronLeft size={24} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-extrabold tracking-tight text-base-50 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-base-400 -mt-0.5 truncate">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-4 animate-fade-in', className)}>{children}</div>;
}

export function Loading() {
  return (
    <div className="flex-1 min-h-[60dvh] flex items-center justify-center">
      <div className="h-9 w-9 rounded-full border-2 border-base-700 border-t-accent animate-spin" />
    </div>
  );
}
