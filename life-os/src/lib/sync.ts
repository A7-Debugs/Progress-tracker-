import type { LifeOsDB } from './db';
import { loadSnapshot } from './snapshot';
import { ACHIEVEMENTS, achievementDone, achievementStats, levelInfo, stageFor, totalXp, xpLedger, type AchievementDef } from './progression';
import { celebrate } from './celebrate';

export interface ReconcileResult {
  xpBefore: number;
  xpAfter: number;
  levelsGained: number[];
  achievements: AchievementDef[];
}

let chain: Promise<unknown> = Promise.resolve();
let lastXp: number | null = null;

/**
 * Brings stored progression state (achievements, celebrated level) in line with the raw data.
 * XP itself is derived and never stored. Serialised so overlapping taps can't race.
 */
export function reconcile(db: LifeOsDB, opts: { now?: Date; silent?: boolean } = {}): Promise<ReconcileResult | null> {
  const run = chain.then(() => doReconcile(db, opts));
  chain = run.catch(() => undefined);
  return run;
}

async function doReconcile(db: LifeOsDB, opts: { now?: Date; silent?: boolean }): Promise<ReconcileResult | null> {
  const now = opts.now ?? new Date();
  let s = await loadSnapshot(db, now);
  if (!s || !s.profile.onboarded) return null;
  const xpBefore = lastXp ?? totalXp(xpLedger(s));

  // Achievements are permanent once unlocked.
  const stats = achievementStats(s);
  const fresh = ACHIEVEMENTS.filter((a) => !s!.achievements.has(a.id) && achievementDone(a, stats));
  if (fresh.length) {
    await db.achievements.bulkPut(fresh.map((a) => ({ id: a.id, unlockedAt: now.getTime(), date: s!.today })));
    s = (await loadSnapshot(db, now))!;
  }

  const ledger = xpLedger(s);
  const xpAfter = totalXp(ledger);
  lastXp = xpAfter;
  const level = levelInfo(s, ledger).level;
  const levelsGained: number[] = [];
  if (level > s.profile.celebratedLevel) {
    for (let l = s.profile.celebratedLevel + 1; l <= level; l++) levelsGained.push(l);
    await db.profile.update('me', { celebratedLevel: level });
  }

  if (!opts.silent) {
    if (xpAfter > xpBefore) celebrate({ kind: 'xp', amount: xpAfter - xpBefore });
    for (const a of fresh) celebrate({ kind: 'achievement', def: a });
    if (levelsGained.length) {
      const top = levelsGained.at(-1)!;
      celebrate({ kind: 'level', level: top, stage: stageFor(top) });
    }
  }
  return { xpBefore, xpAfter, levelsGained, achievements: fresh };
}

/** Test hook: forget the cached XP total between isolated test runs. */
export function resetReconcileCache() {
  lastXp = null;
}
