import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import * as A from '@/lib/actions';
import type { Difficulty, Goal, Horizon, Measurement, Priority } from '@/lib/types';
import { HORIZONS, HORIZON_RANK, liveGoals } from '@/lib/goals';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Field, Segmented } from '../ui/Chips';
import { Input, NumberField, Textarea } from '../ui/Input';
import { NONE, Select } from '../ui/Select';
import { useToast } from '../ui/Toaster';

type Draft = A.GoalDraft;

const MEASUREMENTS: { value: Measurement; label: string; hint: string }[] = [
  { value: 'milestones', label: 'Milestones', hint: 'Progress = share of milestones achieved (weighted by size).' },
  { value: 'numeric', label: 'A number', hint: 'Progress = where your measured value sits between start and target (e.g. £ saved, kg, books).' },
  { value: 'hybrid', label: 'Both', hint: 'Half milestones, half measured value.' },
  { value: 'children', label: 'Sub-goals', hint: 'Progress = average of the goals underneath it. Best for visions and annual objectives.' },
  { value: 'binary', label: 'Done / not done', hint: '0% until you mark it achieved.' },
];

function blank(d: Partial<Draft> = {}): Draft {
  return { title: '', description: '', categoryId: 'personal', horizon: 'annual', parentId: null, targetOutcome: '', startingPosition: '', measurement: 'milestones', unit: '', startValue: 0, targetValue: 100, targetDate: null, priority: 2, difficulty: 'medium', ...d };
}

export function GoalEditor({ open, onOpenChange, goal, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; goal?: Goal; defaults?: Partial<Draft> }) {
  const { s } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [d, setD] = useState<Draft>(() => blank(defaults));
  useEffect(() => {
    if (open) setD(goal ? { ...goal } : blank(defaults));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal?.id]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const parents = liveGoals(s).filter((g) => g.id !== goal?.id && HORIZON_RANK[g.horizon] < HORIZON_RANK[d.horizon] && g.status !== 'completed');
  const numeric = d.measurement === 'numeric' || d.measurement === 'hybrid';

  async function save() {
    try {
      const id = await A.saveGoal(d);
      toast(goal ? 'Goal updated' : 'Goal created');
      onOpenChange(false);
      if (!goal) navigate(`/goals/${id}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={goal ? 'Edit goal' : 'New goal'}
      description="Make it specific and measurable. Tasks support a goal; progress comes from outcomes."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!d.title.trim()}>
            {goal ? 'Save' : 'Create goal'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Goal">
          <Input autoFocus value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Become a qualified ACCA accountant" />
        </Field>
        <Field label="Level">
          <Select value={d.horizon} onValueChange={(v) => setD((x) => ({ ...x, horizon: v as Horizon, parentId: null, measurement: v === 'vision' ? 'children' : x.measurement === 'children' && v === 'weekly' ? 'milestones' : x.measurement }))} options={HORIZONS.map((h) => ({ value: h.id, label: h.label }))} />
        </Field>
        {d.horizon !== 'vision' && (
          <Field label="Part of" hint="Link it to a bigger goal to build the hierarchy.">
            <Select value={d.parentId ?? NONE} onValueChange={(v) => set('parentId', v === NONE ? null : v)} options={[{ value: NONE, label: 'Top level' }, ...parents.map((g) => ({ value: g.id, label: `${HORIZONS.find((h) => h.id === g.horizon)!.short}: ${g.title}` }))]} />
          </Field>
        )}
        <Field label="Life area">
          <Select value={d.categoryId} onValueChange={(v) => set('categoryId', v)} options={s.categories.filter((c) => !c.archived || c.id === d.categoryId).map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
        <Field label="Description">
          <Textarea value={d.description} onChange={(e) => set('description', e.target.value)} placeholder="Why it matters" rows={2} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Starting position">
            <Textarea rows={2} value={d.startingPosition} onChange={(e) => set('startingPosition', e.target.value)} placeholder="Where you are now" />
          </Field>
          <Field label="Target outcome">
            <Textarea rows={2} value={d.targetOutcome} onChange={(e) => set('targetOutcome', e.target.value)} placeholder="What done looks like" />
          </Field>
        </div>
        <Field label="How progress is measured" hint={MEASUREMENTS.find((m) => m.value === d.measurement)?.hint}>
          <Segmented<Measurement> size="sm" value={d.measurement} onChange={(v) => set('measurement', v)} options={MEASUREMENTS.map((m) => ({ value: m.value, label: m.label }))} />
        </Field>
        {numeric && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Start">
              <NumberField value={d.startValue} onChange={(e) => set('startValue', Number(e.target.value))} />
            </Field>
            <Field label="Target">
              <NumberField value={d.targetValue} onChange={(e) => set('targetValue', Number(e.target.value))} />
            </Field>
            <Field label="Unit">
              <Input value={d.unit} onChange={(e) => set('unit', e.target.value)} placeholder="£, kg, books" />
            </Field>
          </div>
        )}
        {numeric && goal && <p className="text-xs text-fg-3 -mt-2">Record new values from the goal page; each update is kept for the progress chart.</p>}
        <Field label="Target date">
          <Input type="date" value={d.targetDate ?? ''} onChange={(e) => set('targetDate', e.target.value || null)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <Select value={String(d.priority)} onValueChange={(v) => set('priority', Number(v) as Priority)} options={[1, 2, 3, 4].map((p) => ({ value: String(p), label: ['', 'P1 · Critical', 'P2 · High', 'P3 · Medium', 'P4 · Low'][p] }))} />
          </Field>
          <Field label="Difficulty">
            <Select value={d.difficulty} onValueChange={(v) => set('difficulty', v as Difficulty)} options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
