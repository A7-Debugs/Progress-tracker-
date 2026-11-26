import { format, parseISO } from 'date-fns';
import { HABITS, HABIT_BY_ID, isOff, type HabitSpec } from './habits';
import { addDaysStr, dateRange, dayHit, evaluateWeek, habitPeriod, isSuccess, scheduleOn, toMinutes, weekStartOf, type LifeContext } from './engine';
import { paidHours, grossFor, takeHomeRatio } from './earnings';
import type { DailyCheckin } from './types';

/**
 * Health and career analytics: plain comparisons from your own data ("on days you X, Y was …").
 * Each needs at least MIN_N days in both groups, and they're relationships, not proof of cause.
 */

export const MIN_N = 5;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface Comparison {
  key: string;
  /** e.g. "Energy after 7h+ sleep" */
  title: string;
  yes: number;
  no: number;
  diff: number;
  nYes: number;
  nNo: number;
  /** Plain-English finding. */
  text: string;
  /** Is the "yes" group the better one? */
  good: boolean;
  /** How big, relative to the measure's scale (0–1+), for ranking. */
  size: number;
}

/** Recent days with a check-in, excluding sick days. */
export function recentDays(ctx: LifeContext, n: number): string[] {
  return dateRange(addDaysStr(ctx.today, -(n - 1)), ctx.today).filter((d) => d >= ctx.firstDate && ctx.byDate.has(d) && !ctx.byDate.get(d)!.sick);
}

function compare(
  days: string[],
  o: {
    key: string;
    title: string;
    group: (d: string) => boolean | null;
    value: (d: string) => number | null | undefined;
    yesLabel: string;
    noLabel: string;
    measure: string;
    unit?: string;
    scale: number;
    higherIsBetter?: boolean;
    digits?: number;
  },
): Comparison | null {
  const yes: number[] = [];
  const no: number[] = [];
  for (const d of days) {
    const g = o.group(d);
    const v = o.value(d);
    if (g === null || v == null) continue;
    (g ? yes : no).push(v);
  }
  if (yes.length < MIN_N || no.length < MIN_N) return null;
  const y = mean(yes)!;
  const n = mean(no)!;
  const diff = y - n;
  const hib = o.higherIsBetter ?? true;
  const dig = o.digits ?? 1;
  const fmt = (x: number) => `${x.toFixed(dig)}${o.unit ?? ''}`;
  const size = Math.abs(diff) / o.scale;
  const same = size < 0.05;
  const text = same
    ? `${o.measure} is about the same ${o.yesLabel} (${fmt(y)}) and ${o.noLabel} (${fmt(n)}).`
    : `${o.measure} is ${diff > 0 ? 'higher' : 'lower'} ${o.yesLabel}: ${fmt(y)} vs ${fmt(n)} ${o.noLabel} (${yes.length} vs ${no.length} days).`;
  return { key: o.key, title: o.title, yes: y, no: n, diff, nYes: yes.length, nNo: no.length, text, good: same ? false : (diff > 0) === hib, size };
}

const ck = (ctx: LifeContext, d: string): DailyCheckin | undefined => ctx.byDate.get(d);
const hitOn = (ctx: LifeContext, id: string, d: string): boolean | null => {
  const spec = HABIT_BY_ID.get(id as HabitSpec['id']);
  if (!spec || !ctx.byDate.has(d)) return null;
  const h = dayHit(ctx, spec, d);
  return h === null ? null : isSuccess(h);
};
const trained = (ctx: LifeContext, d: string) => (ctx.sessionMinutes.has(d) || (ck(ctx, d)?.trainingMinutes ?? 0) >= 20 ? true : ctx.byDate.has(d) ? false : null);

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export function healthComparisons(ctx: LifeContext, window = 90): Comparison[] {
  const days = recentDays(ctx, window);
  const prevNight = (d: string) => ck(ctx, d)?.sleepHours;
  const list = [
    compare(days, {
      key: 'sleep-energy',
      title: 'Energy after 7h+ sleep',
      group: (d) => (prevNight(d) == null ? null : prevNight(d)! >= 7),
      value: (d) => ck(ctx, d)?.energy,
      yesLabel: 'after 7h+ sleep',
      noLabel: 'after less',
      measure: 'Energy',
      unit: '/5',
      scale: 4,
    }),
    compare(days, {
      key: 'walk-energy',
      title: 'Energy on daylight-walk days',
      group: (d) => hitOn(ctx, 'morningWalk', d),
      value: (d) => ck(ctx, d)?.energy,
      yesLabel: 'on daylight-walk days',
      noLabel: 'without',
      measure: 'Energy',
      unit: '/5',
      scale: 4,
    }),
    compare(days, {
      key: 'train-mood',
      title: 'Mood on training days',
      group: (d) => trained(ctx, d),
      value: (d) => ck(ctx, d)?.mood,
      yesLabel: 'on training days',
      noLabel: 'on rest days',
      measure: 'Mood',
      unit: '/5',
      scale: 4,
    }),
    compare(days, {
      key: 'train-sleep',
      title: 'Sleep after training days',
      group: (d) => trained(ctx, addDaysStr(d, -1)),
      value: (d) => ck(ctx, d)?.sleepHours,
      yesLabel: 'after a training day',
      noLabel: 'after a rest day',
      measure: 'Sleep',
      unit: 'h',
      scale: 3,
    }),
    compare(days, {
      key: 'stress-sleep',
      title: 'Sleep after high-stress days',
      group: (d) => {
        const s = ck(ctx, addDaysStr(d, -1))?.stress;
        return s == null ? null : s >= 4;
      },
      value: (d) => ck(ctx, d)?.sleepHours,
      yesLabel: 'after a high-stress day',
      noLabel: 'after calmer days',
      measure: 'Sleep',
      unit: 'h',
      scale: 3,
    }),
    compare(days, {
      key: 'protein-energy',
      title: 'Energy on protein-target days',
      group: (d) => hitOn(ctx, 'protein', d),
      value: (d) => ck(ctx, d)?.energy,
      yesLabel: 'on days you hit protein',
      noLabel: 'on days you didn’t',
      measure: 'Energy',
      unit: '/5',
      scale: 4,
    }),
    compare(days, {
      key: 'work-energy',
      title: 'Energy on long work days',
      group: (d) => {
        const w = ck(ctx, d)?.workHours;
        return w == null ? null : w >= 9;
      },
      value: (d) => ck(ctx, d)?.energy,
      yesLabel: 'on 9h+ work days',
      noLabel: 'on shorter days',
      measure: 'Energy',
      unit: '/5',
      scale: 4,
    }),
    compare(days, {
      key: 'caffeine-sleep',
      title: 'Sleep on caffeine cut-off days',
      group: (d) => hitOn(ctx, 'caffeine', addDaysStr(d, -1)),
      value: (d) => ck(ctx, d)?.sleepHours,
      yesLabel: 'after a caffeine cut-off day',
      noLabel: 'after late caffeine',
      measure: 'Sleep',
      unit: 'h',
      scale: 3,
    }),
  ];
  return list.filter((x): x is Comparison => x !== null).sort((a, b) => b.size - a.size);
}

export type HealthWeek = {
  label: string;
  sleep: number | null;
  sleepSd: number | null;
  wakeSd: number | null;
  energy: number | null;
  mood: number | null;
  stress: number | null;
  steps: number | null;
  sessions: number;
  sick: number;
  walk: number | null;
  supplements: number | null;
  protein: number | null;
};

const adhPct = (ctx: LifeContext, id: string, start: string, end: string) => {
  const spec = HABIT_BY_ID.get(id as HabitSpec['id']);
  if (!spec) return null;
  const a = habitPeriod(ctx, spec, start, end).adherence;
  return a === null ? null : Math.round(a * 100);
};

export function healthWeeks(ctx: LifeContext, n = 12): HealthWeek[] {
  const out: HealthWeek[] = [];
  const thisWeek = weekStartOf(ctx.today);
  for (let i = n - 1; i >= 0; i--) {
    const ws = addDaysStr(thisWeek, -7 * i);
    if (addDaysStr(ws, 6) < ctx.firstDate) continue;
    const w = evaluateWeek(ctx, ws);
    const end = addDaysStr(ws, 6) > ctx.today ? ctx.today : addDaysStr(ws, 6);
    out.push({
      label: format(parseISO(ws), 'd MMM'),
      sleep: r1(w.metrics.avgSleep),
      sleepSd: r1(w.metrics.sleepSd),
      wakeSd: w.metrics.wakeSdMin === null ? null : Math.round(w.metrics.wakeSdMin),
      energy: r1(w.metrics.avgEnergy),
      mood: r1(w.metrics.avgMood),
      stress: r1(w.metrics.avgStress),
      steps: w.metrics.avgSteps === null ? null : Math.round(w.metrics.avgSteps),
      sessions: w.metrics.trainingSessions,
      sick: w.metrics.sickDays,
      walk: adhPct(ctx, 'morningWalk', ws, end),
      supplements: adhPct(ctx, 'vitamins', ws, end),
      protein: adhPct(ctx, 'protein', ws, end),
    });
  }
  return out;
}

export type HealthDay = {
  label: string;
  sleep: number | null;
  wake: number | null;
  energy: number | null;
};

export function healthDays(ctx: LifeContext, n = 42): HealthDay[] {
  return dateRange(addDaysStr(ctx.today, -(n - 1)), ctx.today)
    .filter((d) => d >= ctx.firstDate)
    .map((d) => {
      const c = ck(ctx, d);
      const w = toMinutes(c?.wakeTime);
      return { label: format(parseISO(d), 'd MMM'), sleep: c?.sleepHours ?? null, wake: w === null ? null : Math.round((w / 60) * 100) / 100, energy: c?.energy ?? null };
    });
}

/** Headline health numbers: last 30 days vs the 30 before. */
export function healthSummary(ctx: LifeContext) {
  const block = (from: number, to: number) => {
    const days = dateRange(addDaysStr(ctx.today, -from), addDaysStr(ctx.today, -to)).filter((d) => d >= ctx.firstDate);
    const cs = days.map((d) => ck(ctx, d)).filter((c): c is DailyCheckin => !!c);
    const num = (f: (c: DailyCheckin) => number | null | undefined) => mean(cs.map(f).filter((x): x is number => x != null));
    return {
      sleep: num((c) => (c.sick ? null : c.sleepHours)),
      energy: num((c) => c.energy),
      stress: num((c) => c.stress),
      steps: num((c) => c.steps),
      sick: cs.filter((c) => c.sick).length,
      nights7: cs.filter((c) => (c.sleepHours ?? 0) >= 7).length,
      logged: cs.length,
    };
  };
  return { cur: block(29, 0), prev: block(59, 30) };
}

// ---------------------------------------------------------------------------
// Career & development
// ---------------------------------------------------------------------------

export function careerComparisons(ctx: LifeContext, window = 90): Comparison[] {
  const days = recentDays(ctx, window);
  const dw = (d: string) => ck(ctx, d)?.deepWorkMinutes ?? (ctx.byDate.has(d) ? 0 : null);
  const list = [
    compare(days, {
      key: 'sleep-deep',
      title: 'Deep work after 7h+ sleep',
      group: (d) => (ck(ctx, d)?.sleepHours == null ? null : ck(ctx, d)!.sleepHours! >= 7),
      value: dw,
      yesLabel: 'after 7h+ sleep',
      noLabel: 'after less',
      measure: 'Deep work',
      unit: ' min',
      scale: 60,
      digits: 0,
    }),
    compare(days, {
      key: 'plan-deep',
      title: 'Deep work after planning the night before',
      group: (d) => hitOn(ctx, 'plan', addDaysStr(d, -1)),
      value: dw,
      yesLabel: 'after planning the evening before',
      noLabel: 'without',
      measure: 'Deep work',
      unit: ' min',
      scale: 60,
      digits: 0,
    }),
    compare(days, {
      key: 'work-deep',
      title: 'Deep work on work days',
      group: (d) => {
        const w = ck(ctx, d)?.workHours;
        return w == null ? null : w > 0;
      },
      value: dw,
      yesLabel: 'on work days',
      noLabel: 'on days off',
      measure: 'Deep work',
      unit: ' min',
      scale: 60,
      digits: 0,
    }),
    compare(days, {
      key: 'walk-deep',
      title: 'Deep work on daylight-walk days',
      group: (d) => hitOn(ctx, 'morningWalk', d),
      value: dw,
      yesLabel: 'on daylight-walk days',
      noLabel: 'without',
      measure: 'Deep work',
      unit: ' min',
      scale: 60,
      digits: 0,
    }),
    compare(days, {
      key: 'train-deep',
      title: 'Deep work on training days',
      group: (d) => trained(ctx, d),
      value: dw,
      yesLabel: 'on training days',
      noLabel: 'on rest days',
      measure: 'Deep work',
      unit: ' min',
      scale: 60,
      digits: 0,
    }),
    compare(days, {
      key: 'stress-deep',
      title: 'Deep work on high-stress days',
      group: (d) => {
        const s = ck(ctx, d)?.stress;
        return s == null ? null : s >= 4;
      },
      value: dw,
      yesLabel: 'on high-stress days',
      noLabel: 'on calmer days',
      measure: 'Deep work',
      unit: ' min',
      scale: 60,
      digits: 0,
      higherIsBetter: true,
    }),
  ];
  return list.filter((x): x is Comparison => x !== null).sort((a, b) => b.size - a.size);
}

export type CareerWeek = {
  label: string;
  deep: number;
  work: number;
  net: number;
  read: number | null;
};

export function careerWeeks(ctx: LifeContext, n = 12): CareerWeek[] {
  const out: CareerWeek[] = [];
  const thisWeek = weekStartOf(ctx.today);
  const ratio = takeHomeRatio(ctx.profile.pay).ratio;
  for (let i = n - 1; i >= 0; i--) {
    const ws = addDaysStr(thisWeek, -7 * i);
    if (addDaysStr(ws, 6) < ctx.firstDate) continue;
    const cs = dateRange(ws, addDaysStr(ws, 6))
      .map((d) => ck(ctx, d))
      .filter((c): c is DailyCheckin => !!c);
    const end = addDaysStr(ws, 6) > ctx.today ? ctx.today : addDaysStr(ws, 6);
    out.push({
      label: format(parseISO(ws), 'd MMM'),
      deep: Math.round((cs.reduce((a, c) => a + (c.deepWorkMinutes ?? 0), 0) / 60) * 10) / 10,
      work: Math.round(cs.reduce((a, c) => a + paidHours(ctx.profile.pay, c.workHours), 0) * 10) / 10,
      net: Math.round(cs.reduce((a, c) => a + grossFor(ctx.profile.pay, c), 0) * ratio),
      read: adhPct(ctx, 'read', ws, end),
    });
  }
  return out;
}

/** Average deep-work minutes by weekday (days with a check-in, not sick). */
export function deepByWeekday(ctx: LifeContext, window = 90) {
  const days = recentDays(ctx, window);
  const by = new Map<number, number[]>();
  for (const d of days) {
    const dow = parseISO(d).getDay();
    by.set(dow, [...(by.get(dow) ?? []), ck(ctx, d)?.deepWorkMinutes ?? 0]);
  }
  return [1, 2, 3, 4, 5, 6, 0].map((dow) => ({ label: WEEKDAYS[dow], minutes: by.get(dow)?.length ? Math.round(mean(by.get(dow)!)!) : null, n: by.get(dow)?.length ?? 0 }));
}

export function careerSummary(ctx: LifeContext) {
  const sum = (from: number, to: number) =>
    dateRange(addDaysStr(ctx.today, -from), addDaysStr(ctx.today, -to))
      .map((d) => ck(ctx, d)?.deepWorkMinutes ?? 0)
      .reduce((a, b) => a + b, 0) / 60;
  const all = [...ctx.byDate.values()].reduce((a, c) => a + (c.deepWorkMinutes ?? 0), 0) / 60;
  const sessions30 = dateRange(addDaysStr(ctx.today, -29), ctx.today).filter((d) => (ck(ctx, d)?.deepWorkMinutes ?? 0) >= 25).length;
  return { h30: Math.round(sum(29, 0) * 10) / 10, hPrev30: Math.round(sum(59, 30) * 10) / 10, total: Math.round(all * 10) / 10, sessions30 };
}

// ---------------------------------------------------------------------------
// What's working / what's not (dashboard)
// ---------------------------------------------------------------------------

export interface WorkItem {
  title: string;
  detail: string;
  action?: string;
}

/**
 * Habits: last 14 days vs the 14 before (improving or strong = working; weak or slipping = not).
 * Plus your clearest data-backed relationships, framed as "keep doing" or "the lever you're not pulling".
 */
export function whatsWorking(ctx: LifeContext): { working: WorkItem[]; notWorking: WorkItem[]; needsData: boolean } {
  const working: (WorkItem & { score: number })[] = [];
  const notWorking: (WorkItem & { score: number })[] = [];
  const s1 = addDaysStr(ctx.today, -13);
  const s0 = addDaysStr(ctx.today, -27);
  const logged = (a: string, b: string) => dateRange(a, b).filter((d) => ctx.byDate.has(d)).length;
  // Judging habits needs a week of check-ins in the window; otherwise unlogged days would read as 0%.
  const enough = logged(s1, ctx.today) >= 7;
  const prevEnough = logged(s0, addDaysStr(s1, -1)) >= 7;
  for (const h of enough ? HABITS : []) {
    if (isOff(ctx.profile, h.id, ctx.today) || !scheduleOn(ctx, h, ctx.today)) continue;
    const cur = habitPeriod(ctx, h, s1, ctx.today);
    const prev = habitPeriod(ctx, h, s0, addDaysStr(s1, -1));
    if (cur.adherence === null || cur.expected < 2) continue;
    const c = Math.round(cur.adherence * 100);
    const p = prev.adherence === null || !prevEnough ? null : Math.round(prev.adherence * 100);
    const delta = p === null ? null : c - p;
    const trend = delta === null ? '' : delta === 0 ? ' (steady)' : ` (${delta > 0 ? '+' : ''}${delta} pts vs the 2 weeks before)`;
    if (c >= 85 || (delta !== null && delta >= 15 && c >= 60))
      working.push({ title: h.name, detail: `${c}% over 2 weeks${trend}.`, score: c + (delta ?? 0) });
    else if (c < 60 || (delta !== null && delta <= -15))
      notWorking.push({ title: h.name, detail: `${c}% over 2 weeks${trend}.`, action: `Make it smaller: ${h.redesign.smaller}`, score: (100 - c) * h.impact + Math.max(0, -(delta ?? 0)) });
  }
  // Behaviours you control only (not "high-stress days" or "long work days").
  const comps = [...healthComparisons(ctx, 60), ...careerComparisons(ctx, 60)].filter((x) => x.size >= 0.1 && !/^(stress|work)-/.test(x.key));
  const LEVERS: Record<string, string> = {
    'sleep-energy': 'Protect 7h+: set a fixed wake time and count back 8 hours for lights out.',
    'walk-energy': 'Put the daylight walk straight after waking — 10 minutes outside before your phone.',
    'sleep-deep': 'Your best focus follows 7h+ nights — guard sleep before big study days.',
    'plan-deep': 'Spend 2 minutes each evening naming tomorrow’s deep-work block.',
    'protein-energy': 'Front-load protein at breakfast (30–40g) so the target is easy by evening.',
  };
  for (const x of comps.slice(0, 5)) {
    if (!x.good) continue;
    const share = x.nYes / (x.nYes + x.nNo);
    if (LEVERS[x.key] && share < 0.5)
      notWorking.push({ title: `Lever not pulled: ${x.title.toLowerCase()}`, detail: `${x.text} But that only happened on ${Math.round(share * 100)}% of days.`, action: LEVERS[x.key], score: 120 + x.size * 100 });
    else working.push({ title: x.title, detail: x.text, score: 50 + x.size * 100 });
  }
  return {
    working: working.sort((a, b) => b.score - a.score).slice(0, 3),
    notWorking: notWorking.sort((a, b) => b.score - a.score).slice(0, 3),
    needsData: !enough,
  };
}

export const WEEKDAY_NAMES = WEEKDAYS;
export type { HabitSpec };

/** Mastery from 30-day consistency: a small reward for keeping a habit, not just starting it. */
export function masteryOf(c30: number | null): { tier: 'Gold' | 'Silver' | 'Bronze'; color: string } | null {
  if (c30 === null) return null;
  if (c30 >= 0.9) return { tier: 'Gold', color: '#e8c872' };
  if (c30 >= 0.8) return { tier: 'Silver', color: '#c5c6cf' };
  if (c30 >= 0.7) return { tier: 'Bronze', color: '#d08b5b' };
  return null;
}

