import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, X, Clock } from 'lucide-react';
import { db } from '@/lib/db';
import { ExerciseLogCard } from '@/components/workout/ExerciseLogCard';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toaster';
import type { ExerciseDef, WorkoutExercise } from '@/lib/types';

function useElapsed(startedAt: number) {
  const [elapsed, setElapsed] = useState(Date.now() - startedAt);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function SessionLog() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [notes, setNotes] = useState<string | null>(null);

  const session = useLiveQuery(() => db.sessions.get(sessionId!), [sessionId]);
  const items = useLiveQuery(async () => {
    if (!session) return null;
    const rows = await db.workoutExercises.where('workoutTemplateId').equals(session.workoutTemplateId).sortBy('order');
    const defs = await db.exerciseDefs.bulkGet(rows.map((r) => r.exerciseDefId));
    return rows.map((r, i) => ({ row: r, def: defs[i] })).filter((x): x is { row: WorkoutExercise; def: ExerciseDef } => !!x.def);
  }, [session?.workoutTemplateId]);

  const elapsed = useElapsed(session?.startedAt ?? Date.now());

  if (!session || !items) return null;

  const displayNotes = notes ?? session.notes;

  async function finish() {
    const setCount = await db.setLogs.where('sessionId').equals(sessionId!).count();
    if (setCount === 0) {
      if (!confirm('No sets logged yet. Finish anyway?')) return;
    }
    await db.sessions.update(sessionId!, { completedAt: Date.now(), notes: displayNotes });
    toast('Workout saved');
    navigate('/', { replace: true });
  }

  async function discard() {
    if (!confirm('Discard this workout session? All logged sets will be deleted.')) return;
    await db.setLogs.where('sessionId').equals(sessionId!).delete();
    await db.sessions.delete(sessionId!);
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-dvh bg-base-950 flex flex-col">
      <header className="sticky top-0 z-20 bg-base-950/90 backdrop-blur-lg border-b border-base-800 safe-top">
        <div className="mx-auto max-w-lg flex items-center gap-2 h-14 px-3">
          <button
            onClick={discard}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-base-400 hover:bg-base-800 shrink-0"
            aria-label="Discard"
          >
            <X size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-base-50 truncate">{session.workoutName}</p>
            <p className="text-xs text-base-400 flex items-center gap-1">
              <Clock size={11} /> {elapsed}
            </p>
          </div>
          <Button size="sm" onClick={finish}>
            <Check size={15} /> Finish
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-4 flex flex-col gap-3 pb-10">
        {items.map(({ row, def }) => (
          <Card key={row.id} className="p-4">
            <ExerciseLogCard
              sessionId={sessionId!}
              workoutExercise={row}
              def={def}
              onOverload={(msg) => toast(msg, 'pr')}
            />
          </Card>
        ))}

        <Card className="p-4">
          <label className="text-xs font-semibold text-base-400 mb-2 block">Session notes</label>
          <Textarea
            rows={3}
            placeholder="Felt strong, shoulder sore, increase weight next week…"
            value={displayNotes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => db.sessions.update(sessionId!, { notes: displayNotes })}
          />
        </Card>

        <Button size="lg" onClick={finish} className="mt-1">
          <Check size={18} /> Finish workout
        </Button>
      </div>
    </div>
  );
}
