import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Search as SearchIcon, Dumbbell, LayoutGrid, CalendarDays, Trophy } from 'lucide-react';
import { db } from '@/lib/db';
import { TopBar } from '@/components/layout/TopBar';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { best1RM, maxWeight } from '@/lib/calculations';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const exercises = useLiveQuery(() => db.exerciseDefs.toArray(), []);
  const workouts = useLiveQuery(() => db.workoutTemplates.toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.filter((s) => s.completedAt !== null).toArray(), []);
  const setLogs = useLiveQuery(() => db.setLogs.toArray(), []);

  const q = query.trim().toLowerCase();

  const matchedExercises = useMemo(
    () => (q ? (exercises ?? []).filter((e) => e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q)) : []),
    [exercises, q],
  );
  const matchedWorkouts = useMemo(
    () => (q ? (workouts ?? []).filter((w) => w.name.toLowerCase().includes(q)) : []),
    [workouts, q],
  );
  const matchedSessions = useMemo(
    () =>
      q
        ? (sessions ?? []).filter((s) => s.workoutName.toLowerCase().includes(q) || s.date.includes(q) || (s.notes ?? '').toLowerCase().includes(q))
        : [],
    [sessions, q],
  );

  const prMatches = useMemo(() => {
    if (!q || !setLogs || !exercises) return [];
    const byExercise = new Map<string, typeof setLogs>();
    for (const s of setLogs) {
      const arr = byExercise.get(s.exerciseDefId) ?? [];
      arr.push(s);
      byExercise.set(s.exerciseDefId, arr);
    }
    return exercises
      .filter((e) => e.name.toLowerCase().includes(q))
      .map((e) => {
        const sets = byExercise.get(e.id) ?? [];
        return { exercise: e, weight: maxWeight(sets), rm: Math.round(best1RM(sets)) };
      })
      .filter((x) => x.weight > 0);
  }, [q, setLogs, exercises]);

  return (
    <div className="animate-fade-in">
      <TopBar title="Search" back />
      <div className="px-4 pt-3 pb-24 flex flex-col gap-4">
        <div className="relative">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
          <Input
            autoFocus
            placeholder="Search exercises, workouts, PRs, dates…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {!q && <p className="text-sm text-base-500 text-center py-10">Start typing to search everything.</p>}

        {q && matchedExercises.length === 0 && matchedWorkouts.length === 0 && matchedSessions.length === 0 && (
          <p className="text-sm text-base-500 text-center py-10">No results for "{query}"</p>
        )}

        {matchedExercises.length > 0 && (
          <Section title="Exercises" icon={Dumbbell}>
            {matchedExercises.map((e) => (
              <ResultRow key={e.id} title={e.name} sub={e.muscleGroup} onClick={() => navigate(`/exercises/${e.id}`)} />
            ))}
          </Section>
        )}

        {prMatches.length > 0 && (
          <Section title="Personal Records" icon={Trophy}>
            {prMatches.map(({ exercise, weight, rm }) => (
              <ResultRow
                key={exercise.id}
                title={exercise.name}
                sub={`${weight}kg max · ${rm}kg est. 1RM`}
                onClick={() => navigate(`/exercises/${exercise.id}`)}
              />
            ))}
          </Section>
        )}

        {matchedWorkouts.length > 0 && (
          <Section title="Workouts" icon={LayoutGrid}>
            {matchedWorkouts.map((w) => (
              <ResultRow key={w.id} title={w.name} onClick={() => navigate(`/programs/${w.programId}/workouts/${w.id}`)} />
            ))}
          </Section>
        )}

        {matchedSessions.length > 0 && (
          <Section title="Sessions" icon={CalendarDays}>
            {matchedSessions.map((s) => (
              <ResultRow
                key={s.id}
                title={s.workoutName}
                sub={format(parseISO(s.date), 'MMM d, yyyy')}
                onClick={() => navigate(`/history/${s.id}`)}
              />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Dumbbell; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-base-500 mb-2 flex items-center gap-1.5">
        <Icon size={12} /> {title}
      </p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function ResultRow({ title, sub, onClick }: { title: string; sub?: string; onClick: () => void }) {
  return (
    <Card className="p-3.5 cursor-pointer active:bg-base-850" onClick={onClick}>
      <p className="font-medium text-base-50">{title}</p>
      {sub && <p className="text-xs text-base-400">{sub}</p>}
    </Card>
  );
}
