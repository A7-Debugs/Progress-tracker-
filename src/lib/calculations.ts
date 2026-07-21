import type { SetLog } from './types';

/** Epley formula estimated 1-rep max. */
export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function setVolume(set: Pick<SetLog, 'weight' | 'reps'>): number {
  return set.weight * set.reps;
}

export function totalVolume(sets: Pick<SetLog, 'weight' | 'reps' | 'isWarmup'>[]): number {
  return sets.filter((s) => !s.isWarmup).reduce((sum, s) => sum + setVolume(s), 0);
}

export function bestSet(sets: SetLog[]): SetLog | null {
  const working = sets.filter((s) => !s.isWarmup);
  if (working.length === 0) return null;
  return working.reduce((best, s) => (estimate1RM(s.weight, s.reps) > estimate1RM(best.weight, best.reps) ? s : best));
}

export function maxWeight(sets: SetLog[]): number {
  const working = sets.filter((s) => !s.isWarmup);
  return working.length ? Math.max(...working.map((s) => s.weight)) : 0;
}

export function maxReps(sets: SetLog[]): number {
  const working = sets.filter((s) => !s.isWarmup);
  return working.length ? Math.max(...working.map((s) => s.reps)) : 0;
}

export function best1RM(sets: SetLog[]): number {
  const working = sets.filter((s) => !s.isWarmup);
  return working.length ? Math.max(...working.map((s) => estimate1RM(s.weight, s.reps))) : 0;
}

export interface SessionGroup {
  sessionId: string;
  createdAt: number;
  sets: SetLog[];
}

/** Group set logs (already filtered to a single exercise) by session, sorted oldest -> newest. */
export function groupBySession(sets: SetLog[]): SessionGroup[] {
  const map = new Map<string, SetLog[]>();
  for (const s of sets) {
    const arr = map.get(s.sessionId) ?? [];
    arr.push(s);
    map.set(s.sessionId, arr);
  }
  const groups: SessionGroup[] = Array.from(map.entries()).map(([sessionId, groupSets]) => ({
    sessionId,
    createdAt: Math.min(...groupSets.map((s) => s.createdAt)),
    sets: groupSets.sort((a, b) => a.setNumber - b.setNumber),
  }));
  return groups.sort((a, b) => a.createdAt - b.createdAt);
}

export interface OverloadComparison {
  weightDelta: number;
  repDelta: number;
  volumeDelta: number;
  volumePctDelta: number;
  est1RMDelta: number;
  isNewPRWeight: boolean;
  isNewPRVolume: boolean;
  isNewPR1RM: boolean;
  improved: boolean;
}

/** Compare the current (in-progress) session's sets for an exercise against all prior history. */
export function compareToHistory(currentSets: SetLog[], priorSets: SetLog[]): OverloadComparison | null {
  const curWorking = currentSets.filter((s) => !s.isWarmup && s.weight > 0 && s.reps > 0);
  if (curWorking.length === 0) return null;

  const priorGroups = groupBySession(priorSets);
  const lastGroup = priorGroups[priorGroups.length - 1];

  const curTopSet = curWorking.reduce((best, s) => (estimate1RM(s.weight, s.reps) > estimate1RM(best.weight, best.reps) ? s : best));
  const curVolume = totalVolume(curWorking);
  const curBest1RM = best1RM(curWorking);

  const priorAllTimeMaxWeight = maxWeight(priorSets);
  const priorAllTimeMaxVolume = priorGroups.length
    ? Math.max(...priorGroups.map((g) => totalVolume(g.sets)))
    : 0;
  const priorAllTime1RM = best1RM(priorSets);

  let weightDelta = 0;
  let repDelta = 0;
  let volumeDelta = 0;
  let volumePctDelta = 0;
  let est1RMDelta = 0;

  if (lastGroup) {
    const lastTopSet = bestSet(lastGroup.sets);
    if (lastTopSet) {
      weightDelta = curTopSet.weight - lastTopSet.weight;
      repDelta = curTopSet.reps - lastTopSet.reps;
    }
    const lastVolume = totalVolume(lastGroup.sets);
    volumeDelta = curVolume - lastVolume;
    volumePctDelta = lastVolume > 0 ? (volumeDelta / lastVolume) * 100 : 0;
    est1RMDelta = curBest1RM - best1RM(lastGroup.sets);
  }

  const isNewPRWeight = curTopSet.weight > priorAllTimeMaxWeight;
  const isNewPRVolume = curVolume > priorAllTimeMaxVolume;
  const isNewPR1RM = curBest1RM > priorAllTime1RM;

  return {
    weightDelta,
    repDelta,
    volumeDelta,
    volumePctDelta,
    est1RMDelta,
    isNewPRWeight,
    isNewPRVolume,
    isNewPR1RM,
    improved: weightDelta > 0 || repDelta > 0 || volumeDelta > 0 || isNewPRWeight || isNewPRVolume || isNewPR1RM,
  };
}

/** Longest & current daily streak from a sorted list of unique yyyy-MM-dd date strings. */
export function computeStreaks(dates: string[]): { current: number; longest: number } {
  const unique = Array.from(new Set(dates)).sort();
  if (unique.length === 0) return { current: 0, longest: 0 };

  const toDays = (d: string) => Math.floor(new Date(d + 'T00:00:00').getTime() / 86400000);

  let longest = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    const diff = toDays(unique[i]) - toDays(unique[i - 1]);
    if (diff === 1) {
      run += 1;
    } else if (diff > 1) {
      run = 1;
    }
    longest = Math.max(longest, run);
  }

  const todayDays = Math.floor(Date.now() / 86400000);
  const lastDays = toDays(unique[unique.length - 1]);
  let current = 0;
  if (todayDays - lastDays <= 1) {
    current = 1;
    for (let i = unique.length - 1; i > 0; i--) {
      const diff = toDays(unique[i]) - toDays(unique[i - 1]);
      if (diff === 1) current += 1;
      else break;
    }
  }

  return { current, longest };
}

export function formatDelta(n: number, opts: { suffix?: string; decimals?: number } = {}): string {
  const { suffix = '', decimals = 1 } = opts;
  const rounded = Number(n.toFixed(decimals));
  if (rounded === 0) return `0${suffix}`;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}${suffix}`;
}
