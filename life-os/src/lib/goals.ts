import { addDays, daysBetween } from './dates';
import type { Snapshot } from './snapshot';
import type { DateStr, Goal, Horizon, Milestone } from './types';

export const HORIZONS: { id: Horizon; label: string; short: string; child: Horizon | null }[] = [
  { id: 'vision', label: 'Long-term vision', short: 'Vision', child: 'annual' },
  { id: 'annual', label: 'Annual objective', short: 'Annual', child: 'quarterly' },
  { id: 'quarterly', label: 'Quarterly milestone', short: 'Quarter', child: 'monthly' },
  { id: 'monthly', label: 'Monthly target', short: 'Month', child: 'weekly' },
  { id: 'weekly', label: 'Weekly action', short: 'Week', child: null },
];
export const HORIZON_BY_ID = Object.fromEntries(HORIZONS.map((h) => [h.id, h])) as Record<Horizon, (typeof HORIZONS)[number]>;
export const HORIZON_RANK: Record<Horizon, number> = { vision: 0, annual: 1, quarterly: 2, monthly: 3, weekly: 4 };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Goals that still count (archived goals are kept for history but leave every calculation). */
export function liveGoals(s: Snapshot): Goal[] {
  return s.goals.filter((g) => g.status !== 'archived');
}

export function childrenOf(s: Snapshot, goalId: string): Goal[] {
  return s.goals.filter((g) => g.parentId === goalId && g.status !== 'archived');
}

function milestonesAt(ms: Milestone[], at: DateStr | null): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const m of ms) {
    total += m.weight;
    if (m.done && (at === null || (m.completedDate ?? '9999') <= at)) done += m.weight;
  }
  return { done, total };
}

/** The goal's measured value on a date: the last recorded update on or before it. */
export function valueAt(s: Snapshot, g: Goal, at: DateStr | null): number {
  if (at === null) return g.currentValue;
  let v = g.startValue;
  for (const u of s.goalUpdates) {
    if (u.goalId !== g.id) continue;
    if (u.date > at) break;
    v = u.value;
  }
  return v;
}

export function numericProgress(start: number, target: number, current: number): number | null {
  if (start === target) return current === target ? 1 : null;
  return clamp01((current - start) / (target - start));
}

export interface GoalProgress {
  /** 0..1, or null when there is nothing measurable yet. */
  value: number | null;
  milestones: { done: number; total: number; count: number; doneCount: number };
  numeric: number | null;
  source: string;
}

/**
 * Goal progress comes only from outcomes (milestones achieved, measured values, sub-goals), never from
 * how many tasks were ticked off. `at` reconstructs progress on a past date for charts.
 */
export function goalProgress(s: Snapshot, g: Goal, at: DateStr | null = null, depth = 0): GoalProgress {
  const ms = s.milestonesByGoal.get(g.id) ?? [];
  const mw = milestonesAt(ms, at);
  const milestones = { ...mw, count: ms.length, doneCount: ms.filter((m) => m.done && (at === null || (m.completedDate ?? '9999') <= at)).length };
  const completed = g.status === 'completed' && (at === null || (g.completedDate ?? '9999') <= at);
  const numeric = g.measurement === 'numeric' || g.measurement === 'hybrid' ? numericProgress(g.startValue, g.targetValue, valueAt(s, g, at)) : null;
  if (at !== null && at < g.startDate) return { value: null, milestones, numeric, source: 'Not started' };
  if (completed) return { value: 1, milestones, numeric, source: 'Achieved' };
  const mProg = mw.total ? mw.done / mw.total : null;
  let value: number | null = null;
  let source = '';
  switch (g.measurement) {
    case 'milestones':
      value = mProg;
      source = ms.length ? `${milestones.doneCount} of ${ms.length} milestones` : 'Add milestones to measure progress';
      break;
    case 'numeric':
      value = numeric;
      source = `${fmtValue(valueAt(s, g, at), g.unit)} of ${fmtValue(g.targetValue, g.unit)}`;
      break;
    case 'hybrid': {
      const parts = [mProg, numeric].filter((x): x is number => x !== null);
      value = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
      source = `Milestones and ${g.unit || 'measured value'}`;
      break;
    }
    case 'children': {
      if (depth > 6) break;
      const kids = childrenOf(s, g.id).filter((k) => at === null || k.startDate <= at);
      const vals = kids.map((k) => goalProgress(s, k, at, depth + 1).value ?? 0);
      // Milestones directly on the parent count as one more "child".
      if (mProg !== null) vals.push(mProg);
      value = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      source = kids.length ? `Average of ${kids.length} sub-goal${kids.length === 1 ? '' : 's'}` : 'Add sub-goals to measure progress';
      break;
    }
    case 'binary':
      value = 0;
      source = 'Achieved or not';
      break;
  }
  return { value, milestones, numeric, source };
}

export function fmtValue(v: number, unit: string): string {
  const n = Math.abs(v) >= 1000 ? v.toLocaleString('en-GB', { maximumFractionDigits: 0 }) : String(Math.round(v * 100) / 100);
  if (!unit) return n;
  if (unit.startsWith('£')) return `£${n}${unit.length > 1 ? unit.slice(1) : ''}`;
  return `${n} ${unit}`;
}

export type PaceStatus = 'achieved' | 'ahead' | 'on-track' | 'behind' | 'at-risk' | 'overdue' | 'no-date' | 'no-data';

export interface GoalPace {
  status: PaceStatus;
  expected: number | null;
  daysLeft: number | null;
  label: string;
}

/** Compares progress with the share of time elapsed between start and target date. */
export function goalPace(s: Snapshot, g: Goal): GoalPace {
  const p = goalProgress(s, g).value;
  if (g.status === 'completed') return { status: 'achieved', expected: null, daysLeft: null, label: 'Achieved' };
  if (!g.targetDate) return { status: 'no-date', expected: null, daysLeft: null, label: 'No target date' };
  const daysLeft = daysBetween(s.today, g.targetDate);
  const span = Math.max(1, daysBetween(g.startDate, g.targetDate));
  const expected = clamp01(daysBetween(g.startDate, s.today) / span);
  if (daysLeft < 0) return { status: 'overdue', expected: 1, daysLeft, label: `Target date passed ${-daysLeft}d ago` };
  if (p === null) return { status: 'no-data', expected, daysLeft, label: 'Not measurable yet' };
  const gap = p - expected;
  if (gap >= 0.1) return { status: 'ahead', expected, daysLeft, label: 'Ahead of schedule' };
  if (gap >= -0.1) return { status: 'on-track', expected, daysLeft, label: 'On track' };
  if (gap >= -0.25) return { status: 'behind', expected, daysLeft, label: `${Math.round(-gap * 100)}% behind schedule` };
  return { status: 'at-risk', expected, daysLeft, label: `${Math.round(-gap * 100)}% behind: at risk` };
}

export const PACE_COLOR: Record<PaceStatus, string> = {
  achieved: 'var(--success)',
  ahead: 'var(--success)',
  'on-track': 'var(--accent)',
  behind: 'var(--warning)',
  'at-risk': 'var(--danger)',
  overdue: 'var(--danger)',
  'no-date': 'var(--fg-3)',
  'no-data': 'var(--fg-3)',
};

/** The next milestone to work on: the first unfinished one by due date, then by order. */
export function nextMilestone(s: Snapshot, g: Goal): Milestone | null {
  const open = (s.milestonesByGoal.get(g.id) ?? []).filter((m) => !m.done);
  if (!open.length) return null;
  return [...open].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.order - b.order)[0];
}

/** Ancestors from the top of the hierarchy down to (not including) the goal. */
export function goalPath(s: Snapshot, g: Goal): Goal[] {
  const out: Goal[] = [];
  let cur = g.parentId ? s.goalById.get(g.parentId) : undefined;
  let guard = 0;
  while (cur && guard++ < 8) {
    out.unshift(cur);
    cur = cur.parentId ? s.goalById.get(cur.parentId) : undefined;
  }
  return out;
}

/** Can `parentId` be the parent of goal `id`? (No cycles, and a parent must sit higher in the hierarchy.) */
export function validParent(s: Snapshot, id: string | undefined, horizon: Horizon, parentId: string): boolean {
  const p = s.goalById.get(parentId);
  if (!p || p.id === id) return false;
  if (HORIZON_RANK[p.horizon] >= HORIZON_RANK[horizon]) return false;
  let cur: Goal | undefined = p;
  let guard = 0;
  while (cur && guard++ < 10) {
    if (cur.id === id) return false;
    cur = cur.parentId ? s.goalById.get(cur.parentId) : undefined;
  }
  return true;
}

/** Linked work vs. real progress: tasks done for this goal in a window, and how much the goal moved. */
export function effortVsOutcome(s: Snapshot, g: Goal, from: DateStr, to: DateStr): { tasksDone: number; focusMin: number; progressDelta: number | null } {
  const ids = new Set([g.id, ...descendants(s, g.id).map((d) => d.id)]);
  const tasksDone = s.tasks.filter((t) => t.done && t.goalId && ids.has(t.goalId) && t.completedDate && t.completedDate >= from && t.completedDate <= to).length;
  const taskIds = new Set(s.tasks.filter((t) => t.goalId && ids.has(t.goalId)).map((t) => t.id));
  const focusMin = s.focusSessions.filter((f) => f.date >= from && f.date <= to && ((f.goalId && ids.has(f.goalId)) || (f.taskId && taskIds.has(f.taskId)))).reduce((a, f) => a + f.minutes, 0);
  const before = goalProgress(s, g, dayBefore(from)).value;
  const after = goalProgress(s, g, to).value;
  return { tasksDone, focusMin, progressDelta: after === null ? null : after - (before ?? 0) };
}

const dayBefore = (d: DateStr) => addDays(d, -1);

export function descendants(s: Snapshot, id: string, depth = 0): Goal[] {
  if (depth > 6) return [];
  const kids = s.goals.filter((g) => g.parentId === id);
  return kids.flatMap((k) => [k, ...descendants(s, k.id, depth + 1)]);
}

/** Goals that have been active long enough to earn completion XP (anti-farming). */
export const MIN_GOAL_AGE_DAYS: Record<Horizon, number> = { weekly: 2, monthly: 7, quarterly: 14, annual: 30, vision: 30 };

export function goalAgeOk(g: Goal): boolean {
  if (!g.completedDate) return false;
  return daysBetween(g.startDate, g.completedDate) >= MIN_GOAL_AGE_DAYS[g.horizon];
}
