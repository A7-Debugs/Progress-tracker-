import { db } from './db';

export async function exportJSON(): Promise<void> {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    exerciseDefs: await db.exerciseDefs.toArray(),
    programs: await db.programs.toArray(),
    workoutTemplates: await db.workoutTemplates.toArray(),
    workoutExercises: await db.workoutExercises.toArray(),
    sessions: await db.sessions.toArray(),
    setLogs: await db.setLogs.toArray(),
    bodyweightLogs: await db.bodyweightLogs.toArray(),
    settings: await db.settings.toArray(),
    checkins: await db.checkins.toArray(),
    weekPlans: await db.weekPlans.toArray(),
    financeSnapshots: await db.financeSnapshots.toArray(),
    lifeProfile: await db.lifeProfile.toArray(),
    // progressPhotos intentionally excluded from JSON export (binary blobs) — see exportPhotosZip-free approach below
  };
  downloadBlob(JSON.stringify(data, null, 2), `overload-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
}

function downloadBlob(content: string | Blob, filename: string, type: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importJSON(file: File): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text);
  await db.transaction(
    'rw',
    [db.exerciseDefs, db.programs, db.workoutTemplates, db.workoutExercises, db.sessions, db.setLogs, db.bodyweightLogs, db.settings, db.checkins, db.weekPlans, db.financeSnapshots, db.lifeProfile],
    async () => {
      if (data.exerciseDefs) await db.exerciseDefs.bulkPut(data.exerciseDefs);
      if (data.programs) await db.programs.bulkPut(data.programs);
      if (data.workoutTemplates) await db.workoutTemplates.bulkPut(data.workoutTemplates);
      if (data.workoutExercises) await db.workoutExercises.bulkPut(data.workoutExercises);
      if (data.sessions) await db.sessions.bulkPut(data.sessions);
      if (data.setLogs) await db.setLogs.bulkPut(data.setLogs);
      if (data.bodyweightLogs) await db.bodyweightLogs.bulkPut(data.bodyweightLogs);
      if (data.settings) await db.settings.bulkPut(data.settings);
      if (data.checkins) await db.checkins.bulkPut(data.checkins);
      if (data.weekPlans) await db.weekPlans.bulkPut(data.weekPlans);
      if (data.financeSnapshots) await db.financeSnapshots.bulkPut(data.financeSnapshots);
      if (data.lifeProfile) await db.lifeProfile.bulkPut(data.lifeProfile);
    },
  );
}

export async function exportCSV(): Promise<void> {
  const setLogs = await db.setLogs.toArray();
  const sessions = await db.sessions.toArray();
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  const header = ['date', 'workout', 'exercise', 'set', 'weight_kg', 'reps', 'rpe', 'warmup'];
  const rows = setLogs
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((s) => {
      const session = sessionById.get(s.sessionId);
      return [
        session?.date ?? '',
        csvEscape(session?.workoutName ?? ''),
        csvEscape(s.exerciseName),
        String(s.setNumber),
        String(s.weight),
        String(s.reps),
        s.rpe !== null ? String(s.rpe) : '',
        s.isWarmup ? 'yes' : 'no',
      ].join(',');
    });

  const csv = [header.join(','), ...rows].join('\n');
  downloadBlob(csv, `overload-sets-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function wipeAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.exerciseDefs,
      db.programs,
      db.workoutTemplates,
      db.workoutExercises,
      db.sessions,
      db.setLogs,
      db.bodyweightLogs,
      db.progressPhotos,
      db.settings,
      db.checkins,
      db.weekPlans,
      db.financeSnapshots,
      db.lifeProfile,
    ],
    async () => {
      await Promise.all([
        db.exerciseDefs.clear(),
        db.programs.clear(),
        db.workoutTemplates.clear(),
        db.workoutExercises.clear(),
        db.sessions.clear(),
        db.setLogs.clear(),
        db.bodyweightLogs.clear(),
        db.progressPhotos.clear(),
        db.settings.clear(),
        db.checkins.clear(),
        db.weekPlans.clear(),
        db.financeSnapshots.clear(),
        db.lifeProfile.clear(),
      ]);
    },
  );
}
