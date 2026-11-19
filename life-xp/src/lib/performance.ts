import { addDays, dateRange, dayOfWeek, localDate, weekDates, weekStart } from './dates';
import type { Snapshot } from './snapshot';
import type { DateStr, Habit } from './types';
import { levelFromXp } from './levels';

/** A day counts towards your streak when at least half of its scheduled habits are done. */
export const ACTIVE_DAY_THRESHOLD = 0.5;
/** Every 7 active days in a row earns a streak shield (max 2) that covers one missed day. */
export const SHIELD_EVERY = 7;
export const MAX_SHIELDS = 2;

export interface HabitProgress {
  count: number;
  target: number;
  done: boolean;
  completedAt: number | null;
}

export const logKey = (habitId: string, date: DateStr) => `${habitId}:${date}`;

/** Count towards a habit's target on a date, from whichever source the habit is linked to. */
export function habitCount(s: Snapshot, h: Habit, date: DateStr): number {
  switch (h.link) {
    case 'water':
      return s.nutrition.get(date)?.water ?? 0;
    case 'meals':
      return s.nutrition.get(date)?.meals ?? 0;
    case 'fruitveg':
      return s.nutrition.get(date)?.fruitVeg ?? 0;
    case 'exercise':
      return s.exerciseMinutes.get(date) ?? 0;
    case 'revision':
      return s.revisionMinutes.get(date) ?? 0;
    default:
      return s.habitLogs.get(logKey(h.id, date))?.count ?? 0;
  }
}

export function habitProgress(s: Snapshot, h: Habit, date: DateStr): HabitProgress {
  const count = habitCount(s, h, date);
  const target = Math.max(1, h.target);
  return {
    count,
    target,
    done: count >= target,
    completedAt: h.link === 'manual' ? (s.habitLogs.get(logKey(h.id, date))?.completedAt ?? null) : null,
  };
}

/** Was this habit part of the plan on that date? (Started by then, not archived before, day scheduled.) */
export function habitExistsOn(h: Habit, date: DateStr): boolean {
  if (date < h.startDate) return false;
  if (h.archivedAt !== null && localDate(new Date(h.archivedAt)) <= date) return false;
  if (!h.active && h.archivedAt === null) return false;
  return true;
}

export function scheduledHabits(s: Snapshot, date: DateStr): Habit[] {
  const dow = dayOfWeek(date);
  return s.habits.filter((h) => habitExistsOn(h, date) && h.days.includes(dow));
}

export interface DayStatus {
  date: DateStr;
  scheduled: Habit[];
  done: Habit[];
  pct: number | null; // 0..1, null when nothing was scheduled (a rest day)
  active: boolean;
}

export function dayStatus(s: Snapshot, date: DateStr): DayStatus {
  const scheduled = scheduledHabits(s, date);
  const done = scheduled.filter((h) => habitProgress(s, h, date).done);
  const pct = scheduled.length ? done.length / scheduled.length : null;
  return { date, scheduled, done, pct, active: pct !== null && pct >= ACTIVE_DAY_THRESHOLD };
}

export interface Consistency {
  done: number;
  scheduled: number;
  pct: number | null;
  days: number;
}

/** Completed ÷ scheduled habit instances over a date range (clipped to the profile's start). */
export function consistency(s: Snapshot, from: DateStr, to: DateStr): Consistency {
  const start = from < s.profile.startDate ? s.profile.startDate : from;
  let done = 0;
  let scheduled = 0;
  let days = 0;
  if (start > to) return { done, scheduled, pct: null, days };
  for (const d of dateRange(start, to)) {
    const st = dayStatus(s, d);
    done += st.done.length;
    scheduled += st.scheduled.length;
    if (st.scheduled.length) days++;
  }
  return { done, scheduled, pct: scheduled ? done / scheduled : null, days };
}

/** Rolling 7 completed days (ending yesterday). Today only counts once it's fully complete. */
export function weeklyConsistency(s: Snapshot): Consistency {
  const yesterday = addDays(s.today, -1);
  const base = consistency(s, addDays(s.today, -7), yesterday);
  const t = dayStatus(s, s.today);
  if (base.scheduled === 0) {
    return t.scheduled.length ? { done: t.done.length, scheduled: t.scheduled.length, pct: t.pct, days: 1 } : base;
  }
  if (t.pct === 1) {
    const done = base.done + t.done.length;
    const scheduled = base.scheduled + t.scheduled.length;
    return { done, scheduled, pct: done / scheduled, days: base.days + 1 };
  }
  return base;
}

export function calendarWeekConsistency(s: Snapshot, ws: DateStr): Consistency {
  const end = addDays(ws, 6);
  return consistency(s, ws, end < s.today ? end : s.today);
}

export type StreakDay = 'active' | 'rest' | 'shielded' | 'miss' | 'pending' | 'before';

export interface StreakInfo {
  current: number;
  longest: number;
  shields: number;
  todayActive: boolean;
  history: Map<DateStr, StreakDay>;
}

/**
 * Consistency, not perfection: rest days (nothing scheduled) never break a streak,
 * shields earned every 7 active days cover a missed day, and today is never a miss until it's over.
 */
export function streakInfo(s: Snapshot): StreakInfo {
  const history = new Map<DateStr, StreakDay>();
  let current = 0;
  let longest = 0;
  let shields = 0;
  let sinceShield = 0;
  const start = s.profile.startDate;
  let todayActive = false;
  if (start > s.today) return { current, longest, shields, todayActive, history };
  for (const d of dateRange(start, s.today)) {
    const st = dayStatus(s, d);
    if (st.pct === null) {
      history.set(d, 'rest');
      continue;
    }
    if (st.active) {
      current++;
      sinceShield++;
      if (sinceShield >= SHIELD_EVERY) {
        sinceShield = 0;
        shields = Math.min(MAX_SHIELDS, shields + 1);
      }
      longest = Math.max(longest, current);
      history.set(d, 'active');
      if (d === s.today) todayActive = true;
    } else if (d === s.today) {
      history.set(d, 'pending');
    } else if (shields > 0) {
      shields--;
      history.set(d, 'shielded');
    } else {
      current = 0;
      sinceShield = 0;
      history.set(d, 'miss');
    }
  }
  return { current, longest, shields, todayActive, history };
}

export function totalXp(s: Snapshot): number {
  return s.xpEvents.reduce((a, e) => a + e.amount, 0);
}

export function xpOn(s: Snapshot, date: DateStr): number {
  return s.xpEvents.filter((e) => e.date === date).reduce((a, e) => a + e.amount, 0);
}

export function xpBetween(s: Snapshot, from: DateStr, to: DateStr, kind?: 'life' | 'academic'): number {
  return s.xpEvents.filter((e) => e.date >= from && e.date <= to && (!kind || e.kind === kind)).reduce((a, e) => a + e.amount, 0);
}

export function currentLevel(s: Snapshot) {
  return levelFromXp(totalXp(s));
}

/** Completed calendar weeks (Mon–Sun) strictly before the current one, newest first. */
export function pastWeekStarts(s: Snapshot, n: number): DateStr[] {
  const ws = weekStart(s.today);
  const out: DateStr[] = [];
  for (let i = 1; i <= n; i++) {
    const w = addDays(ws, -7 * i);
    if (addDays(w, 6) < s.profile.startDate) break;
    out.push(w);
  }
  return out;
}

export function habitCompletionRate(s: Snapshot, h: Habit, from: DateStr, to: DateStr): { done: number; scheduled: number; pct: number | null } {
  const start = [from, s.profile.startDate, h.startDate].sort().at(-1)!;
  let done = 0;
  let scheduled = 0;
  if (start <= to) {
    for (const d of dateRange(start, to)) {
      if (!habitExistsOn(h, d) || !h.days.includes(dayOfWeek(d))) continue;
      if (d === s.today && !habitProgress(s, h, d).done) continue; // today isn't missed yet
      scheduled++;
      if (habitProgress(s, h, d).done) done++;
    }
  }
  return { done, scheduled, pct: scheduled ? done / scheduled : null };
}

export { weekDates };
