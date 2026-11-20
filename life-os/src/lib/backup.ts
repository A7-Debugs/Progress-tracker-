import { ALL_TABLES, db, type TableName } from './db';

export const BACKUP_FORMAT = 'life-os-backup';
export const BACKUP_VERSION = 1;

export async function buildBackup(): Promise<string> {
  const data: Record<string, unknown> = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString() };
  for (const t of ALL_TABLES) data[t] = await db.table(t).toArray();
  // Never write the AI API key into a file that may be shared or synced.
  data.settings = (data.settings as Record<string, unknown>[]).map((s) => ({ ...s, ai: { ...(s.ai as object), apiKey: '' } }));
  return JSON.stringify(data);
}

export async function downloadBackup(): Promise<void> {
  const json = await buildBackup();
  await saveFile(`life-os-backup-${new Date().toISOString().slice(0, 10)}.json`, json, 'application/json');
  await db.settings.update('settings', { lastBackupAt: Date.now() });
}

/** Saves a file: the Android share sheet where available, otherwise a normal download. */
export async function saveFile(name: string, content: string, type: string): Promise<void> {
  const blob = new Blob([content], { type });
  // On Android, the share sheet lets you save the backup to Drive or Files.
  try {
    const file = new File([blob], name, { type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
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
}

/** Replaces all data with the backup's contents. Validates before touching anything. */
export async function restoreBackup(json: string): Promise<void> {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("That file isn't a valid backup.");
  }
  if (data.format !== BACKUP_FORMAT) throw new Error("That file isn't a Life OS backup.");
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) throw new Error('This backup is from a newer version of Life OS.');
  if (!Array.isArray(data.profile) || !Array.isArray(data.settings)) throw new Error('The backup is missing its profile.');
  const keep = (await db.settings.get('settings'))?.ai.apiKey ?? '';
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) {
      await db.table(t).clear();
      const rows = data[t as TableName];
      if (Array.isArray(rows) && rows.length) await db.table(t).bulkPut(rows);
    }
    const st = await db.settings.get('settings');
    if (st && keep && !st.ai?.apiKey) await db.settings.put({ ...st, ai: { ...st.ai, apiKey: keep } });
  });
}

const csvCell = (v: unknown) => {
  const x = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
};

export function toCsv(rows: Record<string, unknown>[], cols: string[]): string {
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
}

export async function wipeEverything(): Promise<void> {
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) await db.table(t).clear();
  });
}
