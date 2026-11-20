import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import * as A from '@/lib/actions';
import { loadSnapshot } from '@/lib/snapshot';
import { addDays } from '@/lib/dates';
import { levelFromXp, totalXp, totalXpForLevel, xpLedger, xpToNext } from '@/lib/progression';
import { habitStats, habitsForDay, overallConsistency } from '@/lib/habits';
import { goalPace, goalProgress } from '@/lib/goals';
import { filterTasks, nextOccurrence, quadrant, taskScore } from '@/lib/tasks';
import { agendaFor, conflictsFor, recursOn } from '@/lib/schedule';
import { dayMetrics, insights, periodMetrics } from '@/lib/analytics';
import { buildBackup, restoreBackup, wipeEverything } from '@/lib/backup';
import { resetReconcileCache } from '@/lib/sync';
import { buildContext } from '@/lib/ai/context';
import { activeProvider } from '@/lib/ai/provider';
import { defaultSettings } from '@/lib/defaults';

/** Fake clock: Wednesday 18 Nov 2026, 18:00 local. */
let current = new Date(2026, 10, 18, 18, 0, 0);
const at = (d: Date) => {
  current = d;
};
const day = (iso: string, h = 18) => {
  const [y, m, d] = iso.split('-').map(Number);
  at(new Date(y, m - 1, d, h, 0, 0));
};
A.setClock(() => current);
const snap = async () => (await loadSnapshot(db, current))!;

async function freshUser(habitTemplateIds = ['water', 'read', 'exercise']) {
  await wipeEverything();
  resetReconcileCache();
  await A.init();
  await A.completeOnboarding({
    name: 'Alex',
    quiz: { focusAreas: ['career', 'finance'], routine: 'mixed', dailyMinutes: 60, obstacles: ['time'], horizon: '1y' },
    vision: 'Financially independent, qualified and healthy',
    goals: [
      { templateId: 'qualification', title: 'Become ACCA qualified', categoryId: 'career', targetDate: '2027-12-31', milestones: ['Pass exams', 'Ethics module', 'PER'] },
      { templateId: 'savings', title: 'Build £20,000 in savings', categoryId: 'finance', targetDate: '2028-11-18', startValue: 2000, targetValue: 20000, milestones: [] },
    ],
    habitTemplateIds,
  });
}

const goalByTitle = async (t: string) => (await db.goals.toArray()).find((g) => g.title === t)!;
const habitByName = async (n: string) => (await db.habits.toArray()).find((h) => h.name === n)!;
const task = (title: string, extra: Partial<A.TaskDraft> = {}): A.TaskDraft => ({
  title,
  notes: '',
  categoryId: null,
  goalId: null,
  milestoneId: null,
  priority: 3,
  important: false,
  urgent: false,
  difficulty: 'medium',
  estimateMin: null,
  dueDate: null,
  plannedDate: null,
  plannedTime: null,
  mit: false,
  recurrence: { type: 'none', interval: 1 },
  ...extra,
});

beforeEach(async () => {
  day('2026-11-18');
  await freshUser();
});

describe('levels', () => {
  it('follows the 0 / 100 / 250 / 450 / 700 curve and keeps getting harder', () => {
    expect([1, 2, 3, 4, 5].map((l) => totalXpForLevel(l))).toEqual([0, 100, 250, 450, 700]);
    for (let l = 1; l < 30; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(700).level).toBe(5);
    expect(levelFromXp(260)).toMatchObject({ level: 3, into: 10, needed: 200 });
  });
  it('level pace scales the requirement', () => {
    expect(totalXpForLevel(2, 2)).toBe(200);
  });
});

describe('onboarding', () => {
  it('creates the vision, linked goals, milestones and starter habits', async () => {
    const s = await snap();
    const vision = s.goals.find((g) => g.horizon === 'vision')!;
    expect(vision.measurement).toBe('children');
    const acca = s.goals.find((g) => g.title === 'Become ACCA qualified')!;
    expect(acca.parentId).toBe(vision.id);
    expect(s.milestonesByGoal.get(acca.id)!.map((m) => m.title)).toEqual(['Pass exams', 'Ethics module', 'PER']);
    const sav = s.goals.find((g) => g.title.startsWith('Build'))!;
    expect(sav).toMatchObject({ measurement: 'numeric', startValue: 2000, currentValue: 2000, targetValue: 20000 });
    expect(s.habits.map((h) => h.name)).toEqual(['Drink enough water', 'Read 20 pages', 'Exercise']);
    expect(s.profile.quiz?.routine).toBe('mixed');
  });
});

describe('habits', () => {
  it('supports done, partial (minimum) and missed, with partial at half credit', async () => {
    const h = await habitByName('Read 20 pages');
    await A.logHabit(h.id, '2026-11-18', null, { count: 5 });
    let s = await snap();
    expect(s.habitLogs.get(`${h.id}:2026-11-18`)!.status).toBe('partial');
    expect(dayMetrics(s).habitCredit).toBe(0.5);
    await A.logHabit(h.id, '2026-11-18', null, { count: 20 });
    s = await snap();
    expect(s.habitLogs.get(`${h.id}:2026-11-18`)!.status).toBe('done');
    await A.logHabit(h.id, '2026-11-18', 'missed');
    s = await snap();
    expect(habitStats(s, h).missed).toBe(1);
  });

  it('today is never a miss until it is over, and streaks forgive one miss per 7 successes', async () => {
    const h = await habitByName('Drink enough water');
    let s = await snap();
    expect(habitStats(s, h).missed).toBe(0);
    // 9 days of water (18th–26th), a missed day (27th), then the 28th.
    for (let i = 0; i < 9; i++) {
      day(addDays('2026-11-18', i));
      await A.logHabit(h.id, addDays('2026-11-18', i), 'done');
    }
    day('2026-11-27');
    day('2026-11-28');
    await A.logHabit(h.id, '2026-11-28', 'done');
    s = await snap();
    const st = habitStats(s, h);
    expect(st.missed).toBe(1);
    expect(st.current).toBe(10); // the grace day earned at 7 absorbed the miss on the 27th
    // Two misses in a row breaks it.
    day('2026-12-01');
    s = await snap();
    expect(habitStats(s, h).current).toBe(0);
    expect(habitStats(s, h).longest).toBe(10);
  });

  it('only allows logging within the last 7 days', async () => {
    const h = await habitByName('Drink enough water');
    day('2026-11-30');
    await expect(A.logHabit(h.id, '2026-11-20', 'done')).rejects.toThrow(/last 7 days/);
    await expect(A.logHabit(h.id, '2026-12-01', 'done')).rejects.toThrow();
  });

  it('weekly habits count per week and become "needed today" when slack runs out', async () => {
    const h = await habitByName('Exercise'); // 3× per week
    // Wed 18th: 5 days left including today, need 3 → optional.
    let s = await snap();
    expect(habitsForDay(s, '2026-11-18').find((p) => p.habit.id === h.id)!.week!.neededToday).toBe(false);
    day('2026-11-20'); // Fri: 3 days left, need 3 → needed
    s = await snap();
    expect(habitsForDay(s, '2026-11-20').find((p) => p.habit.id === h.id)!.week!.neededToday).toBe(true);
    for (const d of ['2026-11-20', '2026-11-21', '2026-11-22']) {
      day(d);
      await A.logHabit(h.id, d, 'done');
    }
    day('2026-11-23');
    s = await snap();
    const st = habitStats(s, h);
    expect(st.unit).toBe('weeks');
    expect(st.done).toBe(1);
    expect(st.current).toBe(1);
  });

  it('weekly habit XP is capped at its target per week', async () => {
    const h = await habitByName('Exercise');
    for (const d of ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']) {
      day(d);
      await A.logHabit(h.id, d, 'done');
    }
    const s = await snap();
    expect(xpLedger(s).filter((e) => e.id.startsWith(`h:${h.id}`))).toHaveLength(3);
  });
});

describe('goals', () => {
  it('measures progress from milestones, never from tasks', async () => {
    const g = await goalByTitle('Become ACCA qualified');
    for (let i = 0; i < 10; i++) {
      const id = await A.saveTask(task(`Study block ${i}`, { goalId: g.id }));
      await A.toggleTask(id);
    }
    let s = await snap();
    expect(goalProgress(s, s.goalById.get(g.id)!).value).toBe(0);
    const ms = s.milestonesByGoal.get(g.id)!;
    await A.toggleMilestone(ms[0].id);
    s = await snap();
    expect(goalProgress(s, s.goalById.get(g.id)!).value).toBeCloseTo(1 / 3);
  });

  it('busy-but-no-progress is flagged as an insight', async () => {
    const g = await goalByTitle('Become ACCA qualified');
    for (let i = 0; i < 6; i++) {
      const id = await A.saveTask(task(`Admin ${i}`, { goalId: g.id }));
      await A.toggleTask(id);
    }
    const s = await snap();
    expect(insights(s).some((i) => i.id === `busy-${g.id}`)).toBe(true);
  });

  it('numeric goals track value history and reconstruct past progress', async () => {
    const g = await goalByTitle('Build £20,000 in savings');
    day('2026-11-25');
    await A.recordGoalValue(g.id, 6500);
    day('2026-12-02');
    await A.recordGoalValue(g.id, 11000);
    const s = await snap();
    const live = s.goalById.get(g.id)!;
    expect(goalProgress(s, live).value).toBeCloseTo(0.5);
    expect(goalProgress(s, live, '2026-11-30').value).toBeCloseTo(0.25);
    expect(goalProgress(s, live, '2026-11-20').value).toBe(0);
  });

  it('vision progress is the average of its sub-goals', async () => {
    const g = await goalByTitle('Build £20,000 in savings');
    await A.recordGoalValue(g.id, 20000);
    const s = await snap();
    const vision = s.goals.find((x) => x.horizon === 'vision')!;
    expect(goalProgress(s, vision).value).toBeCloseTo(0.5);
  });

  it('pace compares progress with elapsed time', async () => {
    const g = await goalByTitle('Build £20,000 in savings'); // 2 years
    day('2027-11-18'); // half way, no progress
    const s = await snap();
    expect(goalPace(s, s.goalById.get(g.id)!).status).toBe('at-risk');
  });

  it('rejects hierarchy cycles and wrong-level parents', async () => {
    const acca = await goalByTitle('Become ACCA qualified');
    const qid = await A.saveGoal({ title: 'Pass SBR', description: '', categoryId: 'career', horizon: 'quarterly', parentId: acca.id, targetOutcome: '', startingPosition: '', measurement: 'binary', unit: '', startValue: 0, targetValue: 1, targetDate: null, priority: 2, difficulty: 'hard' });
    await expect(A.saveGoal({ ...acca, parentId: qid })).rejects.toThrow(/higher in the hierarchy/);
  });

  it('milestones ticked when added earn no XP; goals completed too soon earn no XP', async () => {
    const g = await goalByTitle('Become ACCA qualified');
    const mid = await A.addMilestone(g.id, 'Already done');
    await A.toggleMilestone(mid);
    let s = await snap();
    expect(xpLedger(s).find((e) => e.id === `m:${mid}`)!.amount).toBe(0);
    const ms = s.milestonesByGoal.get(g.id)![0];
    day('2026-11-20');
    await A.toggleMilestone(ms.id);
    s = await snap();
    expect(xpLedger(s).find((e) => e.id === `m:${ms.id}`)!.amount).toBe(100);
    await A.setGoalStatus(g.id, 'completed');
    s = await snap();
    expect(xpLedger(s).find((e) => e.id === `g:${g.id}`)!.amount).toBe(0);
  });
});

describe('tasks', () => {
  it('awards XP by difficulty with a daily cap, and unticking removes it', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) ids.push(await A.saveTask(task(`Hard ${i}`, { difficulty: 'hard' })));
    for (const id of ids) await A.toggleTask(id);
    let s = await snap();
    const taskXp = xpLedger(s).filter((e) => e.source === 'task');
    expect(taskXp.reduce((a, e) => a + e.amount, 0)).toBe(150); // 6 × 35 = 210, capped at 150
    expect(taskXp.some((e) => e.note)).toBe(true);
    await A.toggleTask(ids[0]);
    s = await snap();
    expect(xpLedger(s).filter((e) => e.source === 'task').reduce((a, e) => a + e.amount, 0)).toBe(150);
    for (const id of ids.slice(1)) await A.toggleTask(id);
    s = await snap();
    expect(xpLedger(s).filter((e) => e.source === 'task').reduce((a, e) => a + e.amount, 0)).toBe(0);
  });

  it('recurring tasks create exactly one next occurrence, removed again on undo', async () => {
    const id = await A.saveTask(task('Weekly finance review', { plannedDate: '2026-11-18', recurrence: { type: 'weekly', interval: 1 } }));
    await A.toggleTask(id);
    await A.toggleTask(id); // undo
    await A.toggleTask(id); // redo
    const all = await db.tasks.toArray();
    const open = all.filter((t) => !t.done);
    expect(open).toHaveLength(1);
    expect(open[0].plannedDate).toBe('2026-11-25');
    expect(nextOccurrence('2026-01-31', { type: 'monthly', interval: 1 }, '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrence('2026-11-20', { type: 'weekdays', interval: 1 }, '2026-11-20')).toBe('2026-11-23');
  });

  it('counts postponements and limits Most Important Tasks to three a day', async () => {
    const id = await A.saveTask(task('Write report', { plannedDate: '2026-11-18' }));
    await A.postponeTask(id);
    await A.planTaskFor(id, '2026-11-25');
    expect((await db.tasks.get(id))!.postponed).toBe(2);
    for (let i = 0; i < 3; i++) await A.saveTask(task(`MIT ${i}`, { plannedDate: '2026-11-18', mit: true }));
    await expect(A.saveTask(task('MIT 4', { plannedDate: '2026-11-18', mit: true }))).rejects.toThrow(/3 Most Important/);
  });

  it('filters and the Eisenhower matrix', async () => {
    await A.saveTask(task('Overdue', { dueDate: '2026-11-10', priority: 1 }));
    await A.saveTask(task('Tomorrow', { plannedDate: '2026-11-19' }));
    await A.saveTask(task('Someday', { priority: 4 }));
    const s = await snap();
    const titles = (f: Parameters<typeof filterTasks>[1]) => filterTasks(s, f).map((t) => t.title);
    expect(titles('today')).toEqual(['Overdue']);
    expect(titles('overdue')).toEqual(['Overdue']);
    expect(titles('tomorrow')).toEqual(['Tomorrow']);
    expect(titles('inbox')).toEqual(['Someday']);
    const byTitle = (t: string) => s.tasks.find((x) => x.title === t)!;
    expect(quadrant(s, byTitle('Overdue'))).toBe(1);
    expect(quadrant(s, byTitle('Someday'))).toBe(4);
    expect(taskScore(s, byTitle('Overdue')).score).toBeGreaterThan(taskScore(s, byTitle('Someday')).score);
  });
});

describe('schedule', () => {
  it('expands recurring events and detects conflicts', async () => {
    await A.saveEvent({ title: 'Gym', kind: 'block', date: '2026-11-16', start: '07:00', end: '08:00', categoryId: 'health', taskId: null, habitId: null, recurrence: { type: 'weekdays', interval: 1 }, notes: '' });
    await A.saveEvent({ title: 'Call', kind: 'event', date: '2026-11-18', start: '07:30', end: '08:15', categoryId: null, taskId: null, habitId: null, recurrence: { type: 'none', interval: 1 }, notes: '' });
    const s = await snap();
    expect(agendaFor(s, '2026-11-21')).toHaveLength(0); // Saturday
    const c = conflictsFor(agendaFor(s, '2026-11-18'));
    expect(c).toHaveLength(1);
    expect(c[0].overlapMin).toBe(30);
    expect(recursOn('2026-01-31', { type: 'monthly', interval: 1 }, '2026-02-28')).toBe(true);
    await expect(A.saveEvent({ title: 'Bad', kind: 'event', date: '2026-11-18', start: '10:00', end: '09:00', categoryId: null, taskId: null, habitId: null, recurrence: { type: 'none', interval: 1 }, notes: '' })).rejects.toThrow(/after the start/);
  });
});

describe('metrics', () => {
  it('daily completion and productivity are computed from real data only', async () => {
    let s = await snap();
    const m0 = dayMetrics(s);
    expect(m0.completion).toBe(0);
    const h = await habitByName('Drink enough water');
    await A.logHabit(h.id, '2026-11-18', 'done');
    const tid = await A.saveTask(task('One thing', { plannedDate: '2026-11-18' }));
    await A.toggleTask(tid, { actualMin: 45 });
    s = await snap();
    const m = dayMetrics(s);
    expect(m.tasksDone).toBe(1);
    expect(m.focusMin).toBe(45);
    expect(m.productivity).toBeGreaterThan(0);
    expect(m.completion).toBeCloseTo((1 + 1) / (m.habitsPlanned + 1));
  });

  it('week consistency XP needs 80% over 5+ completed occurrences', async () => {
    const h = await habitByName('Drink enough water');
    for (let i = 0; i < 5; i++) {
      const d = addDays('2026-11-23', i);
      day(d);
      await A.logHabit(h.id, d, 'done');
      const r = await habitByName('Read 20 pages');
      await A.logHabit(r.id, d, 'done');
    }
    for (const d of ['2026-11-28', '2026-11-29']) {
      day(d);
      await A.logHabit(h.id, d, 'done');
      await A.logHabit((await habitByName('Read 20 pages')).id, d, 'done');
    }
    day('2026-11-30');
    const s = await snap();
    const c = overallConsistency(s, '2026-11-23', '2026-11-29');
    expect(c.rate).toBe(1 * 14 / 15); // exercise 0/1 week
    expect(xpLedger(s).some((e) => e.id === 'cw:2026-11-23')).toBe(true);
    const pm = periodMetrics(s, '2026-11-23', '2026-11-29', xpLedger(s));
    expect(pm.consistency).toBe(1);
  });

  it('insights need minimum data and are not invented', async () => {
    const s = await snap();
    expect(insights(s).filter((i) => i.id === 'best-habit' || i.id === 'best-day')).toHaveLength(0);
  });
});

describe('data safety', () => {
  it('backups round-trip and never contain the AI key', async () => {
    await A.updateSettings({ ai: { provider: 'anthropic', apiKey: 'sk-ant-secret-key-value-123456', model: 'claude-opus-5-5' } });
    const json = await buildBackup();
    expect(json).not.toContain('sk-ant-secret');
    await A.saveTask(task('After backup'));
    await restoreBackup(json);
    const s = await snap();
    expect(s.tasks.some((t) => t.title === 'After backup')).toBe(false);
    expect(s.settings.ai.apiKey).toBe('sk-ant-secret-key-value-123456');
    await expect(restoreBackup('{"format":"other"}')).rejects.toThrow();
  });

  it('XP total is derived and stable across repeated reconciles', async () => {
    const h = await habitByName('Drink enough water');
    await A.logHabit(h.id, '2026-11-18', 'done');
    await A.logHabit(h.id, '2026-11-18', 'done');
    const s = await snap();
    expect(totalXp(xpLedger(s))).toBe(5);
  });
});

describe('assistant architecture', () => {
  it('builds a factual brief and reports no provider without a key', async () => {
    const s = await snap();
    const brief = buildContext(s);
    expect(brief).toContain('Become ACCA qualified');
    expect(brief).toContain('## 3. What may be preventing progress');
    expect(activeProvider(defaultSettings().ai)).toBeNull();
  });
});
