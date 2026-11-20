import { addDays, dateRange, dayOfWeek, DAY_SHORT, monthStart, weekStart } from './dates';
import type { Snapshot } from './snapshot';
import type { DateStr, Goal, Task } from './types';
import { dayHabitTotals, habitStats, isWeeklyHabit, overallConsistency } from './habits';
import { effortVsOutcome, goalPace, goalProgress, HORIZON_RANK, liveGoals } from './goals';
import { mitsFor, taskDay, todaysTasks } from './tasks';
import { xpBetween, type XpEntry } from './progression';

const pct = (a: number, b: number) => (b > 0 ? a / b : null);

// ───────────────────────────── A single day ─────────────────────────────

export interface DayMetrics {
  date: DateStr;
  habitsPlanned: number;
  habitCredit: number;
  tasksPlanned: number;
  tasksDone: number;
  tasksRemaining: number;
  mitsPlanned: number;
  mitsDone: number;
  focusMin: number;
  /** Habits + tasks done ÷ planned (partial habits count half). */
  completion: number | null;
  /** 0..100, see productivityScore. */
  productivity: number | null;
  productivityParts: { label: string; weight: number; value: number }[];
}

/**
 * Daily productivity score (0–100), re-weighted over the parts that apply that day:
 * habits 40% · tasks 40% (Most Important Tasks count double) · focus time vs. daily target 20%.
 */
export function dayMetrics(s: Snapshot, date: DateStr = s.today): DayMetrics {
  const h = dayHabitTotals(s, date);
  const t = todaysTasks(s, date);
  // Tasks planned for the day = still open for it + completed on it.
  const tasksPlanned = t.open.length + t.done.length;
  const mits = mitsFor(s, date);
  const mitsDone = mits.filter((m) => m.done).length;
  const focusMin = s.focusByDate.get(date) ?? 0;
  const completion = pct(h.credit + t.done.length, h.planned + tasksPlanned);
  const parts: DayMetrics['productivityParts'] = [];
  if (h.planned) parts.push({ label: 'Habits', weight: 40, value: h.credit / h.planned });
  if (tasksPlanned) {
    const openMits = t.open.filter((x) => x.mit && x.plannedDate === date).length;
    const weighted = (t.done.length + mitsDone) / (tasksPlanned + mitsDone + openMits);
    parts.push({ label: 'Tasks (MITs ×2)', weight: 40, value: weighted });
  }
  if (s.settings.dailyFocusTargetMin > 0 && (focusMin > 0 || parts.length)) parts.push({ label: 'Focus time', weight: 20, value: Math.min(1, focusMin / s.settings.dailyFocusTargetMin) });
  const w = parts.reduce((a, p) => a + p.weight, 0);
  const productivity = parts.length && (h.planned || tasksPlanned || focusMin) ? Math.round((parts.reduce((a, p) => a + p.weight * p.value, 0) / w) * 100) : null;
  return {
    date,
    habitsPlanned: h.planned,
    habitCredit: h.credit,
    tasksPlanned,
    tasksDone: t.done.length,
    tasksRemaining: t.open.length,
    mitsPlanned: mits.length,
    mitsDone,
    focusMin,
    completion,
    productivity,
    productivityParts: parts,
  };
}

/** Same as dayMetrics but for a past date: tasks planned that day (whether or not finished on it). */
export function pastDayCompletion(s: Snapshot, date: DateStr): number | null {
  const h = dayHabitTotals(s, date);
  const planned = s.tasks.filter((t) => taskDay(t) === date || (t.done && t.completedDate === date));
  const done = planned.filter((t) => t.done && t.completedDate !== null && t.completedDate <= date).length;
  return pct(h.credit + done, h.planned + planned.length);
}

// ───────────────────────────── A period (week / month) ─────────────────────────────

export interface PeriodMetrics {
  from: DateStr;
  to: DateStr;
  days: number;
  habitRate: number | null;
  habitCredit: number;
  habitTotal: number;
  tasksDone: number;
  tasksDue: number;
  taskRate: number | null;
  focusMin: number;
  /** Share of elapsed days with 60%+ completion. */
  consistency: number | null;
  activeDays: number;
  completion: number | null;
  goalDelta: number | null;
  milestonesDone: number;
  xp: number;
}

export const ACTIVE_DAY = 0.6;

export function periodMetrics(s: Snapshot, from: DateStr, to: DateStr, ledger: XpEntry[]): PeriodMetrics {
  const start = from < s.profile.startDate ? s.profile.startDate : from;
  const end = to > s.today ? s.today : to;
  const days = start <= end ? dateRange(start, end) : [];
  const habits = overallConsistency(s, start, end);
  // Tasks "due" in the period: deadline or planned day inside it, plus anything finished in it.
  const inRange = (d: DateStr | null) => !!d && d >= start && d <= end;
  const due = s.tasks.filter((t) => inRange(taskDay(t)) || (t.done && inRange(t.completedDate)));
  const tasksDone = s.tasks.filter((t) => t.done && inRange(t.completedDate)).length;
  const dueDone = due.filter((t) => t.done).length;
  let focusMin = 0;
  for (const d of days) focusMin += s.focusByDate.get(d) ?? 0;
  let scored = 0;
  let activeDays = 0;
  let compSum = 0;
  let compN = 0;
  for (const d of days) {
    const c = d === s.today ? dayMetrics(s, d).completion : pastDayCompletion(s, d);
    if (c === null) continue;
    scored++;
    compSum += c;
    compN++;
    if (c >= ACTIVE_DAY) activeDays++;
  }
  const goals = liveGoals(s).filter((g) => g.horizon !== 'vision' && g.status !== 'paused' && g.startDate <= end);
  let goalDelta: number | null = null;
  if (goals.length && days.length) {
    let sum = 0;
    let n = 0;
    for (const g of goals) {
      const a = goalProgress(s, g, addDays(start, -1)).value ?? 0;
      const b = goalProgress(s, g, end).value;
      if (b === null) continue;
      sum += b - a;
      n++;
    }
    goalDelta = n ? sum / n : null;
  }
  return {
    from: start,
    to: end,
    days: days.length,
    habitRate: habits.rate,
    habitCredit: habits.credit,
    habitTotal: habits.total,
    tasksDone,
    tasksDue: due.length,
    taskRate: pct(dueDone, due.length),
    focusMin,
    consistency: scored ? activeDays / scored : null,
    activeDays,
    completion: compN ? compSum / compN : null,
    goalDelta,
    milestonesDone: s.milestones.filter((m) => m.done && inRange(m.completedDate)).length,
    xp: days.length ? xpBetween(ledger, start, end) : 0,
  };
}

export function thisWeek(s: Snapshot, ledger: XpEntry[]) {
  const ws = weekStart(s.today);
  return periodMetrics(s, ws, addDays(ws, 6), ledger);
}

// ───────────────────────────── Insights ─────────────────────────────

export interface Insight {
  id: string;
  kind: 'positive' | 'warning' | 'neutral';
  title: string;
  detail: string;
  link?: string;
}

/** Minimum settled occurrences before a habit can be called "most consistent" or "neglected". */
const MIN_OCC = 5;

/**
 * Observations computed from the user's own records. Each one has a minimum-data rule; if there isn't
 * enough history it simply isn't shown. Nothing here is generated or estimated.
 */
export function insights(s: Snapshot): Insight[] {
  const out: Insight[] = [];
  const from = addDays(s.today, -27);
  const to = addDays(s.today, -1);

  // Most consistent / most neglected habit (last 4 weeks)
  const rated = s.habits
    .filter((h) => h.active)
    .map((h) => {
      const st = habitStats(s, h, isWeeklyHabit(h) ? weekStart(from) : from, to);
      return { h, st, n: st.done + st.partial + st.missed };
    })
    .filter((x) => x.st.rate !== null && x.n >= (isWeeklyHabit(x.h) ? 2 : MIN_OCC));
  if (rated.length) {
    const best = [...rated].sort((a, b) => b.st.rate! - a.st.rate! || b.n - a.n)[0];
    out.push({ id: 'best-habit', kind: 'positive', title: `Most consistent: ${best.h.name}`, detail: `${Math.round(best.st.rate! * 100)}% over the last 4 weeks (${best.st.done} done, ${best.st.partial} minimum, ${best.st.missed} missed).`, link: `/habits/${best.h.id}` });
    const worst = [...rated].sort((a, b) => a.st.rate! - b.st.rate!)[0];
    if (rated.length > 1 && worst.h.id !== best.h.id && worst.st.rate! < 0.7) {
      out.push({ id: 'worst-habit', kind: 'warning', title: `Most neglected: ${worst.h.name}`, detail: `${Math.round(worst.st.rate! * 100)}% over the last 4 weeks. ${worst.h.minimumVersion ? `Try the minimum version: "${worst.h.minimumVersion}".` : 'Consider a smaller minimum version or a different time of day.'}`, link: `/habits/${worst.h.id}` });
    }
  }

  // Best-performing day of the week (last 8 weeks, at least 2 samples per weekday)
  const byDow = new Map<number, number[]>();
  const start8 = addDays(s.today, -56) < s.profile.startDate ? s.profile.startDate : addDays(s.today, -56);
  if (start8 <= to) {
    for (const d of dateRange(start8, to)) {
      const c = pastDayCompletion(s, d);
      if (c === null) continue;
      const arr = byDow.get(dayOfWeek(d)) ?? [];
      arr.push(c);
      byDow.set(dayOfWeek(d), arr);
    }
  }
  const dows = [...byDow.entries()].filter(([, v]) => v.length >= 2).map(([d, v]) => ({ d, avg: v.reduce((a, b) => a + b, 0) / v.length, n: v.length }));
  if (dows.length >= 4) {
    const best = [...dows].sort((a, b) => b.avg - a.avg)[0];
    const worst = [...dows].sort((a, b) => a.avg - b.avg)[0];
    out.push({ id: 'best-day', kind: 'neutral', title: `Best day: ${FULL_DAY[best.d]}`, detail: `${Math.round(best.avg * 100)}% average completion on ${FULL_DAY[best.d]}s vs ${Math.round(worst.avg * 100)}% on ${FULL_DAY[worst.d]}s (${best.n}+ weeks of data).`, link: '/performance' });
  }

  // Frequently postponed tasks
  const postponed = s.tasks.filter((t) => !t.done && t.postponed >= 2).sort((a, b) => b.postponed - a.postponed);
  if (postponed.length) {
    const t = postponed[0];
    out.push({ id: 'postponed', kind: 'warning', title: `Postponed ${t.postponed}×: ${t.title}`, detail: postponed.length > 1 ? `${postponed.length} tasks have been pushed back twice or more. Break them down, schedule a block, or drop them.` : 'Break it into a smaller first step, schedule a time block, or decide to drop it.', link: `/tasks?task=${t.id}` });
  }

  // Effort vs outcome: lots of linked work but the goal didn't move
  // Most specific goals first, so the warning names the goal the work was actually for.
  for (const g of liveGoals(s).filter((g) => g.status === 'active').sort((a, b) => HORIZON_RANK[b.horizon] - HORIZON_RANK[a.horizon])) {
    const e = effortVsOutcome(s, g, addDays(s.today, -13), s.today);
    if (e.tasksDone >= 5 && e.progressDelta !== null && e.progressDelta <= 0.001) {
      out.push({ id: `busy-${g.id}`, kind: 'warning', title: `Busy, but "${g.title}" hasn't moved`, detail: `${e.tasksDone} linked tasks done in 2 weeks with no measurable progress. Check the tasks lead to a milestone, or update the measured value.`, link: `/goals/${g.id}` });
      break;
    }
  }

  // Areas requiring attention: categories with active goals but no activity for 14 days, or goals behind pace
  const since = addDays(s.today, -13);
  for (const c of s.categories) {
    const goals = liveGoals(s).filter((g) => g.categoryId === c.id && g.status === 'active');
    if (!goals.length) continue;
    const anyOld = goals.some((g) => g.startDate <= since);
    if (!anyOld) continue;
    if (!categoryActive(s, c.id, goals, since)) {
      out.push({ id: `idle-${c.id}`, kind: 'warning', title: `No activity in ${c.name}`, detail: `You have ${goals.length} active goal${goals.length > 1 ? 's' : ''} here but no habits, tasks, focus or milestones in the last 14 days.`, link: '/goals' });
    }
  }
  const behind = liveGoals(s)
    .filter((g) => g.status === 'active')
    .map((g) => ({ g, p: goalPace(s, g) }))
    .filter((x) => x.p.status === 'at-risk' || x.p.status === 'overdue');
  if (behind.length) {
    const x = behind[0];
    out.push({ id: `behind-${x.g.id}`, kind: 'warning', title: `${x.g.title}: ${x.p.label.toLowerCase()}`, detail: behind.length > 1 ? `${behind.length} goals are well behind their timeline. Re-plan the next milestone or move the target date.` : 'Re-plan the next milestone, add a weekly action, or set a realistic target date.', link: `/goals/${x.g.id}` });
  }

  // Workload: estimated work due in the next 7 days vs. focus you actually manage
  const wl = workload(s);
  if (wl && wl.ratio > 1.5) {
    out.push({ id: 'workload', kind: 'warning', title: 'Heavy week ahead', detail: `${fmtH(wl.estimateMin)} of estimated tasks are due in the next 7 days; you averaged ${fmtH(wl.avgWeeklyFocusMin)} of focused work per week over the last 4 weeks.`, link: '/tasks' });
  }
  return out;
}

const FULL_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const fmtH = (min: number) => `${(min / 60).toFixed(1)}h`;
export { DAY_SHORT };

function categoryActive(s: Snapshot, catId: string, goals: Goal[], since: DateStr): boolean {
  const ids = new Set(goals.map((g) => g.id));
  const habitIds = new Set(s.habits.filter((h) => h.categoryId === catId || (h.goalId && ids.has(h.goalId))).map((h) => h.id));
  for (const l of s.habitLogs.values()) if (l.date >= since && habitIds.has(l.habitId) && l.status !== 'missed') return true;
  if (s.tasks.some((t) => t.done && t.completedDate && t.completedDate >= since && (t.categoryId === catId || (t.goalId && ids.has(t.goalId))))) return true;
  if (s.focusSessions.some((f) => f.date >= since && (f.categoryId === catId || (f.goalId && ids.has(f.goalId))))) return true;
  if (s.milestones.some((m) => m.done && m.completedDate && m.completedDate >= since && ids.has(m.goalId))) return true;
  if (s.goalUpdates.some((u) => u.date >= since && ids.has(u.goalId))) return true;
  return false;
}

/** Estimated minutes due in the next 7 days vs. the recent weekly focus average (needs 2+ weeks of history). */
export function workload(s: Snapshot): { estimateMin: number; unestimated: number; avgWeeklyFocusMin: number; ratio: number } | null {
  const horizon = addDays(s.today, 6);
  const open = s.tasks.filter((t) => !t.done && taskDay(t) !== null && taskDay(t)! <= horizon);
  const estimateMin = open.reduce((a, t) => a + (t.estimateMin ?? 0), 0);
  const unestimated = open.filter((t) => t.estimateMin === null).length;
  const histStart = addDays(s.today, -28) < s.profile.startDate ? s.profile.startDate : addDays(s.today, -28);
  const histDays = dateRange(histStart, addDays(s.today, -1)).length;
  if (histDays < 14 || estimateMin === 0) return null;
  let focus = 0;
  for (const [d, m] of s.focusByDate) if (d >= histStart && d < s.today) focus += m;
  const avgWeeklyFocusMin = (focus / histDays) * 7;
  if (avgWeeklyFocusMin < 30) return null;
  return { estimateMin, unestimated, avgWeeklyFocusMin, ratio: estimateMin / avgWeeklyFocusMin };
}

// ───────────────────────────── Chart series ─────────────────────────────

export function weeklySeries(s: Snapshot, weeks: number, ledger: XpEntry[]) {
  const out: (PeriodMetrics & { label: string; ws: DateStr })[] = [];
  const cur = weekStart(s.today);
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(cur, -7 * i);
    if (addDays(ws, 6) < s.profile.startDate) continue;
    const m = periodMetrics(s, ws, addDays(ws, 6), ledger);
    const [, mm, dd] = ws.split('-');
    out.push({ ...m, ws, label: `${Number(dd)}/${Number(mm)}` });
  }
  return out;
}

export function monthRange(key: string): [DateStr, DateStr] {
  const [y, m] = key.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${key}-01`, `${key}-${String(last).padStart(2, '0')}`];
}

export function prevMonthKey(key: string) {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function monthMetrics(s: Snapshot, key: string, ledger: XpEntry[]) {
  const [a, b] = monthRange(key);
  return periodMetrics(s, a, b, ledger);
}

/** Focus minutes per life category over a range (time allocation). */
export function timeAllocation(s: Snapshot, from: DateStr, to: DateStr) {
  const map = new Map<string, number>();
  for (const f of s.focusSessions) {
    if (f.date < from || f.date > to) continue;
    let cat = f.categoryId;
    if (!cat && f.taskId) cat = s.tasks.find((t) => t.id === f.taskId)?.categoryId ?? null;
    if (!cat && f.goalId) cat = s.goalById.get(f.goalId)?.categoryId ?? null;
    if (!cat && f.learningId) cat = s.learning.find((l) => l.id === f.learningId)?.categoryId ?? 'education';
    const k = cat ?? 'uncategorised';
    map.set(k, (map.get(k) ?? 0) + f.minutes);
  }
  return [...map.entries()]
    .map(([id, minutes]) => ({ id, name: s.categoryById.get(id)?.name ?? 'Uncategorised', color: s.categoryById.get(id)?.color ?? '#8a8a96', minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Cumulative XP by day over a range. */
export function xpSeries(s: Snapshot, ledger: XpEntry[], days: number) {
  const from = addDays(s.today, -(days - 1));
  let running = ledger.filter((e) => e.date < from).reduce((a, e) => a + e.amount, 0);
  const byDate = new Map<DateStr, number>();
  for (const e of ledger) if (e.date >= from) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.amount);
  return dateRange(from < s.profile.startDate ? s.profile.startDate : from, s.today).map((d) => {
    running += byDate.get(d) ?? 0;
    const [, m, dd] = d.split('-');
    return { date: d, label: `${Number(dd)}/${Number(m)}`, xp: running, gained: byDate.get(d) ?? 0 };
  });
}

/** Weekly progress points for a goal (0–100), reconstructed from history. */
export function goalSeries(s: Snapshot, g: Goal, weeks = 12) {
  const out: { label: string; value: number | null }[] = [];
  const cur = s.today;
  for (let i = weeks - 1; i >= 0; i--) {
    const d = addDays(cur, -7 * i);
    if (d < g.startDate && i > 0) continue;
    const v = goalProgress(s, g, d).value;
    const [, m, dd] = d.split('-');
    out.push({ label: `${Number(dd)}/${Number(m)}`, value: v === null ? null : Math.round(v * 100) });
  }
  return out;
}

/** Estimate accuracy: actual ÷ estimated minutes for completed tasks that have both. */
export function estimateAccuracy(s: Snapshot, from: DateStr, to: DateStr): { ratio: number; n: number; estimate: number; actual: number } | null {
  const done = s.tasks.filter((t) => t.done && t.estimateMin && t.completedDate && t.completedDate >= from && t.completedDate <= to);
  let est = 0;
  let act = 0;
  let n = 0;
  for (const t of done) {
    const a = s.focusSessions.filter((f) => f.taskId === t.id).reduce((x, f) => x + f.minutes, 0);
    if (!a) continue;
    est += t.estimateMin!;
    act += a;
    n++;
  }
  return n >= 3 ? { ratio: act / est, n, estimate: est, actual: act } : null;
}

export function underperforming(s: Snapshot, from: DateStr, to: DateStr): { label: string; detail: string }[] {
  const out: { label: string; detail: string }[] = [];
  for (const h of s.habits.filter((x) => x.active)) {
    const st = habitStats(s, h, from, to);
    const n = st.done + st.partial + st.missed;
    if (st.rate !== null && n >= 4 && st.rate < 0.6) out.push({ label: h.name, detail: `${Math.round(st.rate * 100)}% completion` });
  }
  for (const g of liveGoals(s).filter((g) => g.status === 'active')) {
    const p = goalPace(s, g);
    if (p.status === 'behind' || p.status === 'at-risk' || p.status === 'overdue') out.push({ label: g.title, detail: p.label });
  }
  const overdue = s.tasks.filter((t: Task) => !t.done && t.dueDate && t.dueDate < s.today).length;
  if (overdue) out.push({ label: 'Overdue tasks', detail: `${overdue} past their deadline` });
  return out;
}

export { monthStart };
