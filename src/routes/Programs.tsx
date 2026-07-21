import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Plus, LayoutGrid, MoreVertical, CheckCircle2, Copy, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toaster';

export default function Programs() {
  const navigate = useNavigate();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const programs = useLiveQuery(() => db.programs.orderBy('order').toArray(), []);
  const workoutCounts = useLiveQuery(async () => {
    const all = await db.workoutTemplates.toArray();
    const map = new Map<string, number>();
    for (const w of all.filter((w) => !w.archived)) map.set(w.programId, (map.get(w.programId) ?? 0) + 1);
    return map;
  }, []);

  async function createProgram() {
    const name = newName.trim();
    if (!name) return;
    const count = await db.programs.count();
    await db.programs.add({
      id: newId(),
      name,
      active: count === 0,
      archived: false,
      order: count,
      createdAt: Date.now(),
    });
    setNewName('');
    setCreateOpen(false);
    toast('Program created');
  }

  async function setActive(id: string) {
    await db.transaction('rw', db.programs, async () => {
      const all = await db.programs.toArray();
      await Promise.all(all.map((p) => db.programs.update(p.id, { active: p.id === id })));
    });
    toast('Active program updated');
    setMenuFor(null);
  }

  async function duplicate(id: string) {
    const program = await db.programs.get(id);
    if (!program) return;
    const newProgramId = newId();
    const count = await db.programs.count();
    await db.programs.add({ ...program, id: newProgramId, name: `${program.name} copy`, active: false, order: count });
    const workouts = await db.workoutTemplates.where('programId').equals(id).toArray();
    for (const w of workouts) {
      const newWorkoutId = newId();
      await db.workoutTemplates.add({ ...w, id: newWorkoutId, programId: newProgramId });
      const exercises = await db.workoutExercises.where('workoutTemplateId').equals(w.id).toArray();
      for (const ex of exercises) {
        await db.workoutExercises.add({ ...ex, id: newId(), workoutTemplateId: newWorkoutId });
      }
    }
    toast('Program duplicated');
    setMenuFor(null);
  }

  async function toggleArchive(id: string, archived: boolean) {
    await db.programs.update(id, { archived: !archived });
    setMenuFor(null);
  }

  async function remove(id: string) {
    if (!confirm('Delete this program and all its workouts? This cannot be undone.')) return;
    const workouts = await db.workoutTemplates.where('programId').equals(id).toArray();
    for (const w of workouts) {
      await db.workoutExercises.where('workoutTemplateId').equals(w.id).delete();
      await db.workoutTemplates.delete(w.id);
    }
    await db.programs.delete(id);
    setMenuFor(null);
    toast('Program deleted');
  }

  if (!programs) return null;
  const activePrograms = programs.filter((p) => !p.archived);
  const archivedPrograms = programs.filter((p) => p.archived);

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Programs"
        right={
          <Button size="icon" variant="ghost" onClick={() => setCreateOpen(true)} aria-label="New program">
            <Plus size={20} />
          </Button>
        }
      />
      <div className="px-4 pt-4 pb-24 flex flex-col gap-3">
        {activePrograms.length === 0 && (
          <EmptyState
            icon={LayoutGrid}
            title="No programs yet"
            description="Create a program to organize your workouts."
            action={<Button onClick={() => setCreateOpen(true)}>New program</Button>}
          />
        )}
        {activePrograms.map((p) => (
          <Card key={p.id} className="p-4 relative">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => navigate(`/programs/${p.id}`)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-base-50 truncate">{p.name}</span>
                {p.active && <Badge variant="accent">Active</Badge>}
              </div>
              <span className="text-sm text-base-400 shrink-0">{workoutCounts?.get(p.id) ?? 0} workouts</span>
            </div>
            <button
              className="absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-lg text-base-400 hover:bg-base-800"
              onClick={(e) => {
                e.stopPropagation();
                setMenuFor(menuFor === p.id ? null : p.id);
              }}
            >
              <MoreVertical size={16} />
            </button>
            {menuFor === p.id && (
              <div className="absolute top-11 right-3 z-10 w-48 rounded-xl bg-base-850 border border-base-700 shadow-2xl overflow-hidden animate-pop">
                {!p.active && (
                  <MenuItem icon={CheckCircle2} label="Set active" onClick={() => setActive(p.id)} />
                )}
                <MenuItem icon={Copy} label="Duplicate" onClick={() => duplicate(p.id)} />
                <MenuItem icon={Archive} label="Archive" onClick={() => toggleArchive(p.id, p.archived)} />
                <MenuItem icon={Trash2} label="Delete" danger onClick={() => remove(p.id)} />
              </div>
            )}
          </Card>
        ))}

        {archivedPrograms.length > 0 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-base-500 mt-4 mb-1">Archived</p>
            {archivedPrograms.map((p) => (
              <Card key={p.id} className="p-4 opacity-60 relative">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-base-200 truncate">{p.name}</span>
                  <button
                    className="text-sm text-accent flex items-center gap-1"
                    onClick={() => toggleArchive(p.id, p.archived)}
                  >
                    <ArchiveRestore size={14} /> Restore
                  </button>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="New program">
        <div className="flex flex-col gap-4">
          <Input
            autoFocus
            placeholder="e.g. Push Pull Legs"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createProgram()}
          />
          <Button onClick={createProgram} disabled={!newName.trim()}>
            Create
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof CheckCircle2;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className={`flex items-center gap-2.5 w-full px-3.5 h-11 text-sm font-medium hover:bg-base-700 ${danger ? 'text-danger' : 'text-base-100'}`}
      onClick={onClick}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}
