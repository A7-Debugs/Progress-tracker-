import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { db } from '@/lib/db';
import { dateStr } from '@/lib/id';
import { computeStreaks } from '@/lib/calculations';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

export default function CalendarPage() {
  const [cursor, setCursor] = useState(new Date());
  const navigate = useNavigate();

  const sessions = useLiveQuery(() => db.sessions.filter((s) => s.completedAt !== null).toArray(), []);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, typeof sessions>();
    for (const s of sessions ?? []) {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr as NonNullable<typeof sessions>);
    }
    return map;
  }, [sessions]);

  const streak = sessions ? computeStreaks(sessions.map((s) => s.date)) : { current: 0, longest: 0 };

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  if (!sessions) return null;

  return (
    <div className="animate-fade-in">
      <TopBar title="Calendar" back />
      <div className="px-4 pt-3 pb-24 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Card className="flex-1 p-3 flex items-center gap-2">
            <Flame size={16} className="text-warn" />
            <span className="text-sm text-base-100 font-medium">{streak.current} day streak</span>
            <span className="text-xs text-base-500 ml-auto">Best {streak.longest}</span>
          </Card>
        </div>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setCursor((c) => subMonths(c, 1))} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-base-800 text-base-300">
              <ChevronLeft size={18} />
            </button>
            <p className="font-semibold text-base-50">{format(cursor, 'MMMM yyyy')}</p>
            <button onClick={() => setCursor((c) => addMonths(c, 1))} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-base-800 text-base-300">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-base-500 mb-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const key = dateStr(d);
              const daySessions = sessionsByDate.get(key);
              const inMonth = isSameMonth(d, cursor);
              return (
                <button
                  key={key}
                  disabled={!daySessions?.length}
                  onClick={() => daySessions?.length && navigate(`/history/${daySessions[0].id}`)}
                  className={cn(
                    'aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs',
                    inMonth ? 'text-base-200' : 'text-base-700',
                    isToday(d) && 'ring-1 ring-accent/50',
                    daySessions?.length ? 'bg-accent-bg text-accent font-semibold' : '',
                  )}
                >
                  {d.getDate()}
                  {daySessions?.length ? <span className="h-1 w-1 rounded-full bg-accent" /> : null}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-semibold text-base-50 mb-1">This month</p>
          <p className="text-2xl font-bold text-accent">
            {sessions.filter((s) => isSameMonth(new Date(s.date + 'T00:00:00'), cursor)).length}
          </p>
          <p className="text-xs text-base-400">workouts completed</p>
        </Card>
      </div>
    </div>
  );
}
