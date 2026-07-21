import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface ChartPoint {
  label: string;
  value: number;
}

export function ProgressChart({
  data,
  unit = '',
  color = '#7ce281',
  height = 180,
}: {
  data: ChartPoint[];
  unit?: string;
  color?: string;
  height?: number;
}) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-sm text-base-500" style={{ height }}>
        Log at least 2 sessions to see a trend.
      </div>
    );
  }

  const gradientId = `grad-${color.replace('#', '')}`;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, max * 0.05, 1);
  const domain: [number, number] = [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1c1d23" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#6b6d7a', fontSize: 11 }}
          axisLine={{ stroke: '#24252c' }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: '#6b6d7a', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={42}
          domain={domain}
          allowDataOverflow={false}
          reversed={false}
        />
        <Tooltip
          contentStyle={{
            background: '#17181d',
            border: '1px solid #24252c',
            borderRadius: 12,
            fontSize: 12,
            color: '#e1e2e6',
          }}
          labelStyle={{ color: '#93949f' }}
          formatter={(value) => [`${value}${unit}`, '']}
        />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#${gradientId})`} dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
