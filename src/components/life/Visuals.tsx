import { useState, type ReactNode } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/cn';
import type { Hit } from '@/lib/life/types';
import { COLORS, scoreColor } from './colors';

/** Circular completion ring. `value` is 0..1 (or null for no data). */
export function Ring({
  value,
  size = 64,
  stroke = 7,
  color,
  children,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  const col = color ?? scoreColor(value === null ? null : v * 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={COLORS.track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={col}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/** Horizontal progress bar with a mandatory definition. Never shows a number without data. */
export function GoalBar({
  label,
  value,
  formula,
  color,
  detail,
  insufficient = 'Insufficient data',
}: {
  label: string;
  value: number | null; // 0..1
  formula: string;
  color?: string;
  detail?: string;
  insufficient?: string;
}) {
  const [open, setOpen] = useState(false);
  const pct = value === null ? null : Math.round(Math.max(0, Math.min(1, value)) * 100);
  const col = color ?? scoreColor(pct);
  return (
    <div>
      <button className="w-full text-left" onClick={() => setOpen(!open)}>
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <span className="text-sm font-medium text-base-100 flex items-center gap-1.5">
            {label}
            <Info size={12} className="text-base-500" />
          </span>
          <span className={cn('text-sm font-bold tabular-nums', pct === null ? 'text-base-500 font-medium text-xs' : 'text-base-50')}>
            {pct === null ? insufficient : `${pct}%`}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-base-800 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct ?? 0}%`, background: col, transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </div>
      </button>
      {open && (
        <p className="text-xs text-base-400 mt-1.5 leading-relaxed">
          <span className="text-base-300 font-medium">How it's calculated: </span>
          {formula}
          {detail && <span className="block mt-0.5 text-base-500">{detail}</span>}
        </p>
      )}
    </div>
  );
}

export function HitDot({ hit, size = 22 }: { hit: Hit | null; size?: number }) {
  const map: Record<string, string> = {
    ideal: 'bg-accent border-accent',
    min: 'bg-accent/35 border-accent',
    miss: 'bg-transparent border-danger/60',
    none: 'bg-transparent border-base-600 border-dashed',
  };
  return <span className={cn('inline-block rounded-full border-2 shrink-0', map[hit ?? 'none'])} style={{ width: size, height: size }} />;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mt-3 mb-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-base-500">{children}</p>
      {right}
    </div>
  );
}

export function Collapsible({ title, children, defaultOpen = false }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-left py-1">
        <span className="text-sm font-semibold text-base-100">{title}</span>
        <ChevronDown size={16} className={cn('text-base-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { background: '#17181d', border: '1px solid #24252c', borderRadius: 12, fontSize: 12, color: '#e1e2e6' },
  labelStyle: { color: '#93949f' },
};
const axis = { tick: { fill: '#6b6d7a', fontSize: 11 }, tickLine: false } as const;

export interface SeriesPoint {
  label: string;
  [key: string]: string | number | null;
}

export function TrendBars({
  data,
  dataKey = 'value',
  color = COLORS.accent,
  unit = '',
  height = 160,
  target,
  domain,
}: {
  data: SeriesPoint[];
  dataKey?: string;
  color?: string;
  unit?: string;
  height?: number;
  target?: number;
  domain?: [number, number];
}) {
  if (!data.some((d) => d[dataKey] !== null && d[dataKey] !== undefined)) return <NoData height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1c1d23" vertical={false} />
        <XAxis dataKey="label" {...axis} axisLine={{ stroke: '#24252c' }} minTickGap={8} />
        <YAxis {...axis} axisLine={false} width={34} domain={domain} />
        <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(v) => [`${v}${unit}`, '']} />
        {target !== undefined && <ReferenceLine y={target} stroke={COLORS.warn} strokeDasharray="4 4" />}
        <Bar dataKey={dataKey} fill={color} radius={[5, 5, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLines({
  data,
  lines,
  unit = '',
  height = 180,
  target,
  domain,
}: {
  data: SeriesPoint[];
  lines: { key: string; color: string; name: string; dashed?: boolean }[];
  unit?: string;
  height?: number;
  target?: number;
  domain?: [number | 'auto', number | 'auto'];
}) {
  const points = data.filter((d) => lines.some((l) => d[l.key] !== null && d[l.key] !== undefined)).length;
  if (points < 2) return <NoData height={height} />;
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1d23" vertical={false} />
          <XAxis dataKey="label" {...axis} axisLine={{ stroke: '#24252c' }} minTickGap={16} />
          <YAxis {...axis} axisLine={false} width={44} domain={domain ?? ['auto', 'auto']} />
          <Tooltip {...tooltipStyle} formatter={(v, name) => [`${typeof v === 'number' ? Math.round(v * 10) / 10 : v}${unit}`, name]} />
          {target !== undefined && <ReferenceLine y={target} stroke={COLORS.warn} strokeDasharray="4 4" />}
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.name}
              stroke={l.color}
              strokeWidth={2.2}
              strokeDasharray={l.dashed ? '5 4' : undefined}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {lines.length > 1 && (
        <div className="flex flex-wrap gap-3 mt-1">
          {lines.map((l) => (
            <span key={l.key} className="flex items-center gap-1.5 text-[11px] text-base-400">
              <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
              {l.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function NoData({ height = 140, text = 'Insufficient data — keep logging.' }: { height?: number; text?: string }) {
  return (
    <div className="flex items-center justify-center text-sm text-base-500 text-center px-6" style={{ height }}>
      {text}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl bg-base-850 border border-base-800 p-3 min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-base-500 font-semibold truncate">{label}</p>
      <p className="text-lg font-bold text-base-50 mt-0.5 tabular-nums truncate">{value}</p>
      {sub && <p className="text-[11px] text-base-400 truncate">{sub}</p>}
    </div>
  );
}

/** Segmented 1–5 picker. */
export function Scale5({ value, onChange, low, high }: { value: number | null; onChange: (v: number | null) => void; low?: string; high?: string }) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            className={cn(
              'h-10 rounded-xl text-sm font-semibold border transition-colors',
              value === n ? 'bg-accent text-base-950 border-accent' : 'bg-base-850 text-base-300 border-base-700',
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {(low || high) && (
        <div className="flex justify-between text-[10px] text-base-500 mt-1 px-0.5">
          <span>{low}</span>
          <span>{high}</span>
        </div>
      )}
    </div>
  );
}

/** Missed / Minimum / Ideal picker. */
export function TriPicker({ value, onChange, minLabel, idealLabel }: { value: Hit | undefined; onChange: (v: Hit) => void; minLabel: string; idealLabel: string }) {
  const opts: { v: Hit; label: string; sub?: string }[] = [
    { v: 'miss', label: 'Missed' },
    { v: 'min', label: 'Minimum', sub: minLabel },
    { v: 'ideal', label: 'Ideal', sub: idealLabel },
  ];
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            'rounded-xl border px-2 py-2 text-left transition-colors min-h-[52px]',
            value === o.v
              ? o.v === 'miss'
                ? 'bg-danger/15 border-danger/50 text-danger'
                : 'bg-accent-bg border-accent/60 text-accent'
              : 'bg-base-850 border-base-700 text-base-300',
          )}
        >
          <span className="block text-sm font-semibold">{o.label}</span>
          {o.sub && <span className="block text-[10px] leading-tight opacity-80 line-clamp-2">{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}

export function Chips({ values, current, onPick, suffix = '' }: { values: number[]; current: number | null; onPick: (v: number) => void; suffix?: string }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          className={cn(
            'h-8 px-2.5 rounded-lg text-xs font-semibold border tabular-nums',
            current === v ? 'bg-accent text-base-950 border-accent' : 'bg-base-850 text-base-300 border-base-700',
          )}
        >
          {v.toLocaleString()}
          {suffix}
        </button>
      ))}
    </div>
  );
}
