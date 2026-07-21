import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { db } from '@/lib/db';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { totalVolume } from '@/lib/calculations';

export default function SessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const session = useLiveQuery(() => db.sessions.get(sessionId!), [sessionId]);
  const sets = useLiveQuery(() => db.setLogs.where('sessionId').equals(sessionId!).toArray(), [sessionId]);

  if (!session || !sets) return null;

  const grouped = new Map<string, typeof sets>();
  for (const s of sets) {
    const arr = grouped.get(s.exerciseName) ?? [];
    arr.push(s);
    grouped.set(s.exerciseName, arr);
  }

  const duration = session.completedAt ? Math.round((session.completedAt - session.startedAt) / 60000) : null;

  return (
    <div className="animate-fade-in">
      <TopBar title={session.workoutName} back />
      <div className="px-4 pt-4 pb-24 flex flex-col gap-3">
        <div className="flex items-center gap-3 text-sm text-base-400">
          <span>{format(parseISO(session.date), 'EEEE, MMM d yyyy')}</span>
          {duration !== null && <span>· {duration} min</span>}
          <span>· {Math.round(totalVolume(sets)).toLocaleString()} kg volume</span>
        </div>

        {Array.from(grouped.entries()).map(([name, exSets]) => (
          <Card key={name} className="p-4">
            <p className="font-semibold text-base-50 mb-2">{name}</p>
            <div className="flex flex-col gap-1">
              {exSets
                .sort((a, b) => a.setNumber - b.setNumber)
                .map((s) => (
                  <div key={s.id} className="flex items-center gap-3 text-sm">
                    <span className="text-base-500 w-4">{s.setNumber}</span>
                    <span className="text-base-100 font-medium">
                      {s.weight}kg × {s.reps}
                    </span>
                    {s.isWarmup && <span className="text-xs text-base-500">warmup</span>}
                  </div>
                ))}
            </div>
          </Card>
        ))}

        {session.notes && (
          <Card className="p-4">
            <p className="text-xs font-semibold text-base-400 mb-1">Notes</p>
            <p className="text-sm text-base-100 whitespace-pre-wrap">{session.notes}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
