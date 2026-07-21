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

const EMPTY_FORM = {
  date: todayStr(),
  weight: '',
  bodyFat: '',
  calories: '',
  protein: '',
  sleepHours: '',
  waterLiters: '',
  mood: '',
  energy: '',
};

export default function Bodyweight() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const logs = useLiveQuery(() => db.bodyweightLogs.orderBy('date').toArray(), []);

  const chartData = (logs ?? [])
    .filter((l) => l.weight !== null)
    .map((l) => ({ label: format(parseISO(l.date), 'MMM d'), value: l.weight! }));

  async function save() {
    if (!form.weight && !form.bodyFat && !form.calories) {
      // require at least weight typically
    }
    const existing = logs?.find((l) => l.date === form.date);
    const payload: BodyweightLog = {
      id: existing?.id ?? newId(),
      date: form.date,
      weight: form.weight ? Number(form.weight) : null,
      bodyFat: form.bodyFat ? Number(form.bodyFat) : null,
      calories: form.calories ? Number(form.calories) : null,
      protein: form.protein ? Number(form.protein) : null,
      sleepHours: form.sleepHours ? Number(form.sleepHours) : null,
      waterLiters: form.waterLiters ? Number(form.waterLiters) : null,
      mood: form.mood ? Number(form.mood) : null,
      energy: form.energy ? Number(form.energy) : null,
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
                      {l.calories !== null && <span>{l.calories} kcal</span>}
                      {l.protein !== null && <span>{l.protein}g protein</span>}
                      {l.sleepHours !== null && <span>{l.sleepHours}h sleep</span>}
                      {l.waterLiters !== null && <span>{l.waterLiters}L water</span>}
                      {l.mood !== null && <span>Mood {l.mood}/5</span>}
                      {l.energy !== null && <span>Energy {l.energy}/5</span>}
                    </div>
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weight (kg)">
              <Input type="number" inputMode="decimal" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </Field>
            <Field label="Body fat (%)">
              <Input type="number" inputMode="decimal" value={form.bodyFat} onChange={(e) => setForm({ ...form, bodyFat: e.target.value })} />
            </Field>
            <Field label="Calories">
              <Input type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} />
            </Field>
            <Field label="Protein (g)">
              <Input type="number" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} />
            </Field>
            <Field label="Sleep (hrs)">
              <Input type="number" inputMode="decimal" value={form.sleepHours} onChange={(e) => setForm({ ...form, sleepHours: e.target.value })} />
            </Field>
            <Field label="Water (L)">
              <Input type="number" inputMode="decimal" value={form.waterLiters} onChange={(e) => setForm({ ...form, waterLiters: e.target.value })} />
            </Field>
            <Field label="Mood (1-5)">
              <Input type="number" min={1} max={5} value={form.mood} onChange={(e) => setForm({ ...form, mood: e.target.value })} />
            </Field>
            <Field label="Energy (1-5)">
              <Input type="number" min={1} max={5} value={form.energy} onChange={(e) => setForm({ ...form, energy: e.target.value })} />
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
