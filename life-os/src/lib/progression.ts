import { addDays, dateRange, weekStart } from './dates';
import type { Snapshot } from './snapshot';
import type { DateStr, Horizon } from './types';
import { habitStats, habitXp, isWeeklyHabit, overallConsistency, PARTIAL_CREDIT } from './habits';
import { goalAgeOk } from './goals';
import { taskXp } from './tasks';

// ───────────────────────────── Levels ─────────────────────────────

/**
 * XP to go from level L to L+1 = 50 × (L + 1) × pace.
 * Totals: L2 100 · L3 250 · L4 450 · L5 700 · L10 2,700 · L20 10,450 · each level harder than the last.
 */
export const MAX_LEVEL = 100;

export function xpToNext(level: number, pace = 1): number {
  return Math.round(50 * (level + 1) * pace);
}

export function totalXpForLevel(level: number, pace = 1): number {
  let t = 0;
  for (let l = 1; l < level; l++) t += xpToNext(l, pace);
  return t;
}

export interface LevelInfo {
  level: number;
  into: number;
  needed: number;
  remaining: number;
  progress: number;
  total: number;
}

export function levelFromXp(totalXp: number, pace = 1): LevelInfo {
  const total = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let floor = 0;
  while (level < MAX_LEVEL && total >= floor + xpToNext(level, pace)) {
    floor += xpToNext(level, pace);
    level++;
  }
  const needed = xpToNext(level, pace);
  const into = total - floor;
  return { level, into, needed, remaining: needed - into, progress: Math.min(1, into / needed), total };
}

export const STAGES = [
  { level: 1, name: 'Foundation' },
  { level: 5, name: 'Momentum' },
  { level: 10, name: 'Discipline' },
  { level: 15, name: 'Mastery' },
  { level: 25, name: 'Command' },
];
export function stageFor(level: number) {
  let n = STAGES[0].name;
  for (const s of STAGES) if (level >= s.level) n = s.name;
  return n;
}

// ───────────────────────────── XP ledger ─────────────────────────────

export type XpSource = 'habit' | 'task' | 'milestone' | 'goal' | 'review' | 'consistency' | 'focus' | 'achievement';

export interface XpEntry {
  id: string;
  date: DateStr;
  amount: number;
  source: XpSource;
  label: string;
  /** Set when the award was reduced or withheld, with the reason. */
  note?: string;
}

const HORIZON_MULT: Record<Horizon, number> = { weekly: 0.1, monthly: 0.25, quarterly: 0.5, annual: 1, vision: 2 };
const DIFF_MULT = { easy: 0.75, medium: 1, hard: 1.5 };

/**
 * The XP ledger is derived from the raw data on every read, never stored. That makes it impossible to
 * double-award, and unticking something always removes exactly what it earned. Anti-farming rules:
 * - Task XP has a daily cap; a habit earns at most once per day and a weekly habit at most its target per week.
 * - Milestones ticked on the day they were added and goals completed too soon after creation earn nothing.
 * - Focus XP has a daily cap, and sessions under 25 minutes earn nothing.
 */
export function xpLedger(s: Snapshot): XpEntry[] {
  const out: XpEntry[] = [];
  const x = s.settings.xp;
  const start = s.profile.startDate;

  // Habits
  for (const h of s.habits) {
    const xp = habitXp(s, h);
    const perWeek = new Map<DateStr, number>();
    const logs = [...s.habitLogs.values()].filter((l) => l.habitId === h.id && l.date >= start && l.date <= s.today && l.status !== 'missed').sort((a, b) => a.date.localeCompare(b.date));
    for (const l of logs) {
      if (isWeeklyHabit(h)) {
        const ws = weekStart(l.date);
        const n = perWeek.get(ws) ?? 0;
        if (n >= Math.max(1, h.frequency.timesPerWeek)) continue;
        perWeek.set(ws, n + 1);
      }
      const amount = Math.round(l.status === 'done' ? xp : xp * PARTIAL_CREDIT);
      if (amount > 0) out.push({ id: `h:${h.id}:${l.date}`, date: l.date, amount, source: 'habit', label: l.status === 'done' ? h.name : `${h.name} (minimum)` });
    }
  }

  // Tasks, with a daily cap
  const byDay = new Map<DateStr, { id: string; amount: number; label: string; ts: number }[]>();
  for (const t of s.tasks) {
    if (!t.done || !t.completedDate) continue;
    const arr = byDay.get(t.completedDate) ?? [];
    arr.push({ id: `t:${t.id}`, amount: taskXp(s, t), label: t.title, ts: t.completedAt ?? 0 });
    byDay.set(t.completedDate, arr);
  }
  for (const [date, arr] of byDay) {
    let left = x.dailyTaskCap;
    for (const e of arr.sort((a, b) => a.ts - b.ts)) {
      const amount = Math.max(0, Math.min(e.amount, left));
      left -= amount;
      out.push({ id: e.id, date, amount, source: 'task', label: e.label, note: amount < e.amount ? `Daily task XP cap (${x.dailyTaskCap}) reached` : undefined });
    }
  }

  // Milestones
  for (const m of s.milestones) {
    if (!m.done || !m.completedDate) continue;
    const g = s.goalById.get(m.goalId);
    if (!g || g.status === 'archived') continue;
    const base = m.weight === 3 ? x.majorMilestone : m.weight === 1 ? Math.round(x.milestone / 2) : x.milestone;
    // Ticked within 12 hours of being added = it was already done; recording it earns nothing.
    const sameDay = m.completedAt !== null && m.completedAt - m.createdAt < 12 * 3600 * 1000;
    out.push({ id: `m:${m.id}`, date: m.completedDate, amount: sameDay ? 0 : base, source: 'milestone', label: m.title, note: sameDay ? 'Completed when added: no XP' : undefined });
  }

  // Goals
  for (const g of s.goals) {
    if (g.status !== 'completed' || !g.completedDate) continue;
    const amount = Math.round(x.goal * HORIZON_MULT[g.horizon] * DIFF_MULT[g.difficulty]);
    const ok = goalAgeOk(g);
    out.push({ id: `g:${g.id}`, date: g.completedDate, amount: ok ? amount : 0, source: 'goal', label: `Goal achieved: ${g.title}`, note: ok ? undefined : 'Completed too soon after it was set: no XP' });
  }

  // Weekly reviews (must be written once the week is mostly over)
  for (const r of s.weeklyReviews.values()) {
    const hasContent = r.wins.trim() || r.challenges.trim() || r.lessons.trim() || r.nextFocus.some((f) => f.trim());
    if (!hasContent) continue;
    out.push({ id: `wr:${r.id}`, date: minDate(addDays(r.id, 6), s.today), amount: x.weeklyReview, source: 'review', label: 'Weekly review' });
  }

  // Consistency weeks: completed weeks with 80%+ habit consistency over at least 5 scheduled occurrences
  for (let ws = weekStart(start); addDays(ws, 6) < s.today; ws = addDays(ws, 7)) {
    const c = overallConsistency(s, ws, addDays(ws, 6));
    if (c.total >= 5 && c.rate !== null && c.rate >= 0.8) out.push({ id: `cw:${ws}`, date: addDays(ws, 6), amount: x.consistencyWeek, source: 'consistency', label: `Consistent week (${Math.round(c.rate * 100)}%)` });
  }

  // Focus, capped daily
  for (const [date, min] of s.focusByDate) {
    if (date < start || date > s.today) continue;
    const raw = Math.floor(min / 25) * x.focusPer25;
    const amount = Math.min(raw, x.dailyFocusCap);
    if (raw > 0) out.push({ id: `f:${date}`, date, amount, source: 'focus', label: `${min} focused minutes`, note: amount < raw ? `Daily focus XP cap (${x.dailyFocusCap}) reached` : undefined });
  }

  // Achievements (permanent once unlocked)
  for (const a of s.achievements.values()) {
    const def = ACHIEVEMENT_BY_ID[a.id];
    if (def && def.xp > 0) out.push({ id: `a:${a.id}`, date: a.date, amount: def.xp, source: 'achievement', label: `Achievement: ${def.name}` });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const minDate = (a: DateStr, b: DateStr) => (a < b ? a : b);

export function totalXp(ledger: XpEntry[]) {
  return ledger.reduce((a, e) => a + e.amount, 0);
}

export function xpBetween(ledger: XpEntry[], from: DateStr, to: DateStr) {
  return ledger.filter((e) => e.date >= from && e.date <= to).reduce((a, e) => a + e.amount, 0);
}

export function levelInfo(s: Snapshot, ledger = xpLedger(s)) {
  return levelFromXp(totalXp(ledger), s.settings.levelPace);
}

// ───────────────────────────── Achievements ─────────────────────────────

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
  /** Returns current and target values so progress can be shown. */
  progress: (st: AchievementStats) => [number, number];
}

export interface AchievementStats {
  daysSinceStart: number;
  weeksWithActivity: number;
  bestRolling30: number;
  rolling30Days: number;
  tasksDone: number;
  goalsDone: number;
  majorGoalsDone: number;
  milestonesDone: number;
  focusHours: number;
  bestHabitStreakDays: number;
  reviews: number;
  journalEntries: number;
  booksRead: number;
  learningDone: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-week', name: 'First Week Completed', description: 'Use Life OS across a full first week, with activity in it.', icon: 'CalendarCheck', xp: 50, progress: (s) => [Math.min(s.daysSinceStart, 7), 7] },
  { id: 'first-milestone', name: 'First Milestone', description: 'Achieve your first goal milestone.', icon: 'Flag', xp: 25, progress: (s) => [s.milestonesDone, 1] },
  { id: 'first-review', name: 'Reflective', description: 'Complete your first weekly review.', icon: 'NotebookPen', xp: 25, progress: (s) => [s.reviews, 1] },
  { id: 'consistency-30', name: '30-Day Consistency', description: '80%+ habit consistency across 30 days.', icon: 'Activity', xp: 150, progress: (s) => [s.rolling30Days >= 30 ? Math.round(s.bestRolling30 * 100) : 0, 80] },
  { id: 'tasks-100', name: '100 Tasks Completed', description: 'Complete 100 tasks.', icon: 'ListChecks', xp: 100, progress: (s) => [s.tasksDone, 100] },
  { id: 'milestones-10', name: 'Ten Milestones', description: 'Achieve 10 milestones.', icon: 'Milestone', xp: 100, progress: (s) => [s.milestonesDone, 10] },
  { id: 'first-major-goal', name: 'First Major Goal Achieved', description: 'Achieve an annual objective or long-term vision.', icon: 'Trophy', xp: 250, progress: (s) => [s.majorGoalsDone, 1] },
  { id: 'focus-100', name: '100 Hours of Focused Work', description: 'Log 100 hours of focused work.', icon: 'Timer', xp: 200, progress: (s) => [Math.floor(s.focusHours), 100] },
  { id: 'streak-90', name: '90-Day Habit Streak', description: 'Keep a daily habit going for 90 days.', icon: 'Flame', xp: 250, progress: (s) => [s.bestHabitStreakDays, 90] },
  { id: 'goals-5', name: 'Five Goals Completed', description: 'Achieve five goals of any size.', icon: 'Target', xp: 200, progress: (s) => [s.goalsDone, 5] },
  { id: 'reviews-12', name: 'A Quarter of Reviews', description: 'Complete 12 weekly reviews.', icon: 'CalendarRange', xp: 150, progress: (s) => [s.reviews, 12] },
  { id: 'journal-30', name: 'Thirty Reflections', description: 'Write 30 journal entries.', icon: 'BookOpen', xp: 100, progress: (s) => [s.journalEntries, 30] },
  { id: 'books-10', name: 'Ten Books', description: 'Finish 10 books.', icon: 'Library', xp: 150, progress: (s) => [s.booksRead, 10] },
  { id: 'learning-5', name: 'Lifelong Learner', description: 'Complete five courses, qualifications or skills.', icon: 'GraduationCap', xp: 150, progress: (s) => [s.learningDone, 5] },
];
export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export function achievementStats(s: Snapshot): AchievementStats {
  const start = s.profile.startDate;
  const daysSinceStart = start <= s.today ? dateRange(start, s.today).length - 1 : 0;
  const activeDates = new Set<DateStr>();
  for (const l of s.habitLogs.values()) if (l.status !== 'missed') activeDates.add(l.date);
  for (const t of s.tasks) if (t.done && t.completedDate) activeDates.add(t.completedDate);
  const weeks = new Set([...activeDates].map(weekStart));
  // Best rolling 30-day consistency, sampled weekly to stay fast.
  let best = 0;
  let rolling30Days = 0;
  if (daysSinceStart >= 29) {
    rolling30Days = 30;
    for (let end = addDays(start, 29); end <= addDays(s.today, -1); end = addDays(end, 7)) {
      const c = overallConsistency(s, addDays(end, -29), end);
      if (c.total >= 20 && c.rate !== null) best = Math.max(best, c.rate);
    }
    const c = overallConsistency(s, addDays(s.today, -30), addDays(s.today, -1));
    if (c.total >= 20 && c.rate !== null) best = Math.max(best, c.rate);
  }
  let bestStreak = 0;
  for (const h of s.habits) if (h.frequency.type === 'daily') bestStreak = Math.max(bestStreak, habitStats(s, h).longest);
  const goalsDone = s.goals.filter((g) => g.status === 'completed' && goalAgeOk(g));
  return {
    daysSinceStart: weeks.size > 0 ? daysSinceStart : 0,
    weeksWithActivity: weeks.size,
    bestRolling30: best,
    rolling30Days,
    tasksDone: s.tasks.filter((t) => t.done).length,
    goalsDone: goalsDone.length,
    majorGoalsDone: goalsDone.filter((g) => g.horizon === 'annual' || g.horizon === 'vision').length,
    milestonesDone: s.milestones.filter((m) => m.done).length,
    focusHours: s.focusSessions.reduce((a, f) => a + f.minutes, 0) / 60,
    bestHabitStreakDays: bestStreak,
    reviews: [...s.weeklyReviews.values()].filter((r) => r.wins.trim() || r.nextFocus.some((f) => f.trim())).length,
    journalEntries: [...s.journal.values()].filter((j) => (j.reflection + j.lessons + j.challenges + j.accomplishments + j.improvements).trim().length > 0).length,
    booksRead: s.learning.filter((l) => l.type === 'book' && l.status === 'completed').length,
    learningDone: s.learning.filter((l) => l.type !== 'book' && l.status === 'completed').length,
  };
}

export function achievementDone(def: AchievementDef, st: AchievementStats) {
  const [v, t] = def.progress(st);
  return v >= t;
}
