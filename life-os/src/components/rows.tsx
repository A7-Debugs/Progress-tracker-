import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Clock, Flame, Minus, MoreHorizontal, Plus, Repeat, Star, Timer, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useStore } from '@/lib/store';
import * as A from '@/lib/actions';
import type { DayHabitPlan } from '@/lib/habits';
import { frequencyLabel, habitStats, habitXp } from '@/lib/habits';
import { actualMinutes, isOverdue, recurrenceLabel, taskXp } from '@/lib/tasks';
import { fmtDay, relDay } from '@/lib/dates';
import type { DateStr, Task } from '@/lib/types';
import { CategoryDot, DifficultyTag, PriorityFlag, hours } from './Visuals';
import { TaskEditor } from './editors/TaskEditor';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { NumberField } from './ui/Input';
import { Field } from './ui/Chips';
import { useToast } from './ui/Toaster';

// ───────────────────────────── Tasks ─────────────────────────────

export function TaskRow({ task, showDate = true, compact }: { task: Task; showDate?: boolean; compact?: boolean }) {
  const { s } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);
  const [menu, setMenu] = useState(false);
  const [logTime, setLogTime] = useState(false);
  const [anim, setAnim] = useState(false);
  const goal = task.goalId ? s.goalById.get(task.goalId) : undefined;
  const cat = s.categoryById.get(task.categoryId ?? goal?.categoryId ?? '');
  const overdue = isOverdue(task, s.today);
  const day = task.plannedDate ?? task.dueDate;
  const actual = actualMinutes(s, task.id);

  async function toggle() {
    const wasDone = task.done;
    setAnim(true);
    try {
      await A.toggleTask(task.id);
      if (!wasDone) toast(`Completed${taskXp(s, task) ? ` · +${taskXp(s, task)} XP` : ''}`, 'success', { label: 'Undo', run: () => A.toggleTask(task.id) });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    setMenu(false);
    try {
      await fn();
      if (msg) toast(msg);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className={cn('group flex items-start gap-3 py-2.5', !compact && 'border-b border-line last:border-0')}>
      <button onClick={toggle} aria-label={task.done ? `Reopen ${task.title}` : `Complete ${task.title}`} className={cn('mt-0.5 h-[18px] w-[18px] shrink-0 rounded-[5px] border-[1.5px] flex items-center justify-center transition-colors', task.done ? 'bg-accent border-accent text-accent-fg' : 'border-line-strong hover:border-accent', anim && 'check-anim')} onAnimationEnd={() => setAnim(false)} style={!task.done && task.priority <= 2 ? { borderColor: task.priority === 1 ? 'var(--danger)' : 'var(--warning)' } : undefined}>
        {task.done && <Check size={12} strokeWidth={3} />}
      </button>
      <button className="flex-1 min-w-0 text-left" onClick={() => setEdit(true)}>
        <div className={cn('text-[14px] leading-snug text-fg', task.done && 'line-through text-fg-3')}>
          {task.mit && !task.done && <Star size={12} className="inline -mt-0.5 mr-1 text-xp fill-current" aria-label="Most Important Task" />}
          {task.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-fg-3">
          {!task.done && <PriorityFlag p={task.priority} />}
          {showDate && day && !task.done && <span className={cn(overdue && 'text-danger font-medium')}>{task.dueDate && overdue ? `Due ${relDay(task.dueDate, s.today)}` : relDay(day, s.today)}{task.plannedTime ? ` · ${task.plannedTime}` : ''}</span>}
          {task.dueDate && !overdue && !task.done && task.dueDate !== day && <span>Due {fmtDay(task.dueDate)}</span>}
          {task.done && task.completedDate && <span>Done {relDay(task.completedDate, s.today).toLowerCase()}</span>}
          {(task.estimateMin || actual > 0) && (
            <span className="inline-flex items-center gap-0.5">
              <Clock size={11} />
              {actual > 0 ? `${hours(actual)}${task.estimateMin ? ` / ${hours(task.estimateMin)} est.` : ''}` : hours(task.estimateMin!)}
            </span>
          )}
          {task.recurrence.type !== 'none' && (
            <span className="inline-flex items-center gap-0.5">
              <Repeat size={11} />
              {recurrenceLabel(task.recurrence)}
            </span>
          )}
          {!compact && <DifficultyTag d={task.difficulty} />}
          {goal && (
            <span className="inline-flex items-center gap-1 max-w-[180px]">
              <CategoryDot cat={cat} size={6} />
              <span className="truncate">{goal.title}</span>
            </span>
          )}
          {!goal && cat && (
            <span className="inline-flex items-center gap-1">
              <CategoryDot cat={cat} size={6} />
              {cat.name}
            </span>
          )}
          {task.postponed >= 2 && !task.done && <span className="text-warning">Postponed {task.postponed}×</span>}
        </div>
      </button>
      {!task.done && (
        <button onClick={() => setMenu(true)} className="h-7 w-7 -mr-1 shrink-0 flex items-center justify-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-fg" aria-label={`Actions for ${task.title}`}>
          <MoreHorizontal size={16} />
        </button>
      )}
      <TaskEditor open={edit} onOpenChange={setEdit} task={task} />
      <Dialog open={menu} onOpenChange={setMenu} title={task.title}>
        <div className="grid gap-1.5">
          <MenuButton icon={<Star size={16} />} onClick={() => run(() => A.setMit(task.id, !task.mit), task.mit ? 'Removed from priorities' : 'Set as a Most Important Task')}>
            {task.mit ? 'Remove from today’s priorities' : 'Make a Most Important Task'}
          </MenuButton>
          {task.plannedDate !== s.today && (
            <MenuButton icon={<ArrowRight size={16} />} onClick={() => run(() => A.planTaskFor(task.id, s.today), 'Planned for today')}>
              Do today
            </MenuButton>
          )}
          <MenuButton icon={<ArrowRight size={16} />} onClick={() => run(() => A.postponeTask(task.id, 1), 'Moved to tomorrow')}>
            Postpone to tomorrow
          </MenuButton>
          <MenuButton
            icon={<Timer size={16} />}
            onClick={() =>
              run(async () => {
                await A.startTimer({ label: task.title, taskId: task.id, categoryId: task.categoryId ?? goal?.categoryId ?? null, plannedMin: Math.min(90, task.estimateMin ?? 25) });
                navigate('/focus');
              })
            }
          >
            Start a focus session
          </MenuButton>
          <MenuButton icon={<Clock size={16} />} onClick={() => (setMenu(false), setLogTime(true))}>
            Log time spent
          </MenuButton>
        </div>
      </Dialog>
      <LogTimeDialog open={logTime} onOpenChange={setLogTime} task={task} />
    </div>
  );
}

function MenuButton({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 h-11 px-3 rounded-lg text-sm text-fg hover:bg-surface-2 text-left">
      <span className="text-fg-3">{icon}</span>
      {children}
    </button>
  );
}

function LogTimeDialog({ open, onOpenChange, task }: { open: boolean; onOpenChange: (o: boolean) => void; task: Task }) {
  const { s } = useStore();
  const toast = useToast();
  const [min, setMin] = useState(task.estimateMin ?? 30);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Log time spent"
      description="Recorded as focused work on this task, so you can compare estimates with reality."
      footer={
        <Button
          onClick={async () => {
            try {
              await A.logFocus({ date: s.today, minutes: min, taskId: task.id, goalId: task.goalId, categoryId: task.categoryId, learningId: null, note: '' });
              toast(`Logged ${hours(min)}`);
              onOpenChange(false);
            } catch (e) {
              toast((e as Error).message, 'error');
            }
          }}
        >
          Log time
        </Button>
      }
    >
      <Field label="Minutes">
        <NumberField autoFocus min={1} max={720} value={min} onChange={(e) => setMin(Number(e.target.value))} />
      </Field>
    </Dialog>
  );
}

// ───────────────────────────── Habits ─────────────────────────────

export function HabitRow({ plan, date, compact }: { plan: DayHabitPlan; date: DateStr; compact?: boolean }) {
  const { s } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const h = plan.habit;
  const status = plan.log?.status;
  const count = plan.log?.count ?? 0;
  const st = habitStats(s, h);
  const xp = habitXp(s, h);
  const cat = s.categoryById.get(h.categoryId);
  const counted = h.target > 1;

  const set = async (next: 'done' | 'partial' | 'missed' | null, opts: { count?: number } = {}) => {
    try {
      await A.logHabit(h.id, date, next, opts);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const step = Math.max(1, Math.round(h.target / (h.unit === 'minutes' ? 6 : h.target > 20 ? 4 : h.target)));

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
      <button onClick={() => set(status === 'done' ? null : 'done')} aria-label={status === 'done' ? `Undo ${h.name}` : `Mark ${h.name} done`} aria-pressed={status === 'done'} className={cn('h-8 w-8 shrink-0 rounded-full border-[1.5px] flex items-center justify-center transition-colors', status === 'done' ? 'bg-success border-success text-white' : status === 'partial' ? 'border-success text-success bg-success/10' : status === 'missed' ? 'border-line-strong text-fg-3 bg-surface-2' : 'border-line-strong text-transparent hover:border-success hover:text-success/50')}>
        {status === 'missed' ? <X size={14} /> : status === 'partial' ? <span className="text-[10px] font-bold">½</span> : <Check size={15} strokeWidth={2.6} />}
      </button>
      <button className="flex-1 min-w-0 text-left" onClick={() => navigate(`/habits/${h.id}`)}>
        <div className="flex items-center gap-1.5 min-w-0">
          <CategoryDot cat={cat} size={6} />
          <span className={cn('text-[14px] text-fg truncate', status === 'done' && 'text-fg-2')}>{h.name}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-fg-3">
          {plan.week ? <span className={cn(plan.week.neededToday && plan.credit === 0 && 'text-warning')}>{Math.round(plan.week.done * 10) / 10}/{plan.week.target} this week{plan.week.neededToday && plan.credit === 0 ? ' · needed today' : ''}</span> : <span>{frequencyLabel(h.frequency)}</span>}
          {counted && (
            <span className="tnum">
              {count}/{h.target} {h.unit}
            </span>
          )}
          {st.current > 1 && (
            <span className="inline-flex items-center gap-0.5 tnum">
              <Flame size={11} className="text-warning" />
              {st.current} {st.unit}
            </span>
          )}
          {!compact && h.minimumVersion && status !== 'done' && <span className="truncate max-w-[200px]">Min: {h.minimumVersion}</span>}
          {!compact && <span className="text-xp">+{xp} XP</span>}
        </div>
      </button>
      {counted ? (
        <div className="flex items-center gap-1 shrink-0">
          <button className="h-8 w-8 rounded-lg border border-line flex items-center justify-center text-fg-2 hover:bg-surface-2 disabled:opacity-30" disabled={count <= 0} onClick={() => set(null, { count: Math.max(0, count - step) })} aria-label={`Less ${h.name}`}>
            <Minus size={14} />
          </button>
          <button className="h-8 w-8 rounded-lg border border-line flex items-center justify-center text-fg-2 hover:bg-surface-2" onClick={() => set(null, { count: count + step })} aria-label={`More ${h.name}`}>
            <Plus size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => set(status === 'partial' ? null : 'partial')} aria-pressed={status === 'partial'} title={h.minimumVersion ? `Minimum: ${h.minimumVersion}` : 'Did the minimum version'} className={cn('h-8 px-2 rounded-lg border text-[11px] font-medium', status === 'partial' ? 'border-success text-success bg-success/10' : 'border-line text-fg-3 hover:bg-surface-2')}>
            Min
          </button>
          <button onClick={() => set(status === 'missed' ? null : 'missed')} aria-pressed={status === 'missed'} aria-label={`Mark ${h.name} missed`} className={cn('h-8 w-8 rounded-lg border flex items-center justify-center', status === 'missed' ? 'border-line-strong bg-surface-3 text-fg' : 'border-line text-fg-3 hover:bg-surface-2')}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
