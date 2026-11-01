import { db } from './db';
import type { ExerciseDef, MuscleGroup, Session, SetLog } from './types';

const MIN = 60000;
/** An open session with no logged activity for this long is ended automatically. */
export const STALE_SESSION_MIN = 90;

async function lastActivity(s: Session): Promise<{ at: number; sets: number }> {
  const sets = await db.setLogs.where('sessionId').equals(s.id).toArray();
  const at = sets.reduce((m, x) => Math.max(m, x.createdAt), s.startedAt);
  return { at, sets: sets.length };
}

/**
 * End sessions left open: finished at their last logged set + 5 min, or deleted if nothing was logged.
 * Returns how many were ended / discarded.
 */
export async function autoEndStaleSessions(now = Date.now()): Promise<{ ended: number; discarded: number }> {
  const open = await db.sessions.filter((s) => s.completedAt === null).toArray();
  let ended = 0;
  let discarded = 0;
  for (const s of open) {
    const { at, sets } = await lastActivity(s);
    if (now - at < STALE_SESSION_MIN * MIN) continue;
    if (sets === 0) {
      await db.sessions.delete(s.id);
      discarded++;
    } else {
      await db.sessions.update(s.id, { completedAt: at + 5 * MIN });
      ended++;
    }
  }
  return { ended, discarded };
}

/** Exact duplicate rows in a workout template (same exercise and same targets): almost always a double-tap. */
export async function dedupeTemplateExercises(): Promise<number> {
  const rows = await db.workoutExercises.toArray();
  const seen = new Set<string>();
  const remove: string[] = [];
  for (const r of [...rows].sort((a, b) => a.order - b.order)) {
    const key = [r.workoutTemplateId, r.exerciseDefId, r.targetSets, r.targetRepLow, r.targetRepHigh].join('|');
    if (seen.has(key)) remove.push(r.id);
    else seen.add(key);
  }
  if (!remove.length) return 0;
  await db.transaction('rw', db.workoutExercises, async () => {
    await db.workoutExercises.bulkDelete(remove);
    const templates = new Set(rows.filter((r) => remove.includes(r.id)).map((r) => r.workoutTemplateId));
    for (const t of templates) {
      const left = await db.workoutExercises.where('workoutTemplateId').equals(t).sortBy('order');
      await Promise.all(left.map((r, i) => db.workoutExercises.update(r.id, { order: i })));
    }
  });
  return remove.length;
}

/** Boxing logged as sets × reps with a "Glutes" muscle group → timed rounds, Cardio. */
export async function fixTimedExercises(): Promise<number> {
  const defs = await db.exerciseDefs.filter((d) => d.kind === undefined && /\bbox(ing)?\b/i.test(d.name)).toArray();
  for (const d of defs) {
    await db.exerciseDefs.update(d.id, { kind: 'timed', muscleGroup: d.muscleGroup === 'Glutes' ? 'Cardio' : d.muscleGroup });
  }
  return defs.length;
}

/** Safe, idempotent repairs run on every start-up. */
export async function runStartupRepairs(): Promise<void> {
  await dedupeTemplateExercises();
  await fixTimedExercises();
  await autoEndStaleSessions();
}

// ---------------------------------------------------------------------------
// Issues that need a decision (shown on the clean-up screen)
// ---------------------------------------------------------------------------

export interface SessionIssue {
  kind: 'long' | 'nearEmpty' | 'split';
  session: Session;
  other?: Session;
  detail: string;
}

export interface DuplicatePair {
  a: ExerciseDef;
  b: ExerciseDef;
  aSets: number;
  bSets: number;
}

export interface OrphanGroup {
  exerciseDefId: string;
  name: string;
  sets: number;
}

const STOP = new Set(['the', 'a', 'with', 'machine', 'cable', 'dumbbell', 'barbell', 'db', 'bb', 'seated', 'standing', 'rope', 'smith', 'triceps', 'tricep', 'single', 'arm']);
const tokens = (name: string) => new Set(name.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)));

/** Likely duplicates: same muscle group and ≥50% of the longer name's key words shared (or identical key words). */
export function likelyDuplicates(defs: ExerciseDef[], counts: Map<string, number>): DuplicatePair[] {
  const live = defs.filter((d) => !d.archived);
  const out: DuplicatePair[] = [];
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      if (a.kind === 'timed' || b.kind === 'timed') continue;
      const ta = tokens(a.name);
      const tb = tokens(b.name);
      if (!ta.size || !tb.size) continue;
      const shared = [...ta].filter((t) => tb.has(t)).length;
      const same = shared === ta.size && shared === tb.size;
      if (!same && (a.muscleGroup !== b.muscleGroup || shared / Math.max(ta.size, tb.size) < 0.5)) continue;
      const aSets = counts.get(a.id) ?? 0;
      const bSets = counts.get(b.id) ?? 0;
      if (aSets === 0 && bSets === 0) continue; // nothing split yet
      out.push(aSets >= bSets ? { a, b, aSets, bSets } : { a: b, b: a, aSets: bSets, bSets: aSets });
    }
  }
  return out;
}

export async function findIssues() {
  const [sessions, sets, defs] = await Promise.all([db.sessions.toArray(), db.setLogs.toArray(), db.exerciseDefs.toArray()]);
  const bySession = new Map<string, SetLog[]>();
  for (const s of sets) bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s]);
  const done = sessions.filter((s) => s.completedAt !== null).sort((a, b) => a.startedAt - b.startedAt);

  const sessionIssues: SessionIssue[] = [];
  for (const s of done) {
    const ss = bySession.get(s.id) ?? [];
    const working = ss.filter((x) => !x.isWarmup);
    const mins = Math.round((s.completedAt! - s.startedAt) / MIN);
    const lastSet = ss.reduce((m, x) => Math.max(m, x.createdAt), 0);
    if (working.length <= 1) sessionIssues.push({ kind: 'nearEmpty', session: s, detail: `${mins} min, ${working.length} set${working.length === 1 ? '' : 's'}` });
    else if (mins > 150 || (lastSet && s.completedAt! - lastSet > 45 * MIN))
      sessionIssues.push({ kind: 'long', session: s, detail: `${(mins / 60).toFixed(1)} h recorded; last set ${Math.round((lastSet - s.startedAt) / MIN)} min in` });
  }
  for (let i = 1; i < done.length; i++) {
    const a = done[i - 1];
    const b = done[i];
    if (a.date === b.date && b.startedAt - a.completedAt! < 3 * 60 * MIN && (bySession.get(a.id)?.length ?? 0) > 0 && (bySession.get(b.id)?.length ?? 0) > 0)
      sessionIssues.push({ kind: 'split', session: a, other: b, detail: `${b.workoutName} started ${Math.max(0, Math.round((b.startedAt - a.completedAt!) / MIN))} min after ${a.workoutName} ended` });
  }

  const counts = new Map<string, number>();
  for (const s of sets) counts.set(s.exerciseDefId, (counts.get(s.exerciseDefId) ?? 0) + 1);
  const defIds = new Set(defs.map((d) => d.id));
  const orphanMap = new Map<string, OrphanGroup>();
  for (const s of sets) {
    if (defIds.has(s.exerciseDefId)) continue;
    const g = orphanMap.get(s.exerciseDefId) ?? { exerciseDefId: s.exerciseDefId, name: s.exerciseName, sets: 0 };
    g.sets++;
    orphanMap.set(s.exerciseDefId, g);
  }
  return { sessionIssues, duplicates: likelyDuplicates(defs, counts), orphans: [...orphanMap.values()] };
}

// ---------------------------------------------------------------------------
// Fixes
// ---------------------------------------------------------------------------

/** Move all history and template slots from `sourceId` onto `targetId`, then delete the source exercise. */
export async function mergeExercises(sourceId: string, targetId: string): Promise<void> {
  const target = await db.exerciseDefs.get(targetId);
  if (!target || sourceId === targetId) return;
  await db.transaction('rw', [db.setLogs, db.workoutExercises, db.exerciseDefs], async () => {
    await db.setLogs.where('exerciseDefId').equals(sourceId).modify({ exerciseDefId: targetId, exerciseName: target.name });
    const rows = await db.workoutExercises.where('exerciseDefId').equals(sourceId).toArray();
    for (const r of rows) {
      const clash = await db.workoutExercises.where('workoutTemplateId').equals(r.workoutTemplateId).filter((x) => x.exerciseDefId === targetId).count();
      if (clash) await db.workoutExercises.delete(r.id);
      else await db.workoutExercises.update(r.id, { exerciseDefId: targetId });
    }
    await db.exerciseDefs.delete(sourceId);
  });
}

/** Recreate a missing exercise with its original id so the orphaned history reconnects. */
export async function restoreOrphan(o: OrphanGroup, muscleGroup: MuscleGroup = 'Other'): Promise<void> {
  await db.exerciseDefs.put({
    id: o.exerciseDefId,
    name: o.name,
    muscleGroup,
    equipment: '',
    notes: '',
    restTimeSec: 90,
    tempo: '',
    videoUrl: '',
    archived: false,
    createdAt: Date.now(),
  });
}

/** Set the end time to 5 minutes after the last logged set. */
export async function trimSession(id: string): Promise<void> {
  const s = await db.sessions.get(id);
  if (!s) return;
  const { at } = await lastActivity(s);
  await db.sessions.update(id, { completedAt: at > s.startedAt ? at + 5 * MIN : s.startedAt + 60 * MIN });
}

export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    await db.setLogs.where('sessionId').equals(id).delete();
    await db.sessions.delete(id);
  });
}

/** Fold session `b` into `a`: sets move across (renumbered per exercise), times widen, notes join. */
export async function mergeSessions(aId: string, bId: string): Promise<void> {
  const [a, b] = await Promise.all([db.sessions.get(aId), db.sessions.get(bId)]);
  if (!a || !b) return;
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    await db.setLogs.where('sessionId').equals(bId).modify({ sessionId: aId });
    const all = (await db.setLogs.where('sessionId').equals(aId).toArray()).sort((x, y) => x.createdAt - y.createdAt);
    const n = new Map<string, number>();
    for (const s of all) {
      const k = (n.get(s.exerciseDefId) ?? 0) + 1;
      n.set(s.exerciseDefId, k);
      if (s.setNumber !== k) await db.setLogs.update(s.id, { setNumber: k });
    }
    await db.sessions.update(aId, {
      startedAt: Math.min(a.startedAt, b.startedAt),
      completedAt: Math.max(a.completedAt ?? 0, b.completedAt ?? 0) || null,
      workoutName: a.workoutName === b.workoutName ? a.workoutName : `${a.workoutName} + ${b.workoutName}`,
      notes: [a.notes, b.notes].filter(Boolean).join('\n'),
    });
    await db.sessions.delete(bId);
  });
}
