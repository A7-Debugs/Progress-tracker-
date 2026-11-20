import type { ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from './ui/Card';

/**
 * Chart conventions: one y-axis only, recessive grid and axes, 2px lines, bars with rounded data-ends
 * and a surface gap, hover tooltip on every chart, a legend whenever there are 2+ series, and every
 * chart has a "no data" state instead of a fabricated line.
 */
const AXIS = { stroke: 'var(--fg-3)', fontSize: 11, tickLine: false, axisLine: false } as const;
const TIP = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12, color: 'var(--fg)', boxShadow: 'var(--shadow-lg)' },
  labelStyle: { color: 'var(--fg-2)', marginBottom: 2, fontWeight: 600 },
  itemStyle: { color: 'var(--fg)' },
  cursor: { fill: 'var(--surface-2)', stroke: 'var(--line-strong)' },
};

export interface Series {
  key: string;
  name: string;
  color: string;
}

export function ChartCard({ title, subtitle, children, empty, right, className }: { title: string; subtitle?: string; children: ReactNode; empty?: string | null; right?: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-fg">{title}</h3>
          {subtitle && <p className="text-xs text-fg-3 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="px-2 pb-3 pt-2">{empty ? <div className="h-40 flex items-center justify-center text-center text-[13px] text-fg-3 px-6">{empty}</div> : children}</div>
    </Card>
  );
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 pb-1 text-[11px] text-fg-2">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

const fmt = (unit: string) => (v: unknown) => (v === null || v === undefined ? 'No data' : `${typeof v === 'number' ? Math.round(v * 10) / 10 : v}${unit}`);

export function Bars({ data, series, x = 'label', height = 180, unit = '', yMax, refLine, stacked }: { data: Record<string, unknown>[]; series: Series[]; x?: string; height?: number; unit?: string; yMax?: number; refLine?: { y: number; label: string }; stacked?: boolean }) {
  return (
    <>
      <Legend series={series} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey={x} {...AXIS} interval="preserveStartEnd" minTickGap={6} />
          <YAxis {...AXIS} domain={[0, yMax ?? 'auto']} allowDecimals={false} width={44} />
          {refLine && <ReferenceLine y={refLine.y} stroke="var(--fg-3)" strokeDasharray="4 4" label={{ value: refLine.label, fill: 'var(--fg-3)', fontSize: 10, position: 'insideTopRight' }} />}
          <Tooltip {...TIP} formatter={fmt(unit)} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={stacked ? 'a' : undefined} stroke="var(--surface)" strokeWidth={stacked ? 1 : 0} radius={!stacked || i === series.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={26} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

export function Lines({ data, series, x = 'label', height = 180, unit = '', yMax, yMin = 0 }: { data: Record<string, unknown>[]; series: Series[]; x?: string; height?: number; unit?: string; yMax?: number; yMin?: number }) {
  return (
    <>
      <Legend series={series} />
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey={x} {...AXIS} interval="preserveStartEnd" minTickGap={10} />
          <YAxis {...AXIS} domain={[yMin, yMax ?? 'auto']} allowDecimals={false} width={44} />
          <Tooltip {...TIP} formatter={fmt(unit)} cursor={{ stroke: 'var(--line-strong)' }} />
          {series.map((s) => (
            <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={data.length <= 16 ? { r: 3, fill: s.color, stroke: 'var(--surface)', strokeWidth: 2 } : false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} connectNulls type="monotone" isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

export function AreaLine({ data, dataKey, name, color = 'var(--accent)', x = 'label', height = 180, unit = '' }: { data: Record<string, unknown>[]; dataKey: string; name: string; color?: string; x?: string; height?: number; unit?: string }) {
  const gid = `area-${dataKey}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 10, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey={x} {...AXIS} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...AXIS} allowDecimals={false} width={52} />
        <Tooltip {...TIP} formatter={fmt(unit)} cursor={{ stroke: 'var(--line-strong)' }} />
        <Area dataKey={dataKey} name={name} stroke={color} strokeWidth={2} fill={`url(#${gid})`} type="monotone" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Part-to-whole as a labelled list of bars (clearer than a donut, and every value is visible). */
export function ShareList({ rows, format }: { rows: { id: string; name: string; color: string; value: number }[]; format: (v: number) => string }) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (!total) return null;
  return (
    <div className="px-2 space-y-2.5 pt-1">
      <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px]" aria-hidden>
        {rows.map((r) => (
          <div key={r.id} style={{ width: `${(r.value / total) * 100}%`, background: r.color }} title={`${r.name}: ${format(r.value)}`} />
        ))}
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2 text-[13px]">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: r.color }} />
            <span className="flex-1 truncate text-fg-2">{r.name}</span>
            <span className="tnum text-fg font-medium">{format(r.value)}</span>
            <span className="tnum text-fg-3 w-10 text-right">{Math.round((r.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
