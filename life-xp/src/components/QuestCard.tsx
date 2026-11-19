import { Check, Swords } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { QuestRecord } from '@/lib/types';
import { Bar, DifficultyPips, XpChip } from './game';

export function QuestCard({ q, compact }: { q: QuestRecord; compact?: boolean }) {
  const done = q.completedAt !== null;
  const pct = Math.min(1, q.progress / q.target);
  const pctQuest = q.questId === 'eighty' || q.questId === 'consistency-80' || q.questId === 'beat-last-week';
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border p-3', done ? 'border-xp/40 bg-gradient-to-br from-xp/10 to-base-900' : 'border-base-800 bg-base-900')}>
      <div className="flex items-start gap-3">
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', done ? 'bg-xp text-base-950' : 'bg-base-800 text-violet')}>
          {done ? <Check size={20} strokeWidth={3} /> : <Swords size={19} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={cn('font-bold text-[15px] truncate', done ? 'text-xp' : 'text-base-50')}>{q.title}</p>
            <XpChip xp={q.xp} done={done} />
          </div>
          {!compact && <p className="text-xs text-base-300 mt-0.5">{q.description}</p>}
          <div className="flex items-center gap-2 mt-2">
            <Bar value={pct} color={done ? '#ffc845' : '#a47bff'} className="flex-1" />
            <span className="text-[11px] font-bold tabular-nums text-base-300 shrink-0">
              {pctQuest ? `${Math.min(q.progress, 100)}%/${q.target}%` : `${Math.min(q.progress, q.target)}/${q.target}`}
            </span>
          </div>
          {!compact && (
            <div className="mt-2">
              <DifficultyPips d={q.difficulty} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
