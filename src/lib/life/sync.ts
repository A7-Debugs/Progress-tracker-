import { db } from '@/lib/db';
import { proteinTargets } from './nutrition';
import type { DailyCheckin, Hit } from './types';

/** Minutes of the longest completed app workout on a date (null if none). */
export async function workoutMinutesOn(date: string): Promise<number | null> {
  const sessions = await db.sessions.where('date').equals(date).filter((s) => s.completedAt !== null).toArray();
  if (!sessions.length) return null;
  return Math.max(...sessions.map((s) => Math.max(1, Math.round((s.completedAt! - s.startedAt) / 60000))));
}

/** Protein result for a date from the food log (null if nothing logged). */
export async function proteinHitOn(date: string): Promise<Hit | null> {
  const logs = await db.foodLogs.where('date').equals(date).toArray();
  if (!logs.length) return null;
  const [profile, bw] = await Promise.all([db.lifeProfile.get('life'), db.bodyweightLogs.orderBy('date').toArray()]);
  if (!profile) return null;
  const t = proteinTargets(profile, bw, date);
  const total = logs.reduce((a, l) => a + l.protein, 0);
  return total >= t.ideal ? 'ideal' : total >= t.min ? 'min' : 'miss';
}

/** Fields that should come from the gym log and food log rather than being typed twice. */
export async function derivedFields(date: string, base: Pick<DailyCheckin, 'trainingMinutes' | 'habits'>): Promise<Pick<DailyCheckin, 'trainingMinutes' | 'habits'>> {
  const [mins, protein] = await Promise.all([workoutMinutesOn(date), proteinHitOn(date)]);
  return {
    trainingMinutes: mins !== null ? Math.max(mins, base.trainingMinutes ?? 0) : base.trainingMinutes,
    habits: protein !== null ? { ...base.habits, protein } : base.habits,
  };
}

/**
 * Keep an existing check-in in step with the gym and food logs.
 * Never creates a check-in: a day only counts as "logged" when you check in yourself.
 */
export async function syncCheckin(date: string): Promise<void> {
  const c = await db.checkins.get(date);
  if (!c) return;
  const d = await derivedFields(date, c);
  if (d.trainingMinutes !== c.trainingMinutes || JSON.stringify(d.habits) !== JSON.stringify(c.habits)) {
    await db.checkins.update(date, { ...d, updatedAt: Date.now() });
  }
}
