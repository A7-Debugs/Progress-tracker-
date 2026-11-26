import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { SectionTitle, Stat, TrendBars, TrendLines } from '@/components/life/Visuals';
import { COLORS, SERIES } from '@/components/life/colors';
import { ChartCard, Delta, Findings } from '@/components/life/AnalyticsParts';
import { useLife } from '@/lib/life/useLife';
import { healthComparisons, healthDays, healthSummary, healthWeeks } from '@/lib/life/analytics';

const f1 = (x: number | null) => (x === null ? '—' : x.toFixed(1));

export default function HealthAnalytics() {
  const ctx = useLife();
  const navigate = useNavigate();
  const d = useMemo(() => (ctx ? { comps: healthComparisons(ctx), weeks: healthWeeks(ctx), days: healthDays(ctx), sum: healthSummary(ctx) } : null), [ctx]);
  if (!ctx || !d) return null;
  const { cur, prev } = d.sum;

  return (
    <div className="animate-fade-in">
      <TopBar title="Health analytics" back />
      <div className="px-4 pt-3 pb-24 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Sleep (30d avg)" value={`${f1(cur.sleep)}h`} sub={<Delta cur={cur.sleep} prev={prev.sleep} unit="h" />} />
          <Stat label="Nights 7h+" value={`${cur.nights7}/${cur.logged}`} sub="last 30 days" />
          <Stat label="Energy" value={`${f1(cur.energy)}/5`} sub={<Delta cur={cur.energy} prev={prev.energy} />} />
          <Stat label="Stress" value={`${f1(cur.stress)}/5`} sub={<Delta cur={cur.stress} prev={prev.stress} higherIsBetter={false} />} />
          <Stat label="Steps / day" value={cur.steps === null ? '—' : Math.round(cur.steps).toLocaleString()} sub={<Delta cur={cur.steps} prev={prev.steps} digits={0} />} />
          <Stat label="Sick days" value={String(cur.sick)} sub={`${prev.sick} in the 30 days before`} />
        </div>

        <SectionTitle>What your data says</SectionTitle>
        <Card className="p-4">
          <Findings items={d.comps.slice(0, 6)} empty="Not enough paired days yet — keep checking in (energy, mood and stress take 5 seconds)." />
        </Card>

        <SectionTitle>Sleep</SectionTitle>
        <ChartCard title="Hours slept" sub="Each night, last 6 weeks · dashed line = 7h">
          <TrendBars data={d.days} dataKey="sleep" unit="h" color={COLORS.violet} target={7} domain={[0, 10]} />
        </ChartCard>
        <ChartCard title="Wake time" sub="Hour of the day you woke (6.5 = 6:30) · a flat line is the goal">
          <TrendLines data={d.days} lines={[{ key: 'wake', color: SERIES[0], name: 'Wake time' }]} unit="" />
          <p className="text-[11px] text-base-500 mt-1">Enter bed and wake times in the check-in to fill this in. Regular wake times matter more than total hours (UK Biobank, 2023).</p>
        </ChartCard>
        <ChartCard title="Sleep regularity" sub="Weekly wake-time variation in minutes (lower is better; under 30 is excellent)">
          <TrendBars data={d.weeks} dataKey="wakeSd" unit=" min" color={COLORS.info} />
        </ChartCard>

        <SectionTitle>Energy, mood & stress</SectionTitle>
        <ChartCard title="How you've felt" sub="Weekly averages on the 1–5 check-in scale">
          <TrendLines
            data={d.weeks}
            lines={[
              { key: 'energy', color: SERIES[0], name: 'Energy' },
              { key: 'mood', color: SERIES[2], name: 'Mood' },
              { key: 'stress', color: SERIES[1], name: 'Stress' },
            ]}
            domain={[1, 5]}
          />
        </ChartCard>

        <SectionTitle>Movement & habits</SectionTitle>
        <ChartCard title="Training sessions" sub="Per week (app workouts + manual sessions)">
          <TrendBars data={d.weeks} dataKey="sessions" color={COLORS.accent} />
        </ChartCard>
        <ChartCard title="Steps" sub="Average per day each week · dashed line = 8,000">
          <TrendBars data={d.weeks} dataKey="steps" color={SERIES[2]} target={8000} />
        </ChartCard>
        <ChartCard title="Health habits" sub="Weekly adherence (%)">
          <TrendLines
            data={d.weeks}
            lines={[
              { key: 'walk', color: SERIES[0], name: 'Daylight walk' },
              { key: 'protein', color: SERIES[1], name: 'Protein' },
              { key: 'supplements', color: SERIES[2], name: 'Supplements' },
            ]}
            unit="%"
            domain={[0, 100]}
          />
        </ChartCard>
        <ChartCard title="Sick days" sub="Per week">
          <TrendBars data={d.weeks} dataKey="sick" color={COLORS.warn} />
        </ChartCard>

        <Card className="p-4 cursor-pointer active:bg-base-850 flex items-center justify-between" onClick={() => navigate('/bodyweight')}>
          <span className="text-sm text-base-100">Bodyweight, body fat & nutrition</span>
          <ChevronRight size={16} className="text-base-500" />
        </Card>
      </div>
    </div>
  );
}
