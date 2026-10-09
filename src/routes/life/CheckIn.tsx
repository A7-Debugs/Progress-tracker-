import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Check, ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react';
import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toaster';
import { Chips, Collapsible, Scale5, TriPicker } from '@/components/life/Visuals';
import { useLife } from '@/lib/life/useLife';
import { HABIT_BY_ID, formatTarget } from '@/lib/life/habits';
import { addDaysStr, scheduleOn, targetExtras } from '@/lib/life/engine';
import type { DailyCheckin, HabitId, Hit } from '@/lib/life/types';

type Form = Omit<DailyCheckin, 'id' | 'date' | 'createdAt' | 'updatedAt'> & { bodyweight: number | null };

const blank = (): Form => ({
  sleepHours: null,
  trainingMinutes: null,
  steps: null,
  deepWorkMinutes: null,
  workHours: null,
  energy: null,
  mood: null,
  stress: null,
  habits: {},
  minutes: {},
  commitments: '',
  bodyweight: null,
});

const toNum = (v: string) => (v.trim() === '' ? null : Number(v));

export default function CheckIn() {
  const navigate = useNavigate();
  const toast = useToast();
  const ctx = useLife();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? ctx?.today ?? '';
  const [form, setForm] = useState<Form>(blank);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Load the existing entry once per date (don't clobber in-progress edits on live-query refresh).
  useEffect(() => {
    if (!ctx || !date || loadedFor === date) return;
    const c = ctx.byDate.get(date);
    const bw = ctx.bodyweight.find((b) => b.date === date)?.weight ?? null;
    setForm(c ? { ...blank(), ...c, bodyweight: bw } : { ...blank(), bodyweight: bw });
    setLoadedFor(date);
  }, [ctx, date, loadedFor]);

  const sched = useMemo(() => {
    if (!ctx || !date) return null;
    const s = (id: HabitId) => {
      const spec = HABIT_BY_ID.get(id)!;
      const t = scheduleOn(ctx, spec, date);
      return t ? { spec, t, label: formatTarget(spec, t, targetExtras(ctx, date)) } : null;
    };
    return {
      sleep: s('sleep'),
      train: s('train'),
      steps: s('steps'),
      deepWork: s('deepWork'),
      protein: s('protein'),
      plan: s('plan'),
      read: s('read'),
      shutdown: s('shutdown'),
      journal: s('journal'),
      mobility: s('mobility'),
      morningWalk: s('morningWalk'),
      connect: s('connect'),
      vitamins: s('vitamins'),
      appSession: ctx.sessionMinutes.get(date) ?? null,
    };
  }, [ctx, date]);

  if (!ctx || !sched) return null;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setHit = (id: HabitId, v: Hit) => setForm((f) => ({ ...f, habits: { ...f.habits, [id]: v } }));
  const setBool = (id: HabitId, v: boolean) => setForm((f) => ({ ...f, habits: { ...f.habits, [id]: v ? 'ideal' : 'miss' } }));
  const go = (n: number) => {
    const d = addDaysStr(date, n);
    if (d > ctx.today) return;
    setParams({ date: d });
  };

  async function save() {
    const existing = ctx!.byDate.get(date);
    const { bodyweight, ...rest } = form;
    const now = Date.now();
    await db.checkins.put({ ...rest, id: date, date, createdAt: existing?.createdAt ?? now, updatedAt: now });
    if (bodyweight !== null) {
      const bw = await db.bodyweightLogs.where('date').equals(date).first();
      if (bw) await db.bodyweightLogs.update(bw.id, { weight: bodyweight });
      else
        await db.bodyweightLogs.add({
          id: newId(),
          date,
          weight: bodyweight,
          bodyFat: null,
          calories: null,
          protein: null,
          sleepHours: form.sleepHours,
          waterLiters: null,
          mood: form.mood,
          energy: form.energy,
          createdAt: now,
        });
    }
    toast('Check-in saved');
    navigate('/');
  }

  const isToday = date === ctx.today;

  return (
    <div className="animate-fade-in">
      <TopBar title="Daily check-in" back />
      <div className="px-4 pt-3 pb-28 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button onClick={() => go(-1)} className="h-9 w-9 flex items-center justify-center rounded-lg text-base-300 hover:bg-base-800" aria-label="Previous day">
            <ChevronLeft size={20} />
          </button>
          <p className="text-sm font-semibold text-base-100">{isToday ? 'Today' : format(parseISO(date), 'EEEE d MMM')}</p>
          <button onClick={() => go(1)} disabled={isToday} className="h-9 w-9 flex items-center justify-center rounded-lg text-base-300 hover:bg-base-800 disabled:opacity-30" aria-label="Next day">
            <ChevronRight size={20} />
          </button>
        </div>

        <Q title="Sleep" sub={sched.sleep ? `Min ${sched.sleep.label.min} · Ideal ${sched.sleep.label.ideal}` : undefined}>
          <div className="flex gap-2 items-center">
            <Input type="number" inputMode="decimal" step="0.25" placeholder="hours" value={form.sleepHours ?? ''} onChange={(e) => set('sleepHours', toNum(e.target.value))} className="w-24 text-center" />
            <Chips values={[6, 6.5, 7, 7.5, 8, 8.5]} current={form.sleepHours} onPick={(v) => set('sleepHours', v)} />
          </div>
        </Q>

        {sched.morningWalk && (
          <Q title="Morning light walk" sub={`Min ${sched.morningWalk.label.min} · Ideal ${sched.morningWalk.label.ideal}`}>
            <Chips
              values={[0, 5, 10, 15, 20, 30]}
              current={form.minutes.morningWalk ?? null}
              onPick={(v) => setForm((f) => ({ ...f, minutes: { ...f.minutes, morningWalk: v } }))}
              suffix=" min"
            />
          </Q>
        )}

        <Q title="Training" sub={sched.train ? `Min ${sched.train.label.min} · ${sched.train.t.perWeek}x/week` : undefined}>
          {sched.appSession ? (
            <p className="text-sm text-accent flex items-center gap-2">
              <Dumbbell size={15} /> Workout logged in the app ({Math.max(...sched.appSession)} min) — counted automatically.
            </p>
          ) : (
            <div className="flex gap-2 items-center">
              <Input type="number" inputMode="numeric" placeholder="min" value={form.trainingMinutes ?? ''} onChange={(e) => set('trainingMinutes', toNum(e.target.value))} className="w-24 text-center" />
              <Chips values={[0, 20, 30, 45, 60, 90]} current={form.trainingMinutes} onPick={(v) => set('trainingMinutes', v)} />
            </div>
          )}
        </Q>

        <Q title="Steps" sub={sched.steps ? `Min ${sched.steps.label.min} · Ideal ${sched.steps.label.ideal}` : undefined}>
          <Input type="number" inputMode="numeric" placeholder="e.g. 8,500" value={form.steps ?? ''} onChange={(e) => set('steps', toNum(e.target.value))} />
        </Q>

        <Q title="Deep work / study" sub={sched.deepWork ? `Min ${sched.deepWork.label.min} · Ideal ${sched.deepWork.label.ideal} · ${sched.deepWork.t.perWeek}x/week` : undefined}>
          <div className="flex gap-2 items-center flex-wrap">
            <Input type="number" inputMode="numeric" placeholder="min" value={form.deepWorkMinutes ?? ''} onChange={(e) => set('deepWorkMinutes', toNum(e.target.value))} className="w-24 text-center" />
            <Chips values={[0, 15, 25, 45, 60, 90, 120]} current={form.deepWorkMinutes} onPick={(v) => set('deepWorkMinutes', v)} />
          </div>
        </Q>

        {sched.protein && (
          <Q title="Nutrition: protein" sub={`Min ${sched.protein.label.min} · Ideal ${sched.protein.label.ideal}`}>
            {ctx.nutrition.get(date)?.entries ? (
              <button onClick={() => navigate(`/food?date=${date}`)} className="w-full text-left">
                <p className="text-sm text-accent">
                  From food log: {ctx.nutrition.get(date)!.protein}g
                  {ctx.nutrition.get(date)!.calories != null && ` · ${ctx.nutrition.get(date)!.calories} kcal`} — counted automatically.
                </p>
                <p className="text-[11px] text-base-500 mt-0.5">Tap to open the food log</p>
              </button>
            ) : (
              <>
                <TriPicker value={form.habits.protein} onChange={(v) => setHit('protein', v)} minLabel={sched.protein.label.min} idealLabel={sched.protein.label.ideal} />
                <button onClick={() => navigate(`/food?date=${date}`)} className="text-xs text-accent mt-2">
                  Or log food for an exact total →
                </button>
              </>
            )}
          </Q>
        )}

        {sched.plan && (
          <Q title="Planned tomorrow?" sub="Log it on the evening you plan">
            <TriPicker value={form.habits.plan} onChange={(v) => setHit('plan', v)} minLabel="Top 3" idealLabel="+ time-blocked" />
          </Q>
        )}

        {(['read', 'shutdown', 'journal'] as const).map((id) => {
          const s = sched[id];
          if (!s) return null;
          return (
            <Q key={id} title={s.spec.name}>
              <TriPicker value={form.habits[id]} onChange={(v) => setHit(id, v)} minLabel={s.spec.minLabel} idealLabel={s.spec.idealLabel} />
            </Q>
          );
        })}

        {sched.mobility && (
          <Q title="Mobility / prehab" sub={`Min ${sched.mobility.label.min}`}>
            <Chips values={[0, 5, 10, 15, 20]} current={form.minutes.mobility ?? null} onPick={(v) => setForm((f) => ({ ...f, minutes: { ...f.minutes, mobility: v } }))} suffix=" min" />
          </Q>
        )}

        <Card className="p-4 flex flex-col gap-3">
          {sched.vitamins && (
            <Toggle label="Vitamins taken" sub="Habit · with breakfast" checked={form.habits.vitamins === 'ideal'} onChange={(v) => setBool('vitamins', v)} />
          )}
          <Toggle label="Meaningful time with someone" sub={sched.connect ? 'Habit · 3x/week' : 'Tracked for your Relationships score'} checked={form.habits.connect === 'ideal'} onChange={(v) => setBool('connect', v)} />
          <Toggle label="Weekly money check done" sub="Once a week (auto-ticks when you update a finance snapshot)" checked={form.habits.moneyReview === 'ideal'} onChange={(v) => setBool('moneyReview', v)} />
        </Card>

        <Q title="Energy">
          <Scale5 value={form.energy} onChange={(v) => set('energy', v)} low="Drained" high="Charged" />
        </Q>
        <Q title="Mood">
          <Scale5 value={form.mood} onChange={(v) => set('mood', v)} low="Low" high="Great" />
        </Q>
        <Q title="Stress">
          <Scale5 value={form.stress} onChange={(v) => set('stress', v)} low="Calm" high="Overloaded" />
        </Q>

        <Card className="p-4">
          <Collapsible title="Optional context (work hours, bodyweight, commitments)">
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Work hours">
                  <Input type="number" inputMode="decimal" value={form.workHours ?? ''} onChange={(e) => set('workHours', toNum(e.target.value))} />
                </Field>
                <Field label="Bodyweight (kg)">
                  <Input type="number" inputMode="decimal" value={form.bodyweight ?? ''} onChange={(e) => set('bodyweight', toNum(e.target.value))} />
                </Field>
              </div>
              <Field label="Major commitments / notes">
                <Textarea rows={2} value={form.commitments} onChange={(e) => set('commitments', e.target.value)} placeholder="Deadline, travel, event, illness…" />
              </Field>
            </div>
          </Collapsible>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-base-950/90 backdrop-blur-lg border-t border-base-800 safe-bottom">
        <div className="mx-auto max-w-lg p-3">
          <Button size="lg" className="w-full" onClick={save}>
            <Check size={18} /> Save check-in
          </Button>
        </div>
      </div>
    </div>
  );
}

function Q({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-2 mb-2.5">
        <p className="text-sm font-semibold text-base-50">{title}</p>
        {sub && <p className="text-[11px] text-base-500 text-right">{sub}</p>}
      </div>
      {children}
    </Card>
  );
}

function Toggle({ label, sub, checked, onChange }: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-base-50">{label}</p>
        <p className="text-[11px] text-base-500">{sub}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
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
