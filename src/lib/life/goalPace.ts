import { HABIT_BY_ID } from './habits';
import { addDaysStr, daysBetween, habitPeriod, pastWeeks, type LifeContext } from './engine';
import { derive, fiStatus } from './finance';
import type { GoalMetric, GoalMetricKey, GoalNode, GoalTier } from './types';

export const METRICS: Record<GoalMetricKey, { label: string; unit: string; cumulative: boolean }> = {
  weeklyReviews: { label: 'Weekly reviews completed', unit: 'reviews', cumulative: true },
  qualifyingWeeks: { label: 'Weeks in a row at ≥ 85% adherence', unit: 'weeks', cumulative: false },
  trainingSessions: { label: 'Training sessions', unit: 'sessions', cumulative: true },
  deepWorkHours: { label: 'Deep-work / study hours', unit: 'h', cumulative: true },
  snapshots: { label: 'Monthly finance snapshots', unit: 'snapshots', cumulative: true },
  savingsRateMonths: { label: 'Months at or above savings-rate target', unit: 'months', cumulative: true },
  proteinDays: { label: 'Days protein target hit', unit: 'days', cumulative: true },
  connectDays: { label: 'Days with meaningful connection', unit: 'days', cumulative: true },
  fiProgress: { label: 'Financial-independence progress', unit: '%', cumulative: false },
};

export const TIER_DAYS: Record<GoalTier, number> = { vision: 365 * 25, y10: 3650, y5: 1825, y1: 365, d90: 90, month: 30, week: 7 };

/** Built-in trackers for the starter goals (used until you set your own or remove them). */
const DEFAULTS: Record<string, { key: GoalMetricKey; target: number }> = {
  'd90-fin': { key: 'snapshots', target: 3 },
  'd90-career': { key: 'deepWorkHours', target: 40 },
  'd90-health': { key: 'qualifyingWeeks', target: 3 },
  'd90-personal': { key: 'weeklyReviews', target: 12 },
  'd90-rel': { key: 'connectDays', target: 13 },
  'y1-fin': { key: 'savingsRateMonths', target: 12 },
  'y1-career': { key: 'deepWorkHours', target: 200 },
  'y1-health': { key: 'trainingSessions', target: 120 },
  'y1-personal': { key: 'weeklyReviews', target: 52 },
  'y1-rel': { key: 'connectDays', target: 52 },
  'y5-fin': { key: 'fiProgress', target: 30 },
};

export function defaultMetric(node: GoalNode, start: string): GoalMetric | null {
  const d = DEFAULTS[node.id];
  return d ? { ...d, start, deadline: addDaysStr(start, TIER_DAYS[node.tier]) } : null;
}

export function metricFor(ctx: LifeContext, node: GoalNode): GoalMetric | null {
  if (node.metric === null) return null;
  return node.metric ?? defaultMetric(node, ctx.profile.startDate);
}

function measure(ctx: LifeContext, m: GoalMetric): number {
  const end = m.deadline < ctx.today ? m.deadline : ctx.today;
  const inWindow = (d: string) => d >= m.start && d <= end;
  switch (m.key) {
    case 'weeklyReviews':
      return ctx.weekPlans.filter((p) => inWindow(p.weekStart) && (p.reviewedAt || p.reflectionWorked || p.reflectionDidnt || p.reflectionChange)).length;
    case 'qualifyingWeeks': {
      let n = 0;
      for (const w of pastWeeks(ctx, 52)) {
        if (w.loggedDays >= 4 && (w.habitAdherence ?? 0) >= 0.85) n++;
        else break;
      }
      return n;
    }
    case 'trainingSessions':
      return habitPeriod(ctx, HABIT_BY_ID.get('train')!, m.start, end).successes;
    case 'proteinDays':
      return habitPeriod(ctx, HABIT_BY_ID.get('protein')!, m.start, end).successes;
    case 'connectDays':
      return ctx.checkins.filter((c) => inWindow(c.date) && c.habits.connect === 'ideal').length;
    case 'deepWorkHours':
      return Math.round(ctx.checkins.filter((c) => inWindow(c.date)).reduce((a, c) => a + (c.deepWorkMinutes ?? 0), 0) / 6) / 10;
    case 'snapshots':
      return ctx.finance.filter((f) => f.month >= m.start.slice(0, 7) && f.month <= end.slice(0, 7)).length;
    case 'savingsRateMonths':
      return ctx.finance.filter((f) => f.month >= m.start.slice(0, 7) && f.month <= end.slice(0, 7) && (derive(f).savingsRate ?? -1) >= ctx.profile.savingsRateTarget).length;
    case 'fiProgress': {
      const p = fiStatus(ctx.profile, ctx.finance).progress;
      return p === null ? 0 : Math.round(p * 1000) / 10;
    }
  }
}

export type PaceStatus = 'done' | 'on-pace' | 'behind' | 'missed' | 'in-progress';

export interface GoalPace {
  metric: GoalMetric;
  current: number;
  expected: number | null;
  fraction: number; // current / target, 0..1
  status: PaceStatus;
  text: string;
}

export function goalPace(ctx: LifeContext, node: GoalNode): GoalPace | null {
  const metric = metricFor(ctx, node);
  if (!metric) return null;
  const info = METRICS[metric.key];
  const current = measure(ctx, metric);
  const total = Math.max(1, daysBetween(metric.start, metric.deadline));
  const elapsed = Math.min(total, Math.max(0, daysBetween(metric.start, ctx.today) + 1));
  const expected = info.cumulative ? Math.round(((metric.target * elapsed) / total) * 10) / 10 : null;
  let status: PaceStatus;
  if (current >= metric.target) status = 'done';
  else if (ctx.today > metric.deadline) status = 'missed';
  else if (expected === null) status = 'in-progress';
  else status = current >= expected * 0.9 ? 'on-pace' : 'behind';
  const u = info.unit === '%' ? '%' : ` ${info.unit}`;
  const statusText =
    status === 'done' ? 'done ✓' : status === 'missed' ? 'deadline passed' : status === 'in-progress' ? 'in progress' : status === 'on-pace' ? 'on pace' : `behind — expected ${expected}${u === '%' ? '%' : ''} by now`;
  return {
    metric,
    current,
    expected,
    fraction: Math.max(0, Math.min(1, current / metric.target)),
    status,
    text: `${current} of ${metric.target}${u} · ${statusText}`,
  };
}
