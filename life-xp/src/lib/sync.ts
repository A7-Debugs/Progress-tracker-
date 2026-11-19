import type { LifeXpDB } from './db';
import { addDays, weekStart } from './dates';
import { loadSnapshot, type Snapshot } from './snapshot';
import { dayStatus, habitProgress, scheduledHabits, totalXp } from './performance';
import { DAILY_COMBO_XP, WEEKLY_COMBO_XP, evaluateQuest, generateDailyQuests, generateWeeklyQuests, questsFor } from './quests';
import { ACHIEVEMENTS, achievementProgress, computeStats, type AchievementDef } from './achievements';
import { levelFromXp, rankFor, unlocksBetween } from './levels';
import { celebrate } from './celebrate';
import type { DateStr, QuestRecord, XpEvent } from './types';

/** Habits can be ticked today and yesterday (forgot to log). Older days are locked. */
export const EDITABLE_DAYS = 2;

export interface ReconcileResult {
  xpBefore: number;
  xpAfter: number;
  levelsGained: number[];
  achievements: AchievementDef[];
  questsCompleted: QuestRecord[];
}

/** Ids of XP events the reconciler owns for a given day. */
const DAY_PREFIXES = ['h:', 'r:', 'dq:', 'dc:'];

function expectedDayEvents(s: Snapshot, date: DateStr, quests: QuestRecord[]): XpEvent[] {
  const ts = Date.now();
  const out: XpEvent[] = [];
  const st = dayStatus(s, date);
  for (const h of st.done) {
    out.push({ id: `h:${h.id}:${date}`, date, ts, amount: h.xp, source: 'habit', kind: h.xpKind, label: h.name });
  }
  if (st.scheduled.length >= 3 && st.pct === 1) {
    out.push({ id: `r:${date}`, date, ts, amount: s.settings.routineBonusXp, source: 'routine', kind: 'life', label: 'Full routine bonus' });
  }
  const dq = quests.filter((q) => q.period === 'day' && q.periodKey === date);
  for (const q of dq) {
    if (q.completedAt !== null) out.push({ id: `dq:${date}:${q.questId}`, date, ts, amount: q.xp, source: 'daily-quest', kind: 'life', label: q.title });
  }
  if (dq.length >= 2 && dq.every((q) => q.completedAt !== null)) {
    out.push({ id: `dc:${date}`, date, ts, amount: DAILY_COMBO_XP, source: 'daily-combo', kind: 'life', label: 'All daily quests bonus' });
  }
  return out;
}

function expectedWeekEvents(s: Snapshot, ws: DateStr, quests: QuestRecord[]): XpEvent[] {
  const ts = Date.now();
  const out: XpEvent[] = [];
  const wq = quests.filter((q) => q.period === 'week' && q.periodKey === ws);
  // Weekly XP is dated on the day it was earned (clipped to that week).
  const end = addDays(ws, 6);
  const date = s.today < end ? s.today : end;
  for (const q of wq) {
    if (q.completedAt !== null) out.push({ id: `wq:${ws}:${q.questId}`, date, ts, amount: q.xp, source: 'weekly-quest', kind: 'life', label: q.title });
  }
  if (wq.length >= 2 && wq.every((q) => q.completedAt !== null)) {
    out.push({ id: `wc:${ws}`, date, ts, amount: WEEKLY_COMBO_XP, source: 'weekly-combo', kind: 'life', label: 'All weekly quests bonus' });
  }
  return out;
}

let chain: Promise<unknown> = Promise.resolve();

/**
 * Brings derived state (quests, XP, achievements, level) in line with the raw data.
 * Every award has a deterministic id, so running this any number of times can never
 * award the same thing twice. Serialised so overlapping taps can't race.
 */
export function reconcile(db: LifeXpDB, opts: { now?: Date; dates?: DateStr[]; silent?: boolean } = {}): Promise<ReconcileResult | null> {
  const run = chain.then(() => doReconcile(db, opts));
  chain = run.catch(() => undefined);
  return run;
}

async function doReconcile(db: LifeXpDB, opts: { now?: Date; dates?: DateStr[]; silent?: boolean }): Promise<ReconcileResult | null> {
  const now = opts.now ?? new Date();
  let s = await loadSnapshot(db, now);
  if (!s || !s.profile.onboarded) return null;
  const xpBefore = totalXp(s);
  const today = s.today;

  // 1. Make sure today's and this week's quests exist (generated once, then stored).
  const ws = weekStart(today);
  const newQuests: QuestRecord[] = [];
  if (questsFor(s, 'day', today).length === 0) newQuests.push(...generateDailyQuests(s, today));
  if (questsFor(s, 'week', ws).length === 0) newQuests.push(...generateWeeklyQuests(s, ws));
  if (newQuests.length) {
    await db.quests.bulkPut(newQuests);
    s = (await loadSnapshot(db, now))!;
  }

  // 2. Evaluate quests for the editable window.
  const dates = new Set<DateStr>([today, addDays(today, -1), ...(opts.dates ?? [])].filter((d) => d >= s!.profile.startDate && d <= today && d >= addDays(today, -(EDITABLE_DAYS - 1))));
  const weeks = new Set<DateStr>([...dates].map(weekStart));
  const questsCompleted: QuestRecord[] = [];
  const questUpdates: QuestRecord[] = [];
  for (const q of s.quests) {
    const relevant = (q.period === 'day' && dates.has(q.periodKey)) || (q.period === 'week' && weeks.has(q.periodKey));
    if (!relevant) continue;
    const ev = evaluateQuest(s, q);
    const completedAt = ev.done ? (q.completedAt ?? Date.now()) : null;
    if (ev.progress !== q.progress || ev.target !== q.target || completedAt !== q.completedAt) {
      const nq = { ...q, progress: ev.progress, target: ev.target, completedAt };
      questUpdates.push(nq);
      if (completedAt !== null && q.completedAt === null) questsCompleted.push(nq);
    }
  }
  if (questUpdates.length) await db.quests.bulkPut(questUpdates);
  const quests = s.quests.map((q) => questUpdates.find((u) => u.id === q.id) ?? q);

  // 3. Sync XP events owned by the reconciler for those days/weeks.
  const habitIds = new Set(s.habits.map((h) => h.id));
  const expected = new Map<string, XpEvent>();
  for (const d of dates) for (const e of expectedDayEvents(s, d, quests)) expected.set(e.id, e);
  for (const w of weeks) for (const e of expectedWeekEvents(s, w, quests)) expected.set(e.id, e);
  const existing = new Map(s.xpEvents.map((e) => [e.id, e]));
  const toPut: XpEvent[] = [];
  const toDelete: string[] = [];
  for (const e of expected.values()) {
    const old = existing.get(e.id);
    if (!old) toPut.push(e);
    else if (old.amount !== e.amount && dates.has(old.date)) toPut.push({ ...e, ts: old.ts });
  }
  for (const e of s.xpEvents) {
    if (expected.has(e.id)) continue;
    const ownedDay = DAY_PREFIXES.some((p) => e.id.startsWith(p)) && dates.has(e.date);
    const ownedWeek = (e.id.startsWith('wq:') || e.id.startsWith('wc:')) && weeks.has(e.id.split(':')[1]);
    if (!ownedDay && !ownedWeek) continue;
    // XP from a habit that has since been deleted is kept: earned XP is never taken away.
    if (e.id.startsWith('h:') && !habitIds.has(e.id.split(':')[1])) continue;
    toDelete.push(e.id);
  }
  if (toPut.length || toDelete.length) {
    await db.transaction('rw', db.xpEvents, async () => {
      if (toDelete.length) await db.xpEvents.bulkDelete(toDelete);
      if (toPut.length) await db.xpEvents.bulkPut(toPut);
    });
  }

  // 4. Achievements — permanent once unlocked. Loop because badge XP can unlock level badges.
  const unlocked: AchievementDef[] = [];
  for (let pass = 0; pass < 3; pass++) {
    s = (await loadSnapshot(db, now))!;
    const stats = computeStats(s);
    const fresh = ACHIEVEMENTS.filter((a) => !s!.achievements.has(a.id) && achievementProgress(a, stats).done);
    if (!fresh.length) break;
    await db.transaction('rw', db.achievements, db.xpEvents, async () => {
      for (const a of fresh) {
        await db.achievements.put({ id: a.id, unlockedAt: Date.now(), date: today });
        if (a.xp > 0) {
          await db.xpEvents.put({ id: `a:${a.id}`, date: today, ts: Date.now(), amount: a.xp, source: 'achievement', kind: a.group === 'academy' ? 'academic' : 'life', label: `Badge: ${a.name}` });
        }
      }
    });
    unlocked.push(...fresh);
  }

  // 5. Level-ups — celebrated exactly once per level.
  s = (await loadSnapshot(db, now))!;
  const xpAfter = totalXp(s);
  const level = levelFromXp(xpAfter).level;
  const levelsGained: number[] = [];
  if (level > s.profile.celebratedLevel) {
    for (let l = s.profile.celebratedLevel + 1; l <= level; l++) levelsGained.push(l);
    await db.profile.update('me', { celebratedLevel: level });
  }

  if (!opts.silent) {
    if (xpAfter > xpBefore) celebrate({ kind: 'xp', amount: xpAfter - xpBefore });
    for (const q of questsCompleted) celebrate({ kind: 'quest', quest: q });
    for (const a of unlocked) celebrate({ kind: 'achievement', def: a });
    if (levelsGained.length) {
      const top = levelsGained.at(-1)!;
      celebrate({ kind: 'level', level: top, title: rankFor(top), unlocks: unlocksBetween(levelsGained[0] - 1, top) });
    }
  }
  return { xpBefore, xpAfter, levelsGained, achievements: unlocked, questsCompleted };
}

/** Used by the UI to explain a habit card's state. */
export function canEditDate(s: Snapshot, date: DateStr): boolean {
  return date <= s.today && date >= addDays(s.today, -(EDITABLE_DAYS - 1)) && date >= s.profile.startDate;
}

export { habitProgress, scheduledHabits };
