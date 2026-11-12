import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Copy, Minus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toaster';
import { Ring, SectionTitle } from '@/components/life/Visuals';
import { COLORS } from '@/components/life/colors';
import { useLife } from '@/lib/life/useLife';
import { addDaysStr, calorieTargetOn } from '@/lib/life/engine';
import { CALORIE_BANDS, PORTION_GUIDES, currentExpenditure, proteinTargets } from '@/lib/life/nutrition';
import type { FoodItem, FoodLog } from '@/lib/life/types';
import { cn } from '@/lib/cn';
import { syncCheckin } from '@/lib/life/sync';

const r1 = (x: number) => Math.round(x * 10) / 10;

export default function FoodLogPage() {
  const ctx = useLife();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? ctx?.today ?? '';
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<FoodItem | null>(null);
  const [editingEntry, setEditingEntry] = useState<FoodLog | null>(null);
  const [quick, setQuick] = useState({ protein: '', calories: '', name: '' });

  const foods = useLiveQuery(() => db.foods.filter((f) => !f.archived).toArray(), []);
  const logs = useLiveQuery(() => (date ? db.foodLogs.where('date').equals(date).sortBy('createdAt') : []), [date]);
  const yesterdayLogs = useLiveQuery(() => (date ? db.foodLogs.where('date').equals(addDaysStr(date, -1)).toArray() : []), [date]);

  const list = useMemo(() => {
    if (!foods) return { recent: [], all: [] };
    const q = query.trim().toLowerCase();
    const match = foods.filter((f) => !q || f.name.toLowerCase().includes(q) || f.serving.toLowerCase().includes(q));
    const recent = q ? [] : [...match].filter((f) => f.lastUsedAt > 0).sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, 6);
    const recentIds = new Set(recent.map((f) => f.id));
    const all = match.filter((f) => !recentIds.has(f.id)).sort((a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name));
    return { recent, all };
  }, [foods, query]);

  if (!ctx || !logs || !foods) return null;

  const targets = proteinTargets(ctx.profile, ctx.bodyweight, date);
  const protein = Math.round(logs.reduce((a, l) => a + l.protein, 0));
  const withCal = logs.filter((l) => l.calories !== null);
  const calories = withCal.length ? Math.round(withCal.reduce((a, l) => a + l.calories!, 0)) : null;
  const missingCal = logs.length - withCal.length;
  const calUnlocked = !!ctx.profile.calorie?.unlockedAt;
  const calTarget = calorieTargetOn(ctx, date);
  const burn = currentExpenditure(ctx.nutrition, ctx.bodyweight, ctx.today);
  // The minimum is the real target (a success); the ideal is a stretch, so the ring fills at the minimum.
  const status = protein >= targets.ideal ? 'Stretch hit ✓' : protein >= targets.min ? 'Target hit ✓' : `${targets.min - protein}g to target`;
  const perKg = ctx.profile.proteinPerKg ?? { min: 1.8, ideal: 2.0 };
  const isToday = date === ctx.today;

  const go = (n: number) => {
    const d = addDaysStr(date, n);
    if (d <= ctx.today) setParams({ date: d });
  };

  async function addFood(f: FoodItem) {
    const existing = logs!.find((l) => l.foodId === f.id);
    if (existing) await setServings(existing, existing.servings + 1);
    else
      await db.foodLogs.add({ id: newId(), date, foodId: f.id, name: f.name, servings: 1, protein: f.protein, calories: f.calories, createdAt: Date.now() });
    await db.foods.update(f.id, { useCount: f.useCount + 1, lastUsedAt: Date.now() });
    await syncCheckin(date);
    toast(`+${f.protein}g · ${f.name}`);
  }

  async function setServings(l: FoodLog, servings: number) {
    if (servings <= 0) await db.foodLogs.delete(l.id);
    else {
      const per = l.protein / l.servings;
      const perCal = l.calories === null ? null : l.calories / l.servings;
      await db.foodLogs.update(l.id, { servings, protein: r1(per * servings), calories: perCal === null ? null : Math.round(perCal * servings) });
    }
    await syncCheckin(date);
  }

  async function quickAdd() {
    const p = Number(quick.protein);
    if (!(p > 0) && !quick.calories) return;
    await db.foodLogs.add({
      id: newId(),
      date,
      foodId: null,
      name: quick.name.trim() || 'Quick add',
      servings: 1,
      protein: p > 0 ? p : 0,
      calories: quick.calories ? Number(quick.calories) : null,
      createdAt: Date.now(),
    });
    setQuick({ protein: '', calories: '', name: '' });
    await syncCheckin(date);
    toast(`+${p || 0}g added`);
  }

  async function copyYesterday() {
    if (!yesterdayLogs?.length) return;
    const now = Date.now();
    await db.foodLogs.bulkAdd(yesterdayLogs.map((l, i) => ({ ...l, id: newId(), date, createdAt: now + i })));
    await syncCheckin(date);
    toast(`Copied ${yesterdayLogs.length} items from yesterday`);
  }

  return (
    <div className="animate-fade-in">
      <TopBar title="Food log" back />
      <div className="px-4 pt-3 pb-24 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button onClick={() => go(-1)} className="h-9 w-9 flex items-center justify-center rounded-lg text-base-300 hover:bg-base-800" aria-label="Previous day">
            <ChevronLeft size={20} />
          </button>
          <p className="text-sm font-semibold text-base-100">{isToday ? 'Today' : format(parseISO(date), 'EEEE d MMM')}</p>
          <button onClick={() => go(1)} disabled={isToday} className="h-9 w-9 flex items-center justify-center rounded-lg text-base-300 hover:bg-base-800 disabled:opacity-30" aria-label="Next day">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Totals */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <Ring value={protein / targets.min} size={96} stroke={9} color={protein >= targets.min ? COLORS.accent : COLORS.warn}>
              <div className="text-center">
                <p className="text-2xl font-bold text-base-50 tabular-nums leading-none">{protein}g</p>
                <p className="text-[10px] text-base-400 mt-1">protein</p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-semibold', protein >= targets.min ? 'text-accent' : 'text-base-50')}>{status}</p>
              <p className="text-xs text-base-400 mt-0.5">
                Target {targets.min}g · stretch {targets.ideal}g
              </p>
              <p className="text-[11px] text-base-500 mt-0.5">
                {targets.source === 'bodyweight' ? `From ${targets.weight}kg × ${perKg.min} / ${perKg.ideal} g/kg` : 'Manual targets (The System → Nutrition)'}
              </p>
              {(calUnlocked || calories !== null) && (
                <p className="text-xs text-base-200 mt-2">
                  {calories === null ? 'No calories logged' : `${calories.toLocaleString()} kcal`}
                  {calTarget !== null && ` · target ${calTarget - CALORIE_BANDS.min}–${calTarget + CALORIE_BANDS.min}`}
                  {calUnlocked && calTarget === null && ' · awareness phase'}
                  {missingCal > 0 && <span className="block text-[11px] text-warn">{missingCal} item{missingCal === 1 ? '' : 's'} without calories</span>}
                </p>
              )}
              <p className={cn('text-[11px] mt-1', burn.incomplete ? 'text-warn' : 'text-base-500')}>
                {burn.ok
                  ? `Estimated burn ≈ ${burn.maintenance!.toLocaleString()} kcal/day (28-day intake ${burn.avgIntake!.toLocaleString()}, weight ${burn.kgPerWeek! > 0 ? '+' : ''}${burn.kgPerWeek} kg/wk${burn.partialDays ? `, ${burn.partialDays} partial days ignored` : ''})`
                  : `Burn estimate: ${burn.reason}`}
              </p>
            </div>
          </div>
        </Card>

        <ProteinHelper protein={protein} target={targets.min} logs={logs} foods={foods} onAdd={addFood} />

        {/* Logged entries */}
        {logs.length > 0 && (
          <Card className="divide-y divide-base-800">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center gap-2 px-4 py-2.5">
                <button className="min-w-0 flex-1 text-left" onClick={() => setEditingEntry(l)}>
                  <p className="text-sm font-medium text-base-50 truncate">{l.name}</p>
                  <p className="text-xs text-base-400">
                    {r1(l.protein)}g protein
                    {l.calories !== null ? ` · ${l.calories} kcal` : <span className="text-warn"> · no kcal — tap to add</span>}
                    {l.foodId === null && l.calories !== null && <span className="text-base-500"> · not saved as a food</span>}
                  </p>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <IconBtn label="Less" onClick={() => setServings(l, r1(l.servings - 0.5))}>
                    {l.servings <= 0.5 ? <Trash2 size={14} /> : <Minus size={14} />}
                  </IconBtn>
                  <span className="w-9 text-center text-sm font-semibold text-base-100 tabular-nums">{l.servings}×</span>
                  <IconBtn label="More" onClick={() => setServings(l, r1(l.servings + 0.5))}>
                    <Plus size={14} />
                  </IconBtn>
                </div>
              </div>
            ))}
          </Card>
        )}
        {logs.length === 0 && (yesterdayLogs?.length ?? 0) > 0 && (
          <Button variant="secondary" onClick={copyYesterday}>
            <Copy size={15} /> Copy yesterday's {yesterdayLogs!.length} items
          </Button>
        )}

        {/* Quick add */}
        <SectionTitle>Quick add (eating out / unsure)</SectionTitle>
        <Card className="p-4 flex flex-col gap-2.5">
          <div className="flex gap-1.5 flex-wrap">
            {PORTION_GUIDES.map((g) => (
              <button
                key={g.label}
                onClick={() => setQuick({ ...quick, protein: String((Number(quick.protein) || 0) + g.protein), name: quick.name || 'Estimated meal' })}
                className="h-8 px-2.5 rounded-lg text-xs border bg-base-850 text-base-300 border-base-700"
              >
                {g.label} ≈ {g.protein}g
              </button>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input type="number" inputMode="decimal" placeholder="Protein g" value={quick.protein} onChange={(e) => setQuick({ ...quick, protein: e.target.value })} />
            <Input type="number" inputMode="numeric" placeholder="kcal (opt.)" value={quick.calories} onChange={(e) => setQuick({ ...quick, calories: e.target.value })} />
            <Button onClick={quickAdd} disabled={!quick.protein && !quick.calories}>
              Add
            </Button>
          </div>
          <Input placeholder="Name (optional)" value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} />
        </Card>

        {/* My foods */}
        <SectionTitle right={<button className="text-xs text-accent flex items-center gap-0.5" onClick={() => setEditing(blankFood())}><Plus size={12} /> New food / meal</button>}>
          My foods — tap to add
        </SectionTitle>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-500" />
          <Input className="pl-9" placeholder="Search foods" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {list.recent.length > 0 && <FoodList title="Recent" foods={list.recent} onAdd={addFood} onEdit={setEditing} />}
        <FoodList title={list.recent.length ? 'All foods' : undefined} foods={list.all} onAdd={addFood} onEdit={setEditing} />
        {foods.length > 0 && list.all.length === 0 && list.recent.length === 0 && (
          <p className="text-xs text-base-500 text-center py-2">No match. Use quick add, or create it as a new food.</p>
        )}
        <p className="text-[11px] text-base-500">
          Starter values are approximate UK averages. Edit them to your brands and portions, and save your regular meals (e.g. "Overnight oats + whey") as one food so logging is one tap.
        </p>
      </div>

      {editing && <FoodDialog food={editing} onClose={() => setEditing(null)} />}
      {editingEntry && <EntryDialog entry={editingEntry} foods={foods} onClose={() => setEditingEntry(null)} />}
    </div>
  );
}

const blankFood = (): FoodItem => ({ id: '', name: '', serving: '1 serving', protein: 0, calories: null, archived: false, useCount: 0, lastUsedAt: 0, createdAt: 0 });

function FoodList({ title, foods, onAdd, onEdit }: { title?: string; foods: FoodItem[]; onAdd: (f: FoodItem) => void; onEdit: (f: FoodItem) => void }) {
  if (!foods.length) return null;
  return (
    <div>
      {title && <p className="text-[11px] text-base-500 mb-1.5">{title}</p>}
      <Card className="divide-y divide-base-800">
        {foods.map((f) => (
          <div key={f.id} className="flex items-center">
            <button onClick={() => onAdd(f)} className="flex-1 min-w-0 flex items-center gap-3 px-4 py-2.5 text-left active:bg-base-850">
              <div className="h-8 w-8 rounded-full bg-accent-bg flex items-center justify-center shrink-0">
                <Plus size={15} className="text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-base-50 truncate">{f.name}</p>
                <p className="text-xs text-base-400 truncate">
                  {f.serving} · {f.protein}g{f.calories !== null && ` · ${f.calories} kcal`}
                </p>
              </div>
            </button>
            <button onClick={() => onEdit(f)} className="h-10 w-10 flex items-center justify-center text-base-500 hover:text-base-100 shrink-0" aria-label={`Edit ${f.name}`}>
              <Pencil size={14} />
            </button>
          </div>
        ))}
      </Card>
    </div>
  );
}

function FoodDialog({ food, onClose }: { food: FoodItem; onClose: () => void }) {
  const isNew = !food.id;
  const [f, setF] = useState({ name: food.name, serving: food.serving, protein: food.protein ? String(food.protein) : '', calories: food.calories === null ? '' : String(food.calories) });
  const valid = f.name.trim() && Number(f.protein) >= 0 && f.protein !== '';

  async function save() {
    const patch = { name: f.name.trim(), serving: f.serving.trim() || '1 serving', protein: Number(f.protein), calories: f.calories === '' ? null : Number(f.calories) };
    if (isNew) await db.foods.add({ ...food, ...patch, id: newId(), createdAt: Date.now() });
    else await db.foods.update(food.id, patch);
    onClose();
  }

  async function archive() {
    if (!confirm(`Remove "${food.name}" from My foods? Past log entries are kept.`)) return;
    await db.foods.update(food.id, { archived: true });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={isNew ? 'New food or meal' : 'Edit food'} description="Values per one serving. Past log entries keep the values they were logged with.">
      <div className="flex flex-col gap-3">
        <Field label="Name">
          <Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Overnight oats + whey" />
        </Field>
        <Field label="Serving">
          <Input value={f.serving} onChange={(e) => setF({ ...f, serving: e.target.value })} placeholder="e.g. 1 bowl, 150g, 1 pot" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Protein (g)">
            <Input type="number" inputMode="decimal" value={f.protein} onChange={(e) => setF({ ...f, protein: e.target.value })} />
          </Field>
          <Field label="Calories (kcal, optional)">
            <Input type="number" inputMode="numeric" value={f.calories} onChange={(e) => setF({ ...f, calories: e.target.value })} />
          </Field>
        </div>
        <Button onClick={save} disabled={!valid}>
          Save
        </Button>
        {!isNew && (
          <Button variant="danger" onClick={archive}>
            <Trash2 size={15} /> Remove from My foods
          </Button>
        )}
      </div>
    </Dialog>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} className="h-8 w-8 rounded-lg bg-base-850 border border-base-700 flex items-center justify-center text-base-200 active:bg-base-700">
      {children}
    </button>
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

/** Fix an entry: add missing calories, link it to a saved food, or save it as a new food. */
function EntryDialog({ entry, foods, onClose }: { entry: FoodLog; foods: FoodItem[]; onClose: () => void }) {
  const toast = useToast();
  const [e, setE] = useState({ name: entry.name, protein: String(r1(entry.protein)), calories: entry.calories === null ? '' : String(entry.calories) });
  const [q, setQ] = useState('');
  const matches = q.trim() ? foods.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];

  async function done(msg: string) {
    await syncCheckin(entry.date);
    toast(msg);
    onClose();
  }
  async function save() {
    await db.foodLogs.update(entry.id, { name: e.name.trim() || entry.name, protein: Number(e.protein) || 0, calories: e.calories === '' ? null : Number(e.calories) });
    await done('Entry updated');
  }
  async function link(f: FoodItem) {
    await db.foodLogs.update(entry.id, {
      foodId: f.id,
      name: f.name,
      protein: r1(f.protein * entry.servings),
      calories: f.calories === null ? null : Math.round(f.calories * entry.servings),
    });
    await db.foods.update(f.id, { useCount: f.useCount + 1, lastUsedAt: Date.now() });
    await done(`Linked to ${f.name}`);
  }
  async function saveAsFood() {
    const per = (x: number) => r1(x / entry.servings);
    const id = newId();
    await db.foods.add({
      id,
      name: e.name.trim() || entry.name,
      serving: '1 serving',
      protein: per(Number(e.protein) || 0),
      calories: e.calories === '' ? null : Math.round(Number(e.calories) / entry.servings),
      archived: false,
      useCount: 1,
      lastUsedAt: Date.now(),
      createdAt: Date.now(),
    });
    await db.foodLogs.update(entry.id, { foodId: id, name: e.name.trim() || entry.name, protein: Number(e.protein) || 0, calories: e.calories === '' ? null : Number(e.calories) });
    await done('Saved to My foods — one tap next time');
  }
  async function remove() {
    await db.foodLogs.delete(entry.id);
    await done('Entry removed');
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Edit entry" description={`${entry.servings} serving${entry.servings === 1 ? '' : 's'} · values are totals for this entry`}>
      <div className="flex flex-col gap-3">
        <Field label="Name">
          <Input value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Protein (g)">
            <Input type="number" inputMode="decimal" value={e.protein} onChange={(x) => setE({ ...e, protein: x.target.value })} />
          </Field>
          <Field label="Calories (kcal)">
            <Input type="number" inputMode="numeric" value={e.calories} placeholder="add" onChange={(x) => setE({ ...e, calories: x.target.value })} />
          </Field>
        </div>
        <Button onClick={save}>Save</Button>
        {entry.foodId === null && (
          <>
            <Button variant="secondary" onClick={saveAsFood}>
              <Plus size={15} /> Save as a new food (one tap next time)
            </Button>
            <Field label="…or link to an existing saved food">
              <Input placeholder="Search My foods" value={q} onChange={(x) => setQ(x.target.value)} />
            </Field>
            {matches.map((f) => (
              <button key={f.id} onClick={() => link(f)} className="text-left px-3 py-2 rounded-xl bg-base-850 border border-base-700">
                <p className="text-sm text-base-50">{f.name}</p>
                <p className="text-[11px] text-base-400">
                  {f.serving} · {f.protein}g{f.calories !== null && ` · ${f.calories} kcal`} → × {entry.servings}
                </p>
              </button>
            ))}
          </>
        )}
        <Button variant="danger" onClick={remove}>
          <Trash2 size={15} /> Remove entry
        </Button>
      </div>
    </Dialog>
  );
}

/** Protein per 100 kcal: how "efficient" a food is for hitting the target. */
const density = (f: Pick<FoodItem, 'protein' | 'calories'>) => (f.protein / Math.max(50, f.calories ?? 200)) * 100;

/**
 * When short of the target: how much is left and the best options from *your own* foods,
 * plus a swap idea for a low-protein, high-calorie item you logged today (e.g. a croissant).
 */
function ProteinHelper({ protein, target, logs, foods, onAdd }: { protein: number; target: number; logs: FoodLog[]; foods: FoodItem[]; onAdd: (f: FoodItem) => void }) {
  const gap = target - protein;
  const options = foods
    .filter((f) => f.protein >= 15)
    .sort((a, b) => (b.useCount > 0 ? 1 : 0) - (a.useCount > 0 ? 1 : 0) || density(b) - density(a))
    .slice(0, 3);
  const byId = new Map(foods.map((f) => [f.id, f]));
  const low = logs
    .map((l) => (l.foodId ? byId.get(l.foodId) : undefined))
    .filter((f): f is FoodItem => !!f && (f.calories ?? 0) >= 200 && f.protein * 4 < (f.calories ?? 0) * 0.1)
    .sort((a, b) => (b.calories ?? 0) - (a.calories ?? 0))[0];
  const swap = low ? foods.filter((f) => f.protein >= low.protein + 15 && (f.calories ?? 9999) <= (low.calories ?? 0) + 100).sort((a, b) => b.useCount - a.useCount || density(b) - density(a))[0] : undefined; // familiar foods first
  if (gap <= 0 && !swap) return null;
  return (
    <Card className="p-4">
      {gap > 0 && (
        <>
          <p className="text-sm font-semibold text-base-50">{gap}g to go — best options from your foods</p>
          <div className="flex flex-col gap-1.5 mt-2">
            {options.map((f) => (
              <button key={f.id} onClick={() => onAdd(f)} className="flex items-center justify-between rounded-xl bg-base-850 border border-base-700 px-3 py-2 text-left">
                <span className="text-sm text-base-100 truncate">{f.name}</span>
                <span className="text-xs text-accent shrink-0 ml-2">
                  +{f.protein}g{f.calories !== null && ` · ${f.calories} kcal`}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      {low && swap && (
        <p className={cn('text-xs text-base-300 leading-relaxed', gap > 0 && 'mt-3')}>
          <span className="font-semibold text-warn">Swap idea: </span>
          {low.name} gives {low.protein}g protein for {low.calories} kcal. Swapping one for {swap.name} adds +{swap.protein - low.protein}g protein
          {swap.calories !== null && low.calories !== null && (swap.calories <= low.calories ? ` and saves ${low.calories - swap.calories} kcal` : ` for ${swap.calories - low.calories} more kcal`)}.
        </p>
      )}
    </Card>
  );
}
