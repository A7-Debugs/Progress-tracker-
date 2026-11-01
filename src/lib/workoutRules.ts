import { estimate1RM, groupBySession } from './calculations';
import type { ExerciseDef, SetLog } from './types';

/** "60kg × 8", or "3 min" for a timed round. */
export function formatSet(s: Pick<SetLog, 'weight' | 'reps' | 'durationSec'>): string {
  if (s.durationSec != null && s.weight === 0) {
    const m = Math.floor(s.durationSec / 60);
    const sec = s.durationSec % 60;
    return sec ? `${m}:${String(sec).padStart(2, '0')} min` : `${m} min`;
  }
  return `${s.weight}kg × ${s.reps}`;
}

/** Smallest sensible jump for the equipment. */
export function weightIncrement(def: Pick<ExerciseDef, 'equipment'>): number {
  const e = def.equipment.toLowerCase();
  if (e.includes('dumbbell')) return 2;
  return 2.5;
}

export const STALL_SESSIONS = 3;

export interface NextSuggestion {
  kind: 'add' | 'hold' | 'deload';
  weight: number;
  repLow: number;
  repHigh: number;
  stalledSessions: number;
  message: string;
}

interface SessionSummary {
  topWeight: number;
  best: number; // best e1RM
  minReps: number; // fewest reps across working sets
}

function summarise(priorSets: SetLog[]): SessionSummary[] {
  const working = priorSets.filter((s) => !s.isWarmup && s.weight > 0 && s.reps > 0);
  return groupBySession(working).map((g) => ({
    topWeight: Math.max(...g.sets.map((s) => s.weight)),
    best: Math.max(...g.sets.map((s) => estimate1RM(s.weight, s.reps))),
    minReps: Math.min(...g.sets.map((s) => s.reps)),
  }));
}

/** Sessions since the estimated 1RM last set a new high, counted from the most recent deload (≥7% weight drop). */
export function stalledSessions(sessions: SessionSummary[]): number {
  if (sessions.length < 2) return 0;
  let base = 0;
  for (let i = 1; i < sessions.length; i++) if (sessions[i].topWeight <= sessions[i - 1].topWeight * 0.93) base = i;
  let best = sessions[base].best;
  let lastHigh = base;
  for (let i = base + 1; i < sessions.length; i++) {
    if (sessions[i].best > best + 0.01) {
      best = sessions[i].best;
      lastHigh = i;
    }
  }
  return sessions.length - 1 - lastHigh;
}

/**
 * Double progression:
 * - every working set at the top of the rep range last time → add the smallest increment
 * - no new estimated-1RM high for 3 sessions → drop 10% and build back up
 * - otherwise keep the weight and add reps
 */
export function suggestNext(def: Pick<ExerciseDef, 'equipment' | 'kind'>, repLow: number, repHigh: number, priorSets: SetLog[]): NextSuggestion | null {
  if (def.kind === 'timed') return null;
  const sessions = summarise(priorSets);
  if (!sessions.length) return null;
  const last = sessions[sessions.length - 1];
  const inc = weightIncrement({ equipment: def.equipment ?? '' });
  const stalled = stalledSessions(sessions);
  if (stalled >= STALL_SESSIONS) {
    // Round down so a light lift can't round back up to the same weight.
    const down = Math.floor((last.topWeight * 0.9) / inc) * inc;
    const weight = Math.max(inc, down < last.topWeight ? down : last.topWeight - inc);
    return {
      kind: 'deload',
      weight,
      repLow,
      repHigh,
      stalledSessions: stalled,
      message: `No progress in ${stalled} sessions: drop to ${weight}kg (−10%) and build back up to ${repHigh} reps.`,
    };
  }
  if (last.minReps >= repHigh) {
    const weight = last.topWeight + inc;
    return {
      kind: 'add',
      weight,
      repLow,
      repHigh,
      stalledSessions: stalled,
      message: `Hit ${repHigh}+ reps on every set last time: go up to ${weight}kg for ${repLow}–${repHigh}.`,
    };
  }
  const aim = Math.min(repHigh, last.minReps + 1);
  return {
    kind: 'hold',
    weight: last.topWeight,
    repLow,
    repHigh,
    stalledSessions: stalled,
    message: `Stay at ${last.topWeight}kg: aim for ${aim}+ reps on every set (add weight at ${repHigh}).`,
  };
}
