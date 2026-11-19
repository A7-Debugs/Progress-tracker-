import { ALL_TABLES, db, type TableName } from './db';

export const BACKUP_FORMAT = 'life-xp-backup';
export const BACKUP_VERSION = 1;

export async function buildBackup(): Promise<string> {
  const data: Record<string, unknown> = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString() };
  for (const t of ALL_TABLES) data[t] = await db.table(t).toArray();
  return JSON.stringify(data);
}

export async function downloadBackup(): Promise<void> {
  const json = await buildBackup();
  const name = `life-xp-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([json], { type: 'application/json' });
  // On Android, the share sheet lets you save the backup to Drive, Files or send it to a parent.
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'LIFE XP backup' });
      await db.settings.update('settings', { lastBackupAt: Date.now() });
      return;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  await db.settings.update('settings', { lastBackupAt: Date.now() });
}

/** Replaces all data with the backup's contents. Validates before touching anything. */
export async function restoreBackup(json: string): Promise<void> {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("That file isn't a valid backup.");
  }
  if (data.format !== BACKUP_FORMAT) throw new Error("That file isn't a LIFE XP backup.");
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) throw new Error('This backup is from a newer version of LIFE XP.');
  if (!Array.isArray(data.profile) || !Array.isArray(data.settings)) throw new Error('The backup is missing its profile.');
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) {
      await db.table(t).clear();
      const rows = data[t as TableName];
      if (Array.isArray(rows) && rows.length) await db.table(t).bulkPut(rows);
    }
  });
}

export async function wipeEverything(): Promise<void> {
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) await db.table(t).clear();
  });
}
