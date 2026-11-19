import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { PALETTE_BY_ID } from '@/lib/avatar';
import type { AvatarConfig } from '@/lib/types';
import { Icon } from './Icon';
import { TIER_COLORS, type AchievementDef } from '@/lib/achievements';

/** Circular progress ring. value 0..1 or null (no data). */
export function Ring({
  value,
  size = 64,
  stroke = 7,
  color = 'var(--color-accent)',
  track = 'var(--color-base-800)',
  children,
  gradient,
  className,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  gradient?: [string, string];
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  const gid = gradient ? `g${gradient.join('').replace(/[^a-z0-9]/gi, '')}${size}` : undefined;
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        {gradient && (
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={gradient[0]} />
              <stop offset="100%" stopColor={gradient[1]} />
            </linearGradient>
          </defs>
        )}
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={gradient ? `url(#${gid})` : color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1)', filter: v > 0 ? `drop-shadow(0 0 4px ${gradient ? gradient[1] : color})` : undefined }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function XpBar({ value, className, height = 10 }: { value: number; className?: string; height?: number }) {
  return (
    <div className={cn('rounded-full bg-base-800 overflow-hidden', className)} style={{ height }} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full xp-bar-fill" style={{ width: `${Math.max(2, Math.min(100, value * 100))}%`, transition: 'width 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }} />
    </div>
  );
}

export function Bar({ value, color, className, height = 6 }: { value: number | null; color: string; className?: string; height?: number }) {
  return (
    <div className={cn('rounded-full bg-base-800 overflow-hidden', className)} style={{ height }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, (value ?? 0) * 100))}%`, background: color, transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)' }} />
    </div>
  );
}

/** Hexagonal gaming emblem avatar. */
export function Avatar({ config, size = 72, level, className }: { config: AvatarConfig; size?: number; level?: number; className?: string }) {
  const p = PALETTE_BY_ID[config.palette] ?? PALETTE_BY_ID.cyber;
  const id = `av-${config.palette}-${size}`;
  const hex = (r: number) => {
    const c = size / 2;
    return Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`;
    }).join(' ');
  };
  const R = size / 2 - 3;
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden className="absolute inset-0">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={p.from} />
            <stop offset="100%" stopColor={p.to} />
          </linearGradient>
          <radialGradient id={`${id}-in`} cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#1e2034" />
            <stop offset="100%" stopColor="#0b0c16" />
          </radialGradient>
        </defs>
        {config.frame === 'flare' && <polygon points={hex(R + 1)} fill="none" stroke={p.from} strokeWidth={2} opacity={0.5} className="animate-glow" style={{ filter: `drop-shadow(0 0 8px ${p.from})` }} />}
        <polygon points={hex(R)} fill={`url(#${id})`} style={{ filter: `drop-shadow(0 0 ${size / 10}px ${p.to}66)` }} />
        <polygon points={hex(R - size * 0.06)} fill={`url(#${id}-in)`} />
        {(config.frame === 'ring' || config.frame === 'double' || config.frame === 'laurel') && (
          <polygon points={hex(R - size * 0.11)} fill="none" stroke={p.from} strokeOpacity={0.35} strokeWidth={1.2} />
        )}
        {config.frame === 'double' && <polygon points={hex(R - size * 0.16)} fill="none" stroke={p.to} strokeOpacity={0.4} strokeWidth={1} />}
        {config.frame === 'spikes' &&
          Array.from({ length: 6 }, (_, i) => {
            const a = (Math.PI / 3) * i - Math.PI / 2;
            const c = size / 2;
            return <circle key={i} cx={c + (R + 0.5) * Math.cos(a)} cy={c + (R + 0.5) * Math.sin(a)} r={size * 0.035} fill={p.from} />;
          })}
        {config.frame === 'laurel' && <polygon points={hex(R - size * 0.2)} fill="none" stroke="#ffd36b" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="2 3" />}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center" style={{ color: p.from }}>
        <Icon name={config.icon} size={size * 0.4} strokeWidth={2} />
      </div>
      {level !== undefined && (
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-md px-1.5 text-[11px] font-black tabular-nums text-base-950 leading-[18px] shadow-lg"
          style={{ background: `linear-gradient(90deg, ${p.from}, ${p.to})` }}
        >
          {level}
        </div>
      )}
    </div>
  );
}

/** Achievement medal. */
export function Medal({ def, unlocked, size = 56 }: { def: AchievementDef; unlocked: boolean; size?: number }) {
  const [a, b] = TIER_COLORS[def.tier];
  return (
    <div
      className={cn('relative rounded-2xl flex items-center justify-center shrink-0', !unlocked && 'grayscale opacity-35')}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${a}, ${b})`,
        boxShadow: unlocked ? `0 0 18px -4px ${a}, inset 0 1px 0 rgba(255,255,255,0.35)` : undefined,
        transform: 'rotate(45deg) scale(0.78)',
      }}
    >
      <div style={{ transform: 'rotate(-45deg) scale(1.28)' }} className="text-base-950">
        <Icon name={def.icon} size={size * 0.38} strokeWidth={2.4} />
      </div>
    </div>
  );
}

export function StatTile({ label, value, sub, color, icon }: { label: string; value: ReactNode; sub?: ReactNode; color?: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-base-900 border border-base-800 p-3 min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-base-400">
        {icon}
        <span className="leading-tight">{label}</span>
      </div>
      <div className="mt-1 text-lg font-extrabold tabular-nums text-base-50 truncate" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="text-xs text-base-400 leading-snug">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between mt-5 mb-2 px-0.5', className)}>
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-base-400">{children}</h2>
      {right}
    </div>
  );
}

export function DifficultyPips({ d }: { d: 'easy' | 'medium' | 'hard' }) {
  const n = d === 'easy' ? 1 : d === 'medium' ? 2 : 3;
  const col = d === 'easy' ? '#3ee8a4' : d === 'medium' ? '#ffb454' : '#ff5fa2';
  return (
    <span className="inline-flex items-center gap-0.5" title={d}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-3 rounded-full" style={{ background: i < n ? col : 'var(--color-base-700)' }} />
      ))}
      <span className="ml-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: col }}>
        {d}
      </span>
    </span>
  );
}

export function XpChip({ xp, done, className }: { xp: number; done?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums', done ? 'bg-xp/15 text-xp' : 'bg-base-800 text-base-300', className)}>
      +{xp} XP
    </span>
  );
}
