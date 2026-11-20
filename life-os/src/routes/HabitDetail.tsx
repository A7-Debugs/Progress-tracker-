import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArrowDown, ArrowUp, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import * as A from '@/lib/actions';
import { addDays, dateRange, fmtShort, weekStart } from '@/lib/dates';
import { creditOn, frequencyLabel, getLog, habitExistsOn, habitStats, habitXp, isWeeklyHabit, scheduledOn, weekCredit } from '@/lib/habits';
import { Page, PageHeader } from '@/components/layout';
import { Card, Panel } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Confirm } from '@/components/ui/Dialog';
import { CategoryTag, DifficultyTag, pct, Stat } from '@/components/Visuals';
import { HabitEditor } from '@/components/editors/HabitEditor';
import { Bars, ChartCard } from '@/components/charts';
import { useToast } from '@/components/ui/Toaster';

export default function HabitDetail() {
  const { habitId } = useParams();
  const { s } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const h = s.habits.find((x) => x.id === habitId);
  if (!h) return <Navigate to="/habits" replace />;
  const all = habitStats(s, h);
  const yest = addDays(s.today, -1);
  const w = habitStats(s, h, isWeeklyHabit(h) ? weekStart(addDays(s.today, -7)) : addDays(s.today, -7), yest);
  const m = habitStats(s, h, isWeeklyHabit(h) ? weekStart(addDays(s.today, -30)) : addDays(s.today, -30), yest);
  const goal = h.goalId ? s.goalById.get(h.goalId) : undefined;

  // Weekly consistency series (last 12 weeks)
  const cur = weekStart(s.today);
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(cur, -7 * (11 - i))).filter((ws) => addDays(ws, 6) >= h.startDate);
  const series = weeks.map((ws) => {
    const end = addDays(ws, 6) < s.today ? addDays(ws, 6) : s.today;
    let value: number | null;
    if (isWeeklyHabit(h)) value = Math.min(1, weekCredit(s, h, ws) / Math.max(1, h.frequency.timesPerWeek));
    else {
      const st = habitStats(s, h, ws, end);
      value = st.rate;
    }
    return { label: fmtShort(ws), pct: value === null ? null : Math.round(value * 100) };
  });

  // Heatmap: last 12 weeks, Monday-first columns
  const start = addDays(cur, -7 * 11);
  const cells = dateRange(start, addDays(cur, 6));
  const color = (d: string) => {
    if (d > s.today || !habitExistsOn(h, d)) return 'transparent';
    const l = getLog(s, h, d);
    const c = creditOn(s, h, d);
    if (c >= 1) return 'var(--success)';
    if (c > 0) return 'color-mix(in oklab, var(--success) 45%, var(--surface-3))';
    if (l?.status === 'missed' || (scheduledOn(h, d) && d < s.today)) return 'var(--surface-3)';
    return 'var(--surface-2)';
  };
  const history = [...s.habitLogs.values()].filter((l) => l.habitId === h.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  return (
    <>
      <PageHeader
        back
        title={h.name}
        subtitle={<CategoryTag cat={s.categoryById.get(h.categoryId)} />}
        actions={
          <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>
            <Pencil size={14} /> Edit
          </Button>
        }
      />
      <Page>
        {!h.active && (
          <Card className="p-3 mb-4 flex items-center justify-between gap-3 text-[13px]">
            <span className="text-fg-2">This habit is paused. History and XP are kept.</span>
            <Button size="sm" onClick={() => A.restoreHabit(h.id)}>
              <RotateCcw size={14} /> Resume
            </Button>
          </Card>
        )}
        <Card className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Stat label="All-time" value={pct(all.rate)} sub={`${all.done} done · ${all.partial} min · ${all.missed} missed`} />
          <Stat label="Current streak" value={all.current} sub={`${all.unit}${all.grace ? ` · ${all.grace} grace` : ''}`} />
          <Stat label="Longest streak" value={all.longest} sub={all.unit} />
          <Stat label="Last 7 days" value={pct(w.rate)} sub="weekly consistency" />
          <Stat label="Last 30 days" value={pct(m.rate)} sub="monthly consistency" />
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <Panel title="Last 12 weeks" subtitle="Green = done, light = minimum, grey = missed">
            <div className="grid grid-flow-col grid-rows-7 gap-[3px] w-fit">
              {cells.map((d) => (
                <span key={d} title={`${d}: ${getLog(s, h, d)?.status ?? (scheduledOn(h, d) ? 'not logged' : 'not scheduled')}`} className="h-3.5 w-3.5 rounded-[3px]" style={{ background: color(d), outline: d === s.today ? '1.5px solid var(--fg-3)' : undefined }} />
              ))}
            </div>
          </Panel>
          <ChartCard title="Weekly consistency" subtitle="% of scheduled completions (minimum counts half)" empty={series.every((x) => x.pct === null) ? 'Builds up after your first full week.' : null}>
            <Bars data={series} series={[{ key: 'pct', name: 'Consistency', color: 'var(--success)' }]} unit="%" yMax={100} height={160} />
          </ChartCard>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <Panel title="Details">
            <dl className="text-[13px] grid grid-cols-[130px_1fr] gap-y-2">
              <dt className="text-fg-3">Frequency</dt>
              <dd>{frequencyLabel(h.frequency)}</dd>
              <dt className="text-fg-3">Target</dt>
              <dd>{h.target > 1 ? `${h.target} ${h.unit}` : 'Tick when done'}</dd>
              <dt className="text-fg-3">Minimum version</dt>
              <dd>{h.minimumVersion || '—'}</dd>
              <dt className="text-fg-3">Time</dt>
              <dd className="capitalize">{h.preferredTime ?? h.timeOfDay}</dd>
              <dt className="text-fg-3">Difficulty</dt>
              <dd>
                <DifficultyTag d={h.difficulty} />
              </dd>
              <dt className="text-fg-3">XP</dt>
              <dd className="text-xp">+{habitXp(s, h)} per completion (half for minimum)</dd>
              <dt className="text-fg-3">Supports</dt>
              <dd>{goal ? goal.title : '—'}</dd>
              <dt className="text-fg-3">Since</dt>
              <dd>{fmtShort(h.startDate)}</dd>
            </dl>
            {h.description && <p className="mt-3 text-[13px] text-fg-2">{h.description}</p>}
            <div className="flex flex-wrap gap-2 mt-4">
              <Button size="sm" variant="ghost" onClick={() => A.moveHabit(h.id, -1)}>
                <ArrowUp size={14} /> Move up
              </Button>
              <Button size="sm" variant="ghost" onClick={() => A.moveHabit(h.id, 1)}>
                <ArrowDown size={14} /> Move down
              </Button>
              {h.active && (
                <Button size="sm" variant="ghost" onClick={() => A.archiveHabit(h.id).then(() => toast('Habit paused'))}>
                  <Archive size={14} /> Pause
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDel(true)}>
                <Trash2 size={14} /> Delete
              </Button>
            </div>
          </Panel>
          <Panel title="Recent log">
            {history.length === 0 ? (
              <p className="text-[13px] text-fg-3">Nothing logged yet.</p>
            ) : (
              <ul className="text-[13px] divide-y divide-line">
                {history.map((l) => (
                  <li key={l.id} className="flex justify-between py-1.5">
                    <span className="text-fg-2">{fmtShort(l.date)}</span>
                    <span className={l.status === 'done' ? 'text-success' : l.status === 'partial' ? 'text-warning' : 'text-fg-3'}>
                      {l.status === 'partial' ? 'Minimum' : l.status === 'done' ? 'Done' : 'Missed'}
                      {h.target > 1 && l.status !== 'missed' ? ` · ${l.count} ${h.unit}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </Page>
      <HabitEditor open={edit} onOpenChange={setEdit} habit={h} />
      <Confirm
        open={del}
        onOpenChange={setDel}
        title="Delete this habit?"
        body="Its whole history and the XP it earned will be removed. Pause it instead to keep the history."
        onConfirm={async () => {
          await A.deleteHabit(h.id);
          navigate('/habits');
          toast('Habit deleted');
        }}
      />
    </>
  );
}
