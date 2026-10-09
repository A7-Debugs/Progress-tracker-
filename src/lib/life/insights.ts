import { parseISO } from 'date-fns';
import { HABITS, HABIT_BY_ID, DOMAIN_LABELS, type HabitSpec } from './habits';
import {
  addDaysStr,
  dateRange,
  weekStartOf,
  dayHit,
  evaluatePeriod,
  habitPeriod,
  habitStreaks,
  isSuccess,
  pastWeeks,
  scheduleOn,
  type LifeContext,
  type PeriodEval,
} from './engine';
import { recommendProgression } from './progression';
import { estimateMaintenance } from './nutrition';
import type { Domain, GoalNode, HabitId } from './types';

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pct = (x: number) => `${Math.round(x * 100)}%`;

// ---------------------------------------------------------------------------
// Correlations
// ---------------------------------------------------------------------------

export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const mx = mean(xs)!;
  const my = mean(ys)!;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Share of the "daily-ish" (≥5x/week) habits scheduled that day which succeeded. */
export function dailyAdherence(ctx: LifeContext, date: string): number | null {
  if (!ctx.byDate.has(date)) return null;
  let sched = 0;
  let ok = 0;
  for (const h of HABITS) {
    const t = scheduleOn(ctx, h, date);
    if (!t || t.perWeek < 5) continue;
    sched++;
    if (isSuccess(dayHit(ctx, h, date))) ok++;
  }
  return sched ? ok / sched : null;
}

export interface Correlation {
  key: string;
  question: string;
  r: number | null;
  n: number;
  text: string;
}

export const MIN_PAIRS = 14;

function describe(r: number | null, n: number, x: string, y: string): string {
  if (n < MIN_PAIRS) return `Insufficient data (${n}/${MIN_PAIRS} paired days).`;
  if (r === null) return 'Insufficient data (no variation in one of the measures).';
  const a = Math.abs(r);
  if (a < 0.1) return `No meaningful relationship between ${x} and ${y} so far (r = ${r.toFixed(2)}, n = ${n}).`;
  const strength = a < 0.3 ? 'weak' : a < 0.5 ? 'moderate' : 'strong';
  const dir = r > 0 ? 'higher' : 'lower';
  return `The data suggests a ${strength} relationship: days with more ${x} tend to have ${dir} ${y} (r = ${r.toFixed(2)}, n = ${n}). Correlation, not proof of causation.`;
}

export function correlations(ctx: LifeContext, windowDays = 90): Correlation[] {
  const days = dateRange(addDaysStr(ctx.today, -(windowDays - 1)), ctx.today).filter((d) => d >= ctx.firstDate);
  const train = HABIT_BY_ID.get('train')!;
  const plan = HABIT_BY_ID.get('plan')!;
  const pairs = (f: (d: string) => [number | null | undefined, number | null | undefined]) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const d of days) {
      const [x, y] = f(d);
      if (x == null || y == null) continue;
      xs.push(x);
      ys.push(y);
    }
    return { xs, ys };
  };
  const defs: { key: string; question: string; x: string; y: string; f: (d: string) => [number | null | undefined, number | null | undefined] }[] = [
    { key: 'sleep-energy', question: 'More sleep → more energy?', x: 'sleep', y: 'energy', f: (d) => [ctx.byDate.get(d)?.sleepHours, ctx.byDate.get(d)?.energy] },
    {
      key: 'sleep-training',
      question: 'More sleep → training happens?',
      x: 'sleep',
      y: 'training completion',
      f: (d) => {
        const c = ctx.byDate.get(d);
        return [c?.sleepHours, c ? (isSuccess(dayHit(ctx, train, d)) ? 1 : 0) : null];
      },
    },
    { key: 'stress-adherence', question: 'Higher stress → lower adherence?', x: 'stress', y: 'habit adherence', f: (d) => [ctx.byDate.get(d)?.stress, dailyAdherence(ctx, d)] },
    {
      key: 'plan-deepwork',
      question: 'Planning the night before → more deep work?',
      x: 'planning the evening before',
      y: 'deep-work minutes',
      f: (d) => {
        const prev = addDaysStr(d, -1);
        const c = ctx.byDate.get(d);
        if (!ctx.byDate.has(prev) || !c) return [null, null];
        return [isSuccess(dayHit(ctx, plan, prev)) ? 1 : 0, c.deepWorkMinutes ?? 0];
      },
    },
    {
      key: 'training-mood',
      question: 'Training → better mood?',
      x: 'training',
      y: 'mood',
      f: (d) => {
        const c = ctx.byDate.get(d);
        return [c ? (isSuccess(dayHit(ctx, train, d)) ? 1 : 0) : null, c?.mood];
      },
    },
    { key: 'work-adherence', question: 'Longer work days → lower consistency?', x: 'work hours', y: 'habit adherence', f: (d) => [ctx.byDate.get(d)?.workHours, dailyAdherence(ctx, d)] },
  ];
  return defs.map(({ key, question, x, y, f }) => {
    const { xs, ys } = pairs(f);
    const r = xs.length >= MIN_PAIRS ? pearson(xs, ys) : null;
    return { key, question, r, n: xs.length, text: describe(r, xs.length, x, y) };
  });
}

// ---------------------------------------------------------------------------
// Weekly narrative (diagnostic, not judgmental)
// ---------------------------------------------------------------------------

export interface Narrative {
  improved: string[];
  declined: string[];
  causes: string[];
  highestImpact: string | null;
  nextWeek: string | null;
}

export function weekNarrative(week: PeriodEval, prev: PeriodEval | null): Narrative {
  const out: Narrative = { improved: [], declined: [], causes: [], highestImpact: null, nextWeek: null };
  if (!prev || prev.overall === null || week.overall === null) return out;
  for (const d of Object.keys(week.domains) as Domain[]) {
    const a = week.domains[d].score;
    const b = prev.domains[d].score;
    if (a === null || b === null) continue;
    if (a - b >= 5) out.improved.push(`${DOMAIN_LABELS[d]} ${b} → ${a}`);
    if (a - b <= -5) out.declined.push(`${DOMAIN_LABELS[d]} ${b} → ${a}`);
  }
  let best: { h: HabitSpec; delta: number } | null = null;
  for (const h of HABITS) {
    const a = week.habits.get(h.id)?.adherence;
    const b = prev.habits.get(h.id)?.adherence;
    if (a == null || b == null) continue;
    const delta = a - b;
    if (delta <= -0.2) out.causes.push(`${h.name} fell ${pct(b)} → ${pct(a)}`);
    if (!best || Math.abs(delta) * h.impact > Math.abs(best.delta) * best.h.impact) best = { h, delta };
  }
  const m = week.metrics;
  const p = prev.metrics;
  if (m.avgSleep !== null && p.avgSleep !== null && m.avgSleep - p.avgSleep <= -0.5)
    out.causes.push(`sleep dropped ${p.avgSleep.toFixed(1)}h → ${m.avgSleep.toFixed(1)}h`);
  if (m.avgStress !== null && p.avgStress !== null && m.avgStress - p.avgStress >= 0.7)
    out.causes.push(`stress rose ${p.avgStress.toFixed(1)} → ${m.avgStress.toFixed(1)}`);
  if (m.workHours - p.workHours >= 8) out.causes.push(`${Math.round(m.workHours - p.workHours)} more work hours`);
  if (week.loggedDays < prev.loggedDays - 1) out.causes.push(`fewer days logged (${prev.loggedDays} → ${week.loggedDays}) — some "misses" may be unrecorded`);
  if (best && Math.abs(best.delta) >= 0.1) {
    out.highestImpact = `${best.h.name} (${best.delta > 0 ? '+' : ''}${Math.round(best.delta * 100)} pts, impact ${best.h.impact}/5) moved your week the most.`;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Insights engine
// ---------------------------------------------------------------------------

export interface Insight {
  key: 'win' | 'bottleneck' | 'hidden' | 'roi' | 'friction' | 'opportunity' | 'recommendation';
  title: string;
  body: string;
}

const scheduledIn = (w: PeriodEval) => HABITS.filter((h) => (w.habits.get(h.id)?.expected ?? 0) > 0);

function wellbeing(ctx: LifeContext, d: string): number | null {
  const c = ctx.byDate.get(d);
  if (!c || c.energy == null || c.mood == null) return null;
  return (c.energy + c.mood) / 2;
}

/** Wellbeing on success days minus miss days, per habit. Needs ≥4 of each. */
export function habitEffects(ctx: LifeContext, windowDays = 60) {
  const days = dateRange(addDaysStr(ctx.today, -(windowDays - 1)), ctx.today).filter((d) => d >= ctx.firstDate);
  const out: { h: HabitSpec; diff: number; nYes: number; nNo: number }[] = [];
  for (const h of HABITS) {
    const yes: number[] = [];
    const no: number[] = [];
    for (const d of days) {
      if (!scheduleOn(ctx, h, d)) continue;
      const w = wellbeing(ctx, d);
      if (w === null) continue;
      const hit = dayHit(ctx, h, d);
      if (hit === null) continue;
      (isSuccess(hit) ? yes : no).push(w);
    }
    if (yes.length >= 4 && no.length >= 4) out.push({ h, diff: mean(yes)! - mean(no)!, nYes: yes.length, nNo: no.length });
  }
  return out;
}

export function frictionPoint(ctx: LifeContext): { h: HabitSpec; misses: number; weekday: string | null } | null {
  const start = addDaysStr(ctx.today, -13);
  let worst: { h: HabitSpec; misses: number; weekday: string | null } | null = null;
  for (const h of HABITS) {
    const st = habitPeriod(ctx, h, start, ctx.today);
    if (st.expected === 0) continue;
    const shortfall = Math.max(0, Math.round(st.expected) - st.successes);
    if (shortfall < 3) continue;
    const byDow = new Map<number, number>();
    for (const d of st.missDays) byDow.set(parseISO(d).getDay(), (byDow.get(parseISO(d).getDay()) ?? 0) + 1);
    const top = [...byDow.entries()].sort((a, b) => b[1] - a[1])[0];
    const weekday = top && top[1] >= 2 ? WEEKDAYS[top[0]] : null;
    if (!worst || shortfall * h.impact > worst.misses * worst.h.impact) worst = { h, misses: shortfall, weekday };
  }
  return worst;
}

function hiddenProblem(ctx: LifeContext): string | null {
  const days = dateRange(addDaysStr(ctx.today, -27), ctx.today).filter((d) => d >= ctx.firstDate);
  const wk: number[] = [];
  const we: number[] = [];
  const early: number[] = [];
  const late: number[] = [];
  for (const d of days) {
    const a = dailyAdherence(ctx, d);
    if (a === null) continue;
    const dow = parseISO(d).getDay();
    (dow === 0 || dow === 6 ? we : wk).push(a);
    (dow >= 1 && dow <= 3 ? early : late).push(a);
  }
  if (we.length >= 4 && wk.length >= 8 && mean(wk)! - mean(we)! >= 0.25)
    return `Weekends are leaking: habit adherence is ${pct(mean(wk)!)} on weekdays but ${pct(mean(we)!)} on weekends. Weekday routines have cues (work, commute) that weekends lack.`;

  const last7 = dateRange(addDaysStr(ctx.today, -6), ctx.today);
  const prior14 = dateRange(addDaysStr(ctx.today, -20), addDaysStr(ctx.today, -7));
  const energy = (ds: string[]) => ds.map((d) => ctx.byDate.get(d)?.energy).filter((x): x is number => x != null);
  const e7 = energy(last7);
  const e14 = energy(prior14);
  if (e7.length >= 4 && e14.length >= 7 && mean(e14)! - mean(e7)! >= 0.6)
    return `Energy is sliding (${mean(e14)!.toFixed(1)} → ${mean(e7)!.toFixed(1)}/5) even if habits look fine. That usually precedes an adherence drop by 1–2 weeks.`;

  const sleep14 = dateRange(addDaysStr(ctx.today, -13), ctx.today).map((d) => ctx.byDate.get(d)?.sleepHours).filter((x): x is number => x != null);
  const adh14 = dateRange(addDaysStr(ctx.today, -13), ctx.today).map((d) => dailyAdherence(ctx, d)).filter((x): x is number => x !== null);
  if (sleep14.length >= 7 && mean(sleep14)! < 6.8 && adh14.length >= 7 && mean(adh14)! >= 0.75)
    return `You're performing on borrowed sleep: ${mean(sleep14)!.toFixed(1)}h average while adherence is ${pct(mean(adh14)!)}. That combination rarely lasts.`;

  const unlogged = last7.filter((d) => d < ctx.today && !ctx.byDate.has(d)).length;
  if (unlogged >= 3) return `${unlogged} of the last 7 days weren't logged. The scores may be flattering or harsh — the system can't see those days.`;

  if (early.length >= 6 && late.length >= 8 && mean(early)! - mean(late)! >= 0.25)
    return `Late-week fade: ${pct(mean(early)!)} Mon–Wed vs ${pct(mean(late)!)} Thu–Sun. Your week may be front-loaded; energy runs out by Thursday.`;

  return null;
}

export function weeklyInsights(ctx: LifeContext, week: PeriodEval, prev: PeriodEval | null): Insight[] {
  const out: Insight[] = [];
  if (week.loggedDays < 3) {
    const msg = 'Insufficient data — log at least 3 days this week.';
    return (['win', 'bottleneck', 'hidden', 'roi', 'friction', 'opportunity', 'recommendation'] as const).map((key) => ({
      key,
      title: TITLES[key],
      body: key === 'recommendation' ? 'Complete the daily check-in (under 60 seconds) every day this week. Data first, optimisation second.' : msg,
    }));
  }
  const sched = scheduledIn(week);

  // Biggest win
  let win: string | null = null;
  if (prev) {
    const deltas = sched
      .map((h) => ({ h, a: week.habits.get(h.id)!.adherence, b: prev.habits.get(h.id)?.adherence ?? null }))
      .filter((x): x is { h: HabitSpec; a: number; b: number } => x.a !== null && x.b !== null)
      .sort((x, y) => (y.a - y.b) * y.h.impact - (x.a - x.b) * x.h.impact);
    if (deltas[0] && deltas[0].a - deltas[0].b >= 0.15) win = `${deltas[0].h.name} jumped ${pct(deltas[0].b)} → ${pct(deltas[0].a)}.`;
  }
  if (!win) {
    const top = sched
      .map((h) => ({ h, a: week.habits.get(h.id)!.adherence }))
      .filter((x): x is { h: HabitSpec; a: number } => x.a !== null && x.a >= 0.8)
      .sort((x, y) => y.h.impact - x.h.impact || y.a - x.a)[0];
    if (top) win = `${top.h.name} at ${pct(top.a)} — a high-impact habit holding steady.`;
  }
  out.push({ key: 'win', title: TITLES.win, body: win ?? 'No habit reached 80% yet. The first win is simply logging every day.' });

  // Bottleneck
  const domains = (Object.keys(week.domains) as Domain[]).filter((d) => d !== 'consistency' && week.domains[d].score !== null);
  const low = domains.sort((a, b) => week.domains[a].score! - week.domains[b].score!)[0];
  if (low) {
    const part = week.domains[low].parts.filter((p) => p.value !== null && p.weight > 0).sort((a, b) => a.value! - b.value!)[0];
    out.push({ key: 'bottleneck', title: TITLES.bottleneck, body: `${DOMAIN_LABELS[low]} (${week.domains[low].score}/100)${part ? ` — mainly ${part.label.toLowerCase()} at ${pct(part.value!)}` : ''}.` });
  } else out.push({ key: 'bottleneck', title: TITLES.bottleneck, body: 'Insufficient data.' });

  // Hidden problem
  out.push({ key: 'hidden', title: TITLES.hidden, body: hiddenProblem(ctx) ?? 'Nothing hidden detected — no weekend leak, energy slide, sleep debt or logging gaps.' });

  // Highest ROI
  const effects = habitEffects(ctx).map((e) => ({ ...e, roi: e.diff / Math.max(5, e.h.estMinutes.min) })).filter((e) => e.diff >= 0.2).sort((a, b) => b.roi - a.roi);
  if (effects[0]) {
    const e = effects[0];
    out.push({
      key: 'roi',
      title: TITLES.roi,
      body: `${e.h.name}: on days you do it, energy+mood average ${e.diff.toFixed(1)} points higher (n = ${e.nYes}/${e.nNo}), for ~${e.h.estMinutes.min} min of effort. The data suggests a relationship, not causation.`,
    });
  } else {
    const design = [...sched].sort((a, b) => b.impact / (b.difficulty * Math.max(1, b.estMinutes.min / 10)) - a.impact / (a.difficulty * Math.max(1, a.estMinutes.min / 10)))[0];
    out.push({
      key: 'roi',
      title: TITLES.roi,
      body: design ? `Insufficient data for a data-backed answer (needs 4+ done and 4+ missed days with energy & mood logged). By design, ${design.name} has the best impact-to-effort ratio.` : 'Insufficient data.',
    });
  }

  // Friction point
  const fp = frictionPoint(ctx);
  out.push({
    key: 'friction',
    title: TITLES.friction,
    body: fp ? `${fp.h.name}: ${fp.misses} short of target in 14 days${fp.weekday ? `, most often on ${fp.weekday}s` : ''}. Treat it as a design problem → try: "${fp.h.redesign.smaller}"` : 'No habit is repeatedly failing. Friction is low.',
  });

  // Opportunity
  const corr = correlations(ctx);
  const r = (k: string) => corr.find((c) => c.key === k)?.r ?? null;
  const a = (id: HabitId) => week.habits.get(id)?.adherence ?? null;
  let opp: string;
  if ((r('plan-deepwork') ?? 0) >= 0.2 && (a('plan') ?? 1) < 0.7)
    opp = 'Deep work appears to follow evenings you planned. Planning is a 2-minute habit sitting below 70% — lifting it may lift study hours for almost no cost.';
  else if ((r('sleep-energy') ?? 0) >= 0.2 && (a('sleep') ?? 1) < 0.7)
    opp = 'Your energy tracks your sleep. A fixed phone-away time is the cheapest energy upgrade available.';
  else if ((a('steps') ?? 1) < 0.6) opp = 'A 10-minute walk after lunch adds ~1,200 steps and usually lifts afternoon focus. Tiny cost, broad benefit.';
  else {
    const cheap = sched.filter((h) => (a(h.id) ?? 1) < 0.8).sort((x, y) => x.estMinutes.min - y.estMinutes.min)[0];
    opp = cheap
      ? `${cheap.name} ${cheap.estMinutes.min === 0 ? 'needs no extra time' : `costs ~${cheap.estMinutes.min} min`} but is at ${pct(a(cheap.id) ?? 0)}. Closing that gap is the cheapest gain available.`
      : 'Everything is ≥ 80%. Try the ideal version of one high-impact habit on 1–2 days — not all of them.';
  }
  out.push({ key: 'opportunity', title: TITLES.opportunity, body: opp });

  // The ONE recommendation
  let rec: string;
  // A due deload outranks everything when reviewing the most recent week.
  const prog = week.start >= addDaysStr(weekStartOf(ctx.today), -7) ? recommendProgression(ctx) : null;
  if (prog?.status === 'deload' || prog?.status === 'drop-level')
    rec = `${prog.headline}. Run the minimum version of every habit next week — the only goal is to keep the chain alive. Then rebuild.`;
  else if (fp) rec = `Redesign ${fp.h.name}: ${fp.h.redesign.smaller} Cue: ${fp.h.redesign.trigger}`;
  else if (low && week.domains[low].score! < 60) {
    const h = HABITS.find((x) => x.domain === low && (week.habits.get(x.id)?.expected ?? 0) > 0);
    rec = h
      ? `Protect ${h.name} — it's the lever on your weakest area (${DOMAIN_LABELS[low]}).`
      : low === 'relationships'
        ? 'Put 3 moments of real connection in the calendar (a call, a meal, a training session with someone). Relationships are part of the life you are building.'
        : low === 'finance'
          ? 'Add this month\'s finance snapshot — 5 minutes, and the finance score stops guessing.'
          : `Focus on ${DOMAIN_LABELS[low]} next week.`;
  } else rec = 'Keep everything the same. Consistency at this level is the win — let it compound.';
  out.push({ key: 'recommendation', title: TITLES.recommendation, body: rec });

  return out;
}

const TITLES: Record<Insight['key'], string> = {
  win: 'Biggest win',
  bottleneck: 'Biggest bottleneck',
  hidden: 'Hidden problem',
  roi: 'Highest-ROI habit',
  friction: 'Friction point',
  opportunity: 'Opportunity',
  recommendation: 'Next week: the ONE thing',
};

// ---------------------------------------------------------------------------
// Anti-gaming
// ---------------------------------------------------------------------------

export interface Flag {
  title: string;
  body: string;
}

export function detectGaming(ctx: LifeContext): Flag[] {
  const flags: Flag[] = [];
  const s21 = addDaysStr(ctx.today, -20);
  const p21 = evaluatePeriod(ctx, s21, ctx.today);
  const energy = p21.metrics.avgEnergy;
  const stress = p21.metrics.avgStress;
  const minimumWeeks = pastWeeks(ctx, 3).filter((w) => ctx.planByWeek.get(w.start)?.mode === 'minimum').length;

  // 1. Minimum-only despite capacity
  if (energy !== null && stress !== null && energy >= 3.5 && stress <= 2.5 && minimumWeeks < 2) {
    const coasting = HABITS.filter((h) => {
      const st = p21.habits.get(h.id)!;
      // Sleep's minimum (7h) is a genuine target, not coasting.
      return h.id !== 'sleep' && st.expected > 0 && st.successes >= 8 && (st.idealShare ?? 1) < 0.2 && h.input !== 'bool';
    }).slice(0, 2);
    for (const h of coasting)
      flags.push({
        title: `Coasting on the minimum: ${h.name}`,
        body: `Under 20% of successful days hit the ideal, while energy averages ${energy.toFixed(1)}/5 and stress ${stress.toFixed(1)}/5. You seem to have capacity — aim for the ideal on 2 days next week.`,
      });
  }

  // 2. Easy-habit padding
  const sched = HABITS.filter((h) => (p21.habits.get(h.id)?.adherence ?? null) !== null);
  const easy = sched.filter((h) => h.difficulty <= 2).map((h) => p21.habits.get(h.id)!.adherence!);
  const big = sched.filter((h) => h.impact === 5).map((h) => p21.habits.get(h.id)!.adherence!);
  if (easy.length >= 2 && big.length >= 1 && mean(easy)! >= 0.9 && mean(big)! < 0.5)
    flags.push({
      title: 'Score padded by easy habits',
      body: `Easy habits average ${pct(mean(easy)!)} but the highest-impact ones (training, sleep, deep work) average ${pct(mean(big)!)}. The score looks better than the progress.`,
    });

  // 3. Productivity at the expense of health
  const a = evaluatePeriod(ctx, addDaysStr(ctx.today, -13), ctx.today);
  const b = evaluatePeriod(ctx, addDaysStr(ctx.today, -27), addDaysStr(ctx.today, -14));
  if (b.loggedDays >= 7 && a.loggedDays >= 7 && b.metrics.deepWorkMinutes > 0 && a.metrics.deepWorkMinutes >= b.metrics.deepWorkMinutes * 1.25) {
    const sleepDrop = a.metrics.avgSleep !== null && b.metrics.avgSleep !== null ? b.metrics.avgSleep - a.metrics.avgSleep : 0;
    const trainDrop = (b.habits.get('train')!.adherence ?? 0) - (a.habits.get('train')!.adherence ?? 0);
    if (sleepDrop >= 0.4 || trainDrop >= 0.2)
      flags.push({
        title: 'Productivity is borrowing from health',
        body: `Deep work up ${Math.round((a.metrics.deepWorkMinutes / b.metrics.deepWorkMinutes - 1) * 100)}% while ${sleepDrop >= 0.4 ? `sleep fell ${sleepDrop.toFixed(1)}h` : `training adherence fell ${Math.round(trainDrop * 100)} pts`}. Health > productivity — this trade doesn't compound.`,
      });
  }

  // 4. Diminishing returns from long work weeks
  const weeks = pastWeeks(ctx, 8).filter((w) => w.loggedDays >= 5 && w.habitAdherence !== null);
  const heavy = weeks.filter((w) => w.metrics.workHours >= 50);
  const light = weeks.filter((w) => w.metrics.workHours > 0 && w.metrics.workHours < 50);
  if (heavy.length >= 2 && light.length >= 2) {
    const h = mean(heavy.map((w) => w.habitAdherence!))!;
    const l = mean(light.map((w) => w.habitAdherence!))!;
    if (l - h >= 0.1)
      flags.push({
        title: 'Diminishing returns above ~50h/week',
        body: `In 50h+ work weeks your adherence averages ${pct(h)} vs ${pct(l)} in lighter weeks. Beyond a point, extra hours cost more than they return.`,
      });
  }

  // 5. Too many habits
  const active = HABITS.filter((h) => scheduleOn(ctx, h, ctx.today)).length;
  if (active > 9 || (active > 7 && (p21.habitAdherence ?? 1) < 0.7))
    flags.push({
      title: 'Too many habits for current capacity',
      body: `${active} active habits with ${pct(p21.habitAdherence ?? 0)} adherence. Pause the newest one in Settings → Life OS until the rest are automatic.`,
    });

  // 6. Calories vs bodyweight
  const cal = ctx.profile.calorie;
  if (cal?.unlockedAt) {
    const start = addDaysStr(ctx.today, -20);
    let entries = 0;
    let missing = 0;
    for (const [d, n] of ctx.nutrition) {
      if (d < start) continue;
      entries += n.entries;
      missing += n.missingCalories;
    }
    if (entries >= 10 && missing / entries >= 0.2)
      flags.push({
        title: 'Calorie totals are incomplete',
        body: `${missing} of ${entries} food entries in 3 weeks have no calories, so daily totals undercount. Add calories to those foods in My foods.`,
      });
    if (cal.target && cal.goal) {
      const est = estimateMaintenance(ctx.nutrition, ctx.bodyweight, start, ctx.today);
      const onTarget = est.avgIntake !== null && Math.abs(est.avgIntake - cal.target) <= 150;
      const k = est.kgPerWeek;
      const wrongWay = k !== null && ((cal.goal === 'cut' && k > 0.1) || (cal.goal === 'bulk' && k < -0.1) || (cal.goal === 'maintain' && Math.abs(k) > 0.3));
      if (est.ok && onTarget && wrongWay)
        flags.push({
          title: 'Calories and weight disagree',
          body: `You're averaging ${est.avgIntake} kcal (target ${cal.target}) but weight is moving ${k! > 0 ? '+' : ''}${k} kg/week. Usually means un-logged food (oils, drinks, snacks) or that maintenance has shifted — re-estimate in The System.`,
        });
    }
  }

  // 7. High-Performance Mode every week
  const hp = pastWeeks(ctx, 4).filter((w) => ctx.planByWeek.get(w.start)?.mode === 'high').length;
  if (hp >= 3)
    flags.push({ title: 'High-Performance Mode is becoming the default', body: `${hp} of the last 4 weeks were High-Performance. It's meant to be occasional — schedule a Normal week.` });

  return flags;
}

// ---------------------------------------------------------------------------
// Friction reduction
// ---------------------------------------------------------------------------

export interface FrictionReport {
  h: HabitSpec;
  c30: number;
  diagnosis: string;
  verdict: 'system' | 'capacity' | 'tracking' | 'difficulty';
  prompts: { dimension: string; question: string; hint: string | null }[];
}

export const FRICTION_DIMENSIONS = ['Time', 'Location', 'Preparation', 'Difficulty', 'Environment', 'Triggers', 'Convenience', 'Mental effort'] as const;

const QUESTIONS: Record<(typeof FRICTION_DIMENSIONS)[number], string> = {
  Time: 'Is there a realistic, fixed slot for it — or is it competing with something every day?',
  Location: 'Does it require going somewhere? Can it happen where you already are?',
  Preparation: 'What has to be ready beforehand (kit, materials, food)? Can that be done the night before?',
  Difficulty: 'Is the minimum genuinely small enough to do on your worst day?',
  Environment: 'What in your surroundings pulls you away (phone, TV, people)? Can it be removed?',
  Triggers: 'What exact event starts it? If the answer is "when I feel like it", there is no trigger.',
  Convenience: 'How many steps between deciding and doing? Can you cut them to one?',
  'Mental effort': 'Does it require a decision each time (what to study, what to cook)? Pre-decide it.',
};

export function frictionReports(ctx: LifeContext): FrictionReport[] {
  const out: FrictionReport[] = [];
  for (const h of HABITS) {
    if (!scheduleOn(ctx, h, ctx.today)) continue;
    const st = habitStreaks(ctx, h);
    if (st.c30 === null || st.c30 >= 0.6) continue;
    const period = habitPeriod(ctx, h, addDaysStr(ctx.today, -29), ctx.today);
    if (period.expected < 3) continue;
    const byDow = new Map<number, number>();
    for (const d of period.missDays) byDow.set(parseISO(d).getDay(), (byDow.get(parseISO(d).getDay()) ?? 0) + 1);
    const sorted = [...byDow.entries()].sort((a, b) => b[1] - a[1]);
    const topTwo = (sorted[0]?.[1] ?? 0) + (sorted[1]?.[1] ?? 0);
    const clustered = period.missDays.length >= 4 && topTwo / period.missDays.length >= 0.5;
    const stressMiss = period.missDays.map((d) => ctx.byDate.get(d)?.stress).filter((x): x is number => x != null);
    const stressAll = dateRange(addDaysStr(ctx.today, -29), ctx.today).map((d) => ctx.byDate.get(d)?.stress).filter((x): x is number => x != null);
    const stressGap = stressMiss.length >= 3 && stressAll.length >= 7 ? mean(stressMiss)! - mean(stressAll)! : 0;

    let verdict: FrictionReport['verdict'];
    let diagnosis: string;
    if (period.unlogged >= period.misses) {
      verdict = 'tracking';
      diagnosis = 'Most "misses" are unlogged days. This is tracking friction, not a habit problem — make the check-in part of your morning coffee.';
    } else if (clustered) {
      verdict = 'system';
      diagnosis = `Misses cluster on ${sorted.slice(0, 2).map(([d]) => WEEKDAYS[d]).join(' and ')}s. That's a schedule/trigger problem, not discipline — the cue doesn't exist on those days.`;
    } else if (stressGap >= 0.7) {
      verdict = 'capacity';
      diagnosis = `Misses happen on higher-stress days (${mean(stressMiss)!.toFixed(1)} vs ${mean(stressAll)!.toFixed(1)} average). Use the minimum version on hard days — or Minimum Mode for hard weeks.`;
    } else {
      verdict = 'difficulty';
      diagnosis = 'Misses are spread evenly. The habit is probably too big or too vague — shrink it until it is almost too easy.';
    }
    const hint = (dim: (typeof FRICTION_DIMENSIONS)[number]): string | null => {
      if (dim === 'Triggers' && verdict === 'system') return `Suggested cue: ${h.redesign.trigger}`;
      if (dim === 'Difficulty' && (verdict === 'difficulty' || verdict === 'capacity')) return `Smaller version: ${h.redesign.smaller}`;
      if (dim === 'Environment') return h.redesign.environment;
      if (dim === 'Time' && verdict === 'system') return 'Move it to a slot that exists on every day of the week.';
      return null;
    };
    out.push({ h, c30: st.c30, diagnosis, verdict, prompts: FRICTION_DIMENSIONS.map((d) => ({ dimension: d, question: QUESTIONS[d], hint: hint(d) })) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Monthly & quarterly
// ---------------------------------------------------------------------------

export type Trajectory = 'Declining' | 'Stable' | 'Improving' | 'Accelerating' | 'Insufficient data';

export function classify(cur: number | null, prev: number | null, prevPrev: number | null): Trajectory {
  if (cur === null || prev === null) return 'Insufficient data';
  const d = cur - prev;
  if (d <= -5) return 'Declining';
  if (d < 5) return 'Stable';
  const priorImproving = prevPrev !== null && prev - prevPrev >= 5;
  if (d >= 15 || priorImproving) return 'Accelerating';
  return 'Improving';
}

export function explainTrajectory(t: Trajectory, cur: number | null, prev: number | null, prevPrev: number | null): string {
  switch (t) {
    case 'Insufficient data':
      return 'Needs two months with 3+ logged days each.';
    case 'Declining':
      return `Down ${prev! - cur!} points month-on-month.`;
    case 'Stable':
      return `Within ±5 points (${prev} → ${cur}).`;
    case 'Improving':
      return `Up ${cur! - prev!} points.`;
    case 'Accelerating':
      return prevPrev !== null && prev! - prevPrev >= 5 ? `Up ${cur! - prev!} points after also rising last month — the gains are compounding.` : `Up ${cur! - prev!} points — a step change.`;
  }
}

export interface GoalAlignment {
  goal: GoalNode;
  habits: { h: HabitSpec; c90: number | null }[];
  score: number | null;
  verdict: string;
}

export function goalAlignment(ctx: LifeContext): { rows: GoalAlignment[]; orphans: HabitSpec[] } {
  const goals = ctx.profile.goals;
  const ancestors = (id: string): string[] => {
    const out: string[] = [];
    let node = goals.find((g) => g.id === id);
    while (node) {
      out.push(node.id);
      node = node.parentId ? goals.find((g) => g.id === node!.parentId) : undefined;
    }
    return out;
  };
  const active = HABITS.filter((h) => scheduleOn(ctx, h, ctx.today));
  const rows: GoalAlignment[] = goals
    .filter((g) => g.tier === 'y1')
    .map((goal) => {
      const linked = active.filter((h) => ancestors(h.goalLink).includes(goal.id)).map((h) => ({ h, c90: habitStreaks(ctx, h).c90 }));
      const vals = linked.map((x) => x.c90).filter((x): x is number => x !== null);
      const score = vals.length ? Math.round(mean(vals)! * 100) : null;
      let verdict: string;
      if (linked.length === 0) verdict = 'Mismatch: no daily habit feeds this goal. Either add one at the next level-up or question whether the goal is real.';
      else if (score === null) verdict = 'Insufficient data (needs a week of history).';
      else if (score >= 80) verdict = 'Aligned: behaviours consistently support this goal.';
      else if (score >= 60) verdict = 'Partly aligned: the right habits exist but aren\'t consistent enough to deliver the goal on time.';
      else verdict = 'Mismatch: the stated goal and the actual behaviour disagree. Shrink the habit or revisit the goal.';
      return { goal, habits: linked, score, verdict };
    });
  const orphans = active.filter((h) => !goals.some((g) => g.id === h.goalLink));
  return { rows, orphans };
}
