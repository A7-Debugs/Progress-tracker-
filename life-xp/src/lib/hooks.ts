import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { loadSnapshot, type Snapshot } from './snapshot';
import { logicalDate } from './dates';
import { reconcile } from './sync';
import { now } from './actions';

/** Re-renders when the logical day changes (daily reset), checking every 30 seconds and on resume. */
export function useDayKey(dayStartHour = 4): string {
  const [key, setKey] = useState(() => logicalDate(now(), dayStartHour));
  useEffect(() => {
    const check = () => setKey(logicalDate(now(), dayStartHour));
    check();
    const id = setInterval(check, 30000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [dayStartHour]);
  return key;
}

/** Live snapshot of all data; recomputes whenever anything in the database changes. */
export function useSnapshot(): Snapshot | null | undefined {
  const settings = useLiveQuery(() => db.settings.get('settings'), []);
  const day = useDayKey(settings?.dayStartHour ?? 4);
  useEffect(() => {
    // A new day/week: generate quests and settle yesterday.
    reconcile(db, { now: now(), silent: true });
  }, [day]);
  return useLiveQuery(() => loadSnapshot(db, now()), [day]);
}

/** Ticks every second while `active` — for timers. */
export function useTicker(active: boolean, ms = 1000): number {
  const [t, setT] = useState(() => now().getTime());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT(now().getTime()), ms);
    const vis = () => setT(now().getTime());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [active, ms]);
  return t;
}
