import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Minus, Plus, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Habit, DateStr } from '@/lib/types';
import type { Snapshot } from '@/lib/snapshot';
import { habitProgress } from '@/lib/performance';
import { CATEGORY_BY_ID } from '@/lib/habits';
import { setHabitCount, toggleHabit } from '@/lib/actions';
import { canEditDate } from '@/lib/sync';
import { Icon } from './Icon';
import { Ring, XpChip } from './game';
import { useToast } from './ui/Toaster';
import { ExerciseDialog } from './LogDialogs';

/** One tap to complete. Count habits get a +/- stepper. Linked habits explain where they fill from. */
export function HabitCard({ habit, snap, date }: { habit: Habit; snap: Snapshot; date: DateStr }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [pop, setPop] = useState(false);
  const [exercise, setExercise] = useState(false);
  const p = habitProgress(snap, habit, date);
  const cat = CATEGORY_BY_ID[habit.category];
  const editable = canEditDate(snap, date);
  const isCount = habit.target > 1 || habit.unit !== null;
  const nutrition = habit.link === 'water' || habit.link === 'meals' || habit.link === 'fruitveg';

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, 'warn');
    }
  };

  const onMain = () => {
    if (!editable) return toast('Past days are locked. Today is a fresh start!', 'info');
    if (habit.link === 'exercise') return setExercise(true);
    if (habit.link === 'revision') return navigate('/academy/start');
    if (!p.done) {
      setPop(true);
      setTimeout(() => setPop(false), 400);
    }
    if (isCount) return run(() => setHabitCount(habit.id, date, p.done ? 0 : habit.target));
    return run(() => toggleHabit(habit.id, date));
  };

  const step = (dir: 1 | -1) => run(() => setHabitCount(habit.id, date, p.count + dir * habit.step));

  const sub =
    habit.link === 'exercise'
      ? `${p.count}/${p.target} min · tap to log activity`
      : habit.link === 'revision'
        ? `${p.count}/${p.target} min · from Academy sessions`
        : isCount
          ? `${p.count}/${p.target} ${habit.unit ?? ''}`
          : cat.label;

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all',
        p.done ? 'bg-base-850 border-base-700' : 'bg-base-900 border-base-800',
      )}
      style={p.done ? { boxShadow: `inset 3px 0 0 ${cat.color}` } : undefined}
    >
      <button onClick={onMain} className="flex items-center gap-3 flex-1 min-w-0 text-left min-h-12" aria-pressed={p.done} aria-label={`${habit.name}${p.done ? ' (done)' : ''}`}>
        <Ring value={p.count / p.target} size={44} stroke={4} color={cat.color} className={cn(pop && 'check-pop')}>
          {p.done ? (
            <span className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: cat.color }}>
              <Check size={18} strokeWidth={3.2} className="text-base-950" />
            </span>
          ) : (
            <Icon name={habit.icon} size={19} className="text-base-200" />
          )}
        </Ring>
        <div className="flex-1 min-w-0">
          <p className={cn('text-[15px] font-semibold truncate', p.done ? 'text-base-300' : 'text-base-50')}>{habit.name}</p>
          <p className="text-xs text-base-400 truncate">{sub}</p>
        </div>
      </button>
      {isCount && editable && (nutrition || habit.link === 'manual') ? (
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} disabled={p.count <= 0} className="h-9 w-9 rounded-xl bg-base-800 text-base-200 flex items-center justify-center disabled:opacity-30 active:scale-95" aria-label={`Less ${habit.name}`}>
            <Minus size={16} />
          </button>
          <button onClick={() => step(1)} className="h-9 w-9 rounded-xl bg-base-800 text-base-50 flex items-center justify-center active:scale-95" aria-label={`More ${habit.name}`}>
            <Plus size={16} />
          </button>
        </div>
      ) : !editable ? (
        <Lock size={14} className="text-base-500" />
      ) : (
        <XpChip xp={habit.xp} done={p.done} />
      )}
      {exercise && <ExerciseDialog open={exercise} onOpenChange={setExercise} date={date} />}
    </div>
  );
}
