import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import * as A from '@/lib/actions';
import { loadSnapshot } from '@/lib/snapshot';
import { addDays, daysBetween, logicalDate, sleepMinutes, weekStart } from '@/lib/dates';
import { levelFromXp, totalXpForLevel, xpToNext } from '@/lib/levels';
import { streakInfo, totalXp, dayStatus, weeklyConsistency } from '@/lib/performance';
import { applyReview } from '@/lib/academy/srs';
import { sessionXp } from '@/lib/academy/academy';
import { buildBackup, restoreBackup, wipeEverything } from '@/lib/backup';
import { reconcile } from '@/lib/sync';
import { onCelebrate, type Celebration } from '@/lib/celebrate';
import { buildPlan } from '@/lib/academy/planner';
import { coachAdvice } from '@/lib/coach';

/** Fake clock: a Wednesday in term time, 18:00 local. */
let current = new Date(2026, 10, 18, 18, 0, 0);
const at = (d: Date) => {
  current = d;
};
A.setClock(() => current);

const snap = async () => (await loadSnapshot(db, current))!;
const habitByTpl = async (tpl: string) => (await db.habits.toArray()).find((h) => h.templateId === tpl)!;

async function freshUser(templateIds = ['wake', 'bed-made', 'teeth-am', 'water', 'homework', 'teeth-pm']) {
  await wipeEverything();
  await A.init();
  await A.completeOnboarding({ nickname: 'Test', avatar: { icon: 'Rocket', palette: 'cyber', frame: 'ring' }, templateIds, wakeTarget: '07:00', bedTarget: '21:45', subjects: ['Mathematics', 'History'] });
}

async function completeAll(date: string) {
  const s = await snap();
  for (const h of dayStatus(s, date).scheduled) {
    if (h.link === 'manual') {
      if (h.target > 1) await A.setHabitCount(h.id, date, h.target);
      else if (!(s.habitLogs.get(`${h.id}:${date}`)?.count)) await A.toggleHabit(h.id, date);
    } else if (h.link === 'water') await A.setNutrition(date, { water: h.target });
  }
}

beforeEach(async () => {
  at(new Date(2026, 10, 18, 18, 0, 0));
  await freshUser();
});

describe('dates', () => {
  it('handles the day boundary at 4am', () => {
    expect(logicalDate(new Date(2026, 10, 18, 2, 30), 4)).toBe('2026-11-17');
    expect(logicalDate(new Date(2026, 10, 18, 4, 0), 4)).toBe('2026-11-18');
  });
  it('is immune to daylight saving changes', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
  });
  it('starts weeks on Monday', () => {
    expect(weekStart('2026-11-18')).toBe('2026-11-16');
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // Sunday
    expect(weekStart('2026-11-23')).toBe('2026-11-23');
  });
  it('calculates sleep across midnight', () => {
    expect(sleepMinutes('21:45', '07:00')).toBe(555);
    expect(sleepMinutes('00:30', '08:00')).toBe(450);
  });
});

describe('levels', () => {
  it('follows 100 × L^1.5', () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(2)).toBe(283);
    expect(xpToNext(4)).toBe(800);
    expect(totalXpForLevel(3)).toBe(383);
  });
  it('derives level and progress from total XP', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    const l = levelFromXp(383 + 260);
    expect(l.level).toBe(3);
    expect(l.into).toBe(260);
    expect(l.remaining).toBe(520 - 260);
  });
});

describe('habits & XP', () => {
  it('awards XP once per scheduled completion — repeated taps never farm XP', async () => {
    const h = await habitByTpl('bed-made');
    const today = '2026-11-18';
    await A.toggleHabit(h.id, today);
    const xp1 = totalXp(await snap());
    expect(xp1).toBeGreaterThanOrEqual(5);
    // Tap, untap, tap again, and reconcile many times
    await A.toggleHabit(h.id, today);
    await A.toggleHabit(h.id, today);
    for (let i = 0; i < 5; i++) await reconcile(db, { now: current, silent: true });
    expect(totalXp(await snap())).toBe(xp1);
    const events = (await snap()).xpEvents.filter((e) => e.id === `h:${h.id}:${today}`);
    expect(events).toHaveLength(1);
  });

  it('removes XP when a mistaken tick is undone', async () => {
    const h = await habitByTpl('bed-made');
    await A.toggleHabit(h.id, '2026-11-18');
    expect((await snap()).xpEvents.some((e) => e.id === `h:${h.id}:2026-11-18`)).toBe(true);
    await A.toggleHabit(h.id, '2026-11-18');
    expect((await snap()).xpEvents.some((e) => e.id === `h:${h.id}:2026-11-18`)).toBe(false);
  });

  it('does not award XP on unscheduled days', async () => {
    const hw = await habitByTpl('homework'); // Sun–Thu
    at(new Date(2026, 10, 20, 18)); // Friday
    await expect(A.toggleHabit(hw.id, '2026-11-20')).resolves.toBeDefined();
    const s = await snap();
    expect(s.xpEvents.find((e) => e.id === `h:${hw.id}:2026-11-20`)).toBeUndefined();
  });

  it('locks days older than yesterday', async () => {
    const h = await habitByTpl('bed-made');
    await expect(A.toggleHabit(h.id, '2026-11-16')).rejects.toThrow();
    at(new Date(2026, 10, 19, 9));
    await expect(A.toggleHabit(h.id, '2026-11-18')).resolves.toBeDefined(); // yesterday is fine
  });

  it('gives the full-routine bonus only when every scheduled habit is done', async () => {
    await completeAll('2026-11-18');
    const s = await snap();
    expect(s.xpEvents.find((e) => e.id === 'r:2026-11-18')?.amount).toBe(25);
    expect(dayStatus(s, '2026-11-18').pct).toBe(1);
  });

  it('never removes XP for missed days', async () => {
    await completeAll('2026-11-18');
    const xp = totalXp(await snap());
    at(new Date(2026, 10, 22, 18)); // four days later, nothing logged
    await reconcile(db, { now: current, silent: true });
    expect(totalXp(await snap())).toBeGreaterThanOrEqual(xp);
  });

  it('keeps earned XP when a habit is deleted', async () => {
    const h = await habitByTpl('bed-made');
    await A.toggleHabit(h.id, '2026-11-18');
    const xp = totalXp(await snap());
    await A.deleteHabit(h.id);
    expect(totalXp(await snap())).toBeGreaterThanOrEqual(xp);
  });

  it('links water to the nutrition log', async () => {
    for (let i = 0; i < 6; i++) await A.addWater(1);
    const s = await snap();
    const w = await habitByTpl('water');
    expect(s.xpEvents.some((e) => e.id === `h:${w.id}:2026-11-18`)).toBe(true);
  });

  it('levels up and celebrates each level exactly once', async () => {
    const seen: Celebration[] = [];
    const off = onCelebrate((c) => seen.push(c));
    await completeAll('2026-11-18');
    off();
    const s = await snap();
    expect(levelFromXp(totalXp(s)).level).toBeGreaterThanOrEqual(2);
    expect(seen.filter((c) => c.kind === 'level')).toHaveLength(1);
    expect(s.profile.celebratedLevel).toBe(levelFromXp(totalXp(s)).level);
    const seen2: Celebration[] = [];
    const off2 = onCelebrate((c) => seen2.push(c));
    await reconcile(db, { now: current });
    off2();
    expect(seen2.filter((c) => c.kind === 'level')).toHaveLength(0);
  });
});

describe('streaks', () => {
  it('counts active days, ignores today until it is over, and uses shields', async () => {
    // 8 good days: Nov 11 → Nov 18. Start the profile on Nov 11.
    await db.profile.update('me', { startDate: '2026-11-11' });
    await db.habits.toCollection().modify({ startDate: '2026-11-11' });
    for (let i = 0; i < 8; i++) {
      const d = addDays('2026-11-11', i);
      at(new Date(`${d}T18:00:00`));
      await completeAll(d);
    }
    let st = streakInfo(await snap());
    expect(st.current).toBe(8);
    expect(st.shields).toBe(1);
    // Nov 19 missed, Nov 20 still today and untouched → shield covers 19, 20 is pending
    at(new Date(2026, 10, 20, 12));
    st = streakInfo(await snap());
    expect(st.history.get('2026-11-19')).toBe('shielded');
    expect(st.history.get('2026-11-20')).toBe('pending');
    expect(st.current).toBe(8);
    // Nov 21 also missed (no shield left) → streak resets on 22
    at(new Date(2026, 10, 22, 12));
    st = streakInfo(await snap());
    expect(st.current).toBe(0);
    expect(st.longest).toBe(8);
  });

  it('a day with half the habits done keeps the streak', async () => {
    const s0 = await snap();
    const sched = dayStatus(s0, '2026-11-18').scheduled.filter((h) => h.link === 'manual' && h.target === 1);
    for (const h of sched.slice(0, Math.ceil(dayStatus(s0, '2026-11-18').scheduled.length / 2))) await A.toggleHabit(h.id, '2026-11-18');
    expect(streakInfo(await snap()).todayActive).toBe(true);
  });
});

describe('quests', () => {
  it('generates 3 daily quests per day, deterministically, and awards XP once', async () => {
    const s = await snap();
    const dq = s.quests.filter((q) => q.period === 'day' && q.periodKey === '2026-11-18');
    expect(dq).toHaveLength(3);
    await completeAll('2026-11-18');
    for (let i = 0; i < 3; i++) await reconcile(db, { now: current, silent: true });
    const s2 = await snap();
    const ids = s2.xpEvents.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only unlocks weekly quests from level 4', async () => {
    const s = await snap();
    expect(s.quests.filter((q) => q.period === 'week')).toHaveLength(0);
  });

  it('daily reset: a new day gets new quests and a fresh 0%', async () => {
    await completeAll('2026-11-18');
    at(new Date(2026, 10, 19, 7));
    await reconcile(db, { now: current, silent: true });
    const s = await snap();
    expect(s.quests.filter((q) => q.periodKey === '2026-11-19' && q.period === 'day')).toHaveLength(3);
    expect(dayStatus(s, '2026-11-19').done).toHaveLength(0);
  });

  it('weekly reset: a new Monday gets fresh weekly quests once unlocked', async () => {
    await db.xpEvents.put({ id: 'test:boost', date: '2026-11-18', ts: 1, amount: 2000, source: 'bonus' as never, kind: 'life', label: 'test' });
    at(new Date(2026, 10, 23, 9)); // Monday
    await reconcile(db, { now: current, silent: true });
    const s = await snap();
    expect(s.quests.filter((q) => q.period === 'week' && q.periodKey === '2026-11-23').length).toBe(3);
  });
});

describe('achievements', () => {
  it('unlocks First Steps once and never twice', async () => {
    await completeAll('2026-11-18');
    await reconcile(db, { now: current, silent: true });
    const s = await snap();
    expect(s.achievements.has('first-steps')).toBe(true);
    expect(s.xpEvents.filter((e) => e.id === 'a:first-steps')).toHaveLength(1);
  });

  it('unlocks Athlete after 10 exercise sessions', async () => {
    for (let i = 0; i < 10; i++) await A.addExercise({ date: addDays('2026-11-18', -(i % 7)), type: 'run', minutes: 20, effort: 'moderate', note: '' });
    expect((await snap()).achievements.has('athlete')).toBe(true);
  });
});

describe('academy', () => {
  it('session XP: time + method bonus, capped, and nothing under 5 minutes', () => {
    expect(sessionXp(10 * 60, 10, 'reading', 0)).toBe(10);
    expect(sessionXp(15 * 60, 15, 'reading', 0)).toBe(15);
    expect(sessionXp(25 * 60, 25, 'reading', 0)).toBe(25);
    expect(sessionXp(10 * 60, 10, 'active-recall', 0)).toBe(20);
    expect(sessionXp(10 * 60, 10, 'exam', 0)).toBe(25);
    expect(sessionXp(4 * 60, 10, 'exam', 0)).toBe(0);
    expect(sessionXp(9999, 10, 'reading', 0)).toBe(10); // can't exceed planned
    expect(sessionXp(25 * 60, 25, 'exam', 80)).toBe(10); // daily cap 90
  });

  it('timer only counts while running and stops at the planned length', async () => {
    const s = await snap();
    const subj = s.subjects[0];
    const topicId = await A.addTopic(subj.id, 'Fractions');
    at(new Date(2026, 10, 18, 18, 0, 0));
    await A.startTimer({ subjectId: subj.id, topicId, method: 'active-recall', plannedMinutes: 10 });
    at(new Date(2026, 10, 18, 18, 4, 0));
    await A.pauseTimer();
    at(new Date(2026, 10, 18, 19, 0, 0)); // paused for an hour — doesn't count
    let t = (await db.timer.get('timer'))!;
    expect(Math.round(A.timerSeconds(t))).toBe(240);
    await A.resumeTimer();
    at(new Date(2026, 10, 18, 23, 0, 0)); // left running for hours
    t = (await db.timer.get('timer'))!;
    expect(A.timerSeconds(t)).toBe(600);
    const session = await A.finishSession({ studied: 'Adding fractions', difficult: '', confidence: 3, revisit: false, practiceCorrect: null, practiceTotal: null });
    expect(session!.xp).toBe(20);
    const topic = (await db.topics.get(topicId))!;
    expect(topic.firstStudied).toBe('2026-11-18');
    expect(topic.nextReview).toBe('2026-11-19');
    expect(topic.status).toBe(1); // Learning — never auto-mastered
    // Duplicate prevention: one XP event for the session
    expect((await snap()).xpEvents.filter((e) => e.id === `rev:${session!.id}`)).toHaveLength(1);
  });

  it('cancelling a session records nothing', async () => {
    const s = await snap();
    await A.startTimer({ subjectId: s.subjects[0].id, topicId: null, method: 'reading', plannedMinutes: 15 });
    await A.cancelTimer();
    expect(await db.revisionSessions.count()).toBe(0);
  });

  it('spaced repetition ladder adapts to Easy / Medium / Difficult', () => {
    expect(applyReview(0, 'easy', '2026-11-19')).toMatchObject({ reviewStage: 1, intervalDays: 3, nextReview: '2026-11-22' });
    expect(applyReview(1, 'easy', '2026-11-22')).toMatchObject({ reviewStage: 2, intervalDays: 7 });
    expect(applyReview(2, 'medium', '2026-11-29').intervalDays).toBe(5);
    expect(applyReview(3, 'hard', '2026-12-13')).toMatchObject({ reviewStage: 2, intervalDays: 1, nextReview: '2026-12-14' });
  });

  it('awards review XP only for due reviews, once per topic per day', async () => {
    const s = await snap();
    const topicId = await A.addTopic(s.subjects[0].id, 'Algebra');
    await A.markStudiedInClass(topicId); // due tomorrow
    await A.rateReview(topicId, 'easy'); // early — no XP
    expect((await db.topicReviews.toArray())[0].xp).toBe(0);
    at(new Date(2026, 10, 22, 18)); // due on 21st (3-day gap) → due now
    await A.rateReview(topicId, 'medium');
    await A.rateReview(topicId, 'medium');
    const xps = (await db.topicReviews.toArray()).map((r) => r.xp).sort();
    expect(xps).toEqual([0, 0, 15]);
  });

  it('planner respects the target, rest days, heavy homework and rotates subjects', async () => {
    await A.updateSettings({ revisionPerWeek: 3, studyDays: [1, 2, 3, 4, 0], homeworkMinutes: { '0': 0, '1': 30, '2': 90, '3': 30, '4': 30, '5': 0, '6': 0 } });
    at(new Date(2026, 10, 23, 7)); // Monday
    const s = await snap();
    const plan = buildPlan(s, '2026-11-23');
    const study = plan.items.filter((i) => i.kind === 'study');
    expect(study).toHaveLength(3);
    expect(study.some((i) => i.date === '2026-11-24')).toBe(false); // Tuesday has 90 min homework
    expect(study.some((i) => ['2026-11-27', '2026-11-28'].includes(i.date))).toBe(false); // Fri/Sat not study days
    for (let i = 1; i < study.length; i++) expect(study[i].subjectId === study[i - 1].subjectId).toBe(false);
  });
});

describe('coach', () => {
  it('never changes anything by itself and welcomes new users', async () => {
    const s = await snap();
    const advice = coachAdvice(s);
    expect(advice[0].kind).toBe('welcome');
    const before = await db.habits.count();
    coachAdvice(s);
    expect(await db.habits.count()).toBe(before);
  });
});

describe('persistence & backup', () => {
  it('round-trips a full backup', async () => {
    await completeAll('2026-11-18');
    const before = await snap();
    const json = await buildBackup();
    await wipeEverything();
    expect(await db.habits.count()).toBe(0);
    await restoreBackup(json);
    const after = await snap();
    expect(totalXp(after)).toBe(totalXp(before));
    expect(after.habits.length).toBe(before.habits.length);
    expect(weeklyConsistency(after).pct).toBe(weeklyConsistency(before).pct);
  });
  it('rejects files that are not LIFE XP backups', async () => {
    await expect(restoreBackup('{"format":"other"}')).rejects.toThrow();
    await expect(restoreBackup('nope')).rejects.toThrow();
  });
});
