import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

const AXIS = { stroke: '#4c5070', fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID = <CartesianGrid stroke="#1e2034" vertical={false} />;
const TIP = {
  contentStyle: { background: '#121322', border: '1px solid #272a40', borderRadius: 12, fontSize: 12, color: '#e5e7f2' },
  labelStyle: { color: '#9da1bc', marginBottom: 2 },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
};

export function ChartCard({ title, subtitle, children, empty, right }: { title: string; subtitle?: string; children: ReactNode; empty?: string | null; right?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-base-900 border border-base-800 p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-bold text-base-50">{title}</p>
          {subtitle && <p className="text-xs text-base-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      {empty ? <div className="h-36 flex items-center justify-center text-center text-xs text-base-400 px-6">{empty}</div> : children}
    </div>
  );
}

export interface Series {
  key: string;
  name: string;
  color: string;
  stack?: string;
}

export function Bars({ data, series, x = 'label', height = 170, unit = '', yMax, band, refLine }: { data: Record<string, unknown>[]; series: Series[]; x?: string; height?: number; unit?: string; yMax?: number; band?: [number, number]; refLine?: { y: number; label: string } }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
        {GRID}
        <XAxis dataKey={x} {...AXIS} interval="preserveStartEnd" minTickGap={6} />
        <YAxis {...AXIS} domain={[0, yMax ?? 'auto']} allowDecimals={false} />
        {band && <ReferenceArea y1={band[0]} y2={band[1]} fill="#3ee8a4" fillOpacity={0.08} />}
        {refLine && <ReferenceLine y={refLine.y} stroke="#ffc845" strokeDasharray="4 4" label={{ value: refLine.label, fill: '#ffc845', fontSize: 10, position: 'insideTopRight' }} />}
        <Tooltip {...TIP} formatter={(v) => `${v}${unit}`} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9da1bc' }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={s.stack} radius={s.stack && i < series.length - 1 ? 0 : [5, 5, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Lines({ data, series, x = 'label', height = 170, unit = '', yMax, yMin = 0 }: { data: Record<string, unknown>[]; series: Series[]; x?: string; height?: number; unit?: string; yMax?: number; yMin?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
        {GRID}
        <XAxis dataKey={x} {...AXIS} interval="preserveStartEnd" minTickGap={8} />
        <YAxis {...AXIS} domain={[yMin, yMax ?? 'auto']} allowDecimals={false} />
        <Tooltip {...TIP} formatter={(v) => (v === null || v === undefined ? 'No data' : `${v}${unit}`)} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9da1bc' }} />}
        {series.map((s) => (
          <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.5} dot={{ r: 2.5, fill: s.color }} activeDot={{ r: 5 }} connectNulls type="monotone" />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
