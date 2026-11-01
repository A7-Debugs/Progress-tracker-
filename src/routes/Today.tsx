import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Flame, Play, ChevronRight, LayoutGrid, CalendarDays, RotateCcw, ArrowUpRight, Wrench } from 'lucide-react';
import { db } from '@/lib/db';
import { startOrResumeSession } from '@/lib/sessions';
import { computeStreaks } from '@/lib/calculations';
import { suggestNext, type NextSuggestion } from '@/lib/workoutRules';
import { findIssues } from '@/lib/cleanup';
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

  const lifts = useLiveQuery(() => liftProgress(activeProgram?.id ?? null), [activeProgram?.id]);
  const issueCount = useLiveQuery(async () => {
    const i = await findIssues();
    let dismissed: string[] = [];
    try {
      dismissed = JSON.parse(localStorage.getItem('cleanup-dismissed') ?? '[]');
    } catch {
      /* ignore */
    }
    const dupes = i.duplicates.filter((d) => !dismissed.includes([d.a.id, d.b.id].sort().join('|'))).length;
    return i.sessionIssues.length + dupes + i.orphans.length;
  }, []);

  const streak = allSessionDates ? computeStreaks(allSessionDates) : { current: 0, longest: 0 };

  async function startSession(workoutId: string, workoutName: string) {
    if (!activeProgram) return;
    const id = await startOrResumeSession({ workoutId, workoutName, programId: activeProgram.id, programName: activeProgram.name });
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

        {lifts && (lifts.stalled.length > 0 || lifts.ready.length > 0) && (
          <Card className="p-4 mt-2">
            <p className="text-sm font-semibold text-base-50">Lift progress</p>
            <p className="text-[11px] text-base-500 mb-2">Add weight once every set hits the top of the range; no progress in 3 sessions → drop 10% and rebuild.</p>
            {lifts.stalled.map(({ name, s }) => (
              <p key={name} className="text-xs text-warn flex items-start gap-1.5 mt-1">
                <RotateCcw size={12} className="mt-0.5 shrink-0" /> <span><span className="font-semibold">{name}:</span> stalled {s.stalledSessions} sessions → {s.weight}kg and build back up</span>
              </p>
            ))}
            {lifts.ready.map(({ name, s }) => (
              <p key={name} className="text-xs text-accent flex items-start gap-1.5 mt-1">
                <ArrowUpRight size={12} className="mt-0.5 shrink-0" /> <span><span className="font-semibold">{name}:</span> ready for {s.weight}kg</span>
              </p>
            ))}
          </Card>
        )}

        {!!issueCount && (
          <button onClick={() => navigate('/cleanup')} className="text-left">
            <Card className="p-3.5 flex items-center gap-3 border-warn/30">
              <Wrench size={16} className="text-warn shrink-0" />
              <span className="text-sm text-base-100 flex-1">{issueCount} data issue{issueCount === 1 ? '' : 's'} splitting your history (duplicates, broken sessions)</span>
              <ChevronRight size={14} className="text-base-500" />
            </Card>
          </button>
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

/** Next-session advice for every lift trained in the last 8 weeks, using the active program's rep ranges. */
async function liftProgress(programId: string | null): Promise<{ stalled: { name: string; s: NextSuggestion }[]; ready: { name: string; s: NextSuggestion }[] }> {
  const since = Date.now() - 56 * 86400000;
  const [sets, defs, templates] = await Promise.all([db.setLogs.toArray(), db.exerciseDefs.toArray(), programId ? db.workoutTemplates.where('programId').equals(programId).toArray() : []]);
  const rows = templates.length ? await db.workoutExercises.where('workoutTemplateId').anyOf(templates.map((t) => t.id)).toArray() : [];
  const range = new Map(rows.map((r) => [r.exerciseDefId, { low: r.targetRepLow, high: r.targetRepHigh }]));
  const byDef = new Map<string, typeof sets>();
  for (const s of sets) byDef.set(s.exerciseDefId, [...(byDef.get(s.exerciseDefId) ?? []), s]);
  const stalled: { name: string; s: NextSuggestion }[] = [];
  const ready: { name: string; s: NextSuggestion }[] = [];
  for (const d of defs) {
    const ds = byDef.get(d.id);
    if (!ds || !ds.some((x) => x.createdAt >= since)) continue;
    const r = range.get(d.id) ?? { low: 8, high: 12 };
    const s = suggestNext(d, r.low, r.high, ds);
    if (!s) continue;
    if (s.kind === 'deload') stalled.push({ name: d.name, s });
    else if (s.kind === 'add') ready.push({ name: d.name, s });
  }
  return { stalled, ready };
}
