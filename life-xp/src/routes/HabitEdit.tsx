import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Trash2, Pause, Play } from 'lucide-react';
import { useSnapshot } from '@/lib/hooks';
import { Loading, Page, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Chips, DayPicker, Field } from '@/components/ui/Chips';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toaster';
import { Icon, PICKABLE_ICONS } from '@/components/Icon';
import { SectionTitle, StatTile } from '@/components/game';
import { archiveHabit, deleteHabit, restoreHabit, saveHabit, type HabitDraft } from '@/lib/actions';
import { ALL_DAYS, CATEGORIES, XP_LIMITS } from '@/lib/habits';
import { addDays, dayOfWeek, fmtShort } from '@/lib/dates';
import { habitCompletionRate, habitExistsOn, habitProgress } from '@/lib/performance';
import { cn } from '@/lib/cn';
import type { Habit } from '@/lib/types';

const LINK_NOTE: Record<Habit['link'], string | null> = {
  manual: null,
  water: 'Fills from the water you log (Home → Water, or the +/− buttons).',
  meals: 'Fills from balanced meals logged in Health.',
  fruitveg: 'Fills from fruit & veg portions logged in Health.',
  exercise: 'Fills from activity minutes logged in Health.',
  revision: 'Fills from focused minutes in Academy sessions.',
};

export default function HabitEdit() {
  const { habitId } = useParams();
  const s = useSnapshot();
  if (!s) return <Loading />;
  const habit = habitId ? s.habits.find((h) => h.id === habitId) : undefined;
  if (habitId && !habit) return <Loading />;
  return <Editor key={habitId ?? 'new'} habit={habit} snap={s} />;
}

function Editor({ habit, snap }: { habit?: Habit; snap: NonNullable<ReturnType<typeof useSnapshot>> }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [d, setD] = useState<HabitDraft>(() =>
    habit
      ? { ...habit }
      : { name: '', category: 'personal', icon: 'Sparkles', xp: 10, days: [...ALL_DAYS], target: 1, unit: null, step: 1, link: 'manual', xpKind: 'life', templateId: null },
  );
  const set = (p: Partial<HabitDraft>) => setD((x) => ({ ...x, ...p }));
  const isCount = d.target > 1 || d.unit !== null;

  const save = async () => {
    try {
      await saveHabit(d);
      toast(habit ? 'Habit updated' : 'Habit added. It counts from today');
      navigate(-1);
    } catch (e) {
      toast((e as Error).message, 'warn');
    }
  };

  const history = useMemo(() => {
    if (!habit) return null;
    const days = Array.from({ length: 35 }, (_, i) => addDays(snap.today, -34 + i));
    const cells = days.map((date) => {
      const scheduled = habitExistsOn(habit, date) && habit.days.includes(dayOfWeek(date)) && date >= snap.profile.startDate;
      const p = habitProgress(snap, habit, date);
      return { date, scheduled, done: p.done, partial: !p.done && p.count > 0 };
    });
    let streak = 0;
    for (let i = cells.length - 1; i >= 0; i--) {
      const c = cells[i];
      if (!c.scheduled) continue;
      if (c.done) streak++;
      else if (c.date === snap.today) continue;
      else break;
    }
    return {
      cells,
      r7: habitCompletionRate(snap, habit, addDays(snap.today, -6), snap.today),
      r30: habitCompletionRate(snap, habit, addDays(snap.today, -29), snap.today),
      all: habitCompletionRate(snap, habit, habit.startDate, snap.today),
      streak,
    };
  }, [habit, snap]);

  return (
    <>
      <PageHeader title={habit ? 'Edit habit' : 'New habit'} back />
      <Page className="space-y-4 pb-8">
        {history && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Streak" value={history.streak} sub="scheduled days" color="#ff8a3d" />
              <StatTile label="30 days" value={history.r30.pct === null ? '–' : `${Math.round(history.r30.pct * 100)}%`} sub={`${history.r30.done}/${history.r30.scheduled}`} />
              <StatTile label="All time" value={history.all.done} sub="completions" />
            </div>
            <div className="rounded-2xl bg-base-900 border border-base-800 p-3">
              <p className="text-xs font-semibold text-base-400 mb-2">Last 5 weeks</p>
              <div className="grid grid-cols-7 gap-1.5">
                {history.cells.map((c) => (
                  <div
                    key={c.date}
                    title={fmtShort(c.date)}
                    className={cn('aspect-square rounded-md', !c.scheduled ? 'bg-base-850/40' : c.done ? 'bg-accent shadow-[0_0_8px_-2px_var(--color-accent)]' : c.partial ? 'bg-accent/30' : 'bg-base-800', c.date === snap.today && 'ring-2 ring-base-300')}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <Field label="Name">
          <Input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Practise guitar" maxLength={40} />
        </Field>

        <Field label="Icon">
          <div className="flex flex-wrap gap-1.5">
            {[...new Set([d.icon, ...PICKABLE_ICONS])].map((n) => (
              <button key={n} type="button" onClick={() => set({ icon: n })} className={cn('h-10 w-10 rounded-xl flex items-center justify-center border', d.icon === n ? 'border-accent bg-accent-bg text-accent' : 'border-base-700 bg-base-850 text-base-300')} aria-label={n}>
                <Icon name={n} size={18} />
              </button>
            ))}
          </div>
        </Field>

        <Field label="Category">
          <Chips value={d.category} onChange={(category) => set({ category })} options={CATEGORIES.map((c) => ({ value: c.id, label: c.label, color: c.color }))} size="sm" />
        </Field>

        <Field label={`XP reward: ${d.xp}`} hint={`Between ${XP_LIMITS.min} and ${XP_LIMITS.max}. Harder or longer habits deserve more.`}>
          <input type="range" min={XP_LIMITS.min} max={XP_LIMITS.max} value={d.xp} onChange={(e) => set({ xp: Number(e.target.value) })} className="w-full accent-[var(--color-accent)] h-8" aria-label="XP reward" />
        </Field>

        <Field label="Scheduled days">
          <DayPicker value={d.days} onChange={(days) => set({ days })} />
        </Field>

        {d.link === 'manual' && (
          <Field label="Type">
            <Chips
              value={isCount ? 'count' : 'tick'}
              onChange={(v) => set(v === 'tick' ? { target: 1, unit: null, step: 1 } : { target: Math.max(2, d.target), unit: d.unit ?? 'min', step: d.step || 5 })}
              options={[
                { value: 'tick', label: 'Tick when done' },
                { value: 'count', label: 'Reach a target' },
              ]}
            />
          </Field>
        )}
        {(isCount || d.link !== 'manual') && (
          <div className="grid grid-cols-3 gap-2">
            <Field label="Target">
              <Input type="number" inputMode="numeric" min={1} value={d.target} onChange={(e) => set({ target: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Unit">
              <Input value={d.unit ?? ''} disabled={d.link !== 'manual'} onChange={(e) => set({ unit: e.target.value.slice(0, 10) || null })} placeholder="min" />
            </Field>
            <Field label="Step">
              <Input type="number" inputMode="numeric" min={1} value={d.step} disabled={d.link !== 'manual' && d.link !== 'water' && d.link !== 'meals' && d.link !== 'fruitveg'} onChange={(e) => set({ step: Number(e.target.value) || 1 })} />
            </Field>
          </div>
        )}
        {LINK_NOTE[d.link] && <p className="text-xs text-base-400 -mt-2">{LINK_NOTE[d.link]}</p>}

        <Button size="lg" className="w-full" onClick={save}>
          {habit ? 'Save changes' : 'Add habit'}
        </Button>
        {habit && (
          <>
            <SectionTitle>Manage</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {habit.active ? (
                <Button variant="secondary" onClick={async () => { await archiveHabit(habit.id); toast('Paused. History and XP kept', 'info'); navigate(-1); }}>
                  <Pause size={16} /> Pause
                </Button>
              ) : (
                <Button variant="secondary" onClick={async () => { await restoreHabit(habit.id); toast('Resumed from today'); }}>
                  <Play size={16} /> Resume
                </Button>
              )}
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} /> Delete
              </Button>
            </div>
            <p className="text-xs text-base-400">Pausing keeps the history. Deleting removes its history but you keep the XP you earned.</p>
            <Dialog open={confirmDelete} onOpenChange={setConfirmDelete} title={`Delete "${habit.name}"?`} description="Its history is removed. XP you've earned stays.">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                <Button variant="danger" onClick={async () => { await deleteHabit(habit.id); navigate('/habits', { replace: true }); }}>Delete</Button>
              </div>
            </Dialog>
          </>
        )}
      </Page>
    </>
  );
}
