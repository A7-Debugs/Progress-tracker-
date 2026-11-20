import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Lock, Minus, NotebookPen } from 'lucide-react';
import { useStore } from '@/lib/store';
import { addDays, fmtMonth, fmtShort, monthKey, weekStart } from '@/lib/dates';
import { estimateAccuracy, goalSeries, monthMetrics, monthRange, periodMetrics, prevMonthKey, timeAllocation, underperforming, weeklySeries, xpSeries, type PeriodMetrics } from '@/lib/analytics';
import { habitStats, isWeeklyHabit } from '@/lib/habits';
import { liveGoals } from '@/lib/goals';
import { ACHIEVEMENTS, achievementStats, levelInfo, stageFor, xpToNext } from '@/lib/progression';
import { CATEGORY_COLORS } from '@/lib/defaults';
import { cn } from '@/lib/cn';
import { Page, PageHeader } from '@/components/layout';
import { Card, Panel } from '@/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { AreaLine, Bars, ChartCard, Lines, ShareList } from '@/components/charts';
import { hours, pct, Progress, StatCard } from '@/components/Visuals';
import { Icon } from '@/components/Icon';
import { Select } from '@/components/ui/Select';

export default function Performance() {
  const loc = useLocation();
  const [tab, setTab] = useState(loc.hash === '#progression' || loc.hash === '#achievements' ? 'progression' : 'week');
  useEffect(() => {
    if (loc.hash === '#achievements') setTimeout(() => document.getElementById('achievements')?.scrollIntoView({ behavior: 'smooth' }), 150);
  }, [loc.hash]);
  return (
    <>
      <PageHeader
        title="Performance"
        subtitle="Are your behaviours turning into progress? Every number comes from your records."
        actions={
          <Link to="/performance/review">
            <Button size="sm" variant="secondary">
              <NotebookPen size={14} /> Weekly review
            </Button>
          </Link>
        }
      />
      <Page>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="week">Weekly</TabsTrigger>
            <TabsTrigger value="month">Monthly</TabsTrigger>
            <TabsTrigger value="progression">Progression</TabsTrigger>
          </TabsList>
          <TabsContent value="week">
            <Weekly />
          </TabsContent>
          <TabsContent value="month">
            <Monthly />
          </TabsContent>
          <TabsContent value="progression">
            <Progression />
          </TabsContent>
        </Tabs>
      </Page>
    </>
  );
}

function Weekly() {
  const { s, ledger } = useStore();
  const cur = weekStart(s.today);
  const weeks = useMemo(() => {
    const out: string[] = [];
    for (let w = cur; addDays(w, 6) >= s.profile.startDate && out.length < 26; w = addDays(w, -7)) out.push(w);
    return out;
  }, [cur, s.profile.startDate]);
  const [ws, setWs] = useState(cur);
  const m = periodMetrics(s, ws, addDays(ws, 6), ledger);
  const prev = periodMetrics(s, addDays(ws, -7), addDays(ws, -1), ledger);
  const series = weeklySeries(s, 12, ledger).map((w) => ({ label: w.label, habits: w.habitRate === null ? null : Math.round(w.habitRate * 100), tasks: w.tasksDone, focus: Math.round((w.focusMin / 60) * 10) / 10, consistency: w.consistency === null ? null : Math.round(w.consistency * 100), completion: w.completion === null ? null : Math.round(w.completion * 100) }));
  const alloc = timeAllocation(s, ws, addDays(ws, 6));
  const goals = liveGoals(s).filter((g) => g.status === 'active' && g.horizon !== 'vision').slice(0, 4);
  const gData = goals.length ? goalSeries(s, goals[0], 12).map((row, i) => ({ label: row.label, ...Object.fromEntries(goals.map((g) => [g.id, goalSeries(s, g, 12)[i]?.value ?? null])) })) : [];
  const enoughWeeks = series.length >= 2;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-60">
          <Select ariaLabel="Week" value={ws} onValueChange={setWs} options={weeks.map((w) => ({ value: w, label: w === cur ? 'This week' : `Week of ${fmtShort(w)}` }))} />
        </div>
        {ws === cur && <span className="text-xs text-fg-3">In progress: today counts once it's over</span>}
      </div>
      <MetricGrid m={m} prev={prev} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Habit consistency" subtitle="% of scheduled habits completed, by week" empty={enoughWeeks ? null : 'Needs at least two weeks of history.'}>
          <Lines data={series} series={[{ key: 'habits', name: 'Habits', color: 'var(--success)' }]} unit="%" yMax={100} />
        </ChartCard>
        <ChartCard title="Productivity trend" subtitle="Tasks completed per week" empty={series.some((x) => x.tasks > 0) ? null : 'No completed tasks yet.'}>
          <Bars data={series} series={[{ key: 'tasks', name: 'Tasks', color: 'var(--accent)' }]} />
        </ChartCard>
        <ChartCard title="Focused hours" subtitle="Per week" empty={series.some((x) => x.focus > 0) ? null : 'Log focus sessions to see this.'}>
          <Bars data={series} series={[{ key: 'focus', name: 'Focus', color: 'var(--info)' }]} unit="h" />
        </ChartCard>
        <ChartCard title="Time allocation" subtitle="Focused time by life area, selected week" empty={alloc.length ? null : 'No focus time logged in this week.'}>
          <ShareList rows={alloc.map((a) => ({ id: a.id, name: a.name, color: a.color, value: a.minutes }))} format={hours} />
        </ChartCard>
        <ChartCard className="lg:col-span-2" title="Goal progression" subtitle="Progress of your top active goals over 12 weeks" empty={goals.length ? null : 'No active goals.'}>
          <Lines data={gData} series={goals.map((g, i) => ({ key: g.id, name: g.title, color: s.categoryById.get(g.categoryId)?.color ?? CATEGORY_COLORS[i] }))} unit="%" yMax={100} height={200} />
        </ChartCard>
      </div>
    </div>
  );
}

function Delta({ now, before, unit = '', pts }: { now: number | null; before: number | null; unit?: string; pts?: boolean }) {
  if (now === null || before === null) return <span className="text-fg-3">no comparison</span>;
  const d = pts ? Math.round((now - before) * 100) : Math.round((now - before) * 10) / 10;
  if (d === 0) return <span className="inline-flex items-center gap-0.5 text-fg-3"><Minus size={11} /> same as before</span>;
  return (
    <span className={cn('inline-flex items-center gap-0.5', d > 0 ? 'text-success' : 'text-danger')}>
      {d > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {d > 0 ? '+' : ''}
      {d}
      {pts ? ' pts' : unit} vs previous
    </span>
  );
}

function MetricGrid({ m, prev }: { m: PeriodMetrics; prev: PeriodMetrics }) {
  const prevOk = prev.days > 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <StatCard label="Habit completion" value={pct(m.habitRate)} sub={<Delta now={m.habitRate} before={prevOk ? prev.habitRate : null} pts />} />
      <StatCard label="Task completion" value={pct(m.taskRate)} sub={m.tasksDue ? `${m.tasksDone} done · ${m.tasksDue} due` : 'nothing due'} />
      <StatCard label="Goal progression" value={m.goalDelta === null ? '—' : `${m.goalDelta >= 0 ? '+' : ''}${Math.round(m.goalDelta * 100)} pts`} sub={`${m.milestonesDone} milestone${m.milestonesDone === 1 ? '' : 's'}`} tone={m.goalDelta && m.goalDelta > 0 ? 'success' : undefined} />
      <StatCard label="Focus hours" value={hours(m.focusMin)} sub={<Delta now={m.focusMin / 60} before={prevOk ? prev.focusMin / 60 : null} unit="h" />} />
      <StatCard label="Consistency" value={pct(m.consistency)} sub={`${m.activeDays}/${m.days} days at 60%+`} />
      <StatCard label="XP earned" value={m.xp.toLocaleString()} sub={<Delta now={m.xp} before={prevOk ? prev.xp : null} />} />
    </div>
  );
}

function Monthly() {
  const { s, ledger } = useStore();
  const cur = monthKey(s.today);
  const months = useMemo(() => {
    const out: string[] = [];
    for (let k = cur; k >= monthKey(s.profile.startDate) && out.length < 24; k = prevMonthKey(k)) out.push(k);
    return out;
  }, [cur, s.profile.startDate]);
  const [key, setKey] = useState(cur);
  const [from, to] = monthRange(key);
  const m = monthMetrics(s, key, ledger);
  const p = monthMetrics(s, prevMonthKey(key), ledger);
  const habitRows = s.habits
    .filter((h) => h.startDate <= to)
    .map((h) => ({ h, st: habitStats(s, h, isWeeklyHabit(h) ? weekStart(from) : from, to < s.today ? to : addDays(s.today, -1)), prev: habitStats(s, h, ...monthRange(prevMonthKey(key))) }))
    .filter((x) => x.st.rate !== null);
  const alloc = timeAllocation(s, from, to);
  const ms = s.milestones.filter((x) => x.done && x.completedDate && x.completedDate >= from && x.completedDate <= to);
  const weak = underperforming(s, from, to < s.today ? to : s.today);
  const acc = estimateAccuracy(s, from, to);
  const monthsSeries = [...months].reverse().slice(-6).map((k) => {
    const mm = monthMetrics(s, k, ledger);
    return { label: fmtMonth(k).slice(0, 3), habits: mm.habitRate === null ? null : Math.round(mm.habitRate * 100), completion: mm.completion === null ? null : Math.round(mm.completion * 100) };
  });
  const rows: { label: string; now: string; prev: string; up: boolean | null }[] = [
    { label: 'Habit completion', now: pct(m.habitRate), prev: pct(p.habitRate), up: cmp(m.habitRate, p.habitRate) },
    { label: 'Overall completion', now: pct(m.completion), prev: pct(p.completion), up: cmp(m.completion, p.completion) },
    { label: 'Tasks completed', now: String(m.tasksDone), prev: p.days ? String(p.tasksDone) : '—', up: p.days ? cmp(m.tasksDone, p.tasksDone) : null },
    { label: 'Focus hours', now: hours(m.focusMin), prev: p.days ? hours(p.focusMin) : '—', up: p.days ? cmp(m.focusMin, p.focusMin) : null },
    { label: 'Milestones achieved', now: String(m.milestonesDone), prev: p.days ? String(p.milestonesDone) : '—', up: p.days ? cmp(m.milestonesDone, p.milestonesDone) : null },
    { label: 'Goal progression', now: m.goalDelta === null ? '—' : `${Math.round(m.goalDelta * 100)} pts`, prev: p.goalDelta === null ? '—' : `${Math.round(p.goalDelta * 100)} pts`, up: cmp(m.goalDelta, p.goalDelta) },
    { label: 'Consistency', now: pct(m.consistency), prev: pct(p.consistency), up: cmp(m.consistency, p.consistency) },
    { label: 'XP earned', now: m.xp.toLocaleString(), prev: p.days ? p.xp.toLocaleString() : '—', up: p.days ? cmp(m.xp, p.xp) : null },
  ];
  return (
    <div className="space-y-4">
      <div className="w-60">
        <Select ariaLabel="Month" value={key} onValueChange={setKey} options={months.map((k) => ({ value: k, label: fmtMonth(k) }))} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel title="Month on month" subtitle={`${fmtMonth(key)} vs ${fmtMonth(prevMonthKey(key))}`}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] text-fg-3 text-left">
                <th className="font-medium py-1">Metric</th>
                <th className="font-medium text-right">This</th>
                <th className="font-medium text-right">Previous</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-line">
                  <td className="py-2 text-fg-2">{r.label}</td>
                  <td className="text-right tnum font-medium">{r.now}</td>
                  <td className="text-right tnum text-fg-3">{r.prev}</td>
                  <td className="text-right">{r.up === null ? null : r.up ? <ArrowUpRight size={13} className="inline text-success" aria-label="improved" /> : <ArrowDownRight size={13} className="inline text-danger" aria-label="declined" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <ChartCard title="Monthly performance" subtitle="Habit and overall completion, last 6 months" empty={monthsSeries.length >= 2 ? null : 'Needs at least two months of history.'}>
          <Bars data={monthsSeries} series={[{ key: 'habits', name: 'Habits', color: CATEGORY_COLORS[0] }, { key: 'completion', name: 'Overall', color: CATEGORY_COLORS[1] }]} unit="%" yMax={100} />
        </ChartCard>
        <Panel title="Habit consistency this month">
          {habitRows.length === 0 ? (
            <p className="text-[13px] text-fg-3">No settled habit data for this month yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {habitRows.map(({ h, st, prev: pv }) => (
                <li key={h.id}>
                  <div className="flex justify-between text-[13px]">
                    <span className="truncate">{h.name}</span>
                    <span className="tnum">
                      {pct(st.rate)}
                      {pv.rate !== null && <span className="text-fg-3 text-xs"> (was {pct(pv.rate)})</span>}
                    </span>
                  </div>
                  <Progress className="mt-1" height={4} value={st.rate} color="var(--success)" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <ChartCard title="Time allocation" subtitle="Focused time by life area" empty={alloc.length ? null : 'No focus time logged this month.'}>
          <ShareList rows={alloc.map((a) => ({ id: a.id, name: a.name, color: a.color, value: a.minutes }))} format={hours} />
        </ChartCard>
        <Panel title="Completed milestones">
          {ms.length === 0 ? (
            <p className="text-[13px] text-fg-3">None this month.</p>
          ) : (
            <ul className="space-y-1.5 text-[13px]">
              {ms.map((x) => (
                <li key={x.id} className="flex justify-between gap-2">
                  <Link to={`/goals/${x.goalId}`} className="truncate hover:underline">
                    {x.title}
                    <span className="text-fg-3"> · {s.goalById.get(x.goalId)?.title}</span>
                  </Link>
                  <span className="text-fg-3 shrink-0">{fmtShort(x.completedDate!)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Areas of underperformance">
          {weak.length === 0 ? (
            <p className="text-[13px] text-fg-3">Nothing below threshold (habits under 60%, goals behind pace, overdue tasks).</p>
          ) : (
            <ul className="space-y-1.5 text-[13px]">
              {weak.map((w) => (
                <li key={w.label} className="flex justify-between gap-2">
                  <span className="truncate">{w.label}</span>
                  <span className="text-warning shrink-0">{w.detail}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 pt-3 border-t border-line text-[13px]">
            <p className="font-medium">Estimated vs actual time</p>
            {acc ? (
              <p className="text-fg-2 mt-0.5">
                Tasks took <b className="tnum">{Math.round(acc.ratio * 100)}%</b> of their estimate on average ({hours(acc.actual)} actual vs {hours(acc.estimate)} estimated, {acc.n} tasks).
              </p>
            ) : (
              <p className="text-fg-3 mt-0.5">Needs 3+ completed tasks with both an estimate and logged time.</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

const cmp = (a: number | null, b: number | null) => (a === null || b === null || a === b ? null : a > b);

function Progression() {
  const { s, ledger } = useStore();
  const lv = levelInfo(s, ledger);
  const series = xpSeries(s, ledger, 90);
  const stats = achievementStats(s);
  const recent = [...ledger].reverse().slice(0, 25);
  const monthFrom = `${monthKey(s.today)}-01`;
  const bySource = new Map<string, number>();
  for (const e of ledger) if (e.date >= monthFrom) bySource.set(e.source, (bySource.get(e.source) ?? 0) + e.amount);
  const sourceNames: Record<string, string> = { habit: 'Habits', task: 'Tasks', milestone: 'Milestones', goal: 'Goals', review: 'Weekly reviews', consistency: 'Consistent weeks', focus: 'Focus time', achievement: 'Achievements' };
  return (
    <div className="space-y-4" id="progression">
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-fg-3 font-medium">Current level</p>
            <p className="text-3xl font-semibold tnum">
              {lv.level} <span className="text-base font-normal text-fg-3">{stageFor(lv.level)}</span>
            </p>
          </div>
          <div className="text-right text-[13px]">
            <p className="font-semibold tnum">{lv.total.toLocaleString()} XP total</p>
            <p className="text-fg-3 tnum">
              {lv.into.toLocaleString()} / {lv.needed.toLocaleString()} · {lv.remaining.toLocaleString()} to level {lv.level + 1}
            </p>
          </div>
        </div>
        <Progress className="mt-3" height={8} value={lv.progress} color="var(--xp)" />
        <p className="text-xs text-fg-3 mt-2">
          Each level needs more XP than the last (level {lv.level + 1} → {lv.level + 2}: {xpToNext(lv.level + 1, s.settings.levelPace).toLocaleString()} XP). XP is recalculated from your records, so undoing something removes exactly what it earned.
        </p>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="XP progression" subtitle="Cumulative, last 90 days" empty={ledger.length ? null : 'Earn XP by completing habits, tasks and milestones.'}>
          <AreaLine data={series} dataKey="xp" name="Total XP" color="var(--xp)" />
        </ChartCard>
        <Panel title="This month's XP by source">
          {bySource.size === 0 ? (
            <p className="text-[13px] text-fg-3">No XP this month yet.</p>
          ) : (
            <ShareList rows={[...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([k, v], i) => ({ id: k, name: sourceNames[k], color: CATEGORY_COLORS[i % CATEGORY_COLORS.length], value: v }))} format={(v) => `${v.toLocaleString()} XP`} />
          )}
        </Panel>
      </div>
      <Panel title="Achievements" subtitle={`${s.achievements.size} of ${ACHIEVEMENTS.length} unlocked · each recognises genuine progress`} className="scroll-mt-20">
        <div id="achievements" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const rec = s.achievements.get(a.id);
            const [v, t] = a.progress(stats);
            return (
              <div key={a.id} className={cn('flex items-start gap-3 rounded-lg border p-3', rec ? 'border-xp/40 bg-xp/5' : 'border-line')}>
                <span className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', rec ? 'bg-xp/15 text-xp' : 'bg-surface-2 text-fg-3')}>{rec ? <Icon name={a.icon} size={17} /> : <Lock size={15} />}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium">{a.name}</p>
                  <p className="text-[11px] text-fg-3 leading-snug">{a.description}</p>
                  {rec ? (
                    <p className="text-[11px] text-xp mt-1">
                      Unlocked {fmtShort(rec.date)} · +{a.xp} XP
                    </p>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-2">
                      <Progress className="flex-1" height={4} value={Math.min(1, v / t)} color="var(--xp)" />
                      <span className="text-[10.5px] tnum text-fg-3">
                        {Math.min(v, t)}/{t}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="Recent XP">
        {recent.length === 0 ? (
          <p className="text-[13px] text-fg-3">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-line text-[13px]">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-1.5">
                <span className="text-fg-3 w-14 shrink-0 text-xs">{fmtShort(e.date)}</span>
                <span className="flex-1 min-w-0 truncate">
                  {e.label}
                  {e.note && <span className="block text-[11px] text-fg-3">{e.note}</span>}
                </span>
                <span className={cn('tnum font-medium', e.amount ? 'text-xp' : 'text-fg-3')}>+{e.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
