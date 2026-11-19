import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Lightbulb, Minus, Target } from 'lucide-react';
import { useSnapshot } from '@/lib/hooks';
import { Loading, Page, PageHeader } from '@/components/layout';
import { Bar, SectionTitle, StatTile } from '@/components/game';
import { Bars, ChartCard, Lines } from '@/components/charts';
import { Icon } from '@/components/Icon';
import { calendarWeekConsistency, consistency, currentLevel, dayStatus, habitCompletionRate, streakInfo, weeklyConsistency, xpBetween } from '@/lib/performance';
import { addDays, dateRange, dayOfWeek, DAY_LETTER, fmtShort, monthStart, weekStart, fmtMonth, monthKey, daysBetween } from '@/lib/dates';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { insights } from '@/lib/insights';
import { cn } from '@/lib/cn';
import type { Snapshot } from '@/lib/snapshot';

const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);

function buildData(s: Snapshot) {
  const start = s.profile.startDate;
  const ws = weekStart(s.today);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(ws, -7 * (7 - i))).filter((w) => addDays(w, 6) >= start);
  const last14 = dateRange(addDays(s.today, -13), s.today).filter((d) => d >= start);
  const last30 = dateRange(addDays(s.today, -29), s.today).filter((d) => d >= start);

  const xpDaily = last14.map((d) => ({ label: `${DAY_LETTER[dayOfWeek(d)]}`, date: fmtShort(d), life: xpBetween(s, d, d, 'life'), academic: xpBetween(s, d, d, 'academic') }));
  const completion = last30.map((d) => {
    const st = dayStatus(s, d);
    return { label: fmtShort(d), pct: st.pct === null || (d === s.today && st.pct < 1) ? null : Math.round(st.pct * 100) };
  });
  const weekly = weeks.map((w) => {
    const c = calendarWeekConsistency(s, w);
    const end = addDays(w, 6);
    const sl = [...s.sleepLogs.values()].filter((x) => x.date >= w && x.date <= end);
    const dq = s.quests.filter((q) => q.period === 'day' && q.periodKey >= w && q.periodKey <= end && q.periodKey <= s.today);
    return {
      label: fmtShort(w),
      consistency: c.pct === null ? 0 : Math.round(c.pct * 100),
      sleep: sl.length ? +(sl.reduce((a, x) => a + x.minutes, 0) / sl.length / 60).toFixed(1) : null,
      activeDays: new Set(s.exerciseLogs.filter((e) => e.date >= w && e.date <= end && e.minutes >= 10).map((e) => e.date)).size,
      quests: dq.length ? Math.round((dq.filter((q) => q.completedAt).length / dq.length) * 100) : null,
    };
  });

  const lastWs = addDays(ws, -7);
  const thisWeekC = consistency(s, ws, s.today);
  const lastWeekC = calendarWeekConsistency(s, lastWs);
  const ms = monthStart(s.today);
  const lms = monthStart(addDays(ms, -1));
  const thisMonthC = consistency(s, ms, s.today);
  const lastMonthC = consistency(s, lms, addDays(ms, -1));
  const sameDayLastMonth = addDays(lms, Math.min(29, Number(s.today.slice(8, 10)) - 1));
  const compare = {
    week: { a: thisWeekC.pct, b: lastWeekC.pct, xpA: xpBetween(s, ws, s.today), xpB: xpBetween(s, lastWs, addDays(lastWs, daysBetween(ws, s.today))) },
    month: { a: thisMonthC.pct, b: lastMonthC.pct, xpA: xpBetween(s, ms, s.today), xpB: xpBetween(s, lms, sameDayLastMonth < ms ? sameDayLastMonth : addDays(ms, -1)) },
  };

  const habits = s.habits
    .filter((h) => h.active)
    .map((h) => ({ h, now: habitCompletionRate(s, h, addDays(s.today, -27), s.today), prev: habitCompletionRate(s, h, addDays(s.today, -55), addDays(s.today, -28)) }))
    .sort((a, b) => (b.now.pct ?? -1) - (a.now.pct ?? -1));

  // Heatmap: last 12 weeks, Monday-first columns.
  const hmStart = addDays(ws, -7 * 11);
  const streak = streakInfo(s);
  const heat = dateRange(hmStart, addDays(ws, 6)).map((d) => ({ d, state: d > s.today ? 'future' : d < start ? 'before' : (streak.history.get(d) ?? 'before'), pct: d <= s.today && d >= start ? dayStatus(s, d).pct : null }));

  return { xpDaily, completion, weekly, compare, habits, heat, streak, thisMonthLabel: fmtMonth(monthKey(s.today)) };
}

export default function Progress() {
  const s = useSnapshot();
  const data = useMemo(() => (s ? buildData(s) : null), [s]);
  if (!s || !data) return <Loading />;
  const level = currentLevel(s);
  const w7 = weeklyConsistency(s);
  const month = consistency(s, monthStart(s.today), s.today);
  const today = dayStatus(s, s.today);
  const unlocked = s.achievements.size;
  const tips = insights(s);
  const enoughDays = data.completion.filter((c) => c.pct !== null).length;

  return (
    <>
      <PageHeader title="Progress" subtitle="Every number here comes from what you've logged" />
      <Page className="pb-8">
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Total XP" value={level.total.toLocaleString()} color="#ffc845" />
          <StatTile label="Level" value={level.level} sub={`${Math.round(level.progress * 100)}% to ${level.level + 1}`} />
          <StatTile label="Today" value={pct(today.pct)} sub={`${today.done.length}/${today.scheduled.length} habits`} />
          <StatTile label="Streak" value={`${data.streak.current}d`} sub={`best ${data.streak.longest}d`} color="#ff8a3d" />
          <StatTile label="7-day" value={pct(w7.pct)} sub="consistency" color="#3ee8a4" />
          <StatTile label="Month" value={pct(month.pct)} sub={data.thisMonthLabel} />
        </div>

        {tips.length > 0 && (
          <>
            <SectionTitle>Insights</SectionTitle>
            <div className="space-y-2">
              {tips.map((t, i) => (
                <div key={i} className={cn('flex gap-2.5 rounded-2xl border p-3 text-sm', t.tone === 'positive' ? 'border-mint/30 bg-mint/5 text-base-100' : t.tone === 'focus' ? 'border-warn/30 bg-warn/5 text-base-100' : 'border-base-800 bg-base-900 text-base-200')}>
                  {t.tone === 'focus' ? <Target size={16} className="text-warn shrink-0 mt-0.5" /> : <Lightbulb size={16} className="text-mint shrink-0 mt-0.5" />}
                  {t.text}
                </div>
              ))}
            </div>
          </>
        )}

        <SectionTitle>Compare</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <CompareCard title="This week vs last" a={data.compare.week.a} b={data.compare.week.b} xpA={data.compare.week.xpA} xpB={data.compare.week.xpB} />
          <CompareCard title="This month vs last" a={data.compare.month.a} b={data.compare.month.b} xpA={data.compare.month.xpA} xpB={data.compare.month.xpB} />
        </div>
        <p className="text-[11px] text-base-500 mt-1">XP is compared over the same number of days.</p>

        <SectionTitle>Charts</SectionTitle>
        <div className="space-y-2">
          <ChartCard title="XP earned per day" subtitle="Last 14 days · life vs academic">
            <Bars data={data.xpDaily} series={[{ key: 'life', name: 'Life', color: '#3fe3ff', stack: 'x' }, { key: 'academic', name: 'Academic', color: '#a47bff', stack: 'x' }]} unit=" XP" />
          </ChartCard>
          <ChartCard title="Daily completion" subtitle="Last 30 days" empty={enoughDays < 2 ? 'Your trend line appears after 2 completed days.' : null}>
            <Lines data={data.completion} series={[{ key: 'pct', name: 'Completion', color: '#3ee8a4' }]} unit="%" yMax={100} />
          </ChartCard>
          <ChartCard title="Weekly consistency" subtitle="Mon–Sun weeks">
            <Bars data={data.weekly} series={[{ key: 'consistency', name: 'Consistency', color: '#a47bff' }]} unit="%" yMax={100} refLine={{ y: 80, label: '80%' }} />
          </ChartCard>
          <ChartCard title="Streak calendar" subtitle="Last 12 weeks">
            <Heatmap cells={data.heat} />
          </ChartCard>
        </div>

        <SectionTitle>Habit trends · last 4 weeks</SectionTitle>
        <div className="rounded-2xl bg-base-900 border border-base-800 divide-y divide-base-800">
          {data.habits.length === 0 && <p className="p-4 text-sm text-base-400">No active habits.</p>}
          {data.habits.map(({ h, now, prev }) => {
            const diff = now.pct !== null && prev.pct !== null ? now.pct - prev.pct : null;
            return (
              <Link to={`/habits/${h.id}`} key={h.id} className="flex items-center gap-3 px-3 py-2.5">
                <Icon name={h.icon} size={16} className="text-base-400" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm">
                    <span className="text-base-100 truncate">{h.name}</span>
                    <span className="font-bold tabular-nums text-base-50">{pct(now.pct)}</span>
                  </div>
                  <Bar value={now.pct} color={now.pct !== null && now.pct >= 0.8 ? '#3ee8a4' : now.pct !== null && now.pct >= 0.5 ? '#3fe3ff' : '#ffb454'} className="mt-1" height={5} />
                </div>
                <span className="w-10 flex justify-end">
                  {diff === null ? <Minus size={14} className="text-base-600" /> : diff > 0.04 ? <ArrowUpRight size={16} className="text-mint" /> : diff < -0.04 ? <ArrowDownRight size={16} className="text-warn" /> : <Minus size={14} className="text-base-500" />}
                </span>
              </Link>
            );
          })}
        </div>

        <SectionTitle>Health & quests</SectionTitle>
        <div className="space-y-2">
          <ChartCard title="Average sleep per week" subtitle="Hours · 8–10h is the target" empty={s.sleepLogs.size === 0 ? 'Record sleep in Health to see this trend.' : null}>
            <Lines data={data.weekly} series={[{ key: 'sleep', name: 'Avg sleep', color: '#7b8cff' }]} unit="h" yMax={12} />
          </ChartCard>
          <ChartCard title="Active days per week" subtitle="Days with 10+ minutes of activity" empty={s.exerciseLogs.length === 0 ? 'Log activity in Health to see this trend.' : null}>
            <Bars data={data.weekly} series={[{ key: 'activeDays', name: 'Active days', color: '#ff8a3d' }]} yMax={7} />
          </ChartCard>
          <ChartCard title="Daily quest completion rate" subtitle="% of daily quests completed each week">
            <Bars data={data.weekly} series={[{ key: 'quests', name: 'Quests', color: '#ffc845' }]} unit="%" yMax={100} />
          </ChartCard>
        </div>

        <Link to="/achievements" className="mt-3 flex items-center gap-3 rounded-2xl bg-base-900 border border-base-800 p-3">
          <div className="flex-1">
            <div className="flex justify-between text-sm">
              <span className="font-bold text-base-50">Achievements</span>
              <span className="font-bold text-base-200 tabular-nums">
                {unlocked}/{ACHIEVEMENTS.length}
              </span>
            </div>
            <Bar value={unlocked / ACHIEVEMENTS.length} color="#ffc845" className="mt-1.5" />
          </div>
          <ChevronRight size={18} className="text-base-500" />
        </Link>
        <Link to="/academy/stats" className="mt-2 flex items-center justify-between rounded-2xl bg-base-900 border border-base-800 p-3 text-sm font-bold text-base-50">
          Academy analytics <ChevronRight size={18} className="text-base-500" />
        </Link>
      </Page>
    </>
  );
}

function CompareCard({ title, a, b, xpA, xpB }: { title: string; a: number | null; b: number | null; xpA: number; xpB: number }) {
  const diff = a !== null && b !== null ? Math.round((a - b) * 100) : null;
  return (
    <div className="rounded-2xl bg-base-900 border border-base-800 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-base-400">{title}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-xl font-black text-base-50 tabular-nums">{pct(a)}</span>
        <span className="text-xs text-base-400 tabular-nums">vs {pct(b)}</span>
      </div>
      {diff !== null && <p className={cn('text-xs font-bold', diff > 0 ? 'text-mint' : diff < 0 ? 'text-warn' : 'text-base-400')}>{diff > 0 ? `+${diff}` : diff} pts</p>}
      <p className="text-xs text-base-300 mt-1 tabular-nums">
        {xpA} XP <span className="text-base-500">vs {xpB}</span>
      </p>
    </div>
  );
}

function Heatmap({ cells }: { cells: { d: string; state: string; pct: number | null }[] }) {
  const cols: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));
  const color = (c: (typeof cells)[number]) => {
    if (c.state === 'future' || c.state === 'before') return 'var(--color-base-850)';
    if (c.state === 'rest') return 'var(--color-base-700)';
    if (c.state === 'shielded') return '#3fe3ff55';
    if (c.pct === null || c.pct === 0) return 'var(--color-base-800)';
    return `rgba(62, 232, 164, ${0.25 + c.pct * 0.75})`;
  };
  return (
    <div>
      <div className="flex gap-1">
        <div className="grid grid-rows-7 gap-1 text-[9px] text-base-500 pr-0.5">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className="h-full flex items-center leading-none">{d}</span>
          ))}
        </div>
        {cols.map((col, i) => (
          <div key={i} className="grid grid-rows-7 gap-1 flex-1">
            {col.map((c) => (
              <div key={c.d} title={`${fmtShort(c.d)}${c.pct !== null ? ` · ${Math.round(c.pct * 100)}%` : ''}`} className="aspect-square rounded-[4px]" style={{ background: color(c) }} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-base-400">
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(62,232,164,1)' }} /> done</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-base-700" /> rest day</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: '#3fe3ff55' }} /> shield used</span>
      </div>
    </div>
  );
}
