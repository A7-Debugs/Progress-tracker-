import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArrowDown, ArrowUp, Check, ChevronRight, CircleCheck, Flag, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import * as A from '@/lib/actions';
import { addDays, fmtShort, relDay } from '@/lib/dates';
import { childrenOf, effortVsOutcome, fmtValue, goalPace, goalPath, goalProgress, HORIZON_BY_ID, MIN_GOAL_AGE_DAYS, PACE_COLOR } from '@/lib/goals';
import { goalSeries } from '@/lib/analytics';
import { habitStats } from '@/lib/habits';
import type { Milestone } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Page, PageHeader } from '@/components/layout';
import { Card, Panel } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Confirm, Dialog } from '@/components/ui/Dialog';
import { Input, NumberField, Textarea } from '@/components/ui/Input';
import { Field, Segmented } from '@/components/ui/Chips';
import { CategoryTag, DifficultyTag, hours, pct, PriorityFlag, Progress, Ring } from '@/components/Visuals';
import { TaskRow } from '@/components/rows';
import { GoalEditor } from '@/components/editors/GoalEditor';
import { Lines, ChartCard } from '@/components/charts';
import { useToast } from '@/components/ui/Toaster';

export default function GoalDetail() {
  const { goalId } = useParams();
  const { s } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);
  const [addChild, setAddChild] = useState(false);
  const [del, setDel] = useState(false);
  const [record, setRecord] = useState(false);
  const [newMs, setNewMs] = useState('');
  const g = goalId ? s.goalById.get(goalId) : undefined;
  if (!g) return <Navigate to="/goals" replace />;
  const p = goalProgress(s, g);
  const pace = goalPace(s, g);
  const path = goalPath(s, g);
  const cat = s.categoryById.get(g.categoryId);
  const ms = s.milestonesByGoal.get(g.id) ?? [];
  const kids = childrenOf(s, g.id);
  const habits = s.habits.filter((h) => h.goalId === g.id && h.active);
  const unlinkedTasks = s.tasks.filter((t) => t.goalId === g.id && !t.milestoneId && !t.done);
  const eff = effortVsOutcome(s, g, addDays(s.today, -13), s.today);
  const series = goalSeries(s, g, 12);
  const childHorizon = HORIZON_BY_ID[g.horizon].child;
  const numeric = g.measurement === 'numeric' || g.measurement === 'hybrid';

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast(msg);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <>
      <PageHeader
        back
        title={g.title}
        subtitle={
          <span className="inline-flex items-center gap-1">
            {path.map((x) => (
              <span key={x.id} className="inline-flex items-center gap-1">
                <Link to={`/goals/${x.id}`} className="hover:text-fg truncate max-w-[140px]">
                  {x.title}
                </Link>
                <ChevronRight size={11} />
              </span>
            ))}
            {HORIZON_BY_ID[g.horizon].label}
          </span>
        }
        actions={
          <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>
            <Pencil size={14} /> Edit
          </Button>
        }
      />
      <Page>
        <Card className="p-4 md:p-5">
          <div className="flex items-start gap-4">
            <Ring value={p.value} size={76} stroke={7} color={cat?.color}>
              <span className="text-base font-semibold tnum">{pct(p.value)}</span>
            </Ring>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryTag cat={cat} />
                <PriorityFlag p={g.priority} />
                <DifficultyTag d={g.difficulty} />
                {g.status !== 'active' && <Badge variant={g.status === 'completed' ? 'success' : 'neutral'}>{g.status === 'completed' ? 'Achieved' : g.status}</Badge>}
              </div>
              <p className="mt-2 text-[13px] text-fg-2">{p.source}</p>
              <p className="mt-0.5 text-[13px] font-medium" style={{ color: PACE_COLOR[pace.status] }}>
                {pace.label}
                {pace.daysLeft !== null && pace.daysLeft >= 0 && <span className="text-fg-3 font-normal"> · {pace.daysLeft} days left</span>}
              </p>
              {pace.expected !== null && g.status === 'active' && <p className="text-xs text-fg-3 mt-0.5">On a straight-line pace you'd be at {pct(pace.expected)} by today (the tick on progress bars).</p>}
            </div>
          </div>
          {(g.description || g.startingPosition || g.targetOutcome) && (
            <div className="mt-4 pt-4 border-t border-line grid sm:grid-cols-3 gap-4 text-[13px]">
              {g.description && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-fg-3 font-medium">Why</p>
                  <p className="mt-1 text-fg-2 whitespace-pre-line">{g.description}</p>
                </div>
              )}
              {g.startingPosition && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-fg-3 font-medium">Starting position</p>
                  <p className="mt-1 text-fg-2">{g.startingPosition}</p>
                </div>
              )}
              {g.targetOutcome && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-fg-3 font-medium">Target outcome</p>
                  <p className="mt-1 text-fg-2">{g.targetOutcome}</p>
                </div>
              )}
            </div>
          )}
          {numeric && (
            <div className="mt-4 pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3">
              <div className="text-[13px]">
                <span className="text-fg-3">Measured: </span>
                <span className="font-semibold tnum">{fmtValue(g.currentValue, g.unit)}</span>
                <span className="text-fg-3">
                  {' '}
                  · started {fmtValue(g.startValue, g.unit)} · target {fmtValue(g.targetValue, g.unit)}
                </span>
              </div>
              <Button size="sm" onClick={() => setRecord(true)}>
                Record new value
              </Button>
            </div>
          )}
        </Card>

        {(eff.tasksDone > 0 || eff.focusMin > 0) && (
          <Card className="mt-4 p-4 text-[13px] flex flex-wrap gap-x-6 gap-y-2">
            <span className="text-fg-3">Last 14 days</span>
            <span>
              <b className="tnum">{eff.tasksDone}</b> linked tasks done
            </span>
            <span>
              <b className="tnum">{hours(eff.focusMin)}</b> focused work
            </span>
            <span className={cn(eff.progressDelta !== null && eff.progressDelta <= 0 && eff.tasksDone >= 3 && 'text-warning')}>
              Goal moved <b className="tnum">{eff.progressDelta === null ? '—' : `${eff.progressDelta >= 0 ? '+' : ''}${Math.round(eff.progressDelta * 100)} pts`}</b>
            </span>
            {eff.progressDelta !== null && eff.progressDelta <= 0 && eff.tasksDone >= 3 && <span className="w-full text-xs text-fg-3">Effort is happening but the outcome hasn't moved. Make sure tasks lead to a milestone, or record the new measured value.</span>}
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 mt-4 items-start">
          <div className="space-y-4">
            {g.measurement !== 'children' || ms.length > 0 ? (
              <Panel title="Milestones" subtitle={ms.length ? `${ms.filter((m) => m.done).length} of ${ms.length} achieved · ticking one is what moves the goal` : 'Break the goal into measurable checkpoints'}>
                <ul>
                  {ms.map((m, i) => (
                    <MilestoneItem key={m.id} m={m} first={i === 0} last={i === ms.length - 1} />
                  ))}
                </ul>
                <form
                  className="flex gap-2 mt-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newMs.trim()) return;
                    await act(() => A.addMilestone(g.id, newMs), 'Milestone added');
                    setNewMs('');
                  }}
                >
                  <Input className="h-9" value={newMs} onChange={(e) => setNewMs(e.target.value)} placeholder="Add a milestone…" aria-label="New milestone" />
                  <Button type="submit" size="sm" variant="secondary" disabled={!newMs.trim()} className="h-9">
                    Add
                  </Button>
                </form>
              </Panel>
            ) : null}
            {(childHorizon || kids.length > 0) && (
              <Panel title="Sub-goals" subtitle={g.measurement === 'children' ? 'This goal’s progress is their average' : undefined} action={childHorizon ? <Button size="xs" variant="ghost" onClick={() => setAddChild(true)}><Plus size={13} /> {HORIZON_BY_ID[childHorizon].short}</Button> : undefined}>
                {kids.length === 0 ? (
                  <p className="text-[13px] text-fg-3">No sub-goals yet. Add a {HORIZON_BY_ID[childHorizon!].label.toLowerCase()} to break this down.</p>
                ) : (
                  <ul className="-mx-2">
                    {kids.map((k) => {
                      const kp = goalProgress(s, k);
                      return (
                        <li key={k.id}>
                          <Link to={`/goals/${k.id}`} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-2">
                            <Badge>{HORIZON_BY_ID[k.horizon].short}</Badge>
                            <span className="flex-1 truncate text-[13px] font-medium">{k.title}</span>
                            <Progress className="w-20" height={4} value={kp.value} color={cat?.color} />
                            <span className="text-xs tnum w-9 text-right">{pct(kp.value)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            )}
            {unlinkedTasks.length > 0 && (
              <Panel title="Other tasks for this goal">
                {unlinkedTasks.map((t) => (
                  <TaskRow key={t.id} task={t} compact />
                ))}
              </Panel>
            )}
          </div>
          <div className="space-y-4">
            <ChartCard title="Progress over time" subtitle="Reconstructed from milestone dates and recorded values" empty={series.filter((x) => x.value !== null).length < 2 ? 'Builds up as you make progress.' : null}>
              <Lines data={series} series={[{ key: 'value', name: 'Progress', color: cat?.color ?? 'var(--accent)' }]} unit="%" yMax={100} height={150} />
            </ChartCard>
            <Panel title="Supporting habits" to="/habits" toLabel="Habits">
              {habits.length === 0 ? (
                <p className="text-[13px] text-fg-3">No habits linked. Link one from the habit's settings to turn this goal into a system.</p>
              ) : (
                <ul className="space-y-2">
                  {habits.map((h) => {
                    const st = habitStats(s, h, addDays(s.today, -28), addDays(s.today, -1));
                    return (
                      <li key={h.id}>
                        <Link to={`/habits/${h.id}`} className="flex justify-between text-[13px] hover:underline">
                          <span className="truncate">{h.name}</span>
                          <span className="tnum text-fg-2">{pct(st.rate)} · 4 wks</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
            <Panel title="Status">
              <div className="grid gap-1.5">
                {g.status !== 'completed' ? (
                  <Button variant="secondary" onClick={() => act(() => A.setGoalStatus(g.id, 'completed'), 'Goal achieved')}>
                    <CircleCheck size={15} /> Mark achieved
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => act(() => A.setGoalStatus(g.id, 'active'), 'Goal reopened')}>
                    <Play size={15} /> Reopen
                  </Button>
                )}
                {g.status === 'active' && (
                  <Button variant="ghost" onClick={() => act(() => A.setGoalStatus(g.id, 'paused'), 'Goal paused')}>
                    <Pause size={15} /> Pause
                  </Button>
                )}
                {g.status === 'paused' && (
                  <Button variant="ghost" onClick={() => act(() => A.setGoalStatus(g.id, 'active'), 'Goal resumed')}>
                    <Play size={15} /> Resume
                  </Button>
                )}
                {g.status !== 'archived' && (
                  <Button variant="ghost" onClick={() => act(() => A.setGoalStatus(g.id, 'archived'), 'Goal archived')}>
                    <Archive size={15} /> Archive
                  </Button>
                )}
                <Button variant="ghost" className="text-danger" onClick={() => setDel(true)}>
                  <Trash2 size={15} /> Delete
                </Button>
              </div>
              <p className="text-[11px] text-fg-3 mt-2">Achieving a goal earns XP if it was set at least {MIN_GOAL_AGE_DAYS[g.horizon]} days earlier. Started {fmtShort(g.startDate)}.</p>
            </Panel>
          </div>
        </div>
      </Page>
      <GoalEditor open={edit} onOpenChange={setEdit} goal={g} />
      {childHorizon && <GoalEditor open={addChild} onOpenChange={setAddChild} defaults={{ horizon: childHorizon, parentId: g.id, categoryId: g.categoryId, priority: g.priority }} />}
      <RecordValue open={record} onOpenChange={setRecord} goalId={g.id} unit={g.unit} current={g.currentValue} />
      <Confirm
        open={del}
        onOpenChange={setDel}
        title="Delete this goal?"
        body="Its milestones and value history are deleted. Sub-goals move up a level; linked tasks and habits are kept but unlinked. Archiving keeps everything instead."
        onConfirm={async () => {
          await A.deleteGoal(g.id);
          navigate('/goals');
          toast('Goal deleted');
        }}
      />
    </>
  );
}

function MilestoneItem({ m, first, last }: { m: Milestone; first: boolean; last: boolean }) {
  const { s } = useStore();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(m.title);
  const [desc, setDesc] = useState(m.description);
  const [due, setDue] = useState(m.dueDate ?? '');
  const [weight, setWeight] = useState(m.weight);
  const [task, setTask] = useState('');
  const tasks = s.tasks.filter((t) => t.milestoneId === m.id);
  const open = tasks.filter((t) => !t.done);
  const doneCount = tasks.length - open.length;
  const overdue = !m.done && m.dueDate && m.dueDate < s.today;
  return (
    <li className="py-2.5 border-b border-line last:border-0">
      <div className="flex items-start gap-3">
        <button onClick={() => A.toggleMilestone(m.id).catch((e) => toast(e.message, 'error'))} aria-label={m.done ? `Reopen ${m.title}` : `Achieve ${m.title}`} className={cn('mt-0.5 h-5 w-5 shrink-0 rounded-full border-[1.5px] flex items-center justify-center', m.done ? 'bg-success border-success text-white' : 'border-line-strong hover:border-success')}>
          {m.done && <Check size={12} strokeWidth={3} />}
        </button>
        <button className="flex-1 min-w-0 text-left" onClick={() => setEdit(true)}>
          <div className={cn('text-[14px] font-medium', m.done && 'text-fg-3 line-through')}>
            {m.weight === 3 && <Flag size={12} className="inline mr-1 -mt-0.5 text-xp" aria-label="Major milestone" />}
            {m.title}
          </div>
          <div className="text-[11px] text-fg-3 mt-0.5 flex flex-wrap gap-x-2">
            {m.done && m.completedDate && <span>Achieved {fmtShort(m.completedDate)}</span>}
            {!m.done && m.dueDate && <span className={cn(overdue && 'text-danger')}>Due {relDay(m.dueDate, s.today)}</span>}
            {tasks.length > 0 && (
              <span>
                {doneCount}/{tasks.length} tasks
              </span>
            )}
            <span>{['', 'Small', 'Normal', 'Major'][m.weight]}</span>
          </div>
        </button>
      </div>
      {!m.done && (
        <div className="ml-8 mt-1">
          {open.map((t) => (
            <TaskRow key={t.id} task={t} compact />
          ))}
          <form
            className="flex gap-2 mt-1"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!task.trim()) return;
              try {
                await A.quickAddTask(task, { goalId: m.goalId, milestoneId: m.id, categoryId: s.goalById.get(m.goalId)?.categoryId ?? null });
                setTask('');
              } catch (err) {
                toast((err as Error).message, 'error');
              }
            }}
          >
            <input value={task} onChange={(e) => setTask(e.target.value)} placeholder="+ Add a task for this milestone" aria-label={`Add task to ${m.title}`} className="flex-1 h-8 bg-transparent text-[13px] placeholder:text-fg-3 outline-none border-b border-transparent focus:border-line" />
          </form>
        </div>
      )}
      <Dialog
        open={edit}
        onOpenChange={setEdit}
        title="Edit milestone"
        footer={
          <>
            <Button variant="ghost" className="mr-auto text-danger" onClick={() => A.deleteMilestone(m.id).then(() => setEdit(false))}>
              <Trash2 size={15} /> Delete
            </Button>
            {!first && (
              <Button variant="ghost" size="icon" aria-label="Move up" onClick={() => A.moveMilestone(m.id, -1)}>
                <ArrowUp size={15} />
              </Button>
            )}
            {!last && (
              <Button variant="ghost" size="icon" aria-label="Move down" onClick={() => A.moveMilestone(m.id, 1)}>
                <ArrowDown size={15} />
              </Button>
            )}
            <Button
              onClick={async () => {
                try {
                  await A.updateMilestone(m.id, { title, description: desc, dueDate: due || null, weight });
                  setEdit(false);
                } catch (e) {
                  toast((e as Error).message, 'error');
                }
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Milestone">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Details">
            <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="Size" hint="Bigger milestones weigh more in the goal's progress and earn more XP.">
            <Segmented<1 | 2 | 3> value={weight} onChange={setWeight} options={[{ value: 1, label: 'Small' }, { value: 2, label: 'Normal' }, { value: 3, label: 'Major' }]} />
          </Field>
        </div>
      </Dialog>
    </li>
  );
}

function RecordValue({ open, onOpenChange, goalId, unit, current }: { open: boolean; onOpenChange: (o: boolean) => void; goalId: string; unit: string; current: number }) {
  const toast = useToast();
  const [v, setV] = useState(current);
  const [note, setNote] = useState('');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record measured value"
      description="Your real-world number today. One value per day; history is kept for the chart."
      footer={
        <Button
          onClick={async () => {
            try {
              await A.recordGoalValue(goalId, v, note);
              toast('Value recorded');
              onOpenChange(false);
              setNote('');
            } catch (e) {
              toast((e as Error).message, 'error');
            }
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label={`Value${unit ? ` (${unit})` : ''}`}>
          <NumberField autoFocus value={v} onChange={(e) => setV(Number(e.target.value))} />
        </Field>
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
