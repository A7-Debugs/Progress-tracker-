import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Flame, Play, ChevronRight, LayoutGrid, CalendarDays } from 'lucide-react';
import { db } from '@/lib/db';
import { newId, todayStr } from '@/lib/id';
import { computeStreaks } from '@/lib/calculations';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { format, parseISO } from 'date-fns';

export default function Today() {
  const navigate = useNavigate();

  const activeProgram = useLiveQuery(() => db.programs.filter((p) => p.active && !p.archived).first(), []);
  const workouts = useLiveQuery(
    () => (activeProgram ? db.workoutTemplates.where('programId').equals(activeProgram.id).sortBy('order') : []),
    [activeProgram?.id],
  );
  const inProgress = useLiveQuery(() => db.sessions.filter((s) => s.completedAt === null).first(), []);
  const recentSessions = useLiveQuery(
    () => db.sessions.filter((s) => s.completedAt !== null).reverse().sortBy('startedAt').then((r) => r.slice(0, 5)),
    [],
  );
  const allSessionDates = useLiveQuery(
    () => db.sessions.filter((s) => s.completedAt !== null).toArray().then((r) => r.map((s) => s.date)),
    [],
  );

  const streak = allSessionDates ? computeStreaks(allSessionDates) : { current: 0, longest: 0 };

  async function startSession(workoutId: string, workoutName: string) {
    if (!activeProgram) return;
    const id = newId();
    await db.sessions.add({
      id,
      workoutTemplateId: workoutId,
      workoutName,
      programId: activeProgram.id,
      programName: activeProgram.name,
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
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-2 flex items-center justify-between">
        <div>
          <p className="text-sm text-base-400">{format(new Date(), 'EEEE, MMM d')}</p>
          <h1 className="text-2xl font-bold text-base-50 mt-0.5">Let's train</h1>
        </div>
        {streak.current > 0 && (
          <div className="flex items-center gap-1.5 bg-warn/10 text-warn rounded-full px-3 py-1.5">
            <Flame size={16} />
            <span className="font-bold text-sm">{streak.current}</span>
          </div>
        )}
      </div>

      <div className="px-4 flex flex-col gap-3 pb-6">
        {inProgress && (
          <Card
            className="p-4 border-accent/40 bg-accent-bg cursor-pointer"
            onClick={() => navigate(`/session/${inProgress.id}`)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-accent uppercase tracking-wide">In progress</p>
                <p className="text-base font-bold text-base-50 mt-0.5">{inProgress.workoutName}</p>
              </div>
              <Button size="sm">
                <Play size={14} /> Continue
              </Button>
            </div>
          </Card>
        )}

        {!activeProgram && (
          <EmptyState
            icon={LayoutGrid}
            title="No active program"
            description="Create or activate a program to start logging workouts."
            action={<Button onClick={() => navigate('/programs')}>Go to Programs</Button>}
          />
        )}

        {activeProgram && workouts && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-base-500 mt-1">{activeProgram.name}</p>
            {workouts.filter((w) => !w.archived).map((w) => (
              <Card
                key={w.id}
                className="p-4 flex items-center justify-between cursor-pointer active:bg-base-850"
                onClick={() => startSession(w.id, w.name)}
              >
                <span className="font-semibold text-base-50">{w.name}</span>
                <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center">
                  <Play size={15} className="text-base-950 ml-0.5" fill="currentColor" />
                </div>
              </Card>
            ))}
          </>
        )}

        {recentSessions && recentSessions.length > 0 && (
          <>
            <div className="flex items-center justify-between mt-4 mb-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-base-500">Recent</p>
              <button className="text-xs text-accent flex items-center gap-0.5" onClick={() => navigate('/history')}>
                See all <ChevronRight size={12} />
              </button>
            </div>
            {recentSessions.map((s) => (
              <Card key={s.id} className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-base-800 flex items-center justify-center shrink-0">
                    <CalendarDays size={15} className="text-base-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-base-100 truncate">{s.workoutName}</p>
                    <p className="text-xs text-base-400">{format(parseISO(s.date), 'MMM d, yyyy')}</p>
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
