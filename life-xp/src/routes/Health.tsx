import { useMemo, useState } from 'react';
import { Activity, Apple, BedDouble, GlassWater, Minus, Plus, Trash2, UtensilsCrossed, HeartPulse } from 'lucide-react';
import { useSnapshot } from '@/lib/hooks';
import { Loading, Page, PageHeader } from '@/components/layout';
import { SectionTitle, StatTile } from '@/components/game';
import { Bars, ChartCard } from '@/components/charts';
import { EXERCISE_LABEL, ExerciseDialog, SleepDialog } from '@/components/LogDialogs';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toaster';
import { deleteExercise, deleteSleep, setNutrition, updateSettings } from '@/lib/actions';
import { addDays, dateRange, fmtDay, fmtDuration, fmtShort, toMinutes, weekStart, DAY_LETTER, dayOfWeek } from '@/lib/dates';
import type { Snapshot } from '@/lib/snapshot';

/** Sleep consistency: share of nights whose bedtime is within 45 min of your typical (median) bedtime. */
export function sleepConsistency(s: Snapshot, days = 14): number | null {
  const logs = [...s.sleepLogs.values()].filter((x) => x.date > addDays(s.today, -days));
  if (logs.length < 3) return null;
  // Shift times so that 18:00 → 0, making evening/after-midnight bedtimes comparable.
  const norm = logs.map((l) => (toMinutes(l.bedtime) - 18 * 60 + 1440) % 1440).sort((a, b) => a - b);
  const median = norm[Math.floor(norm.length / 2)];
  return norm.filter((n) => Math.abs(n - median) <= 45).length / norm.length;
}

export default function Health() {
  const s = useSnapshot();
  const toast = useToast();
  const [sleepOpen, setSleepOpen] = useState(false);
  const [exOpen, setExOpen] = useState(false);

  const data = useMemo(() => {
    if (!s) return null;
    const last14 = dateRange(addDays(s.today, -13), s.today);
    const sleepChart = last14.map((d) => ({ label: DAY_LETTER[dayOfWeek(d)], date: fmtShort(d), hours: s.sleepLogs.has(d) ? +(s.sleepLogs.get(d)!.minutes / 60).toFixed(1) : null }));
    const week = [...s.sleepLogs.values()].filter((x) => x.date > addDays(s.today, -7));
    const avg7 = week.length ? week.reduce((a, x) => a + x.minutes, 0) / week.length : null;
    const prevWeek = [...s.sleepLogs.values()].filter((x) => x.date > addDays(s.today, -14) && x.date <= addDays(s.today, -7));
    const avgPrev = prevWeek.length ? prevWeek.reduce((a, x) => a + x.minutes, 0) / prevWeek.length : null;
    const ws = weekStart(s.today);
    const weeks = Array.from({ length: 8 }, (_, i) => addDays(ws, -7 * (7 - i)));
    const exChart = weeks.map((w) => {
      const end = addDays(w, 6);
      const logs = s.exerciseLogs.filter((e) => e.date >= w && e.date <= end);
      return { label: fmtShort(w), minutes: logs.reduce((a, e) => a + e.minutes, 0), days: new Set(logs.map((e) => e.date)).size };
    });
    const thisWeek = exChart.at(-1)!;
    const n7 = dateRange(addDays(s.today, -6), s.today).map((d) => s.nutrition.get(d));
    const avg = (k: 'water' | 'meals' | 'fruitVeg') => {
      const v = n7.filter(Boolean).map((n) => n![k]);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    return { sleepChart, avg7, avgPrev, consistency: sleepConsistency(s), exChart, thisWeek, water: avg('water'), meals: avg('meals'), fv: avg('fruitVeg') };
  }, [s]);

  if (!s || !data) return <Loading />;

  if (!s.settings.healthEnabled) {
    return (
      <>
        <PageHeader title="Health" back />
        <Page>
          <div className="rounded-2xl border border-dashed border-base-700 p-6 text-center mt-4">
            <HeartPulse className="mx-auto text-mint" />
            <p className="font-bold text-base-50 mt-2">Health tracking is off</p>
            <p className="text-sm text-base-400 mt-1">It's optional. Turn it on to track sleep, activity, water and meals.</p>
            <Button className="mt-4" onClick={() => updateSettings({ healthEnabled: true })}>
              Turn on
            </Button>
          </div>
        </Page>
      </>
    );
  }

  const n = s.nutrition.get(s.today) ?? { water: 0, meals: 0, fruitVeg: 0 };
  const lastNight = s.sleepLogs.get(s.today);
  const recentSleep = [...s.sleepLogs.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  const recentEx = [...s.exerciseLogs].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)).slice(0, 6);
  const step = (k: 'water' | 'meals' | 'fruitVeg', d: number) => setNutrition(s.today, { [k]: Math.max(0, n[k] + d) }).catch((e) => toast(e.message, 'warn'));

  return (
    <>
      <PageHeader title="Health" subtitle="Sleep · activity · food. Optional and private." />
      <Page className="pb-8">
        {/* SLEEP */}
        <SectionTitle right={<Button size="sm" variant="secondary" onClick={() => setSleepOpen(true)}><BedDouble size={15} /> Record</Button>}>Sleep</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Last night" value={lastNight ? fmtDuration(lastNight.minutes) : '–'} sub={lastNight ? `${lastNight.bedtime} → ${lastNight.wake}` : 'not logged'} color={lastNight ? (lastNight.minutes >= 480 ? '#3ee8a4' : '#ffb454') : undefined} />
          <StatTile label="7-day avg" value={data.avg7 === null ? '–' : fmtDuration(data.avg7)} sub={data.avgPrev !== null && data.avg7 !== null ? `${data.avg7 >= data.avgPrev ? '▲' : '▼'} ${fmtDuration(Math.abs(data.avg7 - data.avgPrev))} vs last wk` : 'aim 8–10h'} />
          <StatTile label="Consistency" value={data.consistency === null ? '–' : `${Math.round(data.consistency * 100)}%`} sub="same bedtime" />
        </div>
        <div className="mt-2">
          <ChartCard title="Last 14 nights" subtitle="Green band = 8–10 hours, the teenage sweet spot" empty={s.sleepLogs.size === 0 ? 'Record your first night to see your sleep chart.' : null}>
            <Bars data={data.sleepChart} series={[{ key: 'hours', name: 'Hours', color: '#7b8cff' }]} unit="h" yMax={12} band={[8, 10]} />
          </ChartCard>
        </div>
        {recentSleep.length > 0 && (
          <div className="mt-2 rounded-2xl bg-base-900 border border-base-800 divide-y divide-base-800">
            {recentSleep.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="text-base-300 w-24">{fmtDay(l.date)}</span>
                <span className="flex-1 text-base-400 tabular-nums">{l.bedtime} → {l.wake}</span>
                <span className="font-bold tabular-nums text-base-100">{fmtDuration(l.minutes)}</span>
                <button onClick={() => deleteSleep(l.date)} className="h-8 w-8 flex items-center justify-center text-base-500" aria-label="Delete sleep entry">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* EXERCISE */}
        <SectionTitle right={<Button size="sm" variant="secondary" onClick={() => setExOpen(true)}><Activity size={15} /> Log</Button>}>Activity</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="This week" value={`${data.thisWeek.minutes} min`} color="#ff8a3d" />
          <StatTile label="Active days" value={`${data.thisWeek.days}/7`} sub="this week" />
        </div>
        <div className="mt-2">
          <ChartCard title="Weekly activity minutes" subtitle="Last 8 weeks" empty={s.exerciseLogs.length === 0 ? 'Log your first activity: PE, walking and sport all count.' : null}>
            <Bars data={data.exChart} series={[{ key: 'minutes', name: 'Minutes', color: '#ff8a3d' }]} unit=" min" />
          </ChartCard>
        </div>
        {recentEx.length > 0 && (
          <div className="mt-2 rounded-2xl bg-base-900 border border-base-800 divide-y divide-base-800">
            {recentEx.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="text-base-300 w-24">{fmtDay(e.date)}</span>
                <span className="flex-1 text-base-100 truncate">{EXERCISE_LABEL[e.type]}</span>
                <span className="font-bold tabular-nums text-base-100">{e.minutes} min</span>
                <button onClick={() => deleteExercise(e.id)} className="h-8 w-8 flex items-center justify-center text-base-500" aria-label="Delete activity">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-base-500 mt-2">More isn't always better: rest days help your body get stronger. There are no rewards for overdoing it.</p>

        {/* NUTRITION */}
        <SectionTitle>Fuel today</SectionTitle>
        <div className="space-y-2">
          <Stepper icon={<GlassWater size={18} />} color="#3fe3ff" label="Water" unit="glasses" value={n.water} avg={data.water} onStep={(d) => step('water', d)} />
          <Stepper icon={<UtensilsCrossed size={18} />} color="#3ee8a4" label="Balanced meals" unit="meals" value={n.meals} avg={data.meals} onStep={(d) => step('meals', d)} />
          <Stepper icon={<Apple size={18} />} color="#ff5fa2" label="Fruit & veg" unit="portions" value={n.fruitVeg} avg={data.fv} onStep={(d) => step('fruitVeg', d)} />
        </div>
        <div className="mt-3 rounded-2xl bg-base-900 border border-base-800 p-3 text-xs text-base-300 space-y-1.5">
          <p className="font-bold text-base-100 text-sm">Fuel tips</p>
          <p>A balanced plate: about a third starchy carbs (pasta, rice, bread), a third fruit & veg, plus some protein (eggs, beans, meat, fish, tofu) and dairy or alternatives.</p>
          <p>Five portions of fruit & veg a day. Frozen and tinned count. Breakfast helps concentration at school.</p>
          <p>Around 6–8 drinks a day, more when it's hot or you're active. Water and milk are best.</p>
          <p className="text-base-500">LIFE XP never tracks calories or weight. Food is fuel, not a score.</p>
        </div>
      </Page>
      <SleepDialog open={sleepOpen} onOpenChange={setSleepOpen} />
      <ExerciseDialog open={exOpen} onOpenChange={setExOpen} />
    </>
  );
}

function Stepper({ icon, color, label, unit, value, avg, onStep }: { icon: React.ReactNode; color: string; label: string; unit: string; value: number; avg: number | null; onStep: (d: number) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-base-900 border border-base-800 p-3">
      <span className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${color}22`, color }}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-base-50">{label}</p>
        <p className="text-xs text-base-400">{avg === null ? unit : `7-day avg ${avg.toFixed(1)} ${unit}`}</p>
      </div>
      <button onClick={() => onStep(-1)} disabled={value <= 0} className="h-10 w-10 rounded-xl bg-base-800 flex items-center justify-center disabled:opacity-30" aria-label={`Less ${label}`}>
        <Minus size={16} />
      </button>
      <span className="w-7 text-center text-xl font-black tabular-nums text-base-50">{value}</span>
      <button onClick={() => onStep(1)} className="h-10 w-10 rounded-xl flex items-center justify-center text-base-950" style={{ background: color }} aria-label={`More ${label}`}>
        <Plus size={16} strokeWidth={2.6} />
      </button>
    </div>
  );
}
