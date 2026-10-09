import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns';
import { estimate1RM } from '@/lib/calculations';
import type { BodyweightLog, SetLog } from '@/lib/types';
import { HABITS, HABIT_BY_ID, isUnlocked, targetFor, type HabitSpec, type LevelTarget, type TargetExtras } from './habits';
import { gradeCalories, nutritionByDate, proteinTargets, type DayNutrition } from './nutrition';
import type { DailyCheckin, Domain, FinanceSnapshot, FoodLog, HabitId, Hit, LifeProfile, Level, Mode, WeekPlan } from './types';

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export const ds = (d: Date) => format(d, 'yyyy-MM-dd');
export const addDaysStr = (date: string, n: number) => ds(addDays(parseISO(date), n));
export const weekStartOf = (date: string) => ds(startOfWeek(parseISO(date), { weekStartsOn: 1 }));
export const daysBetween = (a: string, b: string) => differenceInCalendarDays(parseISO(b), parseISO(a));

export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDaysStr(d, 1)) out.push(d);
  return out;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface RawLifeData {
  profile: LifeProfile;
  checkins: DailyCheckin[];
  sessions: { date: string; startedAt: number; completedAt: number | null }[];
  setLogs: SetLog[];
  bodyweight: BodyweightLog[];
  weekPlans: WeekPlan[];
  finance: FinanceSnapshot[];
  foodLogs: FoodLog[];
  today: string;
}

export interface LifeContext extends RawLifeData {
  byDate: Map<string, DailyCheckin>;
  sessionMinutes: Map<string, number[]>;
  financeUpdated: Set<string>;
  planByWeek: Map<string, WeekPlan>;
  nutrition: Map<string, DayNutrition>;
  /** First date with any data (check-in or completed session), or the profile start date. */
  firstDate: string;
}

export function buildContext(raw: RawLifeData): LifeContext {
  const byDate = new Map(raw.checkins.map((c) => [c.date, c]));
  const sessionMinutes = new Map<string, number[]>();
  for (const s of raw.sessions) {
    if (s.completedAt === null) continue;
    const arr = sessionMinutes.get(s.date) ?? [];
    arr.push(Math.max(1, Math.round((s.completedAt - s.startedAt) / 60000)));
    sessionMinutes.set(s.date, arr);
  }
  const financeUpdated = new Set(raw.finance.map((f) => ds(new Date(f.updatedAt))));
  const planByWeek = new Map(raw.weekPlans.map((p) => [p.weekStart, p]));
  const nutrition = nutritionByDate(raw.foodLogs);
  const dataDates = [...byDate.keys(), ...sessionMinutes.keys(), ...nutrition.keys()].sort();
  const firstDate = dataDates[0] && dataDates[0] < raw.profile.startDate ? dataDates[0] : raw.profile.startDate;
  return {
    ...raw,
    finance: [...raw.finance].sort((a, b) => a.month.localeCompare(b.month)),
    byDate,
    sessionMinutes,
    financeUpdated,
    planByWeek,
    nutrition,
    firstDate,
  };
}

export function levelOn(ctx: LifeContext, date: string): Level {
  let lvl: Level = ctx.profile.levelHistory?.[0]?.level ?? ctx.profile.level;
  for (const h of ctx.profile.levelHistory ?? []) if (h.from <= date) lvl = h.level;
  return lvl;
}

export function modeOn(ctx: LifeContext, date: string): Mode {
  return ctx.planByWeek.get(weekStartOf(date))?.mode ?? 'normal';
}

/** Is the habit part of the active system on this date, and what are its targets? */
export function scheduleOn(ctx: LifeContext, spec: HabitSpec, date: string): LevelTarget | null {
  const level = levelOn(ctx, date);
  if (!isUnlocked(spec, level, ctx.profile, date)) return null;
  if (ctx.profile.pausedHabits.includes(spec.id)) return null;
  return targetFor(spec, level, modeOn(ctx, date));
}

// ---------------------------------------------------------------------------
// Day-level evaluation
// ---------------------------------------------------------------------------

function grade(value: number, t: LevelTarget): Hit {
  if (value >= t.ideal) return 'ideal';
  if (value >= t.min) return 'min';
  return 'miss';
}

/** A habit's result for one day. `null` = no data for that day (not logged). */
export function dayHit(ctx: LifeContext, spec: HabitSpec, date: string): Hit | null {
  const c = ctx.byDate.get(date);
  const level = levelOn(ctx, date);
  const t = targetFor(spec, level, modeOn(ctx, date)) ?? spec.targets[level];
  switch (spec.id) {
    case 'sleep':
      return c?.sleepHours == null ? null : grade(c.sleepHours, t);
    case 'steps':
      return c?.steps == null ? null : grade(c.steps, t);
    case 'train': {
      const app = ctx.sessionMinutes.get(date);
      const appBest = app ? Math.max(...app) : 0;
      const manual = c?.trainingMinutes ?? 0;
      if (app) return appBest >= t.min || manual >= t.min ? 'ideal' : grade(Math.max(appBest, manual), t);
      if (!c) return null;
      return grade(manual, t);
    }
    case 'deepWork':
      return c ? grade(c.deepWorkMinutes ?? 0, t) : null;
    case 'protein': {
      const n = ctx.nutrition.get(date);
      if (n && n.entries > 0) {
        const p = proteinTargets(ctx.profile, ctx.bodyweight, date);
        return grade(n.protein, { min: p.min, ideal: p.ideal, perWeek: 7 });
      }
      return c ? (c.habits.protein ?? 'miss') : null;
    }
    case 'calories': {
      const n = ctx.nutrition.get(date);
      const target = calorieTargetOn(ctx, date);
      const kcal = n?.calories ?? null;
      if (target === null) return kcal !== null && kcal > 0 ? 'ideal' : c || n ? 'miss' : null; // awareness: logging = success
      if (kcal === null) return c || n ? 'miss' : null;
      return gradeCalories(kcal, target);
    }
    case 'mobility':
      return c ? grade(c.minutes?.mobility ?? 0, t) : null;
    case 'moneyReview':
      if (ctx.financeUpdated.has(date)) return 'ideal';
      return c ? (c.habits.moneyReview ?? 'miss') : null;
    default:
      return c ? (c.habits[spec.id] ?? 'miss') : null;
  }
}

/** Calorie target active on a date, or null during the awareness phase. */
export function calorieTargetOn(ctx: LifeContext, date: string): number | null {
  const c = ctx.profile.calorie;
  if (!c?.target || !c.targetSetAt || date < c.targetSetAt) return null;
  return c.target;
}

/** Protein/calorie numbers needed to label targets on a given day. */
export function targetExtras(ctx: LifeContext, date: string): TargetExtras {
  const p = proteinTargets(ctx.profile, ctx.bodyweight, date);
  return { protein: { min: p.min, ideal: p.ideal }, calorieTarget: calorieTargetOn(ctx, date) };
}

export const isSuccess = (h: Hit | null) => h === 'min' || h === 'ideal';

/** Days in [start, end] that have happened. Today only counts once something is logged for it. */
export function elapsedDays(ctx: LifeContext, start: string, end: string): string[] {
  const last = end < ctx.today ? end : ctx.today;
  const days = dateRange(start < ctx.firstDate ? ctx.firstDate : start, last);
  if (days.length && days[days.length - 1] === ctx.today && !ctx.byDate.has(ctx.today) && !ctx.sessionMinutes.has(ctx.today) && !ctx.nutrition.has(ctx.today)) {
    days.pop();
  }
  return days;
}

// ---------------------------------------------------------------------------
// Period evaluation
// ---------------------------------------------------------------------------

export interface HabitPeriodStat {
  id: HabitId;
  successes: number;
  ideals: number;
  misses: number;
  unlogged: number;
  /** Scheduled successes expected in the elapsed part of the period. */
  expected: number;
  /** successes / expected capped at 1. null = not scheduled or still pending. */
  adherence: number | null;
  /** Share of successes that hit the ideal target. */
  idealShare: number | null;
  missDays: string[];
}

export function habitPeriod(ctx: LifeContext, spec: HabitSpec, start: string, end: string): HabitPeriodStat {
  const days = elapsedDays(ctx, start, end);
  let successes = 0;
  let ideals = 0;
  let misses = 0;
  let unlogged = 0;
  let expected = 0;
  const missDays: string[] = [];
  for (const d of days) {
    const sched = scheduleOn(ctx, spec, d);
    const hit = dayHit(ctx, spec, d);
    if (sched) expected += sched.perWeek / 7;
    if (isSuccess(hit)) {
      successes++;
      if (hit === 'ideal') ideals++;
    } else if (sched) {
      if (hit === null) unlogged++;
      else misses++;
      missDays.push(d);
    }
  }
  const incomplete = end >= ctx.today;
  let adherence: number | null = expected > 0 ? Math.min(1, successes / expected) : null;
  // A 1x/week habit on a Tuesday is "pending", not failed.
  if (adherence !== null && incomplete && expected < 1 && successes < expected) adherence = null;
  return {
    id: spec.id,
    successes,
    ideals,
    misses,
    unlogged,
    expected,
    adherence,
    idealShare: successes > 0 ? ideals / successes : null,
    missDays,
  };
}

export interface ScorePart {
  label: string;
  value: number | null; // 0..1
  weight: number;
}

export interface DomainScore {
  domain: Domain;
  score: number | null; // 0..100
  parts: ScorePart[];
  formula: string;
}

export interface PeriodMetrics {
  avgSleep: number | null;
  sleepSd: number | null;
  avgEnergy: number | null;
  avgMood: number | null;
  avgStress: number | null;
  avgSteps: number | null;
  deepWorkMinutes: number;
  trainingSessions: number;
  workHours: number;
  connectDays: number;
}

export interface PeriodEval {
  start: string;
  end: string;
  elapsed: number;
  loggedDays: number;
  habits: Map<HabitId, HabitPeriodStat>;
  domains: Record<Domain, DomainScore>;
  overall: number | null;
  habitAdherence: number | null;
  metrics: PeriodMetrics;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs: number[]) => {
  const m = mean(xs);
  if (m === null || xs.length < 2) return null;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function combine(domain: Domain, parts: ScorePart[], formula: string): DomainScore {
  const usable = parts.filter((p) => p.value !== null && p.weight > 0);
  const w = usable.reduce((a, p) => a + p.weight, 0);
  const score = w > 0 ? (usable.reduce((a, p) => a + p.value! * p.weight, 0) / w) * 100 : null;
  return { domain, score: score === null ? null : Math.round(score), parts, formula };
}

export const DOMAIN_WEIGHTS: Record<Domain, number> = {
  health: 15,
  fitness: 15,
  career: 10,
  learning: 10,
  finance: 10,
  personal: 10,
  relationships: 10,
  recovery: 10,
  consistency: 10,
};

/** Latest snapshot whose month is ≤ the given date's month. */
export function snapshotAsOf(ctx: LifeContext, date: string): FinanceSnapshot | null {
  const month = date.slice(0, 7);
  let found: FinanceSnapshot | null = null;
  for (const f of ctx.finance) if (f.month <= month) found = f;
  return found;
}

/** Share of exercises (trained in the 28 days to `end`) whose best e1RM is ≥ 99% of the previous 28 days. */
export function strengthTrend(ctx: LifeContext, end: string): { value: number | null; improved: number; total: number } {
  const endMs = parseISO(end).getTime() + 86400000;
  const recentStart = endMs - 28 * 86400000;
  const priorStart = endMs - 56 * 86400000;
  const recent = new Map<string, number>();
  const prior = new Map<string, number>();
  for (const s of ctx.setLogs) {
    if (s.isWarmup || s.weight <= 0 || s.reps <= 0) continue;
    const e = estimate1RM(s.weight, s.reps);
    if (s.createdAt >= recentStart && s.createdAt < endMs) recent.set(s.exerciseDefId, Math.max(recent.get(s.exerciseDefId) ?? 0, e));
    else if (s.createdAt >= priorStart && s.createdAt < recentStart) prior.set(s.exerciseDefId, Math.max(prior.get(s.exerciseDefId) ?? 0, e));
  }
  let total = 0;
  let improved = 0;
  for (const [id, r] of recent) {
    const p = prior.get(id);
    if (p === undefined) continue;
    total++;
    if (r >= p * 0.99) improved++;
  }
  return { value: total ? improved / total : null, improved, total };
}

export function evaluatePeriod(ctx: LifeContext, start: string, end: string): PeriodEval {
  const days = elapsedDays(ctx, start, end);
  const logs = days.map((d) => ctx.byDate.get(d)).filter((c): c is DailyCheckin => !!c);
  const habits = new Map<HabitId, HabitPeriodStat>();
  for (const spec of HABITS) habits.set(spec.id, habitPeriod(ctx, spec, start, end));
  const adh = (id: HabitId) => habits.get(id)!.adherence;

  const sleepVals = logs.map((c) => c.sleepHours).filter((x): x is number => x != null);
  const num = (k: 'energy' | 'mood' | 'stress' | 'steps') => logs.map((c) => c[k]).filter((x): x is number => x != null);
  const deepWorkMinutes = logs.reduce((a, c) => a + (c.deepWorkMinutes ?? 0), 0);
  const trainingSessions = days.filter((d) => isSuccess(dayHit(ctx, HABIT_BY_ID.get('train')!, d))).length;
  const connectDays = logs.filter((c) => c.habits.connect === 'ideal' || c.habits.connect === 'min').length;
  const metrics: PeriodMetrics = {
    avgSleep: mean(sleepVals),
    sleepSd: sd(sleepVals),
    avgEnergy: mean(num('energy')),
    avgMood: mean(num('mood')),
    avgStress: mean(num('stress')),
    avgSteps: mean(num('steps')),
    deepWorkMinutes,
    trainingSessions,
    workHours: logs.reduce((a, c) => a + (c.workHours ?? 0), 0),
    connectDays,
  };

  // Deep-work volume target = Σ over days of (ideal minutes × perWeek / 7).
  const dw = HABIT_BY_ID.get('deepWork')!;
  let dwTarget = 0;
  for (const d of days) {
    const t = scheduleOn(ctx, dw, d);
    if (t) dwTarget += (t.ideal * t.perWeek) / 7;
  }

  const strength = strengthTrend(ctx, end < ctx.today ? end : ctx.today);
  const snap = snapshotAsOf(ctx, end < ctx.today ? end : ctx.today);
  const savingsRate = snap && snap.netIncome && snap.spending != null ? (snap.netIncome - snap.spending) / snap.netIncome : null;

  const active = (id: HabitId) => (habits.get(id)!.expected > 0 ? 1 : 0);

  const domains: Record<Domain, DomainScore> = {
    health: combine(
      'health',
      [
        { label: 'Sleep ≥ minimum', value: adh('sleep'), weight: 40 },
        { label: 'Steps ≥ minimum', value: adh('steps'), weight: 30 },
        { label: 'Protein target', value: adh('protein'), weight: 30 },
        { label: 'Calories', value: adh('calories'), weight: 20 * active('calories') },
      ],
      '40% sleep + 30% steps + 30% protein adherence (+ 20% calories once unlocked), re-weighted',
    ),
    fitness: combine(
      'fitness',
      [
        { label: 'Training sessions vs target', value: adh('train'), weight: 60 },
        { label: `Lifts maintained/improved (${strength.improved}/${strength.total})`, value: strength.value, weight: 25 },
        { label: 'Mobility adherence', value: adh('mobility'), weight: 15 * active('mobility') },
      ],
      '60% training adherence + 25% share of lifts at/above last 28-day best e1RM + 15% mobility (once unlocked)',
    ),
    career: combine(
      'career',
      [
        { label: 'Deep-work days vs target', value: adh('deepWork'), weight: 60 },
        { label: 'Planning adherence', value: adh('plan'), weight: 40 },
      ],
      '60% deep-work day adherence + 40% planning adherence',
    ),
    learning: combine(
      'learning',
      [
        { label: `Deep-work minutes (${deepWorkMinutes}/${Math.round(dwTarget)} ideal)`, value: dwTarget > 0 ? clamp01(deepWorkMinutes / dwTarget) : null, weight: 70 },
        { label: 'Reading adherence', value: adh('read'), weight: 30 * active('read') },
      ],
      '70% deep-work minutes vs ideal volume + 30% reading (once unlocked)',
    ),
    finance: combine(
      'finance',
      [
        { label: 'Weekly money check', value: adh('moneyReview'), weight: 40 },
        {
          label: savingsRate === null ? 'Savings rate (no snapshot)' : `Savings rate ${Math.round(savingsRate * 100)}% vs ${Math.round(ctx.profile.savingsRateTarget * 100)}% target`,
          value: savingsRate === null ? null : clamp01(savingsRate / ctx.profile.savingsRateTarget),
          weight: 60,
        },
      ],
      '40% money-check adherence + 60% latest savings rate ÷ target',
    ),
    personal: combine(
      'personal',
      [
        { label: 'Planning', value: adh('plan'), weight: 50 },
        { label: 'Reading', value: adh('read'), weight: 20 * active('read') },
        { label: 'Journal', value: adh('journal'), weight: 15 * active('journal') },
        { label: 'Screen shutdown', value: adh('shutdown'), weight: 15 * active('shutdown') },
      ],
      'Planning (50) + reading (20) + journal (15) + shutdown (15), unlocked habits only, re-weighted',
    ),
    relationships: combine(
      'relationships',
      [
        {
          label: `Connection days (${connectDays}) vs 3/week`,
          value: logs.length ? clamp01(connectDays / Math.max(1, (3 * days.length) / 7)) : null,
          weight: 100,
        },
      ],
      'Days with meaningful connection ÷ 3 per week',
    ),
    recovery: combine(
      'recovery',
      [
        { label: 'Avg sleep vs 7.5h', value: metrics.avgSleep === null ? null : clamp01(metrics.avgSleep / 7.5), weight: 40 },
        { label: 'Sleep consistency', value: metrics.sleepSd === null ? null : clamp01(1 - metrics.sleepSd / 1.5), weight: 20 },
        { label: 'Energy', value: metrics.avgEnergy === null ? null : (metrics.avgEnergy - 1) / 4, weight: 20 },
        { label: 'Low stress', value: metrics.avgStress === null ? null : (5 - metrics.avgStress) / 4, weight: 20 },
      ],
      '40% avg sleep ÷ 7.5h + 20% (1 − sleep SD ÷ 1.5h) + 20% energy + 20% inverted stress',
    ),
    consistency: { domain: 'consistency', score: null, parts: [], formula: '' },
  };

  const scheduled = [...habits.values()].filter((h) => h.adherence !== null);
  const habitAdherence = scheduled.length ? mean(scheduled.map((h) => h.adherence!)) : null;
  domains.consistency = combine(
    'consistency',
    [
      { label: `Days logged (${logs.length}/${days.length})`, value: days.length ? logs.length / days.length : null, weight: 30 },
      { label: 'Average habit adherence', value: habitAdherence, weight: 70 },
    ],
    '30% share of days checked in + 70% mean adherence across scheduled habits',
  );

  let overall: number | null = null;
  if (logs.length >= 3) {
    const usable = (Object.keys(domains) as Domain[]).filter((d) => domains[d].score !== null);
    const w = usable.reduce((a, d) => a + DOMAIN_WEIGHTS[d], 0);
    overall = w ? Math.round(usable.reduce((a, d) => a + domains[d].score! * DOMAIN_WEIGHTS[d], 0) / w) : null;
  }

  return { start, end, elapsed: days.length, loggedDays: logs.length, habits, domains, overall, habitAdherence, metrics };
}

export function evaluateWeek(ctx: LifeContext, weekStart: string): PeriodEval {
  return evaluatePeriod(ctx, weekStart, addDaysStr(weekStart, 6));
}

/** Completed weeks (Mon–Sun) strictly before the current week, newest first. */
export function pastWeeks(ctx: LifeContext, count: number): PeriodEval[] {
  const out: PeriodEval[] = [];
  let ws = addDaysStr(weekStartOf(ctx.today), -7);
  const firstWeek = weekStartOf(ctx.firstDate);
  while (out.length < count && ws >= firstWeek) {
    out.push(evaluateWeek(ctx, ws));
    ws = addDaysStr(ws, -7);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Streaks & rolling consistency
// ---------------------------------------------------------------------------

export interface HabitStreaks {
  current: number;
  longest: number;
  unit: 'days' | 'weeks';
  c7: number | null;
  c30: number | null;
  c90: number | null;
}

export function habitStreaks(ctx: LifeContext, spec: HabitSpec): HabitStreaks {
  const daily = spec.targets[levelOn(ctx, ctx.today)].perWeek >= 7;
  const windowAdh = (n: number) => {
    const start = addDaysStr(ctx.today, -(n - 1));
    const available = daysBetween(ctx.firstDate, ctx.today) + 1;
    if (available < Math.min(n, 7)) return null; // need at least a week of history
    return habitPeriod(ctx, spec, start, ctx.today).adherence;
  };
  let current = 0;
  let longest = 0;
  if (daily) {
    const days = dateRange(ctx.firstDate, ctx.today);
    let run = 0;
    for (const d of days) {
      if (isSuccess(dayHit(ctx, spec, d))) run++;
      else if (d !== ctx.today) run = 0;
      longest = Math.max(longest, run);
    }
    current = run;
  } else {
    let ws = weekStartOf(ctx.firstDate);
    const thisWeek = weekStartOf(ctx.today);
    let run = 0;
    for (; ws <= thisWeek; ws = addDaysStr(ws, 7)) {
      const st = habitPeriod(ctx, spec, ws, addDaysStr(ws, 6));
      const t = scheduleOn(ctx, spec, ws < ctx.firstDate ? ctx.firstDate : ws);
      if (ws === thisWeek) {
        // The current week only extends the streak once its full target is already met.
        if (t && st.successes >= t.perWeek) run++;
        longest = Math.max(longest, run);
        continue;
      }
      const met = st.expected > 0 && st.successes > 0 && st.successes >= Math.round(st.expected - 1e-9);
      if (met) run++;
      else if (st.expected > 0) run = 0;
      longest = Math.max(longest, run);
    }
    current = run;
  }
  return { current, longest, unit: daily ? 'days' : 'weeks', c7: windowAdh(7), c30: windowAdh(30), c90: windowAdh(90) };
}

export function checkinFor(ctx: LifeContext, date: string): DailyCheckin | undefined {
  return ctx.byDate.get(date);
}
