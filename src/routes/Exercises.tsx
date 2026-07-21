import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Search, Dumbbell } from 'lucide-react';
import { db } from '@/lib/db';
import { TopBar } from '@/components/layout/TopBar';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MUSCLE_GROUPS } from '@/lib/types';
import { cn } from '@/lib/cn';

export default function Exercises() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);

  const exercises = useLiveQuery(() => db.exerciseDefs.orderBy('name').toArray(), []);

  const filtered = useMemo(() => {
    if (!exercises) return [];
    return exercises.filter((e) => {
      if (muscle && e.muscleGroup !== muscle) return false;
      if (query && !e.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [exercises, query, muscle]);

  return (
    <div className="animate-fade-in">
      <TopBar title="Exercises" />
      <div className="px-4 pt-3 flex flex-col gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
          <Input placeholder="Search exercises…" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          <FilterChip active={muscle === null} onClick={() => setMuscle(null)}>
            All
          </FilterChip>
          {MUSCLE_GROUPS.map((m) => (
            <FilterChip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
              {m}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="px-4 pt-2 pb-24 flex flex-col gap-2">
        {filtered.length === 0 && exercises && (
          <EmptyState icon={Dumbbell} title="No exercises found" description="Try a different search or filter." />
        )}
        {filtered.map((e) => (
          <Card
            key={e.id}
            className="p-3.5 flex items-center justify-between cursor-pointer active:bg-base-850"
            onClick={() => navigate(`/exercises/${e.id}`)}
          >
            <div className="min-w-0">
              <p className="font-medium text-base-50 truncate">{e.name}</p>
              <p className="text-xs text-base-400">{e.equipment || 'No equipment set'}</p>
            </div>
            <span className="text-xs font-medium text-base-400 bg-base-800 rounded-full px-2.5 py-1 shrink-0">{e.muscleGroup}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-3 h-8 text-sm font-medium border transition-colors',
        active ? 'bg-accent text-base-950 border-accent' : 'bg-base-850 text-base-300 border-base-700',
      )}
    >
      {children}
    </button>
  );
}
