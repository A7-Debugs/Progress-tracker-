import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowUp, ArrowDown, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { NumberField } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dumbbell } from 'lucide-react';
import { ExercisePickerDialog } from '@/components/workout/ExercisePickerDialog';
import type { ExerciseDef, WorkoutExercise } from '@/lib/types';

export default function WorkoutEditor() {
  const { workoutId } = useParams<{ programId: string; workoutId: string }>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const workout = useLiveQuery(() => db.workoutTemplates.get(workoutId!), [workoutId]);
  const items = useLiveQuery(async () => {
    const rows = await db.workoutExercises.where('workoutTemplateId').equals(workoutId!).sortBy('order');
    const defs = await db.exerciseDefs.bulkGet(rows.map((r) => r.exerciseDefId));
    return rows.map((r, i) => ({ row: r, def: defs[i] })).filter((x): x is { row: WorkoutExercise; def: ExerciseDef } => !!x.def);
  }, [workoutId]);

  if (!workout || !items) return null;

  async function addExercise(def: ExerciseDef) {
    await db.workoutExercises.add({
      id: newId(),
      workoutTemplateId: workoutId!,
      exerciseDefId: def.id,
      order: items!.length,
      targetSets: 3,
      targetRepLow: 8,
      targetRepHigh: 12,
      rpeTarget: 8,
      restTimeSec: def.restTimeSec || 90,
    });
  }

  async function removeExercise(id: string) {
    await db.workoutExercises.delete(id);
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = items!.findIndex((x) => x.row.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= items!.length) return;
    const a = items![idx].row;
    const b = items![swapIdx].row;
    await db.transaction('rw', db.workoutExercises, async () => {
      await db.workoutExercises.update(a.id, { order: b.order });
      await db.workoutExercises.update(b.id, { order: a.order });
    });
  }

  async function updateField(id: string, patch: Partial<WorkoutExercise>) {
    await db.workoutExercises.update(id, patch);
  }

  return (
    <div className="animate-fade-in min-h-dvh">
      <TopBar
        title={workout.name}
        back
        right={
          <Button size="icon" variant="ghost" onClick={() => setPickerOpen(true)} aria-label="Add exercise">
            <Plus size={20} />
          </Button>
        }
      />
      <div className="px-4 pt-4 pb-24 flex flex-col gap-3">
        {items.length === 0 && (
          <EmptyState
            icon={Dumbbell}
            title="No exercises yet"
            description="Add exercises to build this workout."
            action={<Button onClick={() => setPickerOpen(true)}>Add exercise</Button>}
          />
        )}
        {items.map(({ row, def }, i) => {
          const isOpen = expanded === row.id;
          return (
            <Card key={row.id} className="overflow-hidden">
              <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : row.id)}
              >
                <span className="h-6 w-6 rounded-full bg-base-800 text-base-400 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base-50 truncate">{def.name}</p>
                  <p className="text-sm text-base-400">
                    {row.targetSets} sets × {row.targetRepLow}-{row.targetRepHigh} reps
                    {row.rpeTarget ? ` @ RPE ${row.rpeTarget}` : ''}
                  </p>
                </div>
                {isOpen ? <ChevronUp size={18} className="text-base-400" /> : <ChevronDown size={18} className="text-base-400" />}
              </div>
              {isOpen && (
                <div className="px-4 pb-4 flex flex-col gap-3 border-t border-base-800 pt-3 animate-fade-in">
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Sets">
                      <NumberField
                        value={row.targetSets}
                        onChange={(e) => updateField(row.id, { targetSets: Number(e.target.value) })}
                        className="h-10 text-base"
                      />
                    </Field>
                    <Field label="Min reps">
                      <NumberField
                        value={row.targetRepLow}
                        onChange={(e) => updateField(row.id, { targetRepLow: Number(e.target.value) })}
                        className="h-10 text-base"
                      />
                    </Field>
                    <Field label="Max reps">
                      <NumberField
                        value={row.targetRepHigh}
                        onChange={(e) => updateField(row.id, { targetRepHigh: Number(e.target.value) })}
                        className="h-10 text-base"
                      />
                    </Field>
                    <Field label="RPE target">
                      <NumberField
                        value={row.rpeTarget ?? ''}
                        onChange={(e) => updateField(row.id, { rpeTarget: e.target.value ? Number(e.target.value) : null })}
                        className="h-10 text-base"
                      />
                    </Field>
                    <Field label="Rest (sec)">
                      <NumberField
                        value={row.restTimeSec ?? ''}
                        onChange={(e) => updateField(row.id, { restTimeSec: e.target.value ? Number(e.target.value) : null })}
                        className="h-10 text-base"
                      />
                    </Field>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => move(row.id, -1)}>
                      <ArrowUp size={14} /> Up
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => move(row.id, 1)}>
                      <ArrowDown size={14} /> Down
                    </Button>
                    <Button size="sm" variant="danger" className="ml-auto" onClick={() => removeExercise(row.id)}>
                      <Trash2 size={14} /> Remove
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <ExercisePickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onPick={addExercise} />
    </div>
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
