import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { db } from '@/lib/db';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

export default function SessionHistory() {
  const navigate = useNavigate();
  const sessions = useLiveQuery(
    () => db.sessions.filter((s) => s.completedAt !== null).reverse().sortBy('startedAt'),
    [],
  );

  if (!sessions) return null;

  return (
    <div className="animate-fade-in">
      <TopBar title="Workout History" back />
      <div className="px-4 pt-4 pb-24 flex flex-col gap-3">
        {sessions.length === 0 && (
          <EmptyState icon={CalendarDays} title="No workouts logged yet" description="Finish a session to see it here." />
        )}
        {sessions.map((s) => (
          <Card key={s.id} className="p-3.5 flex items-center justify-between cursor-pointer" onClick={() => navigate(`/history/${s.id}`)}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-base-800 flex items-center justify-center shrink-0">
                <CalendarDays size={15} className="text-base-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-base-100 truncate">{s.workoutName}</p>
                <p className="text-xs text-base-400">{format(parseISO(s.date), 'EEE, MMM d yyyy')} · {s.programName}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
