import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import * as A from '@/lib/actions';
import type { Difficulty, Priority, RecurrenceType, Task } from '@/lib/types';
import { addDays } from '@/lib/dates';
import { clashesWith } from '@/lib/schedule';
import { Dialog, Confirm } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Field, Segmented } from '../ui/Chips';
import { Input, NumberField, Textarea } from '../ui/Input';
import { NONE, Select } from '../ui/Select';
import { Switch } from '../ui/Switch';
import { useToast } from '../ui/Toaster';
import { liveGoals } from '@/lib/goals';

type Draft = A.TaskDraft;

function blank(today: string, d: Partial<Draft> = {}): Draft {
  return { title: '', notes: '', categoryId: null, goalId: null, milestoneId: null, priority: 3, important: false, urgent: false, difficulty: 'medium', estimateMin: null, dueDate: null, plannedDate: today, plannedTime: null, mit: false, recurrence: { type: 'none', interval: 1 }, ...d };
}

export function TaskEditor({ open, onOpenChange, task, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; task?: Task; defaults?: Partial<Draft> }) {
  const { s } = useStore();
  const toast = useToast();
  const [d, setD] = useState<Draft>(() => blank(s.today, defaults));
  const [more, setMore] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    setD(task ? { ...task } : blank(s.today, defaults));
    setMore(!!task && !!(task.notes || task.goalId || task.recurrence.type !== 'none' || task.estimateMin));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const goals = liveGoals(s).filter((g) => g.status === 'active' || g.id === d.goalId);
  const milestones = d.goalId ? (s.milestonesByGoal.get(d.goalId) ?? []).filter((m) => !m.done || m.id === d.milestoneId) : [];
  const clashes = d.plannedDate && d.plannedTime ? clashesWith(s, d.plannedDate, d.plannedTime, minutesLater(d.plannedTime, d.estimateMin ?? 30), task ? `t:${task.id}` : undefined) : [];

  async function save() {
    try {
      const goal = d.goalId ? s.goalById.get(d.goalId) : undefined;
      await A.saveTask({ ...d, categoryId: d.categoryId ?? goal?.categoryId ?? null });
      toast(task ? 'Task updated' : 'Task added');
      onOpenChange(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={task ? 'Edit task' : 'New task'}
        footer={
          <>
            {task && (
              <Button variant="ghost" className="mr-auto text-danger" onClick={() => setConfirm(true)} aria-label="Delete task">
                <Trash2 size={15} /> Delete
              </Button>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!d.title.trim()}>
              {task ? 'Save' : 'Add task'}
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input autoFocus placeholder="What needs doing?" value={d.title} onChange={(e) => set('title', e.target.value)} aria-label="Task title" className="h-11 text-base font-medium" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Do on">
              <Input type="date" value={d.plannedDate ?? ''} onChange={(e) => set('plannedDate', e.target.value || null)} />
            </Field>
            <Field label="Time (optional)">
              <Input type="time" value={d.plannedTime ?? ''} disabled={!d.plannedDate} onChange={(e) => set('plannedTime', e.target.value || null)} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5 -mt-2">
            {[
              ['Today', s.today],
              ['Tomorrow', addDays(s.today, 1)],
              ['Next week', addDays(s.today, 7)],
              ['No date', null],
            ].map(([l, v]) => (
              <button key={l} type="button" onClick={() => set('plannedDate', v)} className="h-7 px-2.5 rounded-md text-xs font-medium border border-line text-fg-2 hover:bg-surface-2">
                {l}
              </button>
            ))}
          </div>
          {clashes.length > 0 && <p className="text-xs text-warning -mt-2">Overlaps with {clashes.map((c) => `"${c.title}"`).join(', ')}.</p>}
          <Field label="Deadline (optional)">
            <Input type="date" value={d.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value || null)} />
          </Field>
          <Field label="Priority">
            <Segmented<Priority> value={d.priority} onChange={(v) => set('priority', v)} options={[1, 2, 3, 4].map((p) => ({ value: p as Priority, label: `P${p}` }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <ToggleRow label="Important" hint="Moves a goal or matters long-term" checked={d.important} onChange={(v) => set('important', v)} />
            <ToggleRow label="Urgent" hint="Auto when due within 2 days" checked={d.urgent} onChange={(v) => set('urgent', v)} />
          </div>
          <ToggleRow label="Most Important Task" hint="Up to 3 per day, shown first on the dashboard" checked={d.mit} onChange={(v) => set('mit', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Difficulty">
              <Select value={d.difficulty} onValueChange={(v) => set('difficulty', v as Difficulty)} options={[{ value: 'easy', label: `Easy · ${s.settings.xp.taskEasy} XP` }, { value: 'medium', label: `Medium · ${s.settings.xp.taskMedium} XP` }, { value: 'hard', label: `Hard · ${s.settings.xp.taskHard} XP` }]} />
            </Field>
            <Field label="Estimate (min)">
              <NumberField min={1} placeholder="e.g. 45" value={d.estimateMin ?? ''} onChange={(e) => set('estimateMin', e.target.value ? Number(e.target.value) : null)} />
            </Field>
          </div>
          <Field label="Goal">
            <Select value={d.goalId ?? NONE} onValueChange={(v) => setD((x) => ({ ...x, goalId: v === NONE ? null : v, milestoneId: null }))} options={[{ value: NONE, label: 'Not linked to a goal' }, ...goals.map((g) => ({ value: g.id, label: g.title }))]} />
          </Field>
          {milestones.length > 0 && (
            <Field label="Milestone" hint="Tasks support milestones; finishing tasks does not complete a milestone by itself.">
              <Select value={d.milestoneId ?? NONE} onValueChange={(v) => set('milestoneId', v === NONE ? null : v)} options={[{ value: NONE, label: 'None' }, ...milestones.map((m) => ({ value: m.id, label: m.title }))]} />
            </Field>
          )}
          {!more ? (
            <button type="button" className="text-[13px] font-medium text-accent" onClick={() => setMore(true)}>
              More options
            </button>
          ) : (
            <>
              <Field label="Category">
                <Select value={d.categoryId ?? NONE} onValueChange={(v) => set('categoryId', v === NONE ? null : v)} options={[{ value: NONE, label: 'From goal / none' }, ...s.categories.filter((c) => !c.archived).map((c) => ({ value: c.id, label: c.name }))]} />
              </Field>
              <div className="grid grid-cols-[1fr_96px] gap-3">
                <Field label="Repeat">
                  <Select value={d.recurrence.type} onValueChange={(v) => set('recurrence', { ...d.recurrence, type: v as RecurrenceType })} options={[{ value: 'none', label: 'Does not repeat' }, { value: 'daily', label: 'Daily' }, { value: 'weekdays', label: 'Weekdays' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
                </Field>
                <Field label="Every">
                  <NumberField min={1} max={52} disabled={d.recurrence.type === 'none' || d.recurrence.type === 'weekdays'} value={d.recurrence.interval} onChange={(e) => set('recurrence', { ...d.recurrence, interval: Number(e.target.value) || 1 })} />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea value={d.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Details, links, first step…" />
              </Field>
            </>
          )}
          <button type="submit" className="hidden" />
        </form>
      </Dialog>
      {task && (
        <Confirm
          open={confirm}
          onOpenChange={setConfirm}
          title="Delete this task?"
          body={task.done ? 'The XP it earned will be removed too.' : 'This cannot be undone.'}
          onConfirm={async () => {
            await A.deleteTask(task.id);
            onOpenChange(false);
            toast('Task deleted');
          }}
        />
      )}
    </>
  );
}

export function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 cursor-pointer">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-fg">{label}</span>
        {hint && <span className="block text-[11px] text-fg-3 leading-snug">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} ariaLabel={label} />
    </label>
  );
}

function minutesLater(t: string, m: number) {
  const [h, mm] = t.split(':').map(Number);
  const x = Math.min(23 * 60 + 59, h * 60 + mm + m);
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
}
