import { addDays, dateRange, dayOfWeek, daysBetween, localDate, weekStart } from './dates';
import type { Snapshot } from './snapshot';
import type { DateStr, Frequency, Habit, HabitLog } from './types';

/**
 * Sustainable consistency, not perfection:
 * - "done" = full credit, "partial" (the minimum version) = half credit and keeps the streak alive.
 * - Every 7 successful occurrences in a row earn a grace day (max 2) that absorbs one miss.
 * - Today is never a miss until it's over; a weekly habit is never missed until its week is.
 */
export const PARTIAL_CREDIT = 0.5;
export const GRACE_EVERY = 7;
export const MAX_GRACE = 2;
/** Habits can be logged for the last 7 days (forgot to log), not further back. */
export const HABIT_EDIT_DAYS = 7;

export const logKey = (habitId: string, date: DateStr) => `${habitId}:${date}`;

export function getLog(s: Snapshot, h: Habit, date: DateStr): HabitLog | undefined {
  return s.habitLogs.get(logKey(h.id, date));
}

/** 1 done · 0.5 partial · 0 missed / nothing logged. */
export function creditOn(s: Snapshot, h: Habit, date: DateStr): number {
  const l = getLog(s, h, date);
  if (!l) return 0;
  return l.status === 'done' ? 1 : l.status === 'partial' ? PARTIAL_CREDIT : 0;
}

export function isWeeklyHabit(h: Habit) {
  return h.frequency.type === 'weekly';
}

/** Did the habit exist (started, not archived) on that date? */
export function habitExistsOn(h: Habit, date: DateStr): boolean {
  if (date < h.startDate) return false;
  if (h.archivedAt !== null && localDate(new Date(h.archivedAt)) <= date) return false;
  if (!h.active && h.archivedAt === null) return false;
  return true;
}

/** Is a day-based habit scheduled on this date? Weekly (N× per week) habits are never tied to a day. */
export function scheduledOn(h: Habit, date: DateStr): boolean {
  if (!habitExistsOn(h, date)) return false;
  const f = h.frequency;
  switch (f.type) {
    case 'daily':
      return true;
    case 'weekdays':
      return f.days.includes(dayOfWeek(date));
    case 'interval':
      return daysBetween(h.startDate, date) % Math.max(1, f.everyDays) === 0;
    case 'weekly':
      return false;
  }
}

export function frequencyLabel(f: Frequency): string {
  switch (f.type) {
    case 'daily':
      return 'Every day';
    case 'weekdays': {
      const d = [...f.days].sort();
      if (d.join() === '1,2,3,4,5') return 'Weekdays';
      if (d.join() === '0,6') return 'Weekends';
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return [1, 2, 3, 4, 5, 6, 0].filter((x) => d.includes(x)).map((x) => names[x]).join(', ');
    }
    case 'weekly':
      return `${f.timesPerWeek}× per week`;
    case 'interval':
      return f.everyDays === 1 ? 'Every day' : `Every ${f.everyDays} days`;
  }
}

/** Weighted check-ins for a weekly habit inside one Mon–Sun week, up to `upTo`. */
export function weekCredit(s: Snapshot, h: Habit, ws: DateStr, upTo?: DateStr): number {
  let c = 0;
  const end = addDays(ws, 6);
  for (const d of dateRange(ws, upTo && upTo < end ? upTo : end)) if (habitExistsOn(h, d)) c += creditOn(s, h, d);
  return c;
}

/** Was the habit part of the plan for any day of that week? */
function weekExists(h: Habit, ws: DateStr) {
  return dateRange(ws, addDays(ws, 6)).some((d) => habitExistsOn(h, d));
}

export interface Occurrence {
  key: DateStr; // date, or week start for weekly habits
  credit: number; // 0..1
  pending: boolean; // today / current week not finished yet
}

/** Every occurrence of the habit from its start to today, oldest first. */
export function occurrences(s: Snapshot, h: Habit, from?: DateStr, to?: DateStr): Occurrence[] {
  const start = [h.startDate, s.profile.startDate, from ?? '0000-00-00'].sort().at(-1)!;
  const end = to && to < s.today ? to : s.today;
  if (start > end) return [];
  const out: Occurrence[] = [];
  if (isWeeklyHabit(h)) {
    const target = Math.max(1, h.frequency.timesPerWeek);
    for (let ws = weekStart(start); ws <= end; ws = addDays(ws, 7)) {
      if (!weekExists(h, ws)) continue;
      const credit = Math.min(1, weekCredit(s, h, ws) / target);
      const current = ws === weekStart(s.today);
      out.push({ key: ws, credit, pending: current && credit < 1 });
    }
  } else {
    for (const d of dateRange(start, end)) {
      if (!scheduledOn(h, d)) continue;
      const credit = creditOn(s, h, d);
      // Today stays open until it's over, unless it was explicitly marked as missed.
      out.push({ key: d, credit, pending: d === s.today && credit === 0 && getLog(s, h, d)?.status !== 'missed' });
    }
  }
  return out;
}

export interface HabitStats {
  rate: number | null; // completion over the range (partial = half)
  done: number;
  partial: number;
  missed: number;
  current: number;
  longest: number;
  grace: number;
  unit: 'days' | 'weeks' | 'times';
}

/** Completion percentage, streaks and counts. Pending occurrences are excluded from the rate. */
export function habitStats(s: Snapshot, h: Habit, from?: DateStr, to?: DateStr): HabitStats {
  const occ = occurrences(s, h, from, to);
  const settled = occ.filter((o) => !o.pending);
  let done = 0;
  let partial = 0;
  let missed = 0;
  let creditSum = 0;
  for (const o of settled) {
    creditSum += o.credit;
    if (o.credit >= 1) done++;
    else if (o.credit > 0) partial++;
    else missed++;
  }
  // Streaks always use the full history so a range filter can't hide a broken streak.
  const all = from || to ? occurrences(s, h) : occ;
  let current = 0;
  let longest = 0;
  let grace = 0;
  let since = 0;
  for (const o of all) {
    if (o.pending) continue;
    if (o.credit > 0) {
      current++;
      since++;
      if (since >= GRACE_EVERY) {
        since = 0;
        grace = Math.min(MAX_GRACE, grace + 1);
      }
    } else if (grace > 0) {
      grace--;
    } else {
      current = 0;
      since = 0;
    }
    longest = Math.max(longest, current);
  }
  // A pending occurrence that's already been started extends the streak.
  const last = all.at(-1);
  if (last?.pending && last.credit > 0) {
    current++;
    longest = Math.max(longest, current);
  }
  return {
    rate: settled.length ? creditSum / settled.length : null,
    done,
    partial,
    missed,
    current,
    longest,
    grace,
    unit: isWeeklyHabit(h) ? 'weeks' : h.frequency.type === 'daily' ? 'days' : 'times',
  };
}

export interface DayHabitPlan {
  habit: Habit;
  credit: number;
  log: HabitLog | undefined;
  /** For weekly habits: check-ins so far this week and the target. */
  week?: { done: number; target: number; neededToday: boolean };
}

/**
 * Habits planned for a date. Day-based habits when scheduled; weekly habits while their weekly target
 * isn't met yet (or they were logged that day). `neededToday` marks a weekly habit that has run out of
 * slack: skipping today would make the weekly target impossible.
 */
export function habitsForDay(s: Snapshot, date: DateStr): DayHabitPlan[] {
  const out: DayHabitPlan[] = [];
  const ws = weekStart(date);
  const daysLeft = daysBetween(date, addDays(ws, 6)) + 1; // including today
  for (const h of s.habits) {
    if (!habitExistsOn(h, date)) continue;
    const log = getLog(s, h, date);
    const credit = creditOn(s, h, date);
    if (isWeeklyHabit(h)) {
      const target = Math.max(1, h.frequency.timesPerWeek);
      const before = weekCredit(s, h, ws, addDays(date, -1));
      const remaining = Math.max(0, target - before);
      if (remaining <= 0 && !log) continue;
      out.push({ habit: h, credit, log, week: { done: before + credit, target, neededToday: remaining >= daysLeft } });
    } else if (scheduledOn(h, date)) {
      out.push({ habit: h, credit, log });
    }
  }
  return out;
}

/** Planned habit count and credit for a day, as used by the daily completion figures. */
export function dayHabitTotals(s: Snapshot, date: DateStr): { planned: number; credit: number } {
  let planned = 0;
  let credit = 0;
  for (const p of habitsForDay(s, date)) {
    if (p.week && !p.week.neededToday && !p.log) continue; // optional today
    planned++;
    credit += p.credit;
  }
  return { planned, credit };
}

/** Completed ÷ scheduled across all habits over a date range (partial = half). Pending excluded. */
export function overallConsistency(s: Snapshot, from: DateStr, to: DateStr): { credit: number; total: number; rate: number | null } {
  let credit = 0;
  let total = 0;
  for (const h of s.habits) {
    for (const o of occurrences(s, h, from, to)) {
      if (o.pending) continue;
      // Weekly occurrences only count when the whole week is inside the range.
      if (isWeeklyHabit(h) && (o.key < from || addDays(o.key, 6) > to)) continue;
      total++;
      credit += o.credit;
    }
  }
  return { credit, total, rate: total ? credit / total : null };
}

export function habitXp(s: Snapshot, h: Habit): number {
  if (h.xpOverride !== null && h.xpOverride !== undefined) return h.xpOverride;
  const x = s.settings.xp;
  return h.difficulty === 'easy' ? x.habitEasy : h.difficulty === 'hard' ? x.habitHard : x.habitMedium;
}

export function canLogHabit(today: DateStr, date: DateStr) {
  return date <= today && date > addDays(today, -HABIT_EDIT_DAYS);
}
