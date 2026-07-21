import { db } from './db';
import { totalVolume, computeStreaks, best1RM, groupBySession } from './calculations';
import type { MuscleGroup } from './types';

export interface MuscleVolume {
  muscleGroup: MuscleGroup;
  sets: number;
  volume: number;
}

export interface AnalyticsSummary {
  totalWorkouts: number;
  lifetimeVolume: number;
  hoursTrained: number;
  exercisesCompleted: number;
  currentStreak: number;
  longestStreak: number;
  topMuscleGroup: string | null;
  trainingFrequencyPerWeek: number;
  mostImprovedLift: { name: string; pct: number } | null;
  currentBodyweight: number | null;
  weeklyVolumeByMuscle: MuscleVolume[];
  monthlyVolumeByMuscle: MuscleVolume[];
  weeklyTotalVolume: number;
  monthlyTotalVolume: number;
  averageWeeklyVolume: number;
  weeklyVolumeTrend: { label: string; value: number }[];
}

const DAY = 86400000;
const WEEK = DAY * 7;

export async function computeAnalytics(): Promise<AnalyticsSummary> {
  const [sessions, allSets, exerciseDefs, bodyweightLogs] = await Promise.all([
    db.sessions.toArray(),
    db.setLogs.toArray(),
    db.exerciseDefs.toArray(),
    db.bodyweightLogs.orderBy('date').toArray(),
  ]);

  const completed = sessions.filter((s) => s.completedAt !== null);
  const defById = new Map(exerciseDefs.map((d) => [d.id, d]));
  const workingSets = allSets.filter((s) => !s.isWarmup);

  const totalWorkouts = completed.length;
  const lifetimeVolume = totalVolume(workingSets);
  const hoursTrained = completed.reduce((sum, s) => sum + ((s.completedAt! - s.startedAt) / 3600000), 0);
  const exercisesCompleted = new Set(allSets.map((s) => s.exerciseDefId)).size;

  const { current, longest } = computeStreaks(completed.map((s) => s.date));

  // top muscle group by set count
  const muscleSetCount = new Map<string, number>();
  for (const s of workingSets) {
    const mg = defById.get(s.exerciseDefId)?.muscleGroup;
    if (!mg) continue;
    muscleSetCount.set(mg, (muscleSetCount.get(mg) ?? 0) + 1);
  }
  let topMuscleGroup: string | null = null;
  let topCount = 0;
  for (const [mg, count] of muscleSetCount) {
    if (count > topCount) {
      topCount = count;
      topMuscleGroup = mg;
    }
  }

  // training frequency: sessions per week since first session
  let trainingFrequencyPerWeek = 0;
  if (completed.length > 0) {
    const first = Math.min(...completed.map((s) => s.startedAt));
    const weeksElapsed = Math.max(1, (Date.now() - first) / WEEK);
    trainingFrequencyPerWeek = completed.length / weeksElapsed;
  }

  // average weekly volume
  let averageWeeklyVolume = 0;
  if (workingSets.length > 0) {
    const first = Math.min(...workingSets.map((s) => s.createdAt));
    const weeksElapsed = Math.max(1, (Date.now() - first) / WEEK);
    averageWeeklyVolume = lifetimeVolume / weeksElapsed;
  }

  // most improved lift: compare first vs last session best-1RM per exercise
  let mostImprovedLift: { name: string; pct: number } | null = null;
  const byExercise = new Map<string, typeof allSets>();
  for (const s of allSets) {
    const arr = byExercise.get(s.exerciseDefId) ?? [];
    arr.push(s);
    byExercise.set(s.exerciseDefId, arr);
  }
  for (const [exId, exSets] of byExercise) {
    const groups = groupBySession(exSets);
    if (groups.length < 2) continue;
    const firstRM = best1RM(groups[0].sets);
    const lastRM = best1RM(groups[groups.length - 1].sets);
    if (firstRM <= 0) continue;
    const pct = ((lastRM - firstRM) / firstRM) * 100;
    if (!mostImprovedLift || pct > mostImprovedLift.pct) {
      const name = defById.get(exId)?.name ?? 'Unknown';
      mostImprovedLift = { name, pct };
    }
  }

  const now = Date.now();
  const weekAgo = now - WEEK;
  const monthAgo = now - DAY * 30;

  function volumeByMuscle(sinceMs: number): MuscleVolume[] {
    const map = new Map<MuscleGroup, { sets: number; volume: number }>();
    for (const s of workingSets) {
      if (s.createdAt < sinceMs) continue;
      const mg = defById.get(s.exerciseDefId)?.muscleGroup;
      if (!mg) continue;
      const entry = map.get(mg) ?? { sets: 0, volume: 0 };
      entry.sets += 1;
      entry.volume += s.weight * s.reps;
      map.set(mg, entry);
    }
    return Array.from(map.entries())
      .map(([muscleGroup, v]) => ({ muscleGroup, ...v }))
      .sort((a, b) => b.sets - a.sets);
  }

  const weeklyVolumeByMuscle = volumeByMuscle(weekAgo);
  const monthlyVolumeByMuscle = volumeByMuscle(monthAgo);

  // last 8 weeks trend
  const weeklyVolumeTrend: { label: string; value: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const end = now - i * WEEK;
    const start = end - WEEK;
    const vol = totalVolume(workingSets.filter((s) => s.createdAt >= start && s.createdAt < end));
    weeklyVolumeTrend.push({ label: `W${8 - i}`, value: Math.round(vol) });
  }

  return {
    totalWorkouts,
    lifetimeVolume,
    hoursTrained,
    exercisesCompleted,
    currentStreak: current,
    longestStreak: longest,
    topMuscleGroup,
    trainingFrequencyPerWeek,
    mostImprovedLift,
    currentBodyweight: bodyweightLogs.length ? bodyweightLogs[bodyweightLogs.length - 1].weight : null,
    weeklyVolumeByMuscle,
    monthlyVolumeByMuscle,
    weeklyTotalVolume: weeklyVolumeByMuscle.reduce((s, m) => s + m.volume, 0),
    monthlyTotalVolume: monthlyVolumeByMuscle.reduce((s, m) => s + m.volume, 0),
    averageWeeklyVolume,
    weeklyVolumeTrend,
  };
}
