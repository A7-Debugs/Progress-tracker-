import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/Card';
import { NoData } from '@/components/life/Visuals';
import { ASSET_GROUPS, ASSET_LABELS, assetValue, liveBalances } from '@/lib/life/assets';
import type { LifeContext } from '@/lib/life/engine';

/** Categorical slots 1–5 (validated for CVD separation and contrast on the dark surface). */
const GROUP_COLORS: Record<string, string> = { property: '#338ced', investments: '#e76624', pension: '#00a888', cash: '#d28e05', car: '#e24d8b' };
const SURFACE = '#0e0e11';
const gbp = (x: number) => `£${Math.round(x).toLocaleString()}`;
const short = (x: number) => (Math.abs(x) >= 1000 ? `£${Math.round(x / 1000)}k` : `£${Math.round(x)}`);

export function AssetsCard({ ctx }: { ctx: LifeContext }) {
  const pay = ctx.profile.pay;
  const d = useMemo(() => {
    const live = liveBalances(ctx.finance, pay, ctx.today);
    const rows = ctx.finance.slice(-6).map((f) => {
      const p: Record<string, string | number> = { label: format(parseISO(`${f.month}-01`), 'MMM yy') };
      for (const g of ASSET_GROUPS) p[g.key] = Math.max(0, Math.round(g.keys.reduce((a, k) => a + assetValue(f, k), 0)));
      return p;
    });
    if (live.added > 0) {
      const p: Record<string, string | number> = { label: 'Now (est.)' };
      for (const g of ASSET_GROUPS) p[g.key] = Math.max(0, Math.round(live.rows.filter((r) => g.keys.includes(r.key)).reduce((a, r) => a + r.now, 0)));
      rows.push(p);
    }
    const groups = ASSET_GROUPS.filter((g) => rows.some((r) => (r[g.key] as number) > 0));
    return { live, rows, groups };
  }, [ctx, pay]);

  if (!d.live.asOf) return null;
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-base-50">Your assets now</p>
      <p className="text-[11px] text-base-500">
        {format(parseISO(`${d.live.asOf}-01`), 'MMMM')} snapshot + recurring transfers since. Growth and falls in value only show when you update the snapshot.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {d.live.rows.map((r) => (
          <div key={r.key} className="flex items-start justify-between gap-3 text-xs">
            <div className="min-w-0">
              <p className="text-base-100">{ASSET_LABELS[r.key]}</p>
              {r.added > 0 && (
                <p className="text-[11px] text-accent">
                  +{gbp(r.added)} since snapshot ({r.sources.join(', ')})
                </p>
              )}
            </div>
            <span className="tabular-nums text-base-50 font-semibold shrink-0">{gbp(r.now)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-base-800 pt-2 text-sm">
          <span className="text-base-50 font-semibold">Total assets</span>
          <span className="tabular-nums text-base-50 font-semibold">{gbp(d.live.total)}</span>
        </div>
        <p className="text-[11px] text-base-500">Debts (student loan, other debt) aren't included here — net worth is on the cards above.</p>
      </div>

      <p className="text-xs font-semibold text-base-200 mt-4">Asset mix by month</p>
      {d.rows.length < 1 || !d.groups.length ? (
        <NoData height={160} />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={d.rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c1d23" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#6b6d7a', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#24252c' }} />
              <YAxis tick={{ fill: '#6b6d7a', fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={short} />
              <Tooltip
                contentStyle={{ background: '#17181d', border: '1px solid #24252c', borderRadius: 12, fontSize: 12, color: '#e1e2e6' }}
                labelStyle={{ color: '#93949f' }}
                itemStyle={{ color: '#e1e2e6' }}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                formatter={(v, name) => [gbp(Number(v)), name]}
              />
              {d.groups.map((g) => (
                <Bar key={g.key} dataKey={g.key} name={g.label} stackId="a" fill={GROUP_COLORS[g.key]} stroke={SURFACE} strokeWidth={2} maxBarSize={36} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-1">
            {d.groups.map((g) => (
              <span key={g.key} className="flex items-center gap-1.5 text-[11px] text-base-400">
                <span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLORS[g.key] }} />
                {g.label}
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
