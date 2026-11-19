import { addDays, dateRange, dayOfWeek, weekStart } from './dates';
import { calendarWeekConsistency, consistency, dayStatus, habitProgress, scheduledHabits } from './performance';
import type { Snapshot } from './snapshot';
import type { DateStr, Habit, QuestDifficulty, QuestRecord } from './types';
import { countsAsSession, effectiveRevisionTarget, MIN_XP_MINUTES, sessionsInWeek } from './academy/academy';
import { dueTopics } from './academy/srs';
import { hasFeature, levelFromXp } from './levels';
import { totalXp } from './performance';

export const DAILY_COMBO_XP = 20;
export const WEEKLY_COMBO_XP = 50;
export const DAILY_QUEST_COUNT = 3;
export const WEEKLY_QUEST_COUNT = 3;

interface QuestDef {
  id: string;
  period: 'day' | 'week';
  title: string;
  description: string | ((s: Snapshot, key: DateStr) => string);
  difficulty: QuestDifficulty;
  xp: number;
  /** Is this quest sensible for this day/week? (weekends, school days, which habits exist…) */
  eligible: (s: Snapshot, key: DateStr) => boolean;
  target: (s: Snapshot, key: DateStr) => number;
  progress: (s: Snapshot, key: DateStr) => number;
  personal?: boolean;
}

const byTemplate = (s: Snapshot, key: DateStr, ...ids: string[]): Habit[] => scheduledHabits(s, key).filter((h) => h.templateId && ids.includes(h.templateId));
const catHabits = (s: Snapshot, key: DateStr, cat: Habit['category']) => scheduledHabits(s, key).filter((h) => h.category === cat);
const doneCount = (s: Snapshot, key: DateStr, hs: Habit[]) => hs.filter((h) => habitProgress(s, h, key).done).length;
const isWeekend = (d: DateStr) => [0, 6].includes(dayOfWeek(d));
const activeHabit = (s: Snapshot, tpl: string) => s.habits.find((h) => h.active && h.templateId === tpl);
const weekRange = (s: Snapshot, ws: DateStr) => {
  const end = addDays(ws, 6);
  return dateRange(ws, end < s.today ? end : s.today);
};
const readingMinutes = (s: Snapshot, d: DateStr) => {
  const h = activeHabit(s, 'read');
  return h ? habitProgress(s, h, d).count : 0;
};

export const DAILY_QUESTS: QuestDef[] = [
  {
    id: 'morning-routine', period: 'day', title: 'Morning launch', description: 'Complete every habit in your morning routine.', difficulty: 'easy', xp: 15,
    eligible: (s, k) => catHabits(s, k, 'morning').length >= 2,
    target: (s, k) => catHabits(s, k, 'morning').length,
    progress: (s, k) => doneCount(s, k, catHabits(s, k, 'morning')),
  },
  {
    id: 'evening-routine', period: 'day', title: 'Power down', description: 'Complete every habit in your evening routine.', difficulty: 'easy', xp: 15,
    eligible: (s, k) => catHabits(s, k, 'evening').length >= 2,
    target: (s, k) => catHabits(s, k, 'evening').length,
    progress: (s, k) => doneCount(s, k, catHabits(s, k, 'evening')),
  },
  {
    id: 'prepare', period: 'day', title: 'Ready for tomorrow', description: 'Pack your bag or plan tomorrow before bed.', difficulty: 'easy', xp: 10,
    eligible: (s, k) => byTemplate(s, k, 'bag', 'plan').length > 0,
    target: () => 1,
    progress: (s, k) => Math.min(1, doneCount(s, k, byTemplate(s, k, 'bag', 'plan'))),
  },
  {
    id: 'hydrate', period: 'day', title: 'Hydration check', description: 'Hit your water target today.', difficulty: 'easy', xp: 10,
    eligible: (s, k) => byTemplate(s, k, 'water').length > 0,
    target: (s, k) => byTemplate(s, k, 'water')[0]?.target ?? 6,
    progress: (s, k) => s.nutrition.get(k)?.water ?? 0,
  },
  {
    id: 'log-sleep', period: 'day', title: 'Sleep scout', description: 'Log how you slept last night.', difficulty: 'easy', xp: 5,
    eligible: (s) => s.settings.healthEnabled,
    target: () => 1,
    progress: (s, k) => (s.sleepLogs.has(k) ? 1 : 0),
  },
  {
    id: 'homework', period: 'day', title: 'Homework hero', description: 'Get your homework done today.', difficulty: 'medium', xp: 15,
    eligible: (s, k) => byTemplate(s, k, 'homework').length > 0 && s.settings.workload !== 'holiday',
    target: () => 1,
    progress: (s, k) => Math.min(1, doneCount(s, k, byTemplate(s, k, 'homework'))),
  },
  {
    id: 'read-20', period: 'day', title: 'Page turner', description: 'Read for 20 minutes.', difficulty: 'medium', xp: 15,
    eligible: (s) => !!activeHabit(s, 'read'),
    target: () => 20,
    progress: (s, k) => readingMinutes(s, k),
  },
  {
    id: 'move-20', period: 'day', title: 'Get moving', description: 'Do 20 minutes of physical activity (PE counts!).', difficulty: 'medium', xp: 15,
    eligible: (_s, k) => !isWeekend(k),
    target: () => 20,
    progress: (s, k) => s.exerciseMinutes.get(k) ?? 0,
  },
  {
    id: 'move-30', period: 'day', title: 'Weekend explorer', description: 'Get outside and active for 30 minutes: walk, bike, sport.', difficulty: 'medium', xp: 20,
    eligible: (_s, k) => isWeekend(k),
    target: () => 30,
    progress: (s, k) => s.exerciseMinutes.get(k) ?? 0,
  },
  {
    id: 'focus', period: 'day', title: 'Focus mode', description: `Finish one Academy focus session (${MIN_XP_MINUTES}+ min).`, difficulty: 'medium', xp: 15,
    eligible: (s) => s.subjects.some((x) => !x.archived) && s.settings.workload !== 'rest',
    target: () => 1,
    progress: (s, k) => Math.min(1, s.revisionSessions.filter((r) => r.date === k && countsAsSession(r)).length),
  },
  {
    id: 'reviews', period: 'day', title: 'Memory check', description: 'Clear every spaced-repetition review due today.', difficulty: 'medium', xp: 20,
    eligible: (s, k) => k === s.today && dueTopics(s, k).length + s.topicReviews.filter((r) => r.date === k).length > 0,
    target: (s, k) => Math.max(1, s.topicReviews.filter((r) => r.date === k).length + dueTopics(s, k).length),
    progress: (s, k) => s.topicReviews.filter((r) => r.date === k).length,
  },
  {
    id: 'early-three', period: 'day', title: 'Early riser', description: 'Tick off 3 habits before 9:00.', difficulty: 'hard', xp: 20,
    eligible: (s, k) => scheduledHabits(s, k).filter((h) => h.link === 'manual').length >= 4,
    target: () => 3,
    progress: (s, k) =>
      scheduledHabits(s, k).filter((h) => {
        const p = habitProgress(s, h, k);
        return p.done && p.completedAt !== null && new Date(p.completedAt).getHours() < 9;
      }).length,
  },
  {
    id: 'eighty', period: 'day', title: 'Strong day', description: "Complete 80% of today's habits.", difficulty: 'hard', xp: 20,
    eligible: (s, k) => scheduledHabits(s, k).length >= 4,
    target: () => 80,
    progress: (s, k) => Math.round((dayStatus(s, k).pct ?? 0) * 100),
  },
  {
    id: 'beat-average', period: 'day', title: 'Beat your average', personal: true,
    description: (s, k) => `Complete more habits than your 14-day average (${avgDone(s, k).toFixed(1)}).`,
    difficulty: 'hard', xp: 25,
    eligible: (s, k) => avgDone(s, k) >= 2 && avgDone(s, k) < scheduledHabits(s, k).length,
    target: (s, k) => Math.floor(avgDone(s, k)) + 1,
    progress: (s, k) => dayStatus(s, k).done.length,
  },
];

function avgDone(s: Snapshot, k: DateStr): number {
  const from = addDays(k, -14);
  const to = addDays(k, -1);
  const c = consistency(s, from, to);
  return c.days ? c.done / c.days : 0;
}

export const WEEKLY_QUESTS: QuestDef[] = [
  {
    id: 'exercise-3', period: 'week', title: 'Active week', description: 'Be active (15+ min) on 3 different days.', difficulty: 'medium', xp: 50,
    eligible: () => true,
    target: () => 3,
    progress: (s, ws) => weekRange(s, ws).filter((d) => (s.exerciseMinutes.get(d) ?? 0) >= 15).length,
  },
  {
    id: 'read-100', period: 'week', title: 'Bookworm week', description: 'Read for 100 minutes this week.', difficulty: 'medium', xp: 50,
    eligible: (s) => !!activeHabit(s, 'read'),
    target: () => 100,
    progress: (s, ws) => weekRange(s, ws).reduce((a, d) => a + readingMinutes(s, d), 0),
  },
  {
    id: 'homework-all', period: 'week', title: 'On it', description: 'Complete homework on every scheduled day this week.', difficulty: 'hard', xp: 60,
    eligible: (s) => !!activeHabit(s, 'homework') && s.settings.workload !== 'holiday',
    target: (s, ws) => Math.max(1, dateRange(ws, addDays(ws, 6)).filter((d) => byTemplate(s, d, 'homework').length > 0).length),
    progress: (s, ws) => weekRange(s, ws).filter((d) => doneCount(s, d, byTemplate(s, d, 'homework')) > 0).length,
  },
  {
    id: 'sleep-routine', period: 'week', title: 'Sleep routine', description: 'Log 5 nights of 8+ hours sleep.', difficulty: 'medium', xp: 50,
    eligible: (s) => s.settings.healthEnabled,
    target: () => 5,
    progress: (s, ws) => weekRange(s, ws).filter((d) => (s.sleepLogs.get(d)?.minutes ?? 0) >= 480).length,
  },
  {
    id: 'consistency-80', period: 'week', title: 'Consistency king', description: 'Reach 80% habit completion this week.', difficulty: 'hard', xp: 75,
    eligible: () => true,
    target: () => 80,
    progress: (s, ws) => Math.round((calendarWeekConsistency(s, ws).pct ?? 0) * 100),
  },
  {
    id: 'revision-target', period: 'week', title: 'Study target',
    description: (s) => `Complete ${effectiveRevisionTarget(s).perWeek} revision sessions this week.`,
    difficulty: 'medium', xp: 50,
    eligible: (s) => s.subjects.some((x) => !x.archived) && effectiveRevisionTarget(s).perWeek > 0,
    target: (s) => effectiveRevisionTarget(s).perWeek,
    progress: (s, ws) => sessionsInWeek(s, ws).length,
  },
  {
    id: 'reviews-5', period: 'week', title: 'Memory builder', description: 'Complete 5 spaced-repetition reviews.', difficulty: 'hard', xp: 50,
    eligible: (s) => s.topics.some((t) => t.nextReview !== null),
    target: () => 5,
    progress: (s, ws) => s.topicReviews.filter((r) => r.date >= ws && r.date <= addDays(ws, 6)).length,
  },
  {
    id: 'daily-10', period: 'week', title: 'Quest hunter', description: 'Complete 10 daily quests this week.', difficulty: 'medium', xp: 40,
    eligible: () => true,
    target: () => 10,
    progress: (s, ws) => s.quests.filter((q) => q.period === 'day' && q.periodKey >= ws && q.periodKey <= addDays(ws, 6) && q.completedAt !== null).length,
  },
  {
    id: 'beat-last-week', period: 'week', title: 'Level up your week', personal: true,
    description: (s, ws) => `Beat last week's ${Math.round((calendarWeekConsistency(s, addDays(ws, -7)).pct ?? 0) * 100)}% completion.`,
    difficulty: 'hard', xp: 60,
    eligible: (s, ws) => {
      const p = calendarWeekConsistency(s, addDays(ws, -7)).pct;
      return p !== null && p >= 0.4 && p < 0.95;
    },
    target: (s, ws) => Math.round((calendarWeekConsistency(s, addDays(ws, -7)).pct ?? 0) * 100) + 1,
    progress: (s, ws) => Math.round((calendarWeekConsistency(s, ws).pct ?? 0) * 100),
  },
];

export const QUEST_BY_ID = Object.fromEntries([...DAILY_QUESTS, ...WEEKLY_QUESTS].map((q) => [q.id, q])) as Record<string, QuestDef>;

/** Small deterministic PRNG so the same day always picks the same quests. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function pick(defs: QuestDef[], n: number, seed: string): QuestDef[] {
  const rnd = seeded(seed);
  const shuffled = defs.map((d) => ({ d, r: rnd() })).sort((a, b) => a.r - b.r).map((x) => x.d);
  const out: QuestDef[] = [];
  // Prefer a mix: one easy, one medium, one hard, then fill.
  for (const diff of ['easy', 'medium', 'hard'] as const) {
    const q = shuffled.find((d) => d.difficulty === diff && !out.includes(d));
    if (q && out.length < n) out.push(q);
  }
  for (const d of shuffled) if (out.length < n && !out.includes(d)) out.push(d);
  return out;
}

function toRecord(s: Snapshot, d: QuestDef, key: DateStr, order: number): QuestRecord {
  const target = Math.max(1, d.target(s, key));
  const progress = Math.max(0, d.progress(s, key));
  return {
    id: `${d.period === 'day' ? 'd' : 'w'}:${key}:${d.id}`,
    period: d.period,
    periodKey: key,
    questId: d.id,
    title: d.title,
    description: typeof d.description === 'function' ? d.description(s, key) : d.description,
    difficulty: d.difficulty,
    xp: d.xp,
    target,
    progress,
    completedAt: null,
    order,
  };
}

export function generateDailyQuests(s: Snapshot, date: DateStr): QuestRecord[] {
  const level = levelFromXp(totalXp(s)).level;
  const personal = hasFeature(level, 'personal-quests');
  const eligible = DAILY_QUESTS.filter((q) => (personal || !q.personal) && q.eligible(s, date));
  return pick(eligible, DAILY_QUEST_COUNT, `day:${date}`).map((d, i) => toRecord(s, d, date, i));
}

export function generateWeeklyQuests(s: Snapshot, ws: DateStr): QuestRecord[] {
  const level = levelFromXp(totalXp(s)).level;
  if (!hasFeature(level, 'weekly-quests')) return [];
  const personal = hasFeature(level, 'personal-quests');
  const eligible = WEEKLY_QUESTS.filter((q) => (personal || !q.personal) && q.eligible(s, ws));
  return pick(eligible, WEEKLY_QUEST_COUNT, `week:${ws}`).map((d, i) => toRecord(s, d, ws, i));
}

/** Re-evaluate a stored quest's live progress. */
export function evaluateQuest(s: Snapshot, q: QuestRecord): { progress: number; target: number; done: boolean } {
  const def = QUEST_BY_ID[q.questId];
  if (!def) return { progress: q.progress, target: q.target, done: q.completedAt !== null };
  const target = Math.max(1, def.target(s, q.periodKey));
  const progress = Math.max(0, def.progress(s, q.periodKey));
  return { progress, target, done: progress >= target };
}

export function questsFor(s: Snapshot, period: 'day' | 'week', key: DateStr): QuestRecord[] {
  return s.quests.filter((q) => q.period === period && q.periodKey === key).sort((a, b) => a.order - b.order);
}

export const currentWeek = (s: Snapshot) => weekStart(s.today);
