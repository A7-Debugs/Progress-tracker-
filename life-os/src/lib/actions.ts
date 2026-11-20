import { db } from './db';
import { addDays, logicalDate, toMinutes } from './dates';
import { CATEGORY_COLORS, ensureBase, GOAL_TEMPLATE_BY_ID, HABIT_TEMPLATE_BY_ID } from './defaults';
import { canLogHabit, logKey } from './habits';
import { HORIZON_RANK } from './goals';
import { MAX_MITS, nextOccurrence } from './tasks';
import { reconcile } from './sync';
import { newId } from './id';
import type {
  ActiveTimer,
  CalEvent,
  Category,
  DateStr,
  FocusSession,
  Goal,
  Habit,
  HabitLogStatus,
  JournalEntry,
  LearningItem,
  Milestone,
  Profile,
  QuizAnswers,
  Settings,
  Task,
  WeeklyReview,
} from './types';

// A swappable clock so tests can simulate days and weeks.
let clock: () => Date = () => new Date();
export function setClock(fn: () => Date) {
  clock = fn;
}
export const now = () => clock();
const ts = () => now().getTime();

export async function today(): Promise<DateStr> {
  const s = await db.settings.get('settings');
  return logicalDate(now(), s?.dayStartHour ?? 4);
}

const sync = (silent = false) => reconcile(db, { now: now(), silent });

function clean(x: string, max = 200) {
  return x.trim().slice(0, max);
}

function fail(msg: string): never {
  throw new Error(msg);
}

// ───────────────────────────── Setup ─────────────────────────────

export async function init() {
  await ensureBase(db, logicalDate(now()));
}

export interface OnboardingGoal {
  templateId: string | null;
  title: string;
  categoryId: string;
  targetDate: DateStr | null;
  targetValue?: number;
  startValue?: number;
  milestones: string[];
}

export async function completeOnboarding(x: { name: string; quiz: QuizAnswers; vision: string; goals: OnboardingGoal[]; habitTemplateIds: string[] }) {
  const t = await today();
  await db.transaction('rw', [db.profile, db.goals, db.milestones, db.habits], async () => {
    await db.profile.update('me', { name: clean(x.name, 40), onboarded: true, startDate: t, celebratedLevel: 1, quiz: x.quiz });
    let order = await db.goals.count();
    let visionId: string | null = null;
    if (x.vision.trim()) {
      visionId = newId();
      await db.goals.add(blankGoal({ id: visionId, title: clean(x.vision, 120), horizon: 'vision', measurement: 'children', categoryId: x.goals[0]?.categoryId ?? 'personal', order: order++, startDate: t }));
    }
    const goalByCategory = new Map<string, string>();
    for (const g of x.goals) {
      const tpl = g.templateId ? GOAL_TEMPLATE_BY_ID[g.templateId] : undefined;
      const id = newId();
      goalByCategory.set(g.categoryId, goalByCategory.get(g.categoryId) ?? id);
      const numeric = tpl?.measurement === 'numeric';
      await db.goals.add(
        blankGoal({
          id,
          title: clean(g.title, 120) || tpl?.title || 'New goal',
          description: tpl?.description ?? '',
          categoryId: g.categoryId,
          horizon: tpl?.horizon ?? 'annual',
          parentId: visionId,
          measurement: tpl?.measurement ?? 'milestones',
          unit: tpl?.unit ?? '',
          startValue: numeric ? (g.startValue ?? tpl?.startValue ?? 0) : 0,
          currentValue: numeric ? (g.startValue ?? tpl?.startValue ?? 0) : 0,
          targetValue: numeric ? (g.targetValue ?? tpl?.targetValue ?? 1) : 1,
          targetDate: g.targetDate,
          difficulty: tpl?.difficulty ?? 'medium',
          priority: 2,
          order: order++,
          startDate: t,
        }),
      );
      let mo = 0;
      for (const title of g.milestones.filter((m) => m.trim())) {
        await db.milestones.add({ id: newId(), goalId: id, title: clean(title, 120), description: '', dueDate: null, weight: 2, done: false, completedAt: null, completedDate: null, createdAt: ts(), order: mo++ });
      }
    }
    let ho = await db.habits.count();
    for (const hid of x.habitTemplateIds) {
      const tpl = HABIT_TEMPLATE_BY_ID[hid];
      if (!tpl) continue;
      await db.habits.add({
        id: newId(),
        name: tpl.name,
        description: tpl.description,
        categoryId: tpl.categoryId,
        goalId: goalByCategory.get(tpl.categoryId) ?? null,
        frequency: { ...tpl.frequency, days: [...tpl.frequency.days] },
        target: tpl.target,
        unit: tpl.unit,
        timeOfDay: tpl.timeOfDay,
        preferredTime: null,
        difficulty: tpl.difficulty,
        minimumVersion: tpl.minimumVersion,
        xpOverride: null,
        startDate: t,
        active: true,
        archivedAt: null,
        order: ho++,
        createdAt: ts(),
      });
    }
  });
  return sync(true);
}

// ───────────────────────────── Profile & settings ─────────────────────────────

export async function updateProfile(patch: Partial<Omit<Profile, 'id'>>) {
  await db.profile.update('me', patch);
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>) {
  const s = (await db.settings.get('settings'))!;
  const next = { ...s, ...patch };
  if (patch.xp) {
    const x = { ...s.xp, ...patch.xp };
    for (const k of Object.keys(x) as (keyof typeof x)[]) x[k] = Math.max(0, Math.min(5000, Math.round(Number(x[k]) || 0)));
    next.xp = x;
  }
  if (patch.levelPace !== undefined) next.levelPace = Math.max(0.5, Math.min(3, patch.levelPace));
  if (patch.dayStartHour !== undefined) next.dayStartHour = Math.max(0, Math.min(6, Math.round(patch.dayStartHour)));
  if (patch.dailyFocusTargetMin !== undefined) next.dailyFocusTargetMin = Math.max(0, Math.min(720, Math.round(patch.dailyFocusTargetMin)));
  await db.settings.put(next);
  return sync(true);
}

// ───────────────────────────── Categories ─────────────────────────────

export async function addCategory(name: string, color?: string, icon = 'Tag'): Promise<string> {
  const n = clean(name, 40);
  if (!n) fail('Name the category.');
  const all = await db.categories.toArray();
  if (all.some((c) => c.name.toLowerCase() === n.toLowerCase() && !c.archived)) fail('That category already exists.');
  const id = newId();
  await db.categories.add({ id, name: n, color: color ?? CATEGORY_COLORS[all.length % CATEGORY_COLORS.length], icon, builtin: false, order: all.length, archived: false });
  return id;
}

export async function updateCategory(id: string, patch: Partial<Omit<Category, 'id' | 'builtin'>>) {
  if (patch.name !== undefined && !clean(patch.name, 40)) fail('Name the category.');
  await db.categories.update(id, { ...patch, ...(patch.name !== undefined ? { name: clean(patch.name, 40) } : {}) });
}

// ───────────────────────────── Goals ─────────────────────────────

function blankGoal(p: Partial<Goal> & { id: string; startDate: DateStr }): Goal {
  return {
    title: '',
    description: '',
    categoryId: 'personal',
    horizon: 'annual',
    parentId: null,
    targetOutcome: '',
    startingPosition: '',
    measurement: 'milestones',
    unit: '',
    startValue: 0,
    targetValue: 1,
    currentValue: 0,
    targetDate: null,
    priority: 2,
    difficulty: 'medium',
    status: 'active',
    createdAt: ts(),
    completedAt: null,
    completedDate: null,
    order: 0,
    ...p,
  };
}

export type GoalDraft = Omit<Goal, 'id' | 'createdAt' | 'startDate' | 'completedAt' | 'completedDate' | 'order' | 'status' | 'currentValue'> & { id?: string; currentValue?: number };

export async function saveGoal(d: GoalDraft): Promise<string> {
  const title = clean(d.title, 120);
  if (!title) fail('Give the goal a name.');
  if (d.measurement === 'numeric' || d.measurement === 'hybrid') {
    if (!Number.isFinite(d.startValue) || !Number.isFinite(d.targetValue)) fail('Enter a starting value and a target value.');
    if (d.startValue === d.targetValue) fail('The target must differ from the starting value.');
  }
  if (d.parentId) {
    const p = await db.goals.get(d.parentId);
    if (!p) fail('The parent goal no longer exists.');
    if (HORIZON_RANK[p.horizon] >= HORIZON_RANK[d.horizon]) fail('A parent goal must sit higher in the hierarchy (e.g. an annual objective under a vision).');
    // No cycles.
    let cur: Goal | undefined = p;
    for (let i = 0; cur && i < 10; i++) {
      if (cur.id === d.id) fail('A goal cannot sit under its own sub-goal.');
      cur = cur.parentId ? await db.goals.get(cur.parentId) : undefined;
    }
  }
  const t = await today();
  const patch = {
    title,
    description: clean(d.description, 2000),
    categoryId: d.categoryId,
    horizon: d.horizon,
    parentId: d.parentId,
    targetOutcome: clean(d.targetOutcome, 500),
    startingPosition: clean(d.startingPosition, 500),
    measurement: d.measurement,
    unit: clean(d.unit, 20),
    startValue: Number(d.startValue) || 0,
    targetValue: Number(d.targetValue) || 0,
    targetDate: d.targetDate || null,
    priority: d.priority,
    difficulty: d.difficulty,
  };
  if (d.id) {
    const prev = await db.goals.get(d.id);
    if (!prev) fail('That goal no longer exists.');
    await db.goals.update(d.id, patch);
    await sync();
    return d.id;
  }
  const id = newId();
  const order = await db.goals.count();
  await db.goals.add(blankGoal({ ...patch, id, order, startDate: t, currentValue: d.currentValue ?? patch.startValue }));
  await sync();
  return id;
}

/** Records a new measured value for a numeric/hybrid goal. The history drives the progress charts. */
export async function recordGoalValue(goalId: string, value: number, note = '') {
  if (!Number.isFinite(value)) fail('Enter a number.');
  const t = await today();
  await db.transaction('rw', db.goals, db.goalUpdates, async () => {
    await db.goals.update(goalId, { currentValue: value });
    // One value per day: a second update on the same day replaces the first.
    const same = (await db.goalUpdates.where('goalId').equals(goalId).toArray()).filter((u) => u.date === t);
    if (same.length) await db.goalUpdates.bulkDelete(same.map((u) => u.id));
    await db.goalUpdates.add({ id: newId(), goalId, date: t, value, note: clean(note, 300), ts: ts() });
  });
  return sync();
}

export async function setGoalStatus(goalId: string, status: Goal['status']) {
  const t = await today();
  const g = await db.goals.get(goalId);
  if (!g) return;
  const patch: Partial<Goal> = { status };
  if (status === 'completed') {
    patch.completedAt = g.completedAt ?? ts();
    patch.completedDate = g.completedDate ?? t;
  } else if (status === 'active' || status === 'paused') {
    patch.completedAt = null;
    patch.completedDate = null;
  }
  await db.goals.update(goalId, patch);
  return sync();
}

/** Deletes a goal and its milestones. Sub-goals move up a level; linked tasks and habits are kept but unlinked. */
export async function deleteGoal(goalId: string) {
  await db.transaction('rw', [db.goals, db.milestones, db.goalUpdates, db.tasks, db.habits], async () => {
    const g = await db.goals.get(goalId);
    if (!g) return;
    await db.goals.where('parentId').equals(goalId).modify({ parentId: g.parentId });
    const ms = await db.milestones.where('goalId').equals(goalId).primaryKeys();
    await db.milestones.bulkDelete(ms);
    await db.goalUpdates.where('goalId').equals(goalId).delete();
    await db.tasks.where('goalId').equals(goalId).modify({ goalId: null, milestoneId: null });
    await db.habits.where('goalId').equals(goalId).modify({ goalId: null });
    await db.goals.delete(goalId);
  });
  return sync();
}

export async function addMilestone(goalId: string, title: string, opts: Partial<Pick<Milestone, 'dueDate' | 'weight' | 'description'>> = {}) {
  const n = clean(title, 120);
  if (!n) fail('Name the milestone.');
  const order = (await db.milestones.where('goalId').equals(goalId).count()) + 1;
  const id = newId();
  await db.milestones.add({ id, goalId, title: n, description: clean(opts.description ?? '', 500), dueDate: opts.dueDate ?? null, weight: opts.weight ?? 2, done: false, completedAt: null, completedDate: null, createdAt: ts(), order });
  await sync(true);
  return id;
}

export async function updateMilestone(id: string, patch: Partial<Pick<Milestone, 'title' | 'description' | 'dueDate' | 'weight'>>) {
  if (patch.title !== undefined && !clean(patch.title, 120)) fail('Name the milestone.');
  await db.milestones.update(id, { ...patch, ...(patch.title !== undefined ? { title: clean(patch.title, 120) } : {}) });
  return sync(true);
}

export async function toggleMilestone(id: string) {
  const m = await db.milestones.get(id);
  if (!m) return;
  const t = await today();
  await db.milestones.update(id, m.done ? { done: false, completedAt: null, completedDate: null } : { done: true, completedAt: ts(), completedDate: t });
  return sync();
}

export async function deleteMilestone(id: string) {
  await db.transaction('rw', db.milestones, db.tasks, async () => {
    await db.tasks.where('milestoneId').equals(id).modify({ milestoneId: null });
    await db.milestones.delete(id);
  });
  return sync(true);
}

export async function moveMilestone(id: string, dir: -1 | 1) {
  const m = await db.milestones.get(id);
  if (!m) return;
  const list = (await db.milestones.where('goalId').equals(m.goalId).toArray()).sort((a, b) => a.order - b.order);
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await db.milestones.bulkPut(list.map((x, k) => ({ ...x, order: k })));
}

// ───────────────────────────── Habits ─────────────────────────────

export type HabitDraft = Omit<Habit, 'id' | 'order' | 'createdAt' | 'startDate' | 'archivedAt' | 'active'> & { id?: string };

export async function saveHabit(d: HabitDraft): Promise<string> {
  const name = clean(d.name, 60);
  if (!name) fail('Give the habit a name.');
  const f = d.frequency;
  if (f.type === 'weekdays' && !f.days.length) fail('Pick at least one day.');
  const frequency = {
    type: f.type,
    days: [...new Set(f.days)].filter((x) => x >= 0 && x <= 6).sort(),
    timesPerWeek: Math.max(1, Math.min(7, Math.round(f.timesPerWeek || 1))),
    everyDays: Math.max(1, Math.min(60, Math.round(f.everyDays || 1))),
  };
  const draft = {
    name,
    description: clean(d.description, 500),
    categoryId: d.categoryId,
    goalId: d.goalId,
    frequency,
    target: Math.max(1, Math.min(10000, Math.round(d.target || 1))),
    unit: clean(d.unit, 20),
    timeOfDay: d.timeOfDay,
    preferredTime: d.preferredTime || null,
    difficulty: d.difficulty,
    minimumVersion: clean(d.minimumVersion, 120),
    xpOverride: d.xpOverride === null || d.xpOverride === undefined ? null : Math.max(0, Math.min(50, Math.round(d.xpOverride))),
  };
  if (d.id) {
    await db.habits.update(d.id, draft);
    await sync();
    return d.id;
  }
  const id = newId();
  await db.habits.add({ ...draft, id, order: await db.habits.count(), createdAt: ts(), startDate: await today(), archivedAt: null, active: true });
  await sync();
  return id;
}

/**
 * Records a habit for a day: 'done', 'partial' (the minimum version) or 'missed'; null clears it.
 * For count habits pass `count`; the status follows from it unless given explicitly.
 */
export async function logHabit(habitId: string, date: DateStr, status: HabitLogStatus | null, opts: { count?: number; note?: string } = {}) {
  const t = await today();
  if (!canLogHabit(t, date)) fail('Habits can be logged for the last 7 days only.');
  const h = await db.habits.get(habitId);
  if (!h) return;
  const id = logKey(habitId, date);
  if (status === null && opts.count === undefined) {
    await db.habitLogs.delete(id);
    return sync();
  }
  const prev = await db.habitLogs.get(id);
  let count = opts.count !== undefined ? Math.max(0, Math.min(100000, Math.round(opts.count))) : status === 'done' ? h.target : (prev?.count ?? 0);
  let st = status;
  if (st === null) {
    if (count <= 0) {
      await db.habitLogs.delete(id);
      return sync();
    }
    st = count >= h.target ? 'done' : 'partial';
  }
  if (st === 'missed') count = 0;
  await db.habitLogs.put({ id, habitId, date, status: st, count, note: clean(opts.note ?? prev?.note ?? '', 300), ts: ts() });
  return sync();
}

export async function archiveHabit(id: string) {
  await db.habits.update(id, { active: false, archivedAt: ts() });
  return sync();
}

export async function restoreHabit(id: string) {
  // It counts again from today, never retroactively.
  await db.habits.update(id, { active: true, archivedAt: null, startDate: await today() });
  return sync();
}

export async function deleteHabit(id: string) {
  await db.transaction('rw', db.habits, db.habitLogs, db.events, async () => {
    await db.habitLogs.where('habitId').equals(id).delete();
    await db.events.filter((e) => e.habitId === id).modify({ habitId: null });
    await db.habits.delete(id);
  });
  return sync();
}

export async function moveHabit(id: string, dir: -1 | 1) {
  const hs = await db.habits.orderBy('order').toArray();
  const i = hs.findIndex((h) => h.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= hs.length) return;
  [hs[i], hs[j]] = [hs[j], hs[i]];
  await db.habits.bulkPut(hs.map((h, k) => ({ ...h, order: k })));
}

// ───────────────────────────── Tasks ─────────────────────────────

export type TaskDraft = Omit<Task, 'id' | 'createdAt' | 'done' | 'completedAt' | 'completedDate' | 'postponed' | 'order' | 'seriesId'> & { id?: string };

async function assertMitSlot(date: DateStr | null, exceptId?: string) {
  if (!date) fail('Plan a day for the task before making it a Most Important Task.');
  const n = (await db.tasks.where('plannedDate').equals(date).toArray()).filter((t) => t.mit && t.id !== exceptId && (!t.done || t.completedDate === date)).length;
  if (n >= MAX_MITS) fail(`You already have ${MAX_MITS} Most Important Tasks for that day.`);
}

export async function saveTask(d: TaskDraft): Promise<string> {
  const title = clean(d.title, 200);
  if (!title) fail('Give the task a title.');
  if (d.milestoneId && d.goalId) {
    const m = await db.milestones.get(d.milestoneId);
    if (m && m.goalId !== d.goalId) d = { ...d, milestoneId: null };
  }
  const patch = {
    title,
    notes: clean(d.notes, 4000),
    categoryId: d.categoryId,
    goalId: d.goalId,
    milestoneId: d.goalId ? d.milestoneId : null,
    priority: d.priority,
    important: d.important,
    urgent: d.urgent,
    difficulty: d.difficulty,
    estimateMin: d.estimateMin === null || !Number.isFinite(d.estimateMin) ? null : Math.max(1, Math.min(1440, Math.round(d.estimateMin))),
    dueDate: d.dueDate || null,
    plannedDate: d.plannedDate || null,
    plannedTime: d.plannedDate ? d.plannedTime || null : null,
    mit: d.mit,
    recurrence: { type: d.recurrence.type, interval: Math.max(1, Math.min(52, Math.round(d.recurrence.interval || 1))) },
  };
  if (patch.mit) await assertMitSlot(patch.plannedDate, d.id);
  if (d.id) {
    const prev = await db.tasks.get(d.id);
    if (!prev) fail('That task no longer exists.');
    const later = (a: DateStr | null, b: DateStr | null) => !!a && !!b && b > a;
    const postponed = prev.postponed + (later(prev.plannedDate, patch.plannedDate) || later(prev.dueDate, patch.dueDate) ? 1 : 0);
    await db.tasks.update(d.id, { ...patch, postponed, seriesId: patch.recurrence.type === 'none' ? prev.seriesId : (prev.seriesId ?? prev.id) });
    await sync(true);
    return d.id;
  }
  const id = newId();
  await db.tasks.add({ ...patch, id, createdAt: ts(), done: false, completedAt: null, completedDate: null, postponed: 0, order: await db.tasks.count(), seriesId: patch.recurrence.type === 'none' ? null : id });
  await sync(true);
  return id;
}

/** Quick capture: title only, optionally for today. */
export async function quickAddTask(title: string, opts: { today?: boolean; goalId?: string | null; milestoneId?: string | null; categoryId?: string | null } = {}) {
  const t = await today();
  return saveTask({
    title,
    notes: '',
    categoryId: opts.categoryId ?? null,
    goalId: opts.goalId ?? null,
    milestoneId: opts.milestoneId ?? null,
    priority: 3,
    important: false,
    urgent: false,
    difficulty: 'medium',
    estimateMin: null,
    dueDate: null,
    plannedDate: opts.today ? t : null,
    plannedTime: null,
    mit: false,
    recurrence: { type: 'none', interval: 1 },
  });
}

/**
 * Complete or reopen a task. Completing a recurring task creates its next occurrence (with a
 * deterministic id, so double taps can't create two); reopening removes that occurrence if untouched.
 * `actualMin` logs the time it really took as a focus session.
 */
export async function toggleTask(id: string, opts: { actualMin?: number } = {}) {
  const t0 = await db.tasks.get(id);
  if (!t0) return;
  const t = await today();
  await db.transaction('rw', db.tasks, db.focusSessions, async () => {
    if (t0.done) {
      await db.tasks.update(id, { done: false, completedAt: null, completedDate: null });
      if (t0.recurrence.type !== 'none' && t0.seriesId) {
        const next = (await db.tasks.where('seriesId').equals(t0.seriesId).toArray()).filter((x) => x.id.startsWith(`${t0.seriesId}:`) && !x.done && x.createdAt >= (t0.completedAt ?? 0));
        await db.tasks.bulkDelete(next.map((x) => x.id));
      }
      await db.focusSessions.where('taskId').equals(id).filter((f) => f.source === 'task').delete();
      return;
    }
    await db.tasks.update(id, { done: true, completedAt: ts(), completedDate: t });
    if (opts.actualMin && opts.actualMin > 0) {
      await db.focusSessions.add({ id: newId(), date: t, startedAt: ts(), minutes: Math.min(720, Math.round(opts.actualMin)), taskId: id, goalId: t0.goalId, categoryId: t0.categoryId, learningId: null, note: '', source: 'task' });
    }
    if (t0.recurrence.type !== 'none') {
      const series = t0.seriesId ?? t0.id;
      const base = t0.plannedDate ?? t0.dueDate ?? t;
      const next = nextOccurrence(base, t0.recurrence, t);
      const shift = (d: DateStr | null) => (d ? addDays(next, daysDiff(base, d)) : null);
      const nid = `${series}:${next}`;
      if (!(await db.tasks.get(nid))) {
        await db.tasks.add({
          ...t0,
          id: nid,
          seriesId: series,
          plannedDate: t0.plannedDate ? next : null,
          dueDate: t0.plannedDate ? shift(t0.dueDate) : t0.dueDate ? next : null,
          done: false,
          completedAt: null,
          completedDate: null,
          postponed: 0,
          mit: false,
          createdAt: ts(),
        });
      }
    }
  });
  return sync();
}

function daysDiff(a: DateStr, b: DateStr) {
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
}

export async function deleteTask(id: string) {
  await db.transaction('rw', db.tasks, db.events, db.focusSessions, async () => {
    await db.events.where('taskId').equals(id).modify({ taskId: null });
    await db.focusSessions.where('taskId').equals(id).modify({ taskId: null });
    await db.tasks.delete(id);
  });
  return sync();
}

export async function setMit(id: string, on: boolean) {
  const task = await db.tasks.get(id);
  if (!task) return;
  if (on) {
    const t = await today();
    const date = task.plannedDate && task.plannedDate >= t ? task.plannedDate : t;
    await assertMitSlot(date, id);
    await db.tasks.update(id, { mit: true, plannedDate: date });
  } else await db.tasks.update(id, { mit: false });
  return sync(true);
}

/** Move a task's planned day (and deadline, if it had passed) later. Counts as a postponement. */
export async function postponeTask(id: string, days = 1) {
  const task = await db.tasks.get(id);
  if (!task || task.done) return;
  const t = await today();
  const from = task.plannedDate && task.plannedDate > t ? task.plannedDate : t;
  // The planned day moves; a deadline is a commitment and stays where it is.
  await db.tasks.update(id, { plannedDate: addDays(from, days), mit: false, postponed: task.postponed + 1 });
  return sync(true);
}

export async function planTaskFor(id: string, date: DateStr | null, time: string | null = null) {
  const task = await db.tasks.get(id);
  if (!task) return;
  const postponed = task.plannedDate && date && date > task.plannedDate ? task.postponed + 1 : task.postponed;
  await db.tasks.update(id, { plannedDate: date, plannedTime: date ? time : null, postponed, mit: date === task.plannedDate ? task.mit : false });
  return sync(true);
}

// ───────────────────────────── Schedule ─────────────────────────────

export type EventDraft = Omit<CalEvent, 'id' | 'createdAt' | 'exceptions'> & { id?: string };

export async function saveEvent(d: EventDraft): Promise<string> {
  const title = clean(d.title, 120);
  if (!title) fail('Give it a title.');
  if (!/^\d{2}:\d{2}$/.test(d.start) || !/^\d{2}:\d{2}$/.test(d.end)) fail('Enter a start and end time.');
  if (toMinutes(d.end) <= toMinutes(d.start)) fail('The end time must be after the start time.');
  const patch = { ...d, title, notes: clean(d.notes, 1000), recurrence: { type: d.recurrence.type, interval: Math.max(1, Math.round(d.recurrence.interval || 1)) } };
  delete (patch as { id?: string }).id;
  if (d.id) {
    await db.events.update(d.id, patch);
    return d.id;
  }
  const id = newId();
  await db.events.add({ ...patch, id, createdAt: ts(), exceptions: [] });
  return id;
}

/** Delete one occurrence of a recurring event, or the whole series. */
export async function deleteEvent(id: string, scope: 'one' | 'all' = 'all', date?: DateStr) {
  const e = await db.events.get(id);
  if (!e) return;
  if (scope === 'one' && e.recurrence.type !== 'none' && date) await db.events.update(id, { exceptions: [...new Set([...e.exceptions, date])] });
  else await db.events.delete(id);
}

// ───────────────────────────── Focus ─────────────────────────────

export async function startTimer(x: { label: string; taskId?: string | null; categoryId?: string | null; learningId?: string | null; plannedMin?: number }) {
  const existing = await db.timer.get('timer');
  if (existing) fail('A focus session is already running.');
  const t = ts();
  await db.timer.put({ id: 'timer', label: clean(x.label, 120) || 'Focus session', taskId: x.taskId ?? null, categoryId: x.categoryId ?? null, learningId: x.learningId ?? null, plannedMin: Math.max(5, Math.min(240, x.plannedMin ?? 25)), accumulated: 0, runningSince: t, startedAt: t });
}

export function timerSeconds(t: ActiveTimer, nowMs = ts()) {
  return t.accumulated + (t.runningSince ? (nowMs - t.runningSince) / 1000 : 0);
}

export async function pauseTimer() {
  const t = await db.timer.get('timer');
  if (!t || !t.runningSince) return;
  await db.timer.put({ ...t, accumulated: timerSeconds(t), runningSince: null });
}

export async function resumeTimer() {
  const t = await db.timer.get('timer');
  if (!t || t.runningSince) return;
  await db.timer.put({ ...t, runningSince: ts() });
}

/** Stops the timer and saves the session (sessions under a minute are discarded). */
export async function stopTimer(save = true): Promise<number> {
  const t = await db.timer.get('timer');
  if (!t) return 0;
  const minutes = Math.floor(timerSeconds(t) / 60);
  await db.transaction('rw', db.timer, db.focusSessions, db.tasks, async () => {
    await db.timer.delete('timer');
    if (save && minutes >= 1) {
      const task = t.taskId ? await db.tasks.get(t.taskId) : undefined;
      await db.focusSessions.add({ id: newId(), date: await today(), startedAt: t.startedAt, minutes: Math.min(720, minutes), taskId: t.taskId, goalId: task?.goalId ?? null, categoryId: t.categoryId ?? task?.categoryId ?? null, learningId: t.learningId, note: '', source: 'timer' });
    }
  });
  await sync();
  return save ? minutes : 0;
}

export async function logFocus(x: Omit<FocusSession, 'id' | 'startedAt' | 'source'>) {
  const t = await today();
  if (x.date > t) fail("You can't log focus time in the future.");
  if (x.date < addDays(t, -30)) fail('Focus time can be logged for the last 30 days.');
  const minutes = Math.round(x.minutes);
  if (!(minutes >= 1 && minutes <= 720)) fail('Enter between 1 and 720 minutes.');
  await db.focusSessions.add({ ...x, minutes, id: newId(), startedAt: ts(), note: clean(x.note, 300), source: 'manual' });
  return sync();
}

export async function deleteFocus(id: string) {
  await db.focusSessions.delete(id);
  return sync();
}

// ───────────────────────────── Personal development ─────────────────────────────

export type LearningDraft = Omit<LearningItem, 'id' | 'createdAt'> & { id?: string };

export async function saveLearning(d: LearningDraft): Promise<string> {
  const title = clean(d.title, 160);
  if (!title) fail('Give it a title.');
  const t = await today();
  const total = d.total === null || !Number.isFinite(d.total) || d.total <= 0 ? null : Math.round(d.total);
  let progress = Math.max(0, Math.round(d.progress || 0));
  if (total !== null) progress = Math.min(progress, total);
  const patch = {
    ...d,
    title,
    creator: clean(d.creator, 120),
    notes: clean(d.notes, 4000),
    unit: clean(d.unit, 20),
    total,
    progress,
    rating: d.rating === null ? null : Math.max(1, Math.min(5, Math.round(d.rating))),
    startedDate: d.startedDate ?? (d.status === 'active' || d.status === 'completed' ? t : null),
    completedDate: d.status === 'completed' ? (d.completedDate ?? t) : null,
  };
  delete (patch as { id?: string }).id;
  if (d.id) {
    await db.learning.update(d.id, patch);
    await sync();
    return d.id;
  }
  const id = newId();
  await db.learning.add({ ...patch, id, createdAt: ts() });
  await sync();
  return id;
}

export async function deleteLearning(id: string) {
  await db.transaction('rw', db.learning, db.focusSessions, async () => {
    await db.focusSessions.where('learningId').equals(id).modify({ learningId: null });
    await db.learning.delete(id);
  });
  return sync();
}

export async function saveJournal(date: DateStr, patch: Partial<Omit<JournalEntry, 'id' | 'date' | 'updatedAt'>>) {
  const t = await today();
  if (date > t) fail("You can't write a journal entry for the future.");
  const prev = (await db.journal.get(date)) ?? { id: date, date, reflection: '', lessons: '', challenges: '', accomplishments: '', improvements: '', mood: null, energy: null, updatedAt: 0 };
  const next: JournalEntry = { ...prev, ...patch, updatedAt: ts() };
  for (const k of ['reflection', 'lessons', 'challenges', 'accomplishments', 'improvements'] as const) next[k] = next[k].slice(0, 10000);
  const empty = !(next.reflection + next.lessons + next.challenges + next.accomplishments + next.improvements).trim() && next.mood === null && next.energy === null;
  if (empty) await db.journal.delete(date);
  else await db.journal.put(next);
  return sync();
}

export async function saveWeeklyReview(ws: DateStr, x: Omit<WeeklyReview, 'id' | 'completedAt'>) {
  const t = await today();
  if (ws > t) fail("That week hasn't started yet.");
  if (addDays(ws, 4) > t) fail('Weekly reviews open from Friday of the week.');
  await db.weeklyReviews.put({ id: ws, wins: clean(x.wins, 4000), challenges: clean(x.challenges, 4000), lessons: clean(x.lessons, 4000), nextFocus: x.nextFocus.map((f) => clean(f, 200)).slice(0, 3), rating: x.rating, completedAt: ts() });
  return sync();
}

// ───────────────────────────── AI conversation storage ─────────────────────────────

export async function addAiMessage(threadId: string, role: 'user' | 'assistant', content: string, error: string | null = null) {
  const id = newId();
  await db.aiMessages.add({ id, threadId, role, content, ts: ts(), error });
  return id;
}

export async function clearAiThread(threadId: string) {
  await db.aiMessages.where('threadId').equals(threadId).delete();
}
