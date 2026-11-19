import { useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toaster';
import { SectionTitle } from '@/components/life/Visuals';
import { addDaysStr, weekStartOf, type LifeContext } from '@/lib/life/engine';
import { BUILTIN_HABITS, DOMAIN_LABELS, HABITS, habitCap, habitState, isUnlocked, withStatus, type HabitSpec, type HabitState } from '@/lib/life/habits';
import type { CustomHabitDef, Domain, HabitId, LifeProfile } from '@/lib/life/types';

const STATE_LABEL: Record<HabitState, string> = { active: 'Active', paused: 'Paused', trackOnly: 'Track only', removed: 'Removed', upcoming: 'Starts Monday' };
const STATE_BADGE: Record<HabitState, 'accent' | 'neutral' | 'warn' | 'info' | 'danger'> = { active: 'accent', paused: 'warn', trackOnly: 'info', removed: 'neutral', upcoming: 'info' };
type Action = 'active' | 'paused' | 'trackOnly' | 'removed';

const selectCls = 'h-11 w-full rounded-xl bg-base-850 border border-base-700 px-3 text-sm text-base-50';

/** Change one habit's status. Pauses live in pausedHabits; removed / track-only are dated so history keeps its score. */
function statusPatch(profile: LifeProfile, id: HabitId, to: Action, today: string): Partial<LifeProfile> {
  const paused = profile.pausedHabits.filter((x) => x !== id);
  if (to === 'paused') return { pausedHabits: [...paused, id], habitStatus: withStatus(profile, id, 'active', today) };
  return { pausedHabits: paused, habitStatus: withStatus(profile, id, to, today) };
}

export function HabitEditor({ ctx }: { ctx: LifeContext }) {
  const { profile, today } = ctx;
  const toast = useToast();
  const [editing, setEditing] = useState<HabitSpec | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<{ id: HabitId; to: Action } | null>(null);

  const unlocked = HABITS.filter((h) => (h.custom ? true : isUnlocked(h, profile.level, profile)));
  const stateOf = (h: HabitSpec) => habitState(profile, h, today);
  const scored = unlocked.filter((h) => ['active', 'upcoming'].includes(stateOf(h)));
  const cap = habitCap(profile.level);

  async function change(id: HabitId, to: Action, makeRoom?: { id: HabitId; to: Action }) {
    let p = profile;
    if (makeRoom) p = { ...p, ...statusPatch(p, makeRoom.id, makeRoom.to, today) };
    await db.lifeProfile.update('life', statusPatch(p, id, to, today));
    setPending(null);
    toast(to === 'active' ? 'Habit back on' : `Habit ${STATE_LABEL[to].toLowerCase()} from today — earlier weeks keep their scores`);
  }

  function request(h: HabitSpec, to: Action) {
    const wasScored = ['active', 'upcoming'].includes(stateOf(h));
    if (to === 'active' && !wasScored && scored.length >= cap) setPending({ id: h.id, to });
    else change(h.id, to);
  }

  return (
    <>
      <SectionTitle right={<button onClick={() => setAdding(true)} className="text-xs text-accent">+ Add habit</button>}>Edit habits</SectionTitle>
      <Card className="p-4 flex flex-col gap-2">
        <p className="text-[11px] text-base-500">
          {scored.length} of {cap} scored habits at Level {profile.level}. Track only = still logged and shown, not scored. Removed = hidden. Changes start today; past weeks keep their scores.
        </p>
        {unlocked.map((h) => {
          const st = stateOf(h);
          return (
            <div key={h.id} className="flex items-center gap-2 border-t border-base-800 pt-2">
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${st === 'removed' ? 'text-base-500 line-through' : 'text-base-100'}`}>{h.name}</p>
                <Badge variant={STATE_BADGE[st]}>{STATE_LABEL[st]}</Badge>
                {h.custom && <span className="text-[10px] text-base-500 ml-1.5">your habit</span>}
              </div>
              <select
                aria-label={`Status of ${h.name}`}
                value={st === 'upcoming' ? 'active' : st}
                onChange={(e) => request(h, e.target.value as Action)}
                className="h-9 rounded-lg bg-base-850 border border-base-700 px-2 text-xs text-base-100"
              >
                <option value="active">Active</option>
                <option value="paused">Pause</option>
                <option value="trackOnly">Track only</option>
                <option value="removed">Remove</option>
              </select>
              <button onClick={() => setEditing(h)} className="h-9 w-9 flex items-center justify-center text-base-400 hover:text-base-100" aria-label={`Edit ${h.name}`}>
                <Pencil size={15} />
              </button>
            </div>
          );
        })}
      </Card>

      <SupplementsCard profile={profile} />

      {editing && <EditDialog spec={editing} profile={profile} onClose={() => setEditing(null)} />}
      {adding && (
        <AddDialog
          profile={profile}
          today={today}
          overCap={scored.length >= cap}
          candidates={scored}
          onClose={() => setAdding(false)}
          onSave={async (def, room) => {
            let p: LifeProfile = { ...profile, customHabits: [...(profile.customHabits ?? []), def] };
            if (room) p = { ...p, ...statusPatch(p, room.id, room.to, today) };
            await db.lifeProfile.update('life', { customHabits: p.customHabits, pausedHabits: p.pausedHabits, habitStatus: p.habitStatus });
            setAdding(false);
            toast(`"${def.name}" added — scored from Monday`);
          }}
        />
      )}
      {pending && (
        <Dialog open onOpenChange={(o) => !o && setPending(null)} title="Make room first" description={`You're at ${cap} scored habits. Adding more tends to lower adherence on all of them — swap one out.`}>
          <MakeRoom candidates={scored} onPick={(room) => change(pending.id, pending.to, room)} />
        </Dialog>
      )}
    </>
  );
}

function MakeRoom({ candidates, onPick }: { candidates: HabitSpec[]; onPick: (room: { id: HabitId; to: Action }) => void }) {
  const [id, setId] = useState<HabitId>(candidates[candidates.length - 1]?.id ?? 'sleep');
  const [to, setTo] = useState<Action>('paused');
  return (
    <div className="flex flex-col gap-3">
      <select value={id} onChange={(e) => setId(e.target.value as HabitId)} className={selectCls} aria-label="Habit to swap out">
        {candidates.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
      <select value={to} onChange={(e) => setTo(e.target.value as Action)} className={selectCls} aria-label="What to do with it">
        <option value="paused">Pause it</option>
        <option value="trackOnly">Make it track only</option>
        <option value="removed">Remove it</option>
      </select>
      <Button onClick={() => onPick({ id, to })}>Swap</Button>
    </div>
  );
}

function EditDialog({ spec, profile, onClose }: { spec: HabitSpec; profile: LifeProfile; onClose: () => void }) {
  const builtin = BUILTIN_HABITS.find((h) => h.id === spec.id);
  const custom = profile.customHabits?.find((c) => c.id === spec.id);
  const t = spec.targets[profile.level];
  const numeric = ['minutes', 'count', 'steps', 'hours'].includes(spec.input);
  const [f, setF] = useState({ name: spec.name, trigger: spec.trigger, why: spec.why, min: String(t.min), ideal: String(t.ideal), perWeek: String(t.perWeek) });
  const changedTargets = Number(f.min) !== t.min || Number(f.ideal) !== t.ideal || Number(f.perWeek) !== t.perWeek;

  async function save() {
    const targets = { min: Number(f.min), ideal: Number(f.ideal), perWeek: Math.min(7, Math.max(1, Number(f.perWeek))) };
    if (custom) {
      const next = { ...custom, name: f.name.trim() || custom.name, trigger: f.trigger, why: f.why, ...targets };
      await db.lifeProfile.update('life', { customHabits: (profile.customHabits ?? []).map((c) => (c.id === custom.id ? next : c)) });
    } else if (builtin) {
      const o = { ...(profile.habitOverrides?.[spec.id] ?? {}) };
      o.name = f.name.trim() && f.name.trim() !== builtin.name ? f.name.trim() : undefined;
      o.trigger = f.trigger !== builtin.trigger ? f.trigger : undefined;
      o.why = f.why !== builtin.why ? f.why : undefined;
      if (numeric && changedTargets) o.targets = targets;
      await db.lifeProfile.update('life', { habitOverrides: { ...(profile.habitOverrides ?? {}), [spec.id]: o } });
    }
    onClose();
  }

  async function reset() {
    const o = { ...(profile.habitOverrides ?? {}) };
    const keep = o[spec.id]?.startDate; // a start date protects past weeks' scores — keep it
    if (keep) o[spec.id] = { startDate: keep };
    else delete o[spec.id];
    await db.lifeProfile.update('life', { habitOverrides: o });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Edit ${spec.name}`} description={builtin ? 'Your edits apply from now; reset brings back the original.' : undefined}>
      <div className="flex flex-col gap-3">
        <Field label="Name">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Trigger / cue">
          <Input value={f.trigger} onChange={(e) => setF({ ...f, trigger: e.target.value })} />
        </Field>
        <Field label="Why it matters">
          <Textarea rows={3} value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} />
        </Field>
        {numeric && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Field label={`Minimum (${spec.unit})`}>
                <Input type="number" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} />
              </Field>
              <Field label={`Ideal (${spec.unit})`}>
                <Input type="number" value={f.ideal} onChange={(e) => setF({ ...f, ideal: e.target.value })} />
              </Field>
              <Field label="Days / week">
                <Input type="number" min={1} max={7} value={f.perWeek} onChange={(e) => setF({ ...f, perWeek: e.target.value })} />
              </Field>
            </div>
            {builtin && <p className="text-[11px] text-base-500 -mt-1">Changing targets fixes them at every level (the automatic level-ups won't change them until you reset).</p>}
          </>
        )}
        {!numeric && custom && (
          <Field label="Days / week">
            <Input type="number" min={1} max={7} value={f.perWeek} onChange={(e) => setF({ ...f, perWeek: e.target.value })} />
          </Field>
        )}
        <Button onClick={save} disabled={numeric && !(Number(f.ideal) >= Number(f.min) && Number(f.min) >= 0)}>
          Save
        </Button>
        {builtin && Object.keys(profile.habitOverrides?.[spec.id] ?? {}).some((k) => k !== 'startDate') && (
          <Button variant="ghost" onClick={reset}>
            Reset to original
          </Button>
        )}
      </div>
    </Dialog>
  );
}

function AddDialog({
  profile,
  today,
  overCap,
  candidates,
  onClose,
  onSave,
}: {
  profile: LifeProfile;
  today: string;
  overCap: boolean;
  candidates: HabitSpec[];
  onClose: () => void;
  onSave: (def: CustomHabitDef, room?: { id: HabitId; to: Action }) => void;
}) {
  const goals = profile.goals.filter((g) => g.tier === 'd90' || g.tier === 'y1');
  const [f, setF] = useState({ name: '', input: 'bool' as CustomHabitDef['input'], unit: '', min: '1', ideal: '1', perWeek: '7', domain: 'health' as Domain, why: '', trigger: '', goalLink: goals[0]?.id ?? '' });
  const [room, setRoom] = useState<{ id: HabitId; to: Action }>({ id: candidates[candidates.length - 1]?.id ?? 'sleep', to: 'paused' });
  const start = addDaysStr(weekStartOf(today), 7);
  const ok = f.name.trim() && (f.input === 'bool' || (Number(f.ideal) >= Number(f.min) && Number(f.min) > 0)) && Number(f.perWeek) >= 1;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Add your own habit" description={`Scored from Monday ${start.slice(8)}/${start.slice(5, 7)} so this week isn't judged against it.`}>
      <div className="flex flex-col gap-3">
        <Field label="Name">
          <Input value={f.name} placeholder="e.g. Cold shower" onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Type">
            <select value={f.input} onChange={(e) => setF({ ...f, input: e.target.value as CustomHabitDef['input'], ...(e.target.value === 'bool' ? { min: '1', ideal: '1' } : {}) })} className={selectCls}>
              <option value="bool">Tick (done / not)</option>
              <option value="minutes">Minutes</option>
              <option value="count">Count</option>
            </select>
          </Field>
          <Field label="Days / week">
            <Input type="number" min={1} max={7} value={f.perWeek} onChange={(e) => setF({ ...f, perWeek: e.target.value })} />
          </Field>
        </div>
        {f.input !== 'bool' && (
          <div className="grid grid-cols-3 gap-2">
            {f.input === 'count' && (
              <Field label="Unit">
                <Input value={f.unit} placeholder="pages" onChange={(e) => setF({ ...f, unit: e.target.value })} />
              </Field>
            )}
            <Field label="Minimum">
              <Input type="number" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} />
            </Field>
            <Field label="Ideal">
              <Input type="number" value={f.ideal} onChange={(e) => setF({ ...f, ideal: e.target.value })} />
            </Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Area">
            <select value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value as Domain })} className={selectCls}>
              {(Object.keys(DOMAIN_LABELS) as Domain[])
                .filter((d) => d !== 'consistency')
                .map((d) => (
                  <option key={d} value={d}>
                    {DOMAIN_LABELS[d]}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Serves goal">
            <select value={f.goalLink} onChange={(e) => setF({ ...f, goalLink: e.target.value })} className={selectCls}>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title.slice(0, 40)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label='Trigger ("After I …, I will …")'>
          <Input value={f.trigger} onChange={(e) => setF({ ...f, trigger: e.target.value })} />
        </Field>
        <Field label="Why it matters">
          <Textarea rows={2} value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} />
        </Field>
        {overCap && (
          <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 flex flex-col gap-2">
            <p className="text-xs text-warn">You're at the habit cap for your level — swap one out so the new habit has room:</p>
            <MakeRoomInline candidates={candidates} value={room} onChange={setRoom} />
          </div>
        )}
        <Button
          disabled={!ok}
          onClick={() =>
            onSave(
              {
                id: `c-${newId()}`,
                name: f.name.trim(),
                input: f.input,
                unit: f.input === 'count' ? f.unit.trim() : f.input === 'minutes' ? 'min' : '',
                min: f.input === 'bool' ? 1 : Number(f.min),
                ideal: f.input === 'bool' ? 1 : Number(f.ideal),
                perWeek: Math.min(7, Math.max(1, Number(f.perWeek))),
                domain: f.domain,
                why: f.why.trim(),
                trigger: f.trigger.trim(),
                goalLink: f.goalLink,
                startDate: start,
              },
              overCap ? room : undefined,
            )
          }
        >
          <Plus size={16} /> Add habit
        </Button>
      </div>
    </Dialog>
  );
}

function MakeRoomInline({ candidates, value, onChange }: { candidates: HabitSpec[]; value: { id: HabitId; to: Action }; onChange: (v: { id: HabitId; to: Action }) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <select value={value.id} onChange={(e) => onChange({ ...value, id: e.target.value as HabitId })} className={selectCls} aria-label="Habit to swap out">
        {candidates.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
      <select value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value as Action })} className={selectCls} aria-label="What to do with it">
        <option value="paused">Pause</option>
        <option value="trackOnly">Track only</option>
        <option value="removed">Remove</option>
      </select>
    </div>
  );
}

function SupplementsCard({ profile }: { profile: LifeProfile }) {
  const list = profile.supplements ?? [];
  const [v, setV] = useState('');
  const save = (supplements: string[]) => db.lifeProfile.update('life', { supplements });
  return (
    <Card className="p-4 flex flex-col gap-2">
      <p className="text-sm font-semibold text-base-50">Daily supplements</p>
      <p className="text-[11px] text-base-500">Shown on the Supplements tick in the check-in. NHS: 10µg vitamin D daily October–March. Check anything new with your GP or pharmacist.</p>
      <div className="flex flex-wrap gap-1.5">
        {list.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-full bg-base-800 pl-3 pr-1 py-1 text-xs text-base-200">
            {s}
            <button onClick={() => save(list.filter((x) => x !== s))} className="h-5 w-5 flex items-center justify-center text-base-500 hover:text-danger" aria-label={`Remove ${s}`}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={v} placeholder="e.g. Omega-3 (1g)" onChange={(e) => setV(e.target.value)} />
        <Button
          size="sm"
          variant="secondary"
          disabled={!v.trim() || list.includes(v.trim())}
          onClick={() => {
            save([...list, v.trim()]);
            setV('');
          }}
        >
          Add
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-base-400">{label}</label>
      {children}
    </div>
  );
}
