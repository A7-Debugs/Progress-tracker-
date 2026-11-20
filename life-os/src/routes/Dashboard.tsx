import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, CalendarDays, CheckCircle2, Flame, Info, Plus, Sparkles, Star, Target, TrendingUp } from 'lucide-react';
import { useStore } from '@/lib/store';
import { dayMetrics, insights, thisWeek } from '@/lib/analytics';
import { habitsForDay, habitStats } from '@/lib/habits';
import { goalPace, goalProgress, liveGoals, nextMilestone, PACE_COLOR } from '@/lib/goals';
import { filterTasks, mitsFor, sortByScore, todaysTasks } from '@/lib/tasks';
import { agendaFor, conflictsFor } from '@/lib/schedule';
import { levelInfo, stageFor } from '@/lib/progression';
import { daysBetween, fmtDuration, fromMinutes } from '@/lib/dates';
import type { DashboardCard } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Page } from '@/components/layout';
import { Card, Panel } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CategoryDot, EmptyState, hours, NoData, pct, Progress, Ring, Stat } from '@/components/Visuals';
import { HabitRow, TaskRow } from '@/components/rows';
import { TaskEditor } from '@/components/editors/TaskEditor';
import { GoalEditor } from '@/components/editors/GoalEditor';
import { Badge } from '@/components/ui/Badge';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { s, ledger } = useStore();
  const daysIn = daysBetween(s.profile.startDate, s.today);
  const advanced = s.settings.showAdvanced || daysIn >= 3;
  const cards = s.settings.dashboardOrder.filter((c) => s.settings.dashboard[c]);
  const render: Record<DashboardCard, () => React.ReactNode> = {
    overview: () => <Overview key="overview" />,
    priorities: () => <Priorities key="priorities" />,
    habits: () => <TodayHabits key="habits" />,
    goals: () => <GoalProgression key="goals" />,
    schedule: () => (advanced ? <TodaySchedule key="schedule" /> : null),
    week: () => (advanced ? <WeekOverview key="week" ledger={ledger} /> : null),
    insights: () => (advanced ? <Insights key="insights" /> : null),
  };
  const dateLabel = new Date(`${s.today}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <Page className="pt-6 md:pt-8">
      <div className="mb-5 pr-24 md:pr-0">
        <p className="text-[13px] text-fg-3">{dateLabel}</p>
        <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight text-fg mt-0.5">
          {greeting()}
          {s.profile.name ? `, ${s.profile.name}` : ''}
        </h1>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">{cards.map((c) => render[c]())}</div>
      {!advanced && (
        <p className="mt-6 text-center text-xs text-fg-3">
          Weekly overview, schedule and insights appear once you have a few days of history. <Link to="/settings" className="text-accent">Show them now</Link>
        </p>
      )}
    </Page>
  );
}

function Overview() {
  const { s, ledger } = useStore();
  const m = dayMetrics(s);
  const lv = levelInfo(s, ledger);
  const streaks = s.habits
    .filter((h) => h.active)
    .map((h) => ({ h, st: habitStats(s, h) }))
    .filter((x) => x.st.current >= 2)
    .sort((a, b) => b.st.current - a.st.current);
  const todayXp = ledger.filter((e) => e.date === s.today).reduce((a, e) => a + e.amount, 0);
  return (
    <Card className="lg:col-span-2 p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex items-center gap-4">
          <Ring value={m.completion} size={84} stroke={7} label={`Daily completion ${pct(m.completion)}`}>
            <div className="text-center">
              <div className="text-lg font-semibold tnum leading-none">{pct(m.completion, '0%')}</div>
              <div className="text-[10px] text-fg-3 mt-0.5">today</div>
            </div>
          </Ring>
          <div className="md:hidden flex-1 min-w-0">
            <ProductivityScore value={m.productivity} parts={m.productivityParts} />
          </div>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-4 flex-1">
          <Stat label="Tasks done" value={m.tasksDone} sub={`${m.tasksRemaining} remaining`} />
          <Stat label="Habits" value={`${Math.round(m.habitCredit * 10) / 10}/${m.habitsPlanned}`} sub="done / planned" />
          <Stat label="Focus" value={hours(m.focusMin)} sub={`of ${hours(s.settings.dailyFocusTargetMin)} target`} />
          <div className="hidden md:block">
            <ProductivityScore value={m.productivity} parts={m.productivityParts} />
          </div>
        </div>
      </div>
      <div className="mt-5 pt-4 border-t border-line grid md:grid-cols-[1fr_auto] gap-4 items-center">
        <Link to="/performance#progression" className="block group">
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <span className="text-[13px] font-medium text-fg">
              Level {lv.level} <span className="text-fg-3 font-normal">· {stageFor(lv.level)}</span>
            </span>
            <span className="text-xs text-fg-3 tnum">
              {lv.total.toLocaleString()} XP · {lv.remaining.toLocaleString()} to level {lv.level + 1}
              {todayXp > 0 && <span className="text-xp"> · +{todayXp} today</span>}
            </span>
          </div>
          <Progress value={lv.progress} color="var(--xp)" />
        </Link>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {streaks.length === 0 ? (
            <span className="text-xs text-fg-3">No active streaks yet</span>
          ) : (
            streaks.slice(0, 3).map(({ h, st }) => (
              <Link key={h.id} to={`/habits/${h.id}`} className="shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded-md border border-line text-xs text-fg-2 hover:bg-surface-2">
                <Flame size={12} className="text-warning" />
                <span className="tnum font-medium text-fg">{st.current}</span>
                <span className="truncate max-w-[110px]">{h.name}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

function ProductivityScore({ value, parts }: { value: number | null; parts: { label: string; weight: number; value: number }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="text-[11px] font-medium uppercase tracking-wide text-fg-3 inline-flex items-center gap-1">
          Productivity <Info size={11} />
        </div>
        <div className="mt-0.5 text-xl font-semibold tnum">{value === null ? '—' : value}</div>
        <div className="text-xs text-fg-3">{value === null ? 'Nothing planned yet' : 'score / 100'}</div>
      </button>
      {open && (
        <div className="absolute z-10 top-full mt-2 right-0 md:left-0 md:right-auto w-60 rounded-lg border border-line bg-surface p-3 shadow-[var(--shadow-lg)] text-xs text-fg-2 space-y-1">
          {parts.length === 0 && <p>Plan tasks or habits for today to get a score.</p>}
          {parts.map((p) => (
            <div key={p.label} className="flex justify-between gap-2">
              <span>
                {p.label} <span className="text-fg-3">({p.weight}%)</span>
              </span>
              <span className="tnum font-medium text-fg">{Math.round(p.value * 100)}%</span>
            </div>
          ))}
          <p className="text-fg-3 pt-1">Weighted over the parts that apply today.</p>
        </div>
      )}
    </div>
  );
}

function Priorities() {
  const { s } = useStore();
  const [add, setAdd] = useState(false);
  const mits = mitsFor(s, s.today);
  const { open } = todaysTasks(s);
  const others = sortByScore(s, open.filter((t) => !mits.includes(t)));
  const suggestions = mits.length < 3 ? others.slice(0, 3 - mits.length) : [];
  return (
    <Panel title="Today's priorities" subtitle="Your Most Important Tasks: do these first" to="/tasks" toLabel="All tasks" action={mits.length < 3 ? <Button size="xs" variant="ghost" onClick={() => setAdd(true)} aria-label="Add priority"><Plus size={14} /></Button> : undefined}>
      {mits.length === 0 && suggestions.length === 0 ? (
        <EmptyState icon={<Star size={18} />} title="No priorities set" body="What are the three things that would make today a success?" action={<Button size="sm" onClick={() => setAdd(true)}>Add a priority</Button>} />
      ) : (
        <>
          {mits.map((t) => (
            <TaskRow key={t.id} task={t} showDate={false} compact />
          ))}
          {suggestions.length > 0 && (
            <div className={cn(mits.length > 0 && 'mt-2 pt-2 border-t border-line')}>
              <p className="text-[11px] font-medium text-fg-3 uppercase tracking-wide mb-0.5">{mits.length ? 'Up next by priority score' : 'Suggested by priority score: tap ⋯ to make one a priority'}</p>
              {suggestions.map((t) => (
                <TaskRow key={t.id} task={t} compact />
              ))}
            </div>
          )}
          {open.length > mits.length + suggestions.length && (
            <Link to="/tasks" className="block text-xs text-fg-3 hover:text-fg mt-2">
              +{open.length - mits.length - suggestions.length} more for today
            </Link>
          )}
        </>
      )}
      <TaskEditor open={add} onOpenChange={setAdd} defaults={{ mit: true, priority: 2, important: true }} />
    </Panel>
  );
}

function TodayHabits() {
  const { s } = useStore();
  const plans = habitsForDay(s, s.today);
  const order = { morning: 0, afternoon: 1, anytime: 2, evening: 3 };
  const sorted = [...plans].sort((a, b) => Number(a.credit >= 1) - Number(b.credit >= 1) || order[a.habit.timeOfDay] - order[b.habit.timeOfDay]);
  return (
    <Panel title="Today's habits" subtitle={plans.length ? `${plans.filter((p) => p.credit >= 1).length} of ${plans.length} done · “Min” logs the minimum version` : undefined} to="/habits" toLabel="Manage">
      {plans.length === 0 ? (
        <EmptyState icon={<CheckCircle2 size={18} />} title={s.habits.length ? 'Nothing scheduled today' : 'No habits yet'} body={s.habits.length ? 'Rest days count too.' : 'Habits turn goals into systems.'} action={!s.habits.length && <Link to="/habits?new=1"><Button size="sm">Create a habit</Button></Link>} />
      ) : (
        sorted.map((p) => <HabitRow key={p.habit.id} plan={p} date={s.today} compact />)
      )}
    </Panel>
  );
}

function GoalProgression() {
  const { s } = useStore();
  const [add, setAdd] = useState(false);
  const goals = liveGoals(s)
    .filter((g) => g.status === 'active' && g.horizon !== 'vision')
    .sort((a, b) => a.priority - b.priority || (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999'))
    .slice(0, 5);
  return (
    <Panel title="Goal progression" subtitle="Measured by milestones and outcomes, not tasks ticked" to="/goals" toLabel="All goals" className="lg:row-span-2">
      {goals.length === 0 ? (
        <EmptyState icon={<Target size={18} />} title="No active goals" action={<Button size="sm" onClick={() => setAdd(true)}>Set a goal</Button>} />
      ) : (
        <ul className="space-y-1">
          {goals.map((g) => {
            const p = goalProgress(s, g);
            const pace = goalPace(s, g);
            const nm = nextMilestone(s, g);
            const cat = s.categoryById.get(g.categoryId);
            return (
              <li key={g.id}>
                <Link to={`/goals/${g.id}`} className="block rounded-lg -mx-2 px-2 py-2.5 hover:bg-surface-2">
                  <div className="flex items-center gap-2">
                    <CategoryDot cat={cat} />
                    <span className="flex-1 text-[14px] font-medium text-fg truncate">{g.title}</span>
                    <span className="text-[13px] font-semibold tnum">{pct(p.value)}</span>
                  </div>
                  <Progress className="mt-2" value={p.value} color={cat?.color} marker={pace.expected} />
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-fg-3 truncate">{nm ? `Next: ${nm.title}` : p.source}</span>
                    <span className="shrink-0 font-medium" style={{ color: PACE_COLOR[pace.status] }}>
                      {pace.label}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <GoalEditor open={add} onOpenChange={setAdd} />
    </Panel>
  );
}

function TodaySchedule() {
  const { s } = useStore();
  const items = agendaFor(s, s.today);
  const conflicts = conflictsFor(items);
  return (
    <Panel title="Today's schedule" to="/schedule" toLabel="Calendar">
      {items.length === 0 ? (
        <EmptyState icon={<CalendarDays size={18} />} title="Nothing scheduled" body="Block out time for your most important work." action={<Link to="/schedule"><Button size="sm" variant="secondary">Plan the day</Button></Link>} />
      ) : (
        <>
          {conflicts.length > 0 && (
            <p className="mb-2 text-xs text-warning inline-flex items-center gap-1">
              <AlertTriangle size={12} /> {conflicts.length} overlapping commitment{conflicts.length > 1 ? 's' : ''}
            </p>
          )}
          <ul className="space-y-1">
            {items.map((i) => (
              <li key={i.key} className={cn('flex items-center gap-3 text-[13px] py-1', i.done && 'opacity-50 line-through')}>
                <span className="w-24 shrink-0 text-fg-3 tnum text-xs">
                  {fromMinutes(i.start)}–{fromMinutes(i.end)}
                </span>
                <span className="h-4 w-1 rounded-full shrink-0" style={{ background: i.color ?? 'var(--accent)' }} />
                <span className="flex-1 truncate text-fg">{i.title}</span>
                <span className="text-[11px] text-fg-3">{fmtDuration(i.end - i.start)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function WeekOverview({ ledger }: { ledger: ReturnType<typeof useStore>['ledger'] }) {
  const { s } = useStore();
  const w = thisWeek(s, ledger);
  return (
    <Panel title="This week" subtitle={`${w.days} day${w.days === 1 ? '' : 's'} so far`} to="/performance" toLabel="Performance">
      <div className="grid grid-cols-3 gap-x-4 gap-y-4">
        <Stat label="Completion" value={pct(w.completion)} sub="habits + tasks" />
        <Stat label="Habits" value={pct(w.habitRate)} sub={w.habitTotal ? `${Math.round(w.habitCredit)} of ${w.habitTotal}` : 'none settled yet'} />
        <Stat label="Tasks" value={w.tasksDone} sub={w.tasksDue ? `${pct(w.taskRate)} of ${w.tasksDue} due` : 'completed'} />
        <Stat label="Focus" value={hours(w.focusMin)} sub="focused work" />
        <Stat label="Goal progress" value={w.goalDelta === null ? '—' : `${w.goalDelta >= 0 ? '+' : ''}${Math.round(w.goalDelta * 100)} pts`} sub="avg across goals" tone={w.goalDelta !== null && w.goalDelta > 0 ? 'success' : undefined} />
        <Stat label="Consistency" value={pct(w.consistency)} sub={`${w.activeDays} strong day${w.activeDays === 1 ? '' : 's'}`} />
      </div>
      {new Date(`${s.today}T12:00:00`).getDay() >= 5 || new Date(`${s.today}T12:00:00`).getDay() === 0 ? (
        <Link to="/performance/review" className="mt-4 flex items-center justify-between rounded-lg border border-line px-3 py-2.5 text-[13px] hover:bg-surface-2">
          <span className="inline-flex items-center gap-2">
            <TrendingUp size={15} className="text-accent" /> Weekly review is open
          </span>
          <ArrowUpRight size={15} className="text-fg-3" />
        </Link>
      ) : null}
    </Panel>
  );
}

function Insights() {
  const { s } = useStore();
  const list = insights(s);
  const overdue = filterTasks(s, 'overdue').length;
  return (
    <Panel title="Performance insights" subtitle="Calculated from your own records" action={<Link to="/assistant" className="text-xs text-fg-3 hover:text-fg inline-flex items-center gap-1"><Sparkles size={12} /> Ask the assistant</Link>}>
      {list.length === 0 && !overdue ? (
        <NoData>Not enough history for insights yet. They appear once there are about a week of logs; nothing is estimated.</NoData>
      ) : (
        <ul className="space-y-2.5">
          {overdue > 0 && (
            <li>
              <Link to="/tasks?filter=overdue" className="flex gap-2.5 text-[13px]">
                <AlertTriangle size={15} className="text-danger shrink-0 mt-0.5" />
                <span>
                  <span className="font-medium text-fg">
                    {overdue} overdue task{overdue > 1 ? 's' : ''}
                  </span>
                  <span className="block text-fg-3 text-xs">Reschedule, delegate or drop them.</span>
                </span>
              </Link>
            </li>
          )}
          {list.slice(0, 6).map((i) => (
            <li key={i.id}>
              <Link to={i.link ?? '/performance'} className="flex gap-2.5 text-[13px] group">
                {i.kind === 'positive' ? <CheckCircle2 size={15} className="text-success shrink-0 mt-0.5" /> : i.kind === 'warning' ? <AlertTriangle size={15} className="text-warning shrink-0 mt-0.5" /> : <Info size={15} className="text-info shrink-0 mt-0.5" />}
                <span className="min-w-0">
                  <span className="font-medium text-fg group-hover:underline">{i.title}</span>
                  <span className="block text-fg-3 text-xs leading-relaxed">{i.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {s.achievements.size > 0 && (
        <div className="mt-3 pt-3 border-t border-line flex items-center gap-2">
          <Badge variant="xp">{s.achievements.size} achievement{s.achievements.size > 1 ? 's' : ''}</Badge>
          <Link to="/performance#achievements" className="text-xs text-fg-3 hover:text-fg">
            View
          </Link>
        </div>
      )}
    </Panel>
  );
}
