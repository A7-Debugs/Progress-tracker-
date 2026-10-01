import { HABITS, LEVELS } from './habits';
import { addDaysStr, pastWeeks, weekStartOf, type LifeContext, type PeriodEval } from './engine';
import type { Level, Mode, Phase, WeekPlan } from './types';

export type ProgressionStatus = 'insufficient' | 'level-up' | 'hold' | 'deload' | 'stabilise' | 'rebuild' | 'drop-level';

export interface Criterion {
  label: string;
  current: string;
  target: string;
  met: boolean;
}

export interface ProgressionRec {
  status: ProgressionStatus;
  headline: string;
  reasons: string[];
  nextPhase: Phase;
  nextLevel: Level;
  criteria: Criterion[];
  /** What would change if the recommendation is applied. */
  changes: string[];
}

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x)}%`);
const adh = (w: PeriodEval) => (w.habitAdherence === null ? null : w.habitAdherence * 100);

/** A week counts as evidence only if at least 4 of its days were logged. */
const valid = (w: PeriodEval) => w.loggedDays >= 4 && w.habitAdherence !== null;

export const LEVEL_UP_RULES = {
  weeks: 3,
  eachWeekMin: 80,
  meanMin: 85,
  recoveryMin: 60,
};

export const DELOAD_RULES = {
  twoWeeksBelow: 60,
  oneWeekBelow: 45,
  recoveryTwoWeeksBelow: 45,
  stabiliseWeeks: 2,
  stabiliseMin: 75,
};

export function levelChanges(from: Level, to: Level): string[] {
  const out: string[] = [];
  const target = LEVELS.find((l) => l.level === to)!;
  out.push(`Level ${to} — ${target.name}: ${target.summary}`);
  for (const h of HABITS) {
    if (h.unlock === to && to > from) out.push(`New habit: ${h.name} (${h.minLabel} minimum)`);
    const a = h.targets[from];
    const b = h.targets[to];
    if (h.unlock <= Math.min(from, to) && (a.perWeek !== b.perWeek || a.min !== b.min)) {
      out.push(`${h.name}: ${a.perWeek}x→${b.perWeek}x/week${a.min !== b.min ? `, minimum ${a.min}→${b.min}` : ''}`);
    }
  }
  return out;
}

export function recommendProgression(ctx: LifeContext): ProgressionRec {
  const { profile } = ctx;
  const weeks = pastWeeks(ctx, 6).filter(valid); // newest first
  const level = profile.level;

  if (weeks.length < 2) {
    return {
      status: 'insufficient',
      headline: 'Insufficient data — keep logging',
      reasons: [`Progression decisions need at least 2 completed weeks with 4+ logged days. You have ${weeks.length}.`],
      nextPhase: profile.phase,
      nextLevel: level,
      criteria: [],
      changes: [],
    };
  }

  const [w1, w2] = weeks;
  const since = (date: string) => weeks.filter((w) => w.start >= weekStartOf(date));

  // --- Deload → Stabilise -----------------------------------------------------------------
  if (profile.phase === 'deload') {
    const deloadWeeks = since(profile.phaseSince);
    if (deloadWeeks.length === 0) {
      return {
        status: 'deload',
        headline: 'Deload in progress — Minimum Mode this week',
        reasons: ['Run the minimum version of each habit. The only goal is to keep the chain alive.'],
        nextPhase: 'deload',
        nextLevel: level,
        criteria: [],
        changes: [],
      };
    }
    if ((adh(w1) ?? 0) < 50 && level > 1) {
      return {
        status: 'drop-level',
        headline: `Drop to Level ${level - 1} and rebuild`,
        reasons: [`Even in Minimum Mode adherence was ${pct(adh(w1))}. The load is too high for your current life — this is a system problem, not a discipline problem.`],
        nextPhase: 'stabilise',
        nextLevel: (level - 1) as Level,
        criteria: [],
        changes: levelChanges(level, (level - 1) as Level),
      };
    }
    return {
      status: 'stabilise',
      headline: 'Deload done — stabilise at Normal Mode',
      reasons: [`Deload week adherence ${pct(adh(w1))}. Return to Normal Mode at the same level; no increases for ${DELOAD_RULES.stabiliseWeeks} weeks.`],
      nextPhase: 'stabilise',
      nextLevel: level,
      criteria: [],
      changes: ['Mode → Normal', 'Targets unchanged'],
    };
  }

  // --- Stabilise → Rebuild -----------------------------------------------------------------
  if (profile.phase === 'stabilise') {
    const st = since(profile.phaseSince);
    const good = st.slice(0, DELOAD_RULES.stabiliseWeeks).filter((w) => (adh(w) ?? 0) >= DELOAD_RULES.stabiliseMin);
    const criteria: Criterion[] = [
      {
        label: `${DELOAD_RULES.stabiliseWeeks} weeks ≥ ${DELOAD_RULES.stabiliseMin}% adherence since stabilising`,
        current: `${good.length}/${DELOAD_RULES.stabiliseWeeks}`,
        target: `${DELOAD_RULES.stabiliseWeeks}`,
        met: good.length >= DELOAD_RULES.stabiliseWeeks,
      },
    ];
    if (good.length >= DELOAD_RULES.stabiliseWeeks) {
      return {
        status: 'rebuild',
        headline: 'Stable again — resume normal progression',
        reasons: ['Two solid weeks after the deload. Level-up rules apply again from now.'],
        nextPhase: 'build',
        nextLevel: level,
        criteria,
        changes: ['Phase → Build (level-up rules re-enabled)'],
      };
    }
    if (st.length > 0 && (adh(w1) ?? 0) < DELOAD_RULES.twoWeeksBelow) {
      return {
        status: 'deload',
        headline: 'Still struggling — deload again',
        reasons: [`Adherence ${pct(adh(w1))} while stabilising. Something in the environment is making this hard; check the friction analysis.`],
        nextPhase: 'deload',
        nextLevel: level,
        criteria,
        changes: ['Next week → Minimum Mode'],
      };
    }
    return {
      status: 'stabilise',
      headline: 'Stabilising — hold everything steady',
      reasons: ['Keep targets and mode unchanged until two consecutive solid weeks.'],
      nextPhase: 'stabilise',
      nextLevel: level,
      criteria,
      changes: [],
    };
  }

  // --- Build ---------------------------------------------------------------------------------
  const a1 = adh(w1) ?? 0;
  const a2 = adh(w2) ?? 0;
  const r1 = w1.domains.recovery.score;
  const r2 = w2.domains.recovery.score;
  const deloadReasons: string[] = [];
  if (a1 < DELOAD_RULES.twoWeeksBelow && a2 < DELOAD_RULES.twoWeeksBelow)
    deloadReasons.push(`Adherence below ${DELOAD_RULES.twoWeeksBelow}% two weeks running (${pct(a2)} → ${pct(a1)}).`);
  if (a1 < DELOAD_RULES.oneWeekBelow) deloadReasons.push(`Last week's adherence dropped to ${pct(a1)}.`);
  if (r1 !== null && r2 !== null && r1 < DELOAD_RULES.recoveryTwoWeeksBelow && r2 < DELOAD_RULES.recoveryTwoWeeksBelow)
    deloadReasons.push(`Recovery score below ${DELOAD_RULES.recoveryTwoWeeksBelow} two weeks running — pushing now risks burnout.`);
  if (deloadReasons.length) {
    return {
      status: 'deload',
      headline: 'Deload → stabilise → rebuild',
      reasons: [...deloadReasons, 'Missed days are data: the load currently exceeds your capacity. Shrink the system for one week.'],
      nextPhase: 'deload',
      nextLevel: level,
      criteria: [],
      changes: ['Next week → Minimum Mode (smallest version of each habit)', 'Then 2 weeks of Normal Mode before any increase'],
    };
  }

  const weeksAtLevel = weeks.filter((w) => w.start >= weekStartOf(addDaysStr(profile.levelSince, 6))).length;
  const last3 = weeks.slice(0, LEVEL_UP_RULES.weeks);
  const mean3 = last3.length ? last3.reduce((a, w) => a + (adh(w) ?? 0), 0) / last3.length : 0;
  const minWeek = last3.length ? Math.min(...last3.map((w) => adh(w) ?? 0)) : 0;
  const minRecovery = last3.length ? Math.min(...last3.map((w) => w.domains.recovery.score ?? -1)) : -1;
  const criteria: Criterion[] = [
    { label: 'Full weeks at this level', current: `${weeksAtLevel}`, target: `${LEVEL_UP_RULES.weeks}`, met: weeksAtLevel >= LEVEL_UP_RULES.weeks },
    { label: `3-week mean adherence`, current: pct(mean3), target: `${LEVEL_UP_RULES.meanMin}%`, met: last3.length >= 3 && mean3 >= LEVEL_UP_RULES.meanMin },
    { label: 'No week below', current: pct(minWeek), target: `${LEVEL_UP_RULES.eachWeekMin}%`, met: last3.length >= 3 && minWeek >= LEVEL_UP_RULES.eachWeekMin },
    { label: 'Recovery every week ≥', current: minRecovery < 0 ? 'no sleep data' : `${minRecovery}`, target: `${LEVEL_UP_RULES.recoveryMin}`, met: minRecovery >= LEVEL_UP_RULES.recoveryMin },
  ];

  if (level < 6 && criteria.every((c) => c.met)) {
    const next = (level + 1) as Level;
    return {
      status: 'level-up',
      headline: `Ready for Level ${next} — ${LEVELS[next - 1].name}`,
      reasons: ['The data says your capacity has grown: 3+ weeks of high adherence with healthy recovery.'],
      nextPhase: 'build',
      nextLevel: next,
      criteria,
      changes: levelChanges(level, next),
    };
  }

  return {
    status: 'hold',
    headline: level === 6 ? 'Maintain — Elite means durable' : `Hold Level ${level} — keep compounding`,
    reasons: [
      level === 6
        ? 'No further habits are added at Level 6. Protect recovery and keep standards steady.'
        : 'Not enough evidence yet to add load. Doing well is not a reason to add more — sustained evidence is.',
    ],
    nextPhase: 'build',
    nextLevel: level,
    criteria,
    changes: [],
  };
}

// ---------------------------------------------------------------------------
// Weekly mode selection
// ---------------------------------------------------------------------------

export interface ModeRec {
  mode: Mode;
  reasons: string[];
}

export function recommendMode(ctx: LifeContext, plan: Partial<WeekPlan> | undefined, phase: Phase): ModeRec {
  const last = pastWeeks(ctx, 2);
  const w1 = last[0];
  const reasons: string[] = [];

  if (phase === 'deload') return { mode: 'minimum', reasons: ['Deload phase: Minimum Mode by design.'] };

  const strong: string[] = [];
  const soft: string[] = [];
  if (plan?.expectedWorkHours != null && plan.expectedWorkHours >= 55) strong.push(`${plan.expectedWorkHours}h work week expected`);
  if (plan?.expectedStress != null && plan.expectedStress >= 4) strong.push(`expected stress ${plan.expectedStress}/5`);
  if (w1?.metrics.avgSleep != null && w1.metrics.avgSleep < 6.5) strong.push(`last week's sleep averaged ${w1.metrics.avgSleep.toFixed(1)}h`);
  if (plan?.financialPressure != null && plan.financialPressure >= 4) soft.push(`financial pressure ${plan.financialPressure}/5`);
  if (plan?.socialCommitments != null && plan.socialCommitments >= 4) soft.push(`${plan.socialCommitments} evenings committed`);
  if (w1?.metrics.avgStress != null && w1.metrics.avgStress >= 3.8) soft.push(`last week's stress averaged ${w1.metrics.avgStress.toFixed(1)}/5`);
  if (plan?.expectedWorkHours != null && plan.expectedWorkHours >= 50 && plan.expectedWorkHours < 55) soft.push(`${plan.expectedWorkHours}h work week`);
  if (plan?.importantEvents && plan.importantEvents.trim().length > 0) soft.push(`upcoming: ${plan.importantEvents.trim()}`);

  if (strong.length >= 1 || soft.length >= 2) {
    return { mode: 'minimum', reasons: [...strong, ...soft].map((r) => `Minimum Mode because: ${r}.`) };
  }

  const recentModes = last.map((w) => ctx.planByWeek.get(w.start)?.mode);
  const adherence = w1?.habitAdherence ?? 0;
  const hpReady =
    phase === 'build' &&
    w1 !== undefined &&
    adherence >= 0.85 &&
    (w1.metrics.avgSleep ?? 0) >= 7.3 &&
    (w1.metrics.avgEnergy ?? 0) >= 3.8 &&
    (w1.metrics.avgStress ?? 5) <= 2.5 &&
    (plan?.expectedWorkHours == null || plan.expectedWorkHours <= 45) &&
    (plan?.expectedStress == null || plan.expectedStress <= 2);

  if (hpReady && recentModes[0] === 'high' && recentModes[1] === 'high') {
    return { mode: 'normal', reasons: ['Two High-Performance weeks in a row — take a planned Normal week before pushing again.'] };
  }
  if (hpReady) {
    return {
      mode: 'high',
      reasons: [
        `Last week: ${Math.round(adherence * 100)}% adherence, ${w1!.metrics.avgSleep!.toFixed(1)}h sleep, energy ${w1!.metrics.avgEnergy!.toFixed(1)}/5, low stress, light week ahead.`,
        'High-Performance Mode adds one scheduled day to training/study/nutrition habits. Minimums still count.',
      ],
    };
  }
  if (soft.length === 1) reasons.push(`Watch: ${soft[0]}.`);
  reasons.push('Standard week: Normal Mode.');
  return { mode: 'normal', reasons };
}
