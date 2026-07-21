import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Plus, ArrowLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { MUSCLE_GROUPS, type ExerciseDef } from '@/lib/types';

export function ExercisePickerDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (def: ExerciseDef) => void;
}) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const exercises = useLiveQuery(() => db.exerciseDefs.orderBy('name').toArray(), []);

  const filtered = useMemo(() => {
    if (!exercises) return [];
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (e) => e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q),
    );
  }, [exercises, query]);

  function close() {
    setQuery('');
    setCreating(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={close} title={creating ? 'New exercise' : 'Add exercise'} className="max-h-[80dvh] flex flex-col">
      {creating ? (
        <CreateExerciseForm
          initialName={query}
          onBack={() => setCreating(false)}
          onCreated={(def) => {
            onPick(def);
            close();
          }}
        />
      ) : (
        <div className="flex flex-col gap-3 min-h-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
            <Input
              autoFocus
              placeholder="Search exercises…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto -mx-1 px-1 flex flex-col gap-1 max-h-[50dvh]">
            {filtered.map((e) => (
              <button
                key={e.id}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl hover:bg-base-800 text-left"
                onClick={() => {
                  onPick(e);
                  close();
                }}
              >
                <span className="text-[15px] text-base-50 font-medium">{e.name}</span>
                <span className="text-xs text-base-400">{e.muscleGroup}</span>
              </button>
            ))}
            {exercises && filtered.length === 0 && (
              <p className="text-sm text-base-400 py-6 text-center">No matches.</p>
            )}
          </div>
          <Button variant="secondary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Create new exercise
          </Button>
        </div>
      )}
    </Dialog>
  );
}

function CreateExerciseForm({
  initialName,
  onBack,
  onCreated,
}: {
  initialName: string;
  onBack: () => void;
  onCreated: (def: ExerciseDef) => void;
}) {
  const [name, setName] = useState(initialName);
  const [muscleGroup, setMuscleGroup] = useState<string>('Chest');
  const [equipment, setEquipment] = useState('');

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const def: ExerciseDef = {
      id: newId(),
      name: trimmed,
      muscleGroup: muscleGroup as ExerciseDef['muscleGroup'],
      equipment: equipment.trim(),
      notes: '',
      restTimeSec: 90,
      tempo: '',
      videoUrl: '',
      archived: false,
      createdAt: Date.now(),
    };
    await db.exerciseDefs.add(def);
    onCreated(def);
  }

  return (
    <div className="flex flex-col gap-3">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-base-400 -mt-2 mb-1 self-start">
        <ArrowLeft size={14} /> Back to search
      </button>
      <label className="text-xs font-medium text-base-400">Exercise name</label>
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cable Fly" />
      <label className="text-xs font-medium text-base-400 -mb-2">Muscle group</label>
      <Select
        value={muscleGroup}
        onValueChange={setMuscleGroup}
        options={MUSCLE_GROUPS.map((m) => ({ value: m, label: m }))}
      />
      <label className="text-xs font-medium text-base-400 -mb-2">Equipment</label>
      <Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="e.g. Cable, Dumbbell" />
      <Button onClick={create} disabled={!name.trim()} className="mt-2">
        Add exercise
      </Button>
    </div>
  );
}
