import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3, CalendarDays, CheckSquare, ChevronLeft, LayoutDashboard, MoreHorizontal, Plus, Repeat, Settings, Sparkles, Sprout, Target, Timer } from 'lucide-react';
import { cn } from '@/lib/cn';
import { db } from '@/lib/db';
import { timerSeconds } from '@/lib/actions';
import { useTicker } from '@/lib/hooks';
import { TaskEditor } from './editors/TaskEditor';
import { Dialog } from './ui/Dialog';

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/habits', label: 'Habits', icon: Repeat },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/performance', label: 'Performance', icon: BarChart3 },
  { to: '/development', label: 'Development', icon: Sprout },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

const MOBILE_PRIMARY = ['/', '/goals', '/habits', '/tasks'];

export function Shell() {
  const [adding, setAdding] = useState(false);
  const [more, setMore] = useState(false);
  const openNew = useCallback(() => setAdding(true), []);
  const loc = useLocation();
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const moreActive = !MOBILE_PRIMARY.some((p) => (p === '/' ? loc.pathname === '/' : loc.pathname.startsWith(p)));

  return (
    <div className="flex min-h-dvh">
      {/* Desktop / tablet sidebar */}
      <aside className="hidden md:flex w-56 lg:w-60 shrink-0 flex-col border-r border-line bg-surface/60 sticky top-0 h-dvh">
        <div className="flex items-center gap-2 px-4 h-14">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">Life OS</span>
        </div>
        <div className="px-3 pb-2">
          <button onClick={() => setAdding(true)} className="w-full h-9 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px] text-fg-3 hover:text-fg hover:bg-surface-2 shadow-[var(--shadow)]">
            <Plus size={15} /> New task
            <kbd className="ml-auto text-[10px] font-mono text-fg-3 border border-line rounded px-1">N</kbd>
          </button>
        </div>
        <nav className="flex-1 px-2 space-y-0.5" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, ...r }) => (
            <NavLink key={to} to={to} end={'end' in r} className={({ isActive }) => cn('flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-[13px] font-medium transition-colors', isActive ? 'bg-surface-3 text-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg')}>
              <Icon size={16} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-line">
          <NavLink to="/assistant" className={({ isActive }) => cn('flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-[13px] font-medium', isActive ? 'bg-surface-3 text-fg' : 'text-fg-2 hover:bg-surface-2')}>
            <Sparkles size={16} strokeWidth={1.8} /> Assistant
          </NavLink>
          {profile?.name && <p className="px-2.5 pt-2 text-xs text-fg-3 truncate">{profile.name}</p>}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <FocusPill />
        <main className="flex-1 pb-24 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-surface/90 backdrop-blur-xl safe-bottom" aria-label="Main">
        <div className="grid grid-cols-5 h-[60px]">
          {NAV.filter((n) => MOBILE_PRIMARY.includes(n.to)).map(({ to, label, icon: Icon, ...r }) => (
            <NavLink key={to} to={to} end={'end' in r} className={({ isActive }) => cn('flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium', isActive ? 'text-fg' : 'text-fg-3')}>
              {({ isActive }) => (
                <>
                  <Icon size={21} strokeWidth={isActive ? 2.1 : 1.7} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
          <button onClick={() => setMore(true)} className={cn('flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium', moreActive ? 'text-fg' : 'text-fg-3')} aria-label="More sections">
            <MoreHorizontal size={21} strokeWidth={moreActive ? 2.1 : 1.7} />
            More
          </button>
        </div>
      </nav>
      <button onClick={() => setAdding(true)} className="md:hidden fixed right-4 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 h-12 w-12 rounded-full bg-accent text-accent-fg shadow-[var(--shadow-lg)] flex items-center justify-center active:scale-95 transition-transform" aria-label="New task">
        <Plus size={22} />
      </button>

      <MoreSheet open={more} onOpenChange={setMore} />
      <TaskEditor open={adding} onOpenChange={setAdding} />
      <Hotkeys onNew={openNew} />
    </div>
  );
}

function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const items = [...NAV.filter((n) => !MOBILE_PRIMARY.includes(n.to)), { to: '/assistant', label: 'Assistant', icon: Sparkles }];
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="More">
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ to, label, icon: Icon }) => (
          <button
            key={to}
            onClick={() => {
              onOpenChange(false);
              navigate(to);
            }}
            className="flex items-center gap-2.5 h-14 px-3 rounded-xl border border-line bg-surface-2 text-sm font-medium text-fg hover:bg-surface-3"
          >
            <Icon size={18} strokeWidth={1.8} className="text-fg-2" />
            {label}
          </button>
        ))}
      </div>
    </Dialog>
  );
}

function Hotkeys({ onNew }: { onNew: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        onNew();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onNew]);
  return null;
}

/** Shows a running focus timer from anywhere in the app. */
function FocusPill() {
  const timer = useLiveQuery(() => db.timer.get('timer'), []);
  const loc = useLocation();
  const navigate = useNavigate();
  const t = useTicker(!!timer?.runningSince);
  if (!timer || loc.pathname.startsWith('/focus')) return null;
  const secs = timerSeconds(timer, t);
  const left = timer.plannedMin * 60 - secs;
  const mm = Math.floor(Math.abs(left) / 60);
  const ss = String(Math.floor(Math.abs(left) % 60)).padStart(2, '0');
  return (
    <button onClick={() => navigate('/focus')} className="fixed top-[max(0.6rem,env(safe-area-inset-top))] right-3 z-40 flex items-center gap-1.5 rounded-full bg-fg text-bg pl-2.5 pr-3 h-8 text-[13px] font-semibold tnum shadow-[var(--shadow-lg)] animate-pop">
      <Timer size={14} className={timer.runningSince ? 'text-success' : 'text-warning'} />
      {timer.runningSince ? `${left < 0 ? '+' : ''}${mm}:${ss}` : 'Paused'}
    </button>
  );
}

export function PageHeader({ title, subtitle, back, actions, children }: { title: string; subtitle?: ReactNode; back?: boolean; actions?: ReactNode; children?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 bg-bg/85 backdrop-blur-xl safe-top border-b border-line md:border-transparent md:bg-bg/70">
      <div className="mx-auto max-w-6xl flex items-center gap-2 min-h-14 px-4 md:px-8 py-2">
        {back && (
          <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="h-9 w-9 -ml-2 flex items-center justify-center rounded-lg text-fg-2 hover:bg-surface-2 shrink-0" aria-label="Back">
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] md:text-xl font-semibold tracking-tight text-fg truncate">{title}</h1>
          {subtitle && <div className="text-xs text-fg-3 truncate">{subtitle}</div>}
        </div>
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
      </div>
      {children && <div className="mx-auto max-w-6xl px-4 md:px-8 pb-2">{children}</div>}
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-6xl px-4 md:px-8 pt-4 animate-fade-in', className)}>{children}</div>;
}

export function Loading() {
  return (
    <div className="flex-1 min-h-[60dvh] flex items-center justify-center">
      <div className="h-6 w-6 rounded-full border-2 border-line-strong border-t-accent animate-spin" />
    </div>
  );
}

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--fg)" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--bg)" strokeOpacity="0.35" strokeWidth="2.5" />
      <path d="M16 7.5a8.5 8.5 0 0 1 8.5 8.5" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.6" fill="var(--bg)" />
    </svg>
  );
}
