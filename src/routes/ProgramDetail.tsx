import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, GripVertical, MoreVertical, Copy, Trash2, ArrowUp, ArrowDown, Play } from 'lucide-react';
import { db } from '@/lib/db';
import { newId, todayStr } from '@/lib/id';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toaster';
import { Dumbbell } from 'lucide-react';

export default function ProgramDetail() {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [programName, setProgramName] = useState('');

  const program = useLiveQuery(() => db.programs.get(programId!), [programId]);
  const workouts = useLiveQuery(
    () => db.workoutTemplates.where('programId').equals(programId!).sortBy('order'),
    [programId],
  );
  const exerciseCounts = useLiveQuery(async () => {
    if (!workouts) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const w of workouts) {
      map.set(w.id, await db.workoutExercises.where('workoutTemplateId').equals(w.id).count());
    }
    return map;
  }, [workouts]);

  if (!program || !workouts) return null;
  const currentProgram = program;
  const active = workouts.filter((w) => !w.archived);

  async function addWorkout() {
    const name = newName.trim();
    if (!name) return;
    await db.workoutTemplates.add({
      id: newId(),
      programId: programId!,
      name,
      order: active.length,
      archived: false,
    });
    setNewName('');
    setCreateOpen(false);
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = active.findIndex((w) => w.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= active.length) return;
    const a = active[idx];
    const b = active[swapIdx];
    await db.transaction('rw', db.workoutTemplates, async () => {
      await db.workoutTemplates.update(a.id, { order: b.order });
      await db.workoutTemplates.update(b.id, { order: a.order });
    });
  }

  async function duplicateWorkout(id: string) {
    const w = active.find((x) => x.id === id);
    if (!w) return;
    const newWorkoutId = newId();
    await db.workoutTemplates.add({ ...w, id: newWorkoutId, name: `${w.name} copy`, order: active.length });
    const exercises = await db.workoutExercises.where('workoutTemplateId').equals(id).toArray();
    for (const ex of exercises) {
      await db.workoutExercises.add({ ...ex, id: newId(), workoutTemplateId: newWorkoutId });
    }
    setMenuFor(null);
    toast('Workout duplicated');
  }

  async function deleteWorkout(id: string) {
    if (!confirm('Delete this workout?')) return;
    await db.workoutExercises.where('workoutTemplateId').equals(id).delete();
    await db.workoutTemplates.delete(id);
    setMenuFor(null);
  }

  async function saveRename() {
    const name = programName.trim();
    if (name) await db.programs.update(currentProgram.id, { name });
    setRenaming(false);
  }

  async function startSession(workoutId: string, workoutName: string) {
    const id = newId();
    await db.sessions.add({
      id,
      workoutTemplateId: workoutId,
      workoutName,
      programId: currentProgram.id,
      programName: currentProgram.name,
      date: todayStr(),
      startedAt: Date.now(),
      completedAt: null,
      notes: '',
      bodyweight: null,
    });
    navigate(`/session/${id}`);
  }

  return (
    <div className="animate-fade-in">
      <TopBar
        title={currentProgram.name}
        back
        right={
          <Button size="icon" variant="ghost" onClick={() => setCreateOpen(true)} aria-label="Add workout">
            <Plus size={20} />
          </Button>
        }
      />
      <div className="px-4 pt-4 pb-24 flex flex-col gap-3">
        <button
          className="text-left text-sm text-base-400 hover:text-accent -mt-1 mb-1"
          onClick={() => {
            setProgramName(currentProgram.name);
            setRenaming(true);
          }}
        >
          Rename program
        </button>

        {active.length === 0 && (
          <EmptyState
            icon={Dumbbell}
            title="No workouts yet"
            description="Add a workout day to this program."
            action={<Button onClick={() => setCreateOpen(true)}>Add workout</Button>}
          />
        )}

        {active.map((w) => (
          <Card key={w.id} className="p-4 relative">
            <div className="flex items-center gap-3">
              <GripVertical size={16} className="text-base-600 shrink-0" />
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => navigate(`/programs/${currentProgram.id}/workouts/${w.id}`)}
              >
                <p className="font-semibold text-base-50 truncate">{w.name}</p>
                <p className="text-sm text-base-400">{exerciseCounts?.get(w.id) ?? 0} exercises</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => startSession(w.id, w.name)} aria-label="Start">
                <Play size={18} className="text-accent" />
              </Button>
              <button
                className="h-9 w-9 flex items-center justify-center rounded-lg text-base-400 hover:bg-base-800"
                onClick={() => setMenuFor(menuFor === w.id ? null : w.id)}
              >
                <MoreVertical size={16} />
              </button>
            </div>
            {menuFor === w.id && (
              <div className="absolute top-14 right-3 z-10 w-44 rounded-xl bg-base-850 border border-base-700 shadow-2xl overflow-hidden animate-pop">
                <button
                  className="flex items-center gap-2.5 w-full px-3.5 h-11 text-sm font-medium text-base-100 hover:bg-base-700"
                  onClick={() => {
                    move(w.id, -1);
                    setMenuFor(null);
                  }}
                >
                  <ArrowUp size={16} /> Move up
                </button>
                <button
                  className="flex items-center gap-2.5 w-full px-3.5 h-11 text-sm font-medium text-base-100 hover:bg-base-700"
                  onClick={() => {
                    move(w.id, 1);
                    setMenuFor(null);
                  }}
                >
                  <ArrowDown size={16} /> Move down
                </button>
                <button
                  className="flex items-center gap-2.5 w-full px-3.5 h-11 text-sm font-medium text-base-100 hover:bg-base-700"
                  onClick={() => duplicateWorkout(w.id)}
                >
                  <Copy size={16} /> Duplicate
                </button>
                <button
                  className="flex items-center gap-2.5 w-full px-3.5 h-11 text-sm font-medium text-danger hover:bg-base-700"
                  onClick={() => deleteWorkout(w.id)}
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="New workout">
        <div className="flex flex-col gap-4">
          <Input
            autoFocus
            placeholder="e.g. Push Day"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addWorkout()}
          />
          <Button onClick={addWorkout} disabled={!newName.trim()}>
            Add
          </Button>
        </div>
      </Dialog>

      <Dialog open={renaming} onOpenChange={setRenaming} title="Rename program">
        <div className="flex flex-col gap-4">
          <Input
            autoFocus
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveRename()}
          />
          <Button onClick={saveRename}>Save</Button>
        </div>
      </Dialog>
    </div>
  );
}
