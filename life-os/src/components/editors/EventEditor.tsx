import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import * as A from '@/lib/actions';
import type { CalEvent, DateStr, EventKind, RecurrenceType } from '@/lib/types';
import { clashesWith } from '@/lib/schedule';
import { filterTasks } from '@/lib/tasks';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Field, Segmented } from '../ui/Chips';
import { Input, NumberField, Textarea } from '../ui/Input';
import { NONE, Select } from '../ui/Select';
import { useToast } from '../ui/Toaster';

type Draft = A.EventDraft;

function blank(date: DateStr, d: Partial<Draft> = {}): Draft {
  return { title: '', kind: 'block', date, start: '09:00', end: '10:00', categoryId: null, taskId: null, habitId: null, recurrence: { type: 'none', interval: 1 }, notes: '', ...d };
}

export function EventEditor({ open, onOpenChange, event, date, occurrence, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; event?: CalEvent; date: DateStr; occurrence?: DateStr; defaults?: Partial<Draft> }) {
  const { s } = useStore();
  const toast = useToast();
  const [d, setD] = useState<Draft>(() => blank(date, defaults));
  useEffect(() => {
    if (open) setD(event ? { ...event } : blank(date, defaults));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id, date]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const clashes = d.start && d.end ? clashesWith(s, d.date, d.start, d.end, event ? `e:${event.id}` : undefined) : [];
  const tasks = filterTasks(s, 'all');

  async function save() {
    try {
      await A.saveEvent(d);
      toast(clashes.length ? `Saved, but it overlaps ${clashes.length} other item${clashes.length > 1 ? 's' : ''}` : 'Saved', clashes.length ? 'info' : 'success');
      onOpenChange(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function remove(scope: 'one' | 'all') {
    if (!event) return;
    await A.deleteEvent(event.id, scope, occurrence);
    onOpenChange(false);
    toast('Removed');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={event ? 'Edit time block' : 'Block out time'}
      footer={
        <>
          {event && (
            <Button variant="ghost" className="mr-auto text-danger" onClick={() => remove('all')}>
              <Trash2 size={15} /> {event.recurrence.type !== 'none' ? 'Delete series' : 'Delete'}
            </Button>
          )}
          {event && event.recurrence.type !== 'none' && occurrence && (
            <Button variant="ghost" className="text-danger" onClick={() => remove('one')}>
              This day only
            </Button>
          )}
          <Button onClick={save} disabled={!d.title.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title">
          <Input autoFocus value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Deep work: ACCA study" />
        </Field>
        <Segmented<EventKind> value={d.kind} onChange={(v) => set('kind', v)} options={[{ value: 'block', label: 'Time block' }, { value: 'focus', label: 'Focus block' }, { value: 'event', label: 'Event / commitment' }]} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date">
            <Input type="date" value={d.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Start">
            <Input type="time" value={d.start} onChange={(e) => set('start', e.target.value)} />
          </Field>
          <Field label="End">
            <Input type="time" value={d.end} onChange={(e) => set('end', e.target.value)} />
          </Field>
        </div>
        {clashes.length > 0 && <p className="text-xs text-warning -mt-2">Conflicts with {clashes.map((c) => `"${c.title}"`).join(', ')}.</p>}
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <Field label="Repeat">
            <Select value={d.recurrence.type} onValueChange={(v) => set('recurrence', { ...d.recurrence, type: v as RecurrenceType })} options={[{ value: 'none', label: 'Does not repeat' }, { value: 'daily', label: 'Daily' }, { value: 'weekdays', label: 'Weekdays' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} />
          </Field>
          <Field label="Every">
            <NumberField min={1} disabled={d.recurrence.type === 'none' || d.recurrence.type === 'weekdays'} value={d.recurrence.interval} onChange={(e) => set('recurrence', { ...d.recurrence, interval: Number(e.target.value) || 1 })} />
          </Field>
        </div>
        <Field label="Life area">
          <Select value={d.categoryId ?? NONE} onValueChange={(v) => set('categoryId', v === NONE ? null : v)} options={[{ value: NONE, label: 'None' }, ...s.categories.filter((c) => !c.archived).map((c) => ({ value: c.id, label: c.name }))]} />
        </Field>
        <Field label="For task" hint="Focus time logged from this block counts as the task's actual time.">
          <Select value={d.taskId ?? NONE} onValueChange={(v) => set('taskId', v === NONE ? null : v)} options={[{ value: NONE, label: 'None' }, ...tasks.map((t) => ({ value: t.id, label: t.title }))]} />
        </Field>
        <Field label="Habit">
          <Select value={d.habitId ?? NONE} onValueChange={(v) => set('habitId', v === NONE ? null : v)} options={[{ value: NONE, label: 'None' }, ...s.habits.filter((h) => h.active).map((h) => ({ value: h.id, label: h.name }))]} />
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={d.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
