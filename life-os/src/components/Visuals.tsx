import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import type { Category, Difficulty, Priority } from '@/lib/types';
import { Icon } from './Icon';

/** Circular progress ring. value 0..1 or null (no data: empty track, no fake fill). */
export function Ring({ value, size = 56, stroke = 5, color = 'var(--accent)', children, className, label }: { value: number | null; size?: number; stroke?: number; color?: string; children?: ReactNode; className?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }} role="img" aria-label={label ?? (value === null ? 'No data' : `${Math.round(v * 100)}%`)}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
        {v > 0 && <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1)' }} />}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function Progress({ value, color = 'var(--accent)', className, height = 6, marker }: { value: number | null; color?: string; className?: string; height?: number; marker?: number | null }) {
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <div className={cn('relative rounded-full bg-surface-3 overflow-visible', className)} style={{ height }} role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: color, transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)' }} />
      {marker !== undefined && marker !== null && <div className="absolute -top-[3px] w-[2px] rounded-full bg-fg-3" style={{ left: `calc(${Math.max(0, Math.min(1, marker)) * 100}% - 1px)`, height: height + 6 }} title="Where you'd be on a straight-line pace" />}
    </div>
  );
}

export function Stat({ label, value, sub, className, tone }: { label: string; value: ReactNode; sub?: ReactNode; className?: string; tone?: 'success' | 'warning' | 'danger' }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-fg-3 truncate">{label}</div>
      <div className={cn('mt-0.5 text-xl font-semibold tnum text-fg truncate', tone === 'success' && 'text-success', tone === 'warning' && 'text-warning', tone === 'danger' && 'text-danger')}>{value}</div>
      {sub && <div className="text-xs text-fg-3 truncate">{sub}</div>}
    </div>
  );
}

export function StatCard(props: Parameters<typeof Stat>[0]) {
  return (
    <div className="rounded-xl bg-surface border border-line p-3.5 shadow-[var(--shadow)] min-w-0">
      <Stat {...props} />
    </div>
  );
}

export function SectionTitle({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-2 mt-6 mb-2', className)}>
      <h2 className="text-[13px] font-semibold text-fg-2">{children}</h2>
      {right}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-8 px-4">
      {icon && <div className="h-10 w-10 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-fg-3 mb-3">{icon}</div>}
      <p className="text-sm font-medium text-fg">{title}</p>
      {body && <p className="text-[13px] text-fg-3 mt-1 max-w-sm">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function NoData({ children = 'Not enough data yet' }: { children?: ReactNode }) {
  return <p className="text-[13px] text-fg-3 py-3">{children}</p>;
}

export function CategoryDot({ cat, size = 8 }: { cat: Category | undefined; size?: number }) {
  return <span className="inline-block rounded-full shrink-0" style={{ width: size, height: size, background: cat?.color ?? 'var(--fg-3)' }} aria-hidden />;
}

export function CategoryTag({ cat, className }: { cat: Category | undefined; className?: string }) {
  if (!cat) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium text-fg-2 min-w-0', className)}>
      <Icon name={cat.icon} size={12} className="shrink-0" />
      <span className="truncate" style={{ maxWidth: 140 }}>
        {cat.name}
      </span>
      <CategoryDot cat={cat} size={6} />
    </span>
  );
}

export const PRIORITY_COLOR: Record<Priority, string> = { 1: 'var(--danger)', 2: 'var(--warning)', 3: 'var(--info)', 4: 'var(--fg-3)' };

export function PriorityFlag({ p }: { p: Priority }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold tnum" style={{ color: PRIORITY_COLOR[p] }}>
      <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden>
        <path d="M1 1v8M1 1h6l-1.5 2.5L7 6H1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      </svg>
      P{p}
    </span>
  );
}

export function DifficultyTag({ d }: { d: Difficulty }) {
  const n = d === 'easy' ? 1 : d === 'medium' ? 2 : 3;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-fg-3" title={`Difficulty: ${d}`}>
      <span className="inline-flex gap-[2px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-[3px] rounded-full" style={{ background: i < n ? 'var(--fg-2)' : 'var(--line-strong)' }} />
        ))}
      </span>
      <span className="capitalize">{d}</span>
    </span>
  );
}

export function XpTag({ xp, className }: { xp: number; className?: string }) {
  return <span className={cn('text-[11px] font-semibold tnum text-xp', className)}>+{xp} XP</span>;
}

export function RowLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn('block rounded-lg -mx-2 px-2 py-2 hover:bg-surface-2 transition-colors', className)}>
      {children}
    </Link>
  );
}

export const pct = (v: number | null | undefined, empty = '—') => (v === null || v === undefined ? empty : `${Math.round(v * 100)}%`);
export const hours = (min: number) => (min < 60 ? `${Math.round(min)}m` : `${(min / 60).toFixed(min >= 600 ? 0 : 1)}h`);
