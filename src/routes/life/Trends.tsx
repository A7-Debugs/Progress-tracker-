import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { addMonths, endOfMonth, format, parseISO } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { NoData, TrendBars, TrendLines, type SeriesPoint } from '@/components/life/Visuals';
import { COLORS } from '@/components/life/colors';
import { useLife } from '@/lib/life/useLife';
import { addDaysStr, calorieTargetOn, dateRange, ds, evaluatePeriod, evaluateWeek, weekStartOf } from '@/lib/life/engine';
import { proteinTargets } from '@/lib/life/nutrition';
import { derive } from '@/lib/life/finance';

const r1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);

export default function Trends() {
  const navigate = useNavigate();
  const ctx = useLife();

  const d = useMemo(() => {
    if (!ctx) return null;
    const thisWeek = weekStartOf(ctx.today);
    const firstWeek = weekStartOf(ctx.firstDate);
    const weeks: SeriesPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const ws = addDaysStr(thisWeek, -7 * i);
      if (ws < firstWeek) continue;
      const w = evaluateWeek(ctx, ws);
      weeks.push({
        label: format(parseISO(ws), 'd MMM'),
        overall: w.overall,
        adherence: w.habitAdherence === null ? null : Math.round(w.habitAdherence * 100),
        sessions: w.metrics.trainingSessions,
        deep: r1(w.metrics.deepWorkMinutes / 60),
        sleep: r1(w.metrics.avgSleep),
        sleepSd: r1(w.metrics.sleepSd),
      });
    }

    const months: SeriesPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = format(addMonths(parseISO(`${ctx.today.slice(0, 7)}-01`), -i), 'yyyy-MM-dd');
      if (ds(endOfMonth(parseISO(start))) < ctx.firstDate) continue;
      const m = evaluatePeriod(ctx, start, ds(endOfMonth(parseISO(start))));
      months.push({
        label: format(parseISO(start), 'MMM'),
        overall: m.loggedDays >= 3 ? m.overall : null,
        adherence: m.habitAdherence === null ? null : Math.round(m.habitAdherence * 100),
      });
    }

    const sleepDaily: SeriesPoint[] = dateRange(addDaysStr(ctx.today, -59), ctx.today)
      .filter((x) => x >= ctx.firstDate)
      .map((x) => ({ label: format(parseISO(x), 'd MMM'), sleep: ctx.byDate.get(x)?.sleepHours ?? null }));

    const bw = ctx.bodyweight.filter((b) => b.weight !== null);
    const bodyweight: SeriesPoint[] = bw.map((b, i) => {
      const win = bw.slice(Math.max(0, i - 6), i + 1).map((x) => x.weight!);
      return { label: format(parseISO(b.date), 'd MMM'), weight: b.weight, avg: r1(win.reduce((a, c) => a + c, 0) / win.length) };
    });

    let cum = 0;
    const cumulative: SeriesPoint[] = [];
    for (let ws = firstWeek; ws <= thisWeek; ws = addDaysStr(ws, 7)) {
      const mins = dateRange(ws, addDaysStr(ws, 6)).reduce((a, x) => a + (ctx.byDate.get(x)?.deepWorkMinutes ?? 0), 0);
      cum += mins / 60;
      cumulative.push({ label: format(parseISO(ws), 'd MMM'), hours: r1(cum) });
    }

    const finance: SeriesPoint[] = ctx.finance.map((f) => {
      const x = derive(f);
      return {
        label: format(parseISO(`${f.month}-01`), 'MMM yy'),
        netWorth: Math.round(x.netWorth),
        liquid: Math.round(x.liquid),
        invested: Math.round(x.fiAssets),
        savingsRate: x.savingsRate === null ? null : Math.round(x.savingsRate * 100),
      };
    });

    const foodDays = dateRange(addDaysStr(ctx.today, -29), ctx.today).filter((x) => x >= ctx.firstDate);
    const nutrition: SeriesPoint[] = foodDays.map((x) => {
      const n = ctx.nutrition.get(x);
      return {
        label: format(parseISO(x), 'd MMM'),
        protein: n?.entries ? n.protein : null,
        min: proteinTargets(ctx.profile, ctx.bodyweight, x).min,
        calories: n?.calories ?? null,
        target: calorieTargetOn(ctx, x),
      };
    });
    const hasCalories = nutrition.some((p) => p.calories !== null);

    return { weeks, months, sleepDaily, bodyweight, cumulative, finance, nutrition, hasCalories, totalDeep: cum };
  }, [ctx]);

  if (!ctx || !d) return null;
  const cur = ctx.profile.currency;

  return (
    <div className="animate-fade-in">
      <TopBar title="Trends" back />
      <div className="px-4 pt-3 pb-24 flex flex-col gap-3">
        <Chart title="Habit consistency" sub="Weekly adherence across scheduled habits (%)">
          <TrendBars data={d.weeks} dataKey="adherence" unit="%" domain={[0, 100]} target={85} />
          <p className="text-[11px] text-base-500 mt-1">Dashed line = 85%, the level-up threshold.</p>
        </Chart>

        <Chart title="Monthly completion" sub="Habit adherence by month (%)">
          <TrendBars data={d.months} dataKey="adherence" unit="%" domain={[0, 100]} color={COLORS.info} />
        </Chart>

        <Chart title="Sleep" sub="Nightly hours, last 60 days">
          <TrendLines data={d.sleepDaily} lines={[{ key: 'sleep', color: COLORS.violet, name: 'Sleep' }]} unit="h" target={7} domain={[4, 10]} />
        </Chart>
        <Chart title="Sleep consistency" sub="Weekly average and variability (SD, lower = more consistent)">
          <TrendLines
            data={d.weeks}
            lines={[
              { key: 'sleep', color: COLORS.violet, name: 'Avg hours' },
              { key: 'sleepSd', color: COLORS.warn, name: 'Variability (SD)', dashed: true },
            ]}
            unit="h"
          />
        </Chart>

        <Chart title="Training frequency" sub="Sessions per week">
          <TrendBars data={d.weeks} dataKey="sessions" color={COLORS.accent} />
          <button onClick={() => navigate('/analytics')} className="text-xs text-accent flex items-center gap-0.5 mt-2">
            Strength progression & volume <ChevronRight size={12} />
          </button>
        </Chart>

        <Chart title="Bodyweight" sub="Daily weigh-ins with 7-entry moving average">
          {d.bodyweight.length < 2 ? (
            <NoData text="Log bodyweight in the check-in (optional section) to see the trend." />
          ) : (
            <TrendLines
              data={d.bodyweight}
              lines={[
                { key: 'weight', color: '#4a4b56', name: 'Weigh-in' },
                { key: 'avg', color: COLORS.accent, name: '7-entry average' },
              ]}
              unit="kg"
            />
          )}
        </Chart>

        <Chart title="Protein" sub="Daily grams from the food log vs your minimum, last 30 days">
          <TrendLines
            data={d.nutrition}
            lines={[
              { key: 'protein', color: COLORS.accent, name: 'Protein (g)' },
              { key: 'min', color: COLORS.warn, name: 'Minimum', dashed: true },
            ]}
            unit="g"
          />
        </Chart>

        {d.hasCalories && (
          <Chart title="Calories" sub="Daily kcal from the food log (dashed = target once set)">
            <TrendLines
              data={d.nutrition}
              lines={[
                { key: 'calories', color: COLORS.gold, name: 'Calories' },
                { key: 'target', color: COLORS.info, name: 'Target', dashed: true },
              ]}
              unit=" kcal"
            />
          </Chart>
        )}

        <Chart title="Productivity" sub="Deep-work hours per week">
          <TrendBars data={d.weeks} dataKey="deep" unit="h" color={COLORS.info} />
        </Chart>

        <Chart title="Career & learning" sub={`Cumulative study / deep-work hours · ${Math.round(d.totalDeep)}h total`}>
          <TrendLines data={d.cumulative} lines={[{ key: 'hours', color: COLORS.info, name: 'Cumulative hours' }]} unit="h" />
          <p className="text-[11px] text-base-500 mt-1">Milestones: 50h · 100h · 200h (≈ one year of Level 1–2 study).</p>
        </Chart>

        <Chart title="Finance" sub="Net worth, liquid assets and investments by month">
          <TrendLines
            data={d.finance}
            lines={[
              { key: 'netWorth', color: COLORS.gold, name: 'Net worth' },
              { key: 'invested', color: COLORS.accent, name: 'Investments + pension' },
              { key: 'liquid', color: COLORS.info, name: 'Liquid' },
            ]}
            unit=""
          />
          <p className="text-[11px] text-base-500 mt-1">Values in {cur}.</p>
        </Chart>

        <Chart title="Savings rate" sub="(Net income − spending) ÷ net income, by month">
          <TrendBars data={d.finance} dataKey="savingsRate" unit="%" color={COLORS.gold} target={Math.round(ctx.profile.savingsRateTarget * 100)} />
        </Chart>

        <Chart title="Overall life score" sub="Monthly performance trend">
          <TrendLines data={d.months} lines={[{ key: 'overall', color: COLORS.accent, name: 'Overall' }]} domain={[0, 100]} />
        </Chart>

        <Chart title="Weekly score" sub="Last 12 weeks">
          <TrendBars data={d.weeks} dataKey="overall" domain={[0, 100]} />
        </Chart>
      </div>
    </div>
  );
}

function Chart({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-base-50">{title}</p>
      <p className="text-[11px] text-base-500 mb-2">{sub}</p>
      {children}
    </Card>
  );
}
