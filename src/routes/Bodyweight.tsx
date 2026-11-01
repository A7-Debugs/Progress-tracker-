import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import { Plus, Scale, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { newId, todayStr } from '@/lib/id';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressChart } from '@/components/charts/ProgressChart';
import type { BodyweightLog } from '@/lib/types';

// Sleep, mood and energy live in the daily check-in; protein and calories in the food log.
// This log keeps only what is measured here, so nothing is typed twice.
const EMPTY_FORM = {
  date: todayStr(),
  weight: '',
  bodyFat: '',
  waterLiters: '',
};

export default function Bodyweight() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const logs = useLiveQuery(() => db.bodyweightLogs.orderBy('date').toArray(), []);
  const checkins = useLiveQuery(async () => new Map((await db.checkins.toArray()).map((c) => [c.date, c])), []);
  const food = useLiveQuery(async () => {
    const m = new Map<string, { protein: number; kcal: number | null }>();
    for (const l of await db.foodLogs.toArray()) {
      const d = m.get(l.date) ?? { protein: 0, kcal: null };
      d.protein += l.protein;
      if (l.calories !== null) d.kcal = (d.kcal ?? 0) + l.calories;
      m.set(l.date, d);
    }
    return m;
  }, []);

  const chartData = (logs ?? [])
    .filter((l) => l.weight !== null)
    .map((l) => ({ label: format(parseISO(l.date), 'MMM d'), value: l.weight! }));

  async function save() {
    const existing = logs?.find((l) => l.date === form.date);
    const payload: BodyweightLog = {
      id: existing?.id ?? newId(),
      date: form.date,
      weight: form.weight ? Number(form.weight) : null,
      bodyFat: form.bodyFat ? Number(form.bodyFat) : null,
      calories: existing?.calories ?? null,
      protein: existing?.protein ?? null,
      sleepHours: existing?.sleepHours ?? null,
      waterLiters: form.waterLiters ? Number(form.waterLiters) : null,
      mood: existing?.mood ?? null,
      energy: existing?.energy ?? null,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await db.bodyweightLogs.put(payload);
    setForm(EMPTY_FORM);
    setOpen(false);
  }

  async function remove(id: string) {
    await db.bodyweightLogs.delete(id);
  }

  if (!logs) return null;

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Bodyweight & Health"
        back
        right={
          <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Log entry">
            <Plus size={20} />
          </Button>
        }
      />
      <div className="px-4 pt-3 pb-24 flex flex-col gap-4">
        {logs.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No entries yet"
            description="Log your bodyweight to track trends over time."
            action={<Button onClick={() => setOpen(true)}>Log entry</Button>}
          />
        ) : (
          <>
            <Card className="p-4">
              <p className="text-sm font-semibold text-base-50 mb-2">Bodyweight trend</p>
              <ProgressChart data={chartData} unit="kg" />
            </Card>
            <div className="flex flex-col gap-2">
              {[...logs].reverse().map((l) => (
                <Card key={l.id} className="p-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-base-100">{format(parseISO(l.date), 'EEE, MMM d')}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-base-400 mt-0.5">
                      {l.weight !== null && <span>{l.weight}kg</span>}
                      {l.bodyFat !== null && <span>{l.bodyFat}% BF</span>}
                      {l.waterLiters !== null && <span>{l.waterLiters}L water</span>}
                    </div>
                    <DayContext c={checkins?.get(l.date)} f={food?.get(l.date)} legacy={l} />
                  </div>
                  <button onClick={() => remove(l.id)} className="h-8 w-8 flex items-center justify-center text-base-500 hover:text-danger shrink-0">
                    <Trash2 size={15} />
                  </button>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen} title="Log entry">
        <div className="flex flex-col gap-3">
          <Field label="Date">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <p className="text-[11px] text-base-500">Sleep, mood and energy come from your daily check-in; protein and calories from the food log.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weight (kg)">
              <Input type="number" inputMode="decimal" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </Field>
            <Field label="Body fat (%)">
              <Input type="number" inputMode="decimal" value={form.bodyFat} onChange={(e) => setForm({ ...form, bodyFat: e.target.value })} />
            </Field>
            <Field label="Water (L)">
              <Input type="number" inputMode="decimal" value={form.waterLiters} onChange={(e) => setForm({ ...form, waterLiters: e.target.value })} />
            </Field>
          </div>
          <Button onClick={save}>Save entry</Button>
        </div>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-base-400">{label}</label>
      {children}
    </div>
  );
}

/** Read-only context for the day from the check-in and food log (falls back to older values stored here). */
function DayContext({ c, f, legacy }: { c?: import('@/lib/life/types').DailyCheckin; f?: { protein: number; kcal: number | null }; legacy: BodyweightLog }) {
  const sleep = c?.sleepHours ?? legacy.sleepHours;
  const mood = c?.mood ?? legacy.mood;
  const energy = c?.energy ?? legacy.energy;
  const protein = f ? Math.round(f.protein) : legacy.protein;
  const kcal = f?.kcal ?? legacy.calories;
  if (sleep == null && mood == null && energy == null && protein == null && kcal == null) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-base-500 mt-0.5">
      {sleep != null && <span>{sleep}h sleep</span>}
      {mood != null && <span>Mood {mood}/5</span>}
      {energy != null && <span>Energy {energy}/5</span>}
      {protein != null && <span>{protein}g protein</span>}
      {kcal != null && <span>{Math.round(kcal)} kcal</span>}
    </div>
  );
}
