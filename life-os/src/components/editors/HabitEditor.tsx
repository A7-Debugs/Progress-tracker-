import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import * as A from '@/lib/actions';
import type { Difficulty, FrequencyType, Habit, TimeOfDay } from '@/lib/types';
import { liveGoals } from '@/lib/goals';
import { HABIT_TEMPLATES } from '@/lib/defaults';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { DayPicker, Field, Segmented } from '../ui/Chips';
import { Input, NumberField, Textarea } from '../ui/Input';
import { NONE, Select } from '../ui/Select';
import { useToast } from '../ui/Toaster';
import { ToggleRow } from './TaskEditor';

type Draft = A.HabitDraft;

function blank(): Draft {
  return { name: '', description: '', categoryId: 'health', goalId: null, frequency: { type: 'daily', days: [1, 2, 3, 4, 5], timesPerWeek: 3, everyDays: 2 }, target: 1, unit: '', timeOfDay: 'anytime', preferredTime: null, difficulty: 'medium', minimumVersion: '', xpOverride: null };
}

export function HabitEditor({ open, onOpenChange, habit, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; habit?: Habit; onSaved?: (id: string) => void }) {
  const { s } = useStore();
  const toast = useToast();
  const [d, setD] = useState<Draft>(blank);
  useEffect(() => {
    if (open) setD(habit ? { ...habit, frequency: { ...habit.frequency } } : blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, habit?.id]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setF = (patch: Partial<Draft['frequency']>) => setD((x) => ({ ...x, frequency: { ...x.frequency, ...patch } }));
  const defaultXp = d.difficulty === 'easy' ? s.settings.xp.habitEasy : d.difficulty === 'hard' ? s.settings.xp.habitHard : s.settings.xp.habitMedium;
  const unused = HABIT_TEMPLATES.filter((t) => !s.habits.some((h) => h.name === t.name));

  async function save() {
    try {
      const id = await A.saveHabit(d);
      toast(habit ? 'Habit updated' : 'Habit created');
      onOpenChange(false);
      onSaved?.(id);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={habit ? 'Edit habit' : 'New habit'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!d.name.trim()}>
            {habit ? 'Save' : 'Create habit'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!habit && unused.length > 0 && (
          <div>
            <p className="text-[13px] font-medium text-fg-2 mb-1.5">Start from a template</p>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
              {unused.map((t) => (
                <button key={t.id} type="button" onClick={() => setD({ ...blank(), name: t.name, description: t.description, categoryId: t.categoryId, frequency: { ...blank().frequency, ...t.frequency, days: t.frequency.days.length ? [...t.frequency.days] : [1, 2, 3, 4, 5] }, target: t.target, unit: t.unit, timeOfDay: t.timeOfDay, difficulty: t.difficulty, minimumVersion: t.minimumVersion })} className="shrink-0 h-8 px-3 rounded-lg border border-line text-xs font-medium text-fg-2 hover:bg-surface-2">
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <Field label="Habit">
          <Input autoFocus value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Study for 90 minutes" />
        </Field>
        <Field label="Description">
          <Textarea rows={2} value={d.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Life area">
            <Select value={d.categoryId} onValueChange={(v) => set('categoryId', v)} options={s.categories.filter((c) => !c.archived || c.id === d.categoryId).map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
          <Field label="Supports goal">
            <Select value={d.goalId ?? NONE} onValueChange={(v) => set('goalId', v === NONE ? null : v)} options={[{ value: NONE, label: 'None' }, ...liveGoals(s).filter((g) => g.status === 'active').map((g) => ({ value: g.id, label: g.title }))]} />
          </Field>
        </div>
        <Field label="Frequency">
          <Segmented<FrequencyType> size="sm" value={d.frequency.type} onChange={(v) => setF({ type: v })} options={[{ value: 'daily', label: 'Daily' }, { value: 'weekdays', label: 'Specific days' }, { value: 'weekly', label: 'N× per week' }, { value: 'interval', label: 'Every N days' }]} />
        </Field>
        {d.frequency.type === 'weekdays' && <DayPicker value={d.frequency.days} onChange={(days) => setF({ days })} />}
        {d.frequency.type === 'weekly' && (
          <Field label="Times per week" hint="Any days you like. Weekly habits are judged when the week ends.">
            <NumberField min={1} max={7} value={d.frequency.timesPerWeek} onChange={(e) => setF({ timesPerWeek: Number(e.target.value) })} />
          </Field>
        )}
        {d.frequency.type === 'interval' && (
          <Field label="Every how many days">
            <NumberField min={2} max={60} value={d.frequency.everyDays} onChange={(e) => setF({ everyDays: Number(e.target.value) })} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target per time" hint="1 = a simple tick">
            <NumberField min={1} value={d.target} onChange={(e) => set('target', Number(e.target.value))} />
          </Field>
          <Field label="Unit">
            <Input value={d.unit} disabled={d.target <= 1} onChange={(e) => set('unit', e.target.value)} placeholder="minutes, pages, reps" />
          </Field>
        </div>
        <Field label="Minimum acceptable version" hint="On a hard day, this counts as a partial completion and keeps your streak alive.">
          <Input value={d.minimumVersion} onChange={(e) => set('minimumVersion', e.target.value)} placeholder="e.g. 25 focused minutes" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time of day">
            <Select value={d.timeOfDay} onValueChange={(v) => set('timeOfDay', v as TimeOfDay)} options={[{ value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' }, { value: 'evening', label: 'Evening' }, { value: 'anytime', label: 'Any time' }]} />
          </Field>
          <Field label="Preferred time">
            <Input type="time" value={d.preferredTime ?? ''} onChange={(e) => set('preferredTime', e.target.value || null)} />
          </Field>
        </div>
        <Field label="Difficulty">
          <Segmented<Difficulty> value={d.difficulty} onChange={(v) => set('difficulty', v)} options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} />
        </Field>
        <ToggleRow label="Custom XP reward" hint={d.xpOverride === null ? `Using the ${d.difficulty} default: ${defaultXp} XP` : 'Max 50 XP per completion'} checked={d.xpOverride !== null} onChange={(v) => set('xpOverride', v ? defaultXp : null)} />
        {d.xpOverride !== null && <NumberField aria-label="XP per completion" min={0} max={50} value={d.xpOverride} onChange={(e) => set('xpOverride', Number(e.target.value))} />}
      </div>
    </Dialog>
  );
}
