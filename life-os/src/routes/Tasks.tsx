import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Grid2x2, List, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import * as A from '@/lib/actions';
import { filterTasks, QUADRANTS, quadrant, sortByScore, type Quadrant, type TaskFilter } from '@/lib/tasks';
import { cn } from '@/lib/cn';
import { Page, PageHeader } from '@/components/layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState, hours } from '@/components/Visuals';
import { TaskRow } from '@/components/rows';
import { TaskEditor } from '@/components/editors/TaskEditor';
import { useToast } from '@/components/ui/Toaster';
import { NONE, Select } from '@/components/ui/Select';

const FILTERS: { id: TaskFilter; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'week', label: 'This week' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'inbox', label: 'No date' },
  { id: 'all', label: 'All open' },
  { id: 'completed', label: 'Completed' },
];

export default function Tasks() {
  const { s } = useStore();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('filter') as TaskFilter) || 'today';
  const view = params.get('view') === 'matrix' ? 'matrix' : 'list';
  const [goal, setGoal] = useState(NONE);
  const [quick, setQuick] = useState('');
  const [adding, setAdding] = useState(false);
  const openId = params.get('task');
  const openTask = openId ? s.tasks.find((t) => t.id === openId) : undefined;
  const [editOpen, setEditOpen] = useState(!!openTask);
  useEffect(() => {
    setEditOpen(!!openTask);
  }, [openTask]);

  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v === null) p.delete(k);
    else p.set(k, v);
    setParams(p, { replace: true });
  };

  const tasks = useMemo(() => {
    let list = filterTasks(s, filter);
    if (goal !== NONE) list = list.filter((t) => t.goalId === goal);
    return filter === 'completed' ? [...list].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)).slice(0, 200) : sortByScore(s, list);
  }, [s, filter, goal]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, filterTasks(s, f.id).length])), [s]);
  const estimate = tasks.filter((t) => !t.done).reduce((a, t) => a + (t.estimateMin ?? 0), 0);
  const goalsWithTasks = s.goals.filter((g) => s.tasks.some((t) => t.goalId === g.id));

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quick.trim()) return;
    try {
      await A.quickAddTask(quick, { today: filter === 'today', goalId: goal === NONE ? null : goal });
      setQuick('');
      toast(filter === 'today' ? 'Added to today' : 'Task added');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={`${counts.all} open${counts.overdue ? ` · ${counts.overdue} overdue` : ''}`}
        actions={
          <>
            <div className="inline-flex rounded-lg border border-line p-0.5 bg-surface-2">
              <button aria-label="List view" aria-pressed={view === 'list'} onClick={() => set('view', null)} className={cn('h-7 w-8 rounded-md flex items-center justify-center', view === 'list' ? 'bg-surface text-fg shadow-[var(--shadow)]' : 'text-fg-3')}>
                <List size={15} />
              </button>
              <button aria-label="Eisenhower matrix" aria-pressed={view === 'matrix'} onClick={() => set('view', 'matrix')} className={cn('h-7 w-8 rounded-md flex items-center justify-center', view === 'matrix' ? 'bg-surface text-fg shadow-[var(--shadow)]' : 'text-fg-3')}>
                <Grid2x2 size={15} />
              </button>
            </div>
            <Button size="sm" onClick={() => setAdding(true)} className="hidden md:inline-flex">
              <Plus size={15} /> New task
            </Button>
          </>
        }
      >
        <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => set('filter', f.id === 'today' ? null : f.id)} className={cn('shrink-0 h-8 px-3 rounded-lg text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors', filter === f.id ? 'bg-fg text-bg' : 'text-fg-2 hover:bg-surface-2')}>
              {f.label}
              {f.id !== 'completed' && counts[f.id] > 0 && <span className={cn('text-[11px] tnum', filter === f.id ? 'opacity-70' : f.id === 'overdue' ? 'text-danger' : 'text-fg-3')}>{counts[f.id]}</span>}
            </button>
          ))}
        </div>
      </PageHeader>
      <Page>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <form onSubmit={quickAdd} className="flex-1 flex gap-2">
            <Input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={filter === 'today' ? 'Add a task for today…' : 'Add a task…'} aria-label="Quick add task" />
            <Button type="submit" variant="secondary" disabled={!quick.trim()}>
              Add
            </Button>
          </form>
          {goalsWithTasks.length > 0 && (
            <div className="sm:w-56">
              <Select ariaLabel="Filter by goal" value={goal} onValueChange={setGoal} options={[{ value: NONE, label: 'All goals' }, ...goalsWithTasks.map((g) => ({ value: g.id, label: g.title }))]} />
            </div>
          )}
        </div>

        {view === 'list' ? (
          <Card className="px-4">
            {tasks.length === 0 ? (
              <EmptyState title={filter === 'completed' ? 'Nothing completed yet' : 'Nothing here'} body={filter === 'today' ? 'Add what matters today, or pull something from Upcoming.' : undefined} />
            ) : (
              <>
                {filter !== 'completed' && (
                  <p className="pt-3 text-[11px] text-fg-3">
                    Sorted by priority score (priority, importance, deadline, goal relevance, effort).{estimate > 0 && ` ${hours(estimate)} estimated.`}
                  </p>
                )}
                {tasks.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </>
            )}
          </Card>
        ) : (
          <Matrix tasks={tasks.filter((t) => !t.done)} />
        )}
      </Page>
      <TaskEditor open={adding} onOpenChange={setAdding} defaults={{ plannedDate: filter === 'today' ? s.today : null, goalId: goal === NONE ? null : goal }} />
      {openTask && (
        <TaskEditor
          open={editOpen}
          onOpenChange={(o) => {
            setEditOpen(o);
            if (!o) set('task', null);
          }}
          task={openTask}
        />
      )}
    </>
  );
}

function Matrix({ tasks }: { tasks: ReturnType<typeof filterTasks> }) {
  const { s } = useStore();
  const by = new Map<Quadrant, typeof tasks>([
    [1, []],
    [2, []],
    [3, []],
    [4, []],
  ]);
  for (const t of tasks) by.get(quadrant(s, t))!.push(t);
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {([1, 2, 3, 4] as Quadrant[]).map((q) => (
          <Card key={q} className="px-4 pt-3 pb-1 min-h-40">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-fg inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: QUADRANTS[q].color }} />
                {QUADRANTS[q].title}
              </h3>
              <span className="text-[11px] font-medium text-fg-3">
                {QUADRANTS[q].action} · {by.get(q)!.length}
              </span>
            </div>
            {by.get(q)!.length === 0 ? <p className="text-xs text-fg-3 py-4">None</p> : by.get(q)!.map((t) => <TaskRow key={t.id} task={t} compact />)}
          </Card>
        ))}
      </div>
      <p className="text-xs text-fg-3 mt-3">Important = marked important, P1/P2, or serving a high-priority goal. Urgent = marked urgent or due within 2 days.</p>
    </>
  );
}
