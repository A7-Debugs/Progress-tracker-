import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Chips, Field } from './ui/Chips';
import { useToast } from './ui/Toaster';
import { addExercise, saveSleep, now } from '@/lib/actions';
import { db } from '@/lib/db';
import { addDays, fmtDay, fmtDuration, logicalDate, sleepMinutes } from '@/lib/dates';
import type { DateStr, ExerciseLog, ExerciseType } from '@/lib/types';

export const EXERCISE_TYPES: { value: ExerciseType; label: string }[] = [
  { value: 'walk', label: 'Walk' },
  { value: 'run', label: 'Run' },
  { value: 'cycle', label: 'Cycle' },
  { value: 'football', label: 'Football' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'swim', label: 'Swim' },
  { value: 'pe', label: 'PE' },
  { value: 'gym', label: 'Gym / strength' },
  { value: 'dance', label: 'Dance' },
  { value: 'martial-arts', label: 'Martial arts' },
  { value: 'stretch', label: 'Stretch / yoga' },
  { value: 'other', label: 'Other' },
];
export const EXERCISE_LABEL = Object.fromEntries(EXERCISE_TYPES.map((e) => [e.value, e.label])) as Record<ExerciseType, string>;

export function ExerciseDialog({ open, onOpenChange, date }: { open: boolean; onOpenChange: (o: boolean) => void; date?: DateStr }) {
  const toast = useToast();
  const settings = useLiveQuery(() => db.settings.get('settings'), []);
  const today = logicalDate(now(), settings?.dayStartHour ?? 4);
  const [type, setType] = useState<ExerciseType>('walk');
  const [minutes, setMinutes] = useState(20);
  const [effort, setEffort] = useState<ExerciseLog['effort']>('moderate');
  const [day, setDay] = useState<DateStr>(date ?? today);
  const save = async () => {
    try {
      await addExercise({ date: day, type, minutes, effort, note: '' });
      toast(`${EXERCISE_LABEL[type]} logged · ${minutes} min`);
      onOpenChange(false);
    } catch (e) {
      toast((e as Error).message, 'warn');
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Log activity" description="Anything that gets you moving counts.">
      <div className="space-y-4">
        <Field label="Activity">
          <Chips value={type} onChange={setType} options={EXERCISE_TYPES} size="sm" />
        </Field>
        <Field label={`Duration: ${minutes} min`}>
          <Chips value={minutes} onChange={setMinutes} options={[10, 15, 20, 30, 45, 60, 90].map((m) => ({ value: m, label: `${m}` }))} size="sm" />
        </Field>
        <Field label="Effort">
          <Chips
            value={effort}
            onChange={setEffort}
            options={[
              { value: 'easy', label: 'Easy', color: '#3ee8a4' },
              { value: 'moderate', label: 'Moderate', color: '#ffb454' },
              { value: 'hard', label: 'Hard', color: '#ff5fa2' },
            ]}
          />
        </Field>
        <Field label="Day">
          <Chips value={day} onChange={setDay} options={[0, 1].map((n) => ({ value: addDays(today, -n), label: n === 0 ? 'Today' : 'Yesterday' }))} size="sm" />
        </Field>
        <p className="text-xs text-base-400">Young people should aim for about 60 minutes of activity across the day: PE, walking to school and playing sport all add up. Rest days matter too.</p>
        <Button className="w-full" size="lg" onClick={save}>
          Save activity
        </Button>
      </div>
    </Dialog>
  );
}

export function SleepDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const toast = useToast();
  const settings = useLiveQuery(() => db.settings.get('settings'), []);
  const today = logicalDate(now(), settings?.dayStartHour ?? 4);
  const existing = useLiveQuery(() => db.sleepLogs.get(today), [today]);
  const [bed, setBed] = useState<string | null>(null);
  const [wake, setWake] = useState<string | null>(null);
  const [quality, setQuality] = useState<number | null>(null);
  const [day, setDay] = useState<DateStr>(today);
  const b = bed ?? existing?.bedtime ?? settings?.bedTarget ?? '21:45';
  const w = wake ?? existing?.wake ?? settings?.wakeTarget ?? '07:00';
  const mins = sleepMinutes(b, w);
  const zone = mins < 480 ? { label: 'Below 8h', color: '#ffb454' } : mins <= 600 ? { label: 'In the 8–10h zone', color: '#3ee8a4' } : { label: 'Over 10h', color: '#6ea8fe' };
  const save = async () => {
    try {
      await saveSleep(day, b, w, quality ?? existing?.quality ?? null);
      toast(`Sleep logged · ${fmtDuration(mins)}`);
      onOpenChange(false);
    } catch (e) {
      toast((e as Error).message, 'warn');
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Record sleep" description="Teenagers need 8–10 hours a night.">
      <div className="space-y-4">
        <Field label="Night">
          <Chips value={day} onChange={setDay} options={[0, 1, 2].map((n) => ({ value: addDays(today, -n), label: n === 0 ? 'Last night' : `Woke ${fmtDay(addDays(today, -n))}` }))} size="sm" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Went to sleep">
            <Input type="time" value={b} onChange={(e) => setBed(e.target.value)} aria-label="Bedtime" />
          </Field>
          <Field label="Woke up">
            <Input type="time" value={w} onChange={(e) => setWake(e.target.value)} aria-label="Wake time" />
          </Field>
        </div>
        <div className="rounded-xl bg-base-850 border border-base-700 p-3 flex items-center justify-between">
          <span className="text-2xl font-black tabular-nums text-base-50">{fmtDuration(mins)}</span>
          <span className="text-sm font-bold" style={{ color: zone.color }}>
            {zone.label}
          </span>
        </div>
        <Field label="How did you feel? (optional)">
          <Chips value={quality} onChange={setQuality} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: ['😴', '😕', '🙂', '😃', '⚡'][n - 1] }))} />
        </Field>
        <Button className="w-full" size="lg" onClick={save}>
          Save sleep
        </Button>
      </div>
    </Dialog>
  );
}
