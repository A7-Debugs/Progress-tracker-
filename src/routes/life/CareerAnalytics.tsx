import { useMemo } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { GoalBar, SectionTitle, Stat, TrendBars } from '@/components/life/Visuals';
import { COLORS, SERIES } from '@/components/life/colors';
import { ChartCard, Delta, Findings } from '@/components/life/AnalyticsParts';
import { useLife } from '@/lib/life/useLife';
import { careerComparisons, careerSummary, careerWeeks, deepByWeekday } from '@/lib/life/analytics';
import { goalPace } from '@/lib/life/goalPace';

export default function CareerAnalytics() {
  const ctx = useLife();
  const d = useMemo(() => {
    if (!ctx) return null;
    const weeks = careerWeeks(ctx);
    const worked = weeks.filter((w) => w.work > 0);
    const byDay = deepByWeekday(ctx);
    const best = [...byDay].filter((x) => x.n >= 3 && x.minutes !== null).sort((a, b) => b.minutes! - a.minutes!);
    const paces = ctx.profile.goals.filter((g) => g.tier === 'd90' && (g.domain === 'career' || g.domain === 'personal')).map((g) => ({ g, p: goalPace(ctx, g) }));
    return {
      comps: careerComparisons(ctx),
      weeks,
      byDay,
      best: best[0] ?? null,
      worst: best[best.length - 1] ?? null,
      sum: careerSummary(ctx),
      avgWork: worked.length ? worked.reduce((a, w) => a + w.work, 0) / worked.length : null,
      hasRead: weeks.some((w) => w.read !== null),
      paces,
    };
  }, [ctx]);
  if (!ctx || !d) return null;

  return (
    <div className="animate-fade-in">
      <TopBar title="Career & development" back />
      <div className="px-4 pt-3 pb-24 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Deep work (30d)" value={`${d.sum.h30}h`} sub={<Delta cur={d.sum.h30} prev={d.sum.hPrev30} unit="h" />} />
          <Stat label="Focused sessions" value={String(d.sum.sessions30)} sub="25+ min, last 30 days" />
          <Stat label="Deep work, all time" value={`${d.sum.total}h`} sub="since you started" />
          <Stat label="Paid work / week" value={d.avgWork === null ? '—' : `${d.avgWork.toFixed(1)}h`} sub="weeks with work" />
        </div>

        {d.paces.length > 0 && (
          <Card className="p-4 flex flex-col gap-3">
            <p className="text-sm font-semibold text-base-50">90-day goals</p>
            {d.paces.map(({ g, p }) => (
              <div key={g.id}>
                <GoalBar label={g.title} value={p ? p.fraction : null} color={COLORS.info} formula={p ? p.text : 'Not linked to a measurable metric yet — set one in the Goal tree.'} detail={p?.text} />
              </div>
            ))}
          </Card>
        )}

        <SectionTitle>What drives your best work</SectionTitle>
        <Card className="p-4">
          <Findings items={d.comps.slice(0, 6)} empty="Not enough paired days yet — log deep-work minutes in each check-in (0 counts too)." />
          {d.best && d.worst && d.best !== d.worst && (
            <p className="text-xs text-base-300 mt-3">
              Best day: <span className="text-base-50 font-semibold">{d.best.label}</span> ({d.best.minutes} min avg) · weakest: {d.worst.label} ({d.worst.minutes} min). Schedule the hardest study for {d.best.label}.
            </p>
          )}
        </Card>

        <SectionTitle>Trends</SectionTitle>
        <ChartCard title="Deep work" sub="Hours per week">
          <TrendBars data={d.weeks} dataKey="deep" unit="h" color={SERIES[0]} />
        </ChartCard>
        <ChartCard title="Deep work by weekday" sub="Average minutes, last 90 days">
          <TrendBars data={d.byDay} dataKey="minutes" unit=" min" color={COLORS.info} />
        </ChartCard>
        <ChartCard title="Paid work" sub="Hours per week">
          <TrendBars data={d.weeks} dataKey="work" unit="h" color={SERIES[1]} />
        </ChartCard>
        <ChartCard title="Take-home" sub="Estimated per week (hours × rate × take-home %)">
          <TrendBars data={d.weeks} dataKey="net" unit="" color={COLORS.accent} />
        </ChartCard>
        {d.hasRead && (
          <ChartCard title="Reading" sub="Weekly adherence (%)">
            <TrendBars data={d.weeks} dataKey="read" unit="%" color={SERIES[2]} domain={[0, 100]} />
          </ChartCard>
        )}
      </div>
    </div>
  );
}
