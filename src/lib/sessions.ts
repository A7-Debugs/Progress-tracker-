import { db } from './db';
import { newId, todayStr } from './id';

const MIN = 60000;

/**
 * Start a workout — or, if the same workout was finished in the last hour today, offer to continue it
 * (prevents one gym visit being split across two sessions).
 */
export async function startOrResumeSession(w: { workoutId: string; workoutName: string; programId: string; programName: string }): Promise<string> {
  const date = todayStr();
  const recent = await db.sessions
    .where('date')
    .equals(date)
    .filter((s) => s.completedAt !== null && s.workoutTemplateId === w.workoutId && Date.now() - s.completedAt < 60 * MIN)
    .first();
  if (recent) {
    const ago = Math.max(1, Math.round((Date.now() - recent.completedAt!) / MIN));
    if (confirm(`You finished ${recent.workoutName} ${ago} min ago. Continue that session instead of starting a new one?`)) {
      await db.sessions.update(recent.id, { completedAt: null });
      return recent.id;
    }
  }
  const id = newId();
  await db.sessions.add({
    id,
    workoutTemplateId: w.workoutId,
    workoutName: w.workoutName,
    programId: w.programId,
    programName: w.programName,
    date,
    startedAt: Date.now(),
    completedAt: null,
    notes: '',
    bodyweight: null,
  });
  return id;
}
