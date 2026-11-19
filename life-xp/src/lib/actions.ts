import { db } from './db';
import { addDays, logicalDate, sleepMinutes } from './dates';
import { ensureBase, habitFromTemplate } from './defaults';
import { TEMPLATE_BY_ID, clampXp } from './habits';
import { logKey } from './performance';
import { reconcile, EDITABLE_DAYS } from './sync';
import { newId } from './id';
import { loadSnapshot } from './snapshot';
import { DAILY_REVISION_XP_CAP, MAX_SESSION_MINUTES, METHOD_BY_ID, REVIEW_XP, revisionXpOn, sessionXp, SUGGESTED_SUBJECTS, SUBJECT_COLORS } from './academy/academy';
import { applyReview, firstSchedule, INTERVALS } from './academy/srs';
import type {
  ActiveTimer,
  AvatarConfig,
  DateStr,
  ExerciseLog,
  Habit,
  NutritionLog,
  Profile,
  ReviewRating,
  RevisionMethod,
  RevisionSession,
  Settings,
  Subject,
  Topic,
  TopicStatus,
  WeekPlan,
} from './types';

// A swappable clock so tests can simulate days, weeks and midnight.
let clock: () => Date = () => new Date();
export function setClock(fn: () => Date) {
  clock = fn;
}
export const now = () => clock();

async function settings(): Promise<Settings> {
  return (await db.settings.get('settings'))!;
}
export async function today(): Promise<DateStr> {
  const s = await db.settings.get('settings');
  return logicalDate(now(), s?.dayStartHour ?? 4);
}

const sync = (dates?: DateStr[], silent = false) => reconcile(db, { now: now(), dates, silent });

async function assertEditable(date: DateStr) {
  const t = await today();
  if (date > t || date < addDays(t, -(EDITABLE_DAYS - 1))) throw new Error('This day can no longer be changed.');
}

// ───────────────────────────── Setup ─────────────────────────────

export async function init() {
  await ensureBase(db, logicalDate(now()));
}

export async function completeOnboarding(x: {
  nickname: string;
  avatar: AvatarConfig;
  templateIds: string[];
  wakeTarget: string;
  bedTarget: string;
  subjects: string[];
}) {
  const t = await today();
  await db.transaction('rw', [db.profile, db.settings, db.habits, db.subjects], async () => {
    await db.profile.update('me', { nickname: x.nickname.trim().slice(0, 20), avatar: x.avatar, onboarded: true, startDate: t, celebratedLevel: 1 });
    await db.settings.update('settings', { wakeTarget: x.wakeTarget, bedTarget: x.bedTarget });
    const existing = await db.habits.count();
    let order = existing;
    for (const id of x.templateIds) {
      const tpl = TEMPLATE_BY_ID[id];
      if (tpl) await db.habits.add(habitFromTemplate(tpl, order++, t));
    }
    let i = await db.subjects.count();
    for (const name of x.subjects) {
      const sug = SUGGESTED_SUBJECTS.find((s) => s.name === name);
      await db.subjects.add({
        id: newId(),
        name,
        color: sug?.color ?? SUBJECT_COLORS[i % SUBJECT_COLORS.length],
        icon: sug?.icon ?? 'BookMarked',
        priority: 2,
        examSoon: false,
        order: i++,
        createdAt: Date.now(),
        archived: false,
      });
    }
  });
  return sync(undefined, true);
}

// ───────────────────────────── Habits ─────────────────────────────

export async function toggleHabit(habitId: string, date: DateStr) {
  await assertEditable(date);
  const h = await db.habits.get(habitId);
  if (!h || h.link !== 'manual') return;
  const id = logKey(habitId, date);
  const log = await db.habitLogs.get(id);
  const target = Math.max(1, h.target);
  if (log && log.count >= target) await db.habitLogs.delete(id);
  else await db.habitLogs.put({ id, habitId, date, count: target, completedAt: now().getTime() });
  return sync([date]);
}

/** Set an amount for a count habit (manual or nutrition-linked). */
export async function setHabitCount(habitId: string, date: DateStr, count: number) {
  await assertEditable(date);
  const h = await db.habits.get(habitId);
  if (!h) return;
  const c = Math.max(0, Math.min(999, Math.round(count)));
  if (h.link === 'water' || h.link === 'meals' || h.link === 'fruitveg') {
    const key = h.link === 'fruitveg' ? 'fruitVeg' : h.link;
    return setNutrition(date, { [key]: c });
  }
  if (h.link !== 'manual') return;
  const id = logKey(habitId, date);
  const prev = await db.habitLogs.get(id);
  if (c === 0) await db.habitLogs.delete(id);
  else {
    const doneNow = c >= Math.max(1, h.target);
    const wasDone = prev ? prev.count >= Math.max(1, h.target) : false;
    await db.habitLogs.put({ id, habitId, date, count: c, completedAt: doneNow ? (wasDone ? prev!.completedAt : now().getTime()) : null });
  }
  return sync([date]);
}

export type HabitDraft = Omit<Habit, 'id' | 'order' | 'createdAt' | 'startDate' | 'archivedAt' | 'active'> & { id?: string };

export async function saveHabit(d: HabitDraft): Promise<string> {
  const draft = { ...d, xp: clampXp(d.xp), target: Math.max(1, Math.min(999, Math.round(d.target))), step: Math.max(1, Math.round(d.step)), name: d.name.trim().slice(0, 40) };
  if (!draft.days.length) throw new Error('Pick at least one day.');
  if (!draft.name) throw new Error('Give your habit a name.');
  if (d.id) {
    await db.habits.update(d.id, draft);
    await sync();
    return d.id;
  }
  const t = await today();
  const id = newId();
  const order = (await db.habits.count()) + 1;
  await db.habits.add({ ...draft, id, order, createdAt: Date.now(), startDate: t, archivedAt: null, active: true });
  await sync();
  return id;
}

export async function adoptTemplate(templateId: string): Promise<string | null> {
  const tpl = TEMPLATE_BY_ID[templateId];
  if (!tpl) return null;
  const existing = (await db.habits.toArray()).find((h) => h.templateId === templateId);
  const t = await today();
  if (existing) {
    // Re-activating a paused habit: it counts again from today, never retroactively.
    await db.habits.update(existing.id, { active: true, archivedAt: null, startDate: existing.archivedAt ? t : existing.startDate });
    await sync();
    return existing.id;
  }
  const h = habitFromTemplate(tpl, (await db.habits.count()) + 1, t);
  await db.habits.add(h);
  await sync();
  return h.id;
}

/** Pause a habit: it stops being scheduled, its history and earned XP stay. */
export async function archiveHabit(id: string) {
  await db.habits.update(id, { active: false, archivedAt: now().getTime() });
  return sync();
}

export async function restoreHabit(id: string) {
  await db.habits.update(id, { active: true, archivedAt: null, startDate: await today() });
  return sync();
}

/** Delete a habit and its history. XP already earned is kept. */
export async function deleteHabit(id: string) {
  await db.transaction('rw', db.habits, db.habitLogs, async () => {
    await db.habitLogs.where('habitId').equals(id).delete();
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

// ───────────────────────────── Health ─────────────────────────────

export async function setNutrition(date: DateStr, patch: Partial<Pick<NutritionLog, 'water' | 'meals' | 'fruitVeg'>>) {
  await assertEditable(date);
  const prev = (await db.nutritionLogs.get(date)) ?? { id: date, date, water: 0, meals: 0, fruitVeg: 0 };
  const next = { ...prev, ...patch };
  next.water = Math.max(0, Math.min(20, next.water));
  next.meals = Math.max(0, Math.min(6, next.meals));
  next.fruitVeg = Math.max(0, Math.min(15, next.fruitVeg));
  await db.nutritionLogs.put(next);
  return sync([date]);
}

export async function addWater(delta = 1) {
  const t = await today();
  const prev = await db.nutritionLogs.get(t);
  return setNutrition(t, { water: (prev?.water ?? 0) + delta });
}

export async function saveSleep(date: DateStr, bedtime: string, wake: string, quality: number | null) {
  const t = await today();
  if (date > t || date < addDays(t, -6)) throw new Error('You can log sleep for the last 7 nights.');
  const minutes = sleepMinutes(bedtime, wake);
  if (minutes > 16 * 60) throw new Error('That looks like more than 16 hours. Check the times.');
  await db.sleepLogs.put({ id: date, date, bedtime, wake, minutes, quality });
  return sync([date]);
}

export async function deleteSleep(date: DateStr) {
  await db.sleepLogs.delete(date);
  return sync([date]);
}

export async function addExercise(x: Omit<ExerciseLog, 'id' | 'createdAt'>) {
  const t = await today();
  if (x.date > t || x.date < addDays(t, -6)) throw new Error('You can log activity for the last 7 days.');
  const minutes = Math.max(1, Math.min(240, Math.round(x.minutes)));
  await db.exerciseLogs.add({ ...x, minutes, id: newId(), createdAt: Date.now() });
  return sync([x.date]);
}

export async function deleteExercise(id: string) {
  const e = await db.exerciseLogs.get(id);
  await db.exerciseLogs.delete(id);
  return sync(e ? [e.date] : undefined);
}

// ───────────────────────────── Profile & settings ─────────────────────────────

export async function updateProfile(patch: Partial<Omit<Profile, 'id'>>) {
  await db.profile.update('me', patch);
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>) {
  await db.settings.update('settings', patch);
  return sync(undefined, true);
}

export async function dismissCoach(key: string) {
  const s = await settings();
  await db.settings.update('settings', { coachDismissed: [...s.coachDismissed.slice(-50), key] });
}

// ───────────────────────────── Academy: subjects & topics ─────────────────────────────

export async function addSubject(name: string, color?: string, icon?: string): Promise<string> {
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new Error('Name the subject.');
  const n = await db.subjects.count();
  const sug = SUGGESTED_SUBJECTS.find((s) => s.name.toLowerCase() === clean.toLowerCase());
  const id = newId();
  await db.subjects.add({
    id,
    name: clean,
    color: color ?? sug?.color ?? SUBJECT_COLORS[n % SUBJECT_COLORS.length],
    icon: icon ?? sug?.icon ?? 'BookMarked',
    priority: 2,
    examSoon: false,
    order: n,
    createdAt: Date.now(),
    archived: false,
  });
  return id;
}

export async function updateSubject(id: string, patch: Partial<Omit<Subject, 'id'>>) {
  await db.subjects.update(id, patch);
  return sync(undefined, true);
}

/** Removes a subject with its topics, sessions and reviews. XP already earned is kept. */
export async function deleteSubject(id: string) {
  await db.transaction('rw', [db.subjects, db.topics, db.revisionSessions, db.topicReviews], async () => {
    await db.topics.where('subjectId').equals(id).delete();
    await db.revisionSessions.where('subjectId').equals(id).delete();
    await db.topicReviews.filter((r) => r.subjectId === id).delete();
    await db.subjects.delete(id);
  });
  return sync(undefined, true);
}

export async function addTopic(subjectId: string, name: string): Promise<string> {
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new Error('Name the topic.');
  const n = await db.topics.where('subjectId').equals(subjectId).count();
  const id = newId();
  await db.topics.add({
    id,
    subjectId,
    name: clean,
    status: 0,
    confidence: null,
    confidenceHistory: [],
    firstStudied: null,
    lastRevised: null,
    nextReview: null,
    reviewStage: 0,
    needsRevisit: false,
    difficultCount: 0,
    practice: [],
    createdAt: Date.now(),
    order: n,
  });
  return id;
}

export async function updateTopic(id: string, patch: Partial<Omit<Topic, 'id'>>) {
  const t = await db.topics.get(id);
  if (!t) return;
  const next: Partial<Topic> = { ...patch };
  if (patch.confidence !== undefined && patch.confidence !== null && patch.confidence !== t.confidence) {
    next.confidenceHistory = [...t.confidenceHistory, { date: await today(), value: patch.confidence }];
  }
  await db.topics.update(id, next);
  return sync(undefined, true);
}

export async function setTopicStatus(id: string, status: TopicStatus) {
  return updateTopic(id, { status });
}

export async function deleteTopic(id: string) {
  await db.transaction('rw', [db.topics, db.topicReviews], async () => {
    await db.topicReviews.where('topicId').equals(id).delete();
    await db.topics.delete(id);
  });
  await db.revisionSessions.where('topicId').equals(id).modify({ topicId: null });
  return sync(undefined, true);
}

// ───────────────────────────── Academy: focus timer ─────────────────────────────

export function timerSeconds(t: ActiveTimer, at: number = now().getTime()): number {
  const running = t.runningSince !== null ? Math.max(0, (at - t.runningSince) / 1000) : 0;
  return Math.min(t.plannedMinutes * 60, t.accumulated + running);
}

export async function startTimer(x: { subjectId: string; topicId: string | null; method: RevisionMethod; plannedMinutes: number; planItemId?: string | null }) {
  const existing = await db.timer.get('timer');
  if (existing) throw new Error('A session is already running.');
  const planned = Math.max(1, Math.min(MAX_SESSION_MINUTES, Math.round(x.plannedMinutes)));
  const t = now().getTime();
  await db.timer.put({ id: 'timer', subjectId: x.subjectId, topicId: x.topicId, method: x.method, plannedMinutes: planned, startedAt: t, accumulated: 0, runningSince: t, planItemId: x.planItemId ?? null });
}

export async function pauseTimer() {
  const t = await db.timer.get('timer');
  if (!t || t.runningSince === null) return;
  await db.timer.put({ ...t, accumulated: timerSeconds(t), runningSince: null });
}

export async function resumeTimer() {
  const t = await db.timer.get('timer');
  if (!t || t.runningSince !== null) return;
  if (t.accumulated >= t.plannedMinutes * 60) return;
  await db.timer.put({ ...t, runningSince: now().getTime() });
}

export async function cancelTimer() {
  await db.timer.delete('timer');
}

export interface SessionReflection {
  studied: string;
  difficult: string;
  confidence: number | null;
  revisit: boolean;
  practiceCorrect: number | null;
  practiceTotal: number | null;
}

/** Ends the running session, records it with its reflection, updates the topic and awards XP once. */
export async function finishSession(r: SessionReflection): Promise<RevisionSession | null> {
  const t = await db.timer.get('timer');
  if (!t) return null;
  const endedAt = now().getTime();
  const focusedSeconds = Math.floor(timerSeconds(t, endedAt));
  const date = await today();
  const snap = await loadSnapshot(db, now());
  const already = snap ? revisionXpOn(snap, date) : 0;
  const xp = sessionXp(focusedSeconds, t.plannedMinutes, t.method, already);
  const isPractice = METHOD_BY_ID[t.method].practice;
  const pc = isPractice && r.practiceTotal ? Math.max(0, Math.min(r.practiceCorrect ?? 0, r.practiceTotal)) : null;
  const session: RevisionSession = {
    id: newId(),
    date,
    startedAt: t.startedAt,
    endedAt,
    subjectId: t.subjectId,
    topicId: t.topicId,
    method: t.method,
    plannedMinutes: t.plannedMinutes,
    focusedSeconds,
    studied: r.studied.trim().slice(0, 500),
    difficult: r.difficult.trim().slice(0, 500),
    confidence: r.confidence,
    revisit: r.revisit,
    practiceCorrect: pc,
    practiceTotal: isPractice && r.practiceTotal ? Math.max(1, Math.min(200, r.practiceTotal)) : null,
    xp,
  };
  await db.transaction('rw', [db.timer, db.revisionSessions, db.topics, db.xpEvents, db.weekPlans], async () => {
    await db.timer.delete('timer');
    await db.revisionSessions.add(session);
    if (xp > 0) {
      const method = METHOD_BY_ID[t.method].label.toLowerCase();
      await db.xpEvents.put({ id: `rev:${session.id}`, date, ts: endedAt, amount: xp, source: 'revision', kind: 'academic', label: `Focus session: ${method}` });
    }
    if (t.topicId) {
      const topic = await db.topics.get(t.topicId);
      if (topic) {
        const patch: Partial<Topic> = { lastRevised: date, needsRevisit: r.revisit };
        if (!topic.firstStudied) patch.firstStudied = date;
        if (topic.status === 0) patch.status = 1; // starting a topic moves it to "Learning" — never further automatically
        if (topic.nextReview === null) Object.assign(patch, firstSchedule(date));
        if (r.confidence !== null) {
          patch.confidence = r.confidence;
          patch.confidenceHistory = [...topic.confidenceHistory, { date, value: r.confidence }];
        }
        if (r.difficult.trim()) patch.difficultCount = topic.difficultCount + 1;
        if (pc !== null && session.practiceTotal) patch.practice = [...topic.practice, { date, correct: pc, total: session.practiceTotal, sessionId: session.id }];
        await db.topics.update(topic.id, patch);
      }
    }
    if (t.planItemId) {
      const plans = await db.weekPlans.toArray();
      for (const p of plans) {
        if (p.items.some((i) => i.id === t.planItemId)) {
          await db.weekPlans.put({ ...p, items: p.items.map((i) => (i.id === t.planItemId ? { ...i, done: true } : i)) });
        }
      }
    }
  });
  await sync([date]);
  return session;
}

// ───────────────────────────── Academy: spaced repetition ─────────────────────────────

export async function rateReview(topicId: string, rating: ReviewRating) {
  const topic = await db.topics.get(topicId);
  if (!topic) return null;
  const date = await today();
  const wasDue = topic.nextReview !== null && topic.nextReview <= date;
  const reviewedToday = (await db.topicReviews.where('topicId').equals(topicId).toArray()).some((r) => r.date === date);
  const out = applyReview(topic.reviewStage, rating, date);
  const gap = INTERVALS[Math.min(topic.reviewStage, INTERVALS.length - 1)];
  const xp = wasDue && !reviewedToday ? REVIEW_XP : 0;
  const id = newId();
  await db.transaction('rw', [db.topics, db.topicReviews, db.xpEvents], async () => {
    await db.topicReviews.add({ id, topicId, subjectId: topic.subjectId, date, dueDate: topic.nextReview ?? date, rating, intervalDays: gap, xp });
    await db.topics.update(topicId, {
      reviewStage: out.reviewStage,
      nextReview: out.nextReview,
      lastRevised: date,
      firstStudied: topic.firstStudied ?? date,
      needsRevisit: rating === 'hard',
      difficultCount: topic.difficultCount + (rating === 'hard' ? 1 : 0),
    });
    if (xp > 0) await db.xpEvents.put({ id: `srs:${id}`, date, ts: Date.now(), amount: xp, source: 'review', kind: 'academic', label: `Review: ${topic.name}` });
  });
  await sync([date]);
  return out;
}

/** Puts a not-yet-studied topic into the review cycle (e.g. you learnt it in class today). */
export async function markStudiedInClass(topicId: string) {
  const topic = await db.topics.get(topicId);
  if (!topic) return;
  const date = await today();
  await db.topics.update(topicId, {
    firstStudied: topic.firstStudied ?? date,
    lastRevised: date,
    status: topic.status === 0 ? 1 : topic.status,
    ...(topic.nextReview === null ? firstSchedule(date) : {}),
  });
  return sync(undefined, true);
}

// ───────────────────────────── Academy: planner ─────────────────────────────

export async function savePlan(plan: WeekPlan) {
  await db.weekPlans.put(plan);
}

export async function togglePlanItem(weekId: DateStr, itemId: string) {
  const p = await db.weekPlans.get(weekId);
  if (!p) return;
  await db.weekPlans.put({ ...p, items: p.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) });
}

export async function removePlanItem(weekId: DateStr, itemId: string) {
  const p = await db.weekPlans.get(weekId);
  if (!p) return;
  await db.weekPlans.put({ ...p, edited: true, items: p.items.filter((i) => i.id !== itemId) });
}

export { DAILY_REVISION_XP_CAP };
