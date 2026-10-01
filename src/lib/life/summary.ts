import { HABITS, type HabitSpec, type LevelTarget } from './habits';
import { addDaysStr, dayHit, evaluatePeriod, habitPeriod, scheduleOn, weekStartOf, type LifeContext } from './engine';
import { fiStatus, gt3rsReadiness } from './finance';
import type { Hit } from './types';

export interface GoalProgress {
  key: string;
  label: string;
  value: number | null;
  formula: string;
  detail?: string;
}

/** The headline progress bars. Each has an explicit formula; null means insufficient data. */
export function goalProgress(ctx: LifeContext): GoalProgress[] {
  const p30 = evaluatePeriod(ctx, addDaysStr(ctx.today, -29), ctx.today);
  const enough = p30.loggedDays >= 7;
  const fi = fiStatus(ctx.profile, ctx.finance);
  const gt = gt3rsReadiness(ctx.profile, ctx.finance);
  const cur = ctx.profile.currency;
  const money = (x: number) => `${cur}${Math.round(x).toLocaleString()}`;
  const dom = (k: 'fitness' | 'career' | 'consistency') => (enough && p30.domains[k].score !== null ? p30.domains[k].score! / 100 : null);
  return [
    {
      key: 'fitness',
      label: 'Fitness',
      value: dom('fitness'),
      formula: `30-day Fitness score: ${p30.domains.fitness.formula}.`,
      detail: enough ? undefined : `Needs 7 logged days in the last 30 (have ${p30.loggedDays}).`,
    },
    {
      key: 'career',
      label: 'Career',
      value: dom('career'),
      formula: `30-day Career score: ${p30.domains.career.formula}.`,
      detail: enough ? `${Math.round(p30.metrics.deepWorkMinutes / 60)}h deep work in 30 days.` : `Needs 7 logged days in the last 30 (have ${p30.loggedDays}).`,
    },
    {
      key: 'fi',
      label: 'Financial independence',
      value: fi.progress,
      formula: `FI assets (investments + pension + investment-property equity) ÷ FI number (annual spending ÷ ${Math.round(ctx.profile.withdrawalRate * 100)}% withdrawal rate). Home equity and cash are excluded.`,
      detail: fi.fiNumber ? `${money(fi.fiAssets)} of ${money(fi.fiNumber)} (spending from ${fi.spendSource === 'profile' ? 'your setting' : '3-month average'}).` : 'Add a finance snapshot with spending.',
    },
    {
      key: 'gt3rs',
      label: 'GT3 RS financial readiness',
      value: gt.readiness === null ? null : gt.readiness / 100,
      formula: 'Weighted average progress across 10 conditions. Scale conditions weigh 2× (ring-fenced car fund, running costs vs income, opportunity cost, post-purchase net worth); foundations weigh 1× (emergency fund, income stability, investing rate, debt, housing, ability to keep investing). 100% only when all 10 are met.',
      detail: gt.headline,
    },
    {
      key: 'consistency',
      label: 'Consistency',
      value: dom('consistency'),
      formula: `30-day Consistency score: ${p30.domains.consistency.formula}.`,
      detail: enough ? undefined : `Needs 7 logged days in the last 30 (have ${p30.loggedDays}).`,
    },
  ];
}

export interface TodayHabit {
  spec: HabitSpec;
  target: LevelTarget;
  hit: Hit | null;
  /** For weekly-count habits: successes so far this week vs scheduled. */
  week: { done: number; of: number } | null;
}

export function todayHabits(ctx: LifeContext): TodayHabit[] {
  const ws = weekStartOf(ctx.today);
  return HABITS.flatMap((spec) => {
    const target = scheduleOn(ctx, spec, ctx.today);
    if (!target) return [];
    const hit = dayHit(ctx, spec, ctx.today);
    const week = target.perWeek < 7 ? { done: habitPeriod(ctx, spec, ws, addDaysStr(ws, 6)).successes, of: target.perWeek } : null;
    return [{ spec, target, hit, week }];
  });
}
