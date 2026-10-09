import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { todayStr } from '@/lib/id';
import { buildContext, type LifeContext } from './engine';

/** Loads every Life OS input from IndexedDB and returns a memoised scoring context (undefined while loading). */
export function useLife(): LifeContext | undefined {
  const raw = useLiveQuery(async () => {
    const [profile, checkins, sessions, setLogs, bodyweight, weekPlans, finance, foodLogs] = await Promise.all([
      db.lifeProfile.get('life'),
      db.checkins.orderBy('date').toArray(),
      db.sessions.toArray(),
      db.setLogs.toArray(),
      db.bodyweightLogs.orderBy('date').toArray(),
      db.weekPlans.toArray(),
      db.financeSnapshots.orderBy('month').toArray(),
      db.foodLogs.toArray(),
    ]);
    if (!profile) return undefined;
    return { profile, checkins, sessions, setLogs, bodyweight, weekPlans, finance, foodLogs, today: todayStr() };
  }, []);
  return useMemo(() => (raw ? buildContext(raw) : undefined), [raw]);
}
