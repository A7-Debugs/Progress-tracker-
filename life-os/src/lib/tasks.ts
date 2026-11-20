import { addDays, dayOfWeek, daysBetween, weekStart } from './dates';
import type { Snapshot } from './snapshot';
import type { DateStr, Recurrence, Task } from './types';

/** A deadline within this many days makes a task urgent automatically. */
export const URGENT_WITHIN_DAYS = 2;
export const MAX_MITS = 3;

export function isOverdue(t: Task, today: DateStr) {
  return !t.done && !!t.dueDate && t.dueDate < today;
}

export function isUrgent(t: Task, today: DateStr) {
  return t.urgent || (!!t.dueDate && daysBetween(today, t.dueDate) <= URGENT_WITHIN_DAYS);
}

export type Quadrant = 1 | 2 | 3 | 4;

export const QUADRANTS: Record<Quadrant, { title: string; action: string; color: string }> = {
  1: { title: 'Important & urgent', action: 'Do now', color: 'var(--danger)' },
  2: { title: 'Important, not urgent', action: 'Schedule', color: 'var(--accent)' },
  3: { title: 'Urgent, not important', action: 'Delegate or batch', color: 'var(--warning)' },
  4: { title: 'Neither', action: 'Drop or defer', color: 'var(--fg-3)' },
};

/** Eisenhower quadrant. P1/P2 tasks and tasks serving an active goal are treated as important. */
export function quadrant(s: Snapshot, t: Task): Quadrant {
  const imp = isImportant(s, t);
  const urg = isUrgent(t, s.today);
  return imp && urg ? 1 : imp ? 2 : urg ? 3 : 4;
}

export function isImportant(s: Snapshot, t: Task) {
  if (t.important) return true;
  if (t.priority <= 2) return true;
  const g = t.goalId ? s.goalById.get(t.goalId) : undefined;
  return !!g && g.status === 'active' && g.priority <= 2;
}

export interface ScorePart {
  label: string;
  points: number;
}

/**
 * Priority score combining importance, urgency, difficulty, time required and strategic relevance.
 * Every point is explained, so the ordering is never a black box.
 */
export function taskScore(s: Snapshot, t: Task): { score: number; parts: ScorePart[] } {
  const parts: ScorePart[] = [];
  parts.push({ label: `Priority P${t.priority}`, points: { 1: 40, 2: 28, 3: 16, 4: 6 }[t.priority] });
  if (isImportant(s, t)) parts.push({ label: 'Important', points: 15 });
  if (t.dueDate) {
    const d = daysBetween(s.today, t.dueDate);
    if (d < 0) parts.push({ label: `Overdue by ${-d}d`, points: 30 });
    else if (d === 0) parts.push({ label: 'Due today', points: 25 });
    else if (d <= URGENT_WITHIN_DAYS) parts.push({ label: `Due in ${d}d`, points: 18 });
    else if (d <= 7) parts.push({ label: 'Due this week', points: 8 });
  } else if (t.urgent) parts.push({ label: 'Marked urgent', points: 18 });
  const g = t.goalId ? s.goalById.get(t.goalId) : undefined;
  if (g && g.status === 'active') parts.push({ label: `Serves "${g.title}"`, points: 6 + (4 - g.priority) * 3 });
  if (t.milestoneId) parts.push({ label: 'Moves a milestone', points: 5 });
  if (t.estimateMin !== null && t.estimateMin <= 15) parts.push({ label: 'Quick win (≤15 min)', points: 4 });
  if (t.difficulty === 'hard' && t.estimateMin !== null && t.estimateMin >= 120) parts.push({ label: 'Large: break it down', points: -4 });
  if (t.postponed >= 2) parts.push({ label: `Postponed ${t.postponed}×`, points: 3 });
  return { score: parts.reduce((a, p) => a + p.points, 0), parts };
}

export function sortByScore(s: Snapshot, tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => taskScore(s, b).score - taskScore(s, a).score || a.createdAt - b.createdAt);
}

export type TaskFilter = 'today' | 'tomorrow' | 'week' | 'overdue' | 'upcoming' | 'inbox' | 'completed' | 'all';

/** The date a task belongs to: the planned day, else the deadline. */
export function taskDay(t: Task): DateStr | null {
  return t.plannedDate ?? t.dueDate;
}

export function filterTasks(s: Snapshot, f: TaskFilter): Task[] {
  const today = s.today;
  const tomorrow = addDays(today, 1);
  const we = addDays(weekStart(today), 6);
  return s.tasks.filter((t) => {
    if (f === 'completed') return t.done;
    if (f === 'all') return !t.done;
    if (t.done) return false;
    const day = taskDay(t);
    switch (f) {
      case 'today':
        return (!!day && day <= today) || (!!t.dueDate && t.dueDate <= today);
      case 'tomorrow':
        return day === tomorrow;
      case 'week':
        return !!day && day <= we;
      case 'overdue':
        return isOverdue(t, today) || (!!t.plannedDate && t.plannedDate < today);
      case 'upcoming':
        return !!day && day > today;
      case 'inbox':
        return !day;
    }
  });
}

/** Tasks that make up "today": planned or due today, carried over, plus anything completed today. */
export function todaysTasks(s: Snapshot, date: DateStr = s.today): { open: Task[]; done: Task[] } {
  const open = date === s.today ? filterTasks(s, 'today') : s.tasks.filter((t) => !t.done && taskDay(t) === date);
  const done = s.tasks.filter((t) => t.done && t.completedDate === date);
  return { open, done };
}

export function mitsFor(s: Snapshot, date: DateStr): Task[] {
  return s.tasks.filter((t) => t.mit && (t.plannedDate === date || (t.done && t.completedDate === date && t.plannedDate !== null && t.plannedDate <= date))).sort((a, b) => a.order - b.order);
}

// ───────────────────────────── Recurrence ─────────────────────────────

export function advance(date: DateStr, r: Recurrence): DateStr {
  const n = Math.max(1, r.interval || 1);
  switch (r.type) {
    case 'daily':
      return addDays(date, n);
    case 'weekly':
      return addDays(date, 7 * n);
    case 'weekdays': {
      let d = addDays(date, 1);
      while (dayOfWeek(d) === 0 || dayOfWeek(d) === 6) d = addDays(d, 1);
      return d;
    }
    case 'monthly': {
      const [y, m, day] = date.split('-').map(Number);
      const total = y * 12 + (m - 1) + n;
      const ny = Math.floor(total / 12);
      const nm = (total % 12) + 1;
      const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
      return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
    }
    case 'none':
      return date;
  }
}

/** The next occurrence after `today`, stepping from the task's own date so the rhythm is kept. */
export function nextOccurrence(base: DateStr, r: Recurrence, today: DateStr): DateStr {
  let d = advance(base, r);
  let guard = 0;
  while (d <= today && guard++ < 1000) d = advance(d, r);
  return d;
}

export function recurrenceLabel(r: Recurrence): string {
  const n = Math.max(1, r.interval || 1);
  switch (r.type) {
    case 'none':
      return 'Does not repeat';
    case 'daily':
      return n === 1 ? 'Every day' : `Every ${n} days`;
    case 'weekdays':
      return 'Every weekday';
    case 'weekly':
      return n === 1 ? 'Every week' : `Every ${n} weeks`;
    case 'monthly':
      return n === 1 ? 'Every month' : `Every ${n} months`;
  }
}

export function taskXp(s: Snapshot, t: Task): number {
  const x = s.settings.xp;
  return t.difficulty === 'easy' ? x.taskEasy : t.difficulty === 'hard' ? x.taskHard : x.taskMedium;
}

/** Minutes of focus logged against a task. */
export function actualMinutes(s: Snapshot, taskId: string): number {
  return s.focusSessions.filter((f) => f.taskId === taskId).reduce((a, f) => a + f.minutes, 0);
}
