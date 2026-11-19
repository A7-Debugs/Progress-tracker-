import { dateRange, weekStart } from './dates';
import { calendarWeekConsistency, dayStatus, habitProgress, pastWeekStarts, streakInfo, totalXp } from './performance';
import type { Snapshot } from './snapshot';
import { countsAsSession, effectiveRevisionTarget, sessionsInWeek } from './academy/academy';
import { levelFromXp } from './levels';
import type { DateStr } from './types';

export interface Stats {
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  readingMinutes: number;
  exerciseSessions: number;
  wakeHits: number;
  bestWeekPct: number;
  level: number;
  dailyQuests: number;
  weeklyQuests: number;
  fullQuestWeeks: number;
  waterDays: number;
  sleepGoodNights: number;
  perfectDays: number;
  revisionSessions: number;
  maxSessionsInWeek: number;
  mathsTopics: number;
  reviews: number;
  activeRecall: number;
  examSessions: number;
  practiceSessions: number;
  targetWeeksRun: number;
  topicsStudied: number;
  confidenceGains: number;
  subjectsStudied: number;
}

export function computeStats(s: Snapshot): Stats {
  const dates = s.profile.startDate <= s.today ? dateRange(s.profile.startDate, s.today) : [];
  let activeDays = 0;
  let perfectDays = 0;
  let readingMinutes = 0;
  let wakeHits = 0;
  let waterDays = 0;
  for (const d of dates) {
    const st = dayStatus(s, d);
    if (st.active) activeDays++;
    if (st.pct === 1 && st.scheduled.length >= 3) perfectDays++;
    for (const h of s.habits) {
      if (d < h.startDate) continue;
      if (h.templateId === 'read') readingMinutes += habitProgress(s, h, d).count;
      if (h.templateId === 'wake' && habitProgress(s, h, d).done) wakeHits++;
      if (h.templateId === 'water' && habitProgress(s, h, d).done) waterDays++;
    }
  }
  // Also count logged sleep that met the wake target as an "on time" wake (when no wake habit tick that day).
  const wakeHabit = s.habits.find((h) => h.templateId === 'wake');
  for (const sl of s.sleepLogs.values()) {
    const ticked = wakeHabit ? habitProgress(s, wakeHabit, sl.date).done : false;
    if (!ticked && sl.wake <= s.settings.wakeTarget) wakeHits++;
  }
  const streak = streakInfo(s);
  const weeks = pastWeekStarts(s, 520);
  let bestWeekPct = 0;
  for (const w of weeks) {
    const c = calendarWeekConsistency(s, w);
    if (c.scheduled >= 10 && c.pct !== null) bestWeekPct = Math.max(bestWeekPct, c.pct);
  }
  const doneQuests = s.quests.filter((q) => q.completedAt !== null);
  const weeklyByKey = new Map<string, { n: number; done: number }>();
  for (const q of s.quests.filter((q) => q.period === 'week')) {
    const e = weeklyByKey.get(q.periodKey) ?? { n: 0, done: 0 };
    e.n++;
    if (q.completedAt !== null) e.done++;
    weeklyByKey.set(q.periodKey, e);
  }
  const sessions = s.revisionSessions.filter(countsAsSession);
  const weeksWithSessions = new Map<string, number>();
  for (const r of sessions) {
    const k = weekOf(r.date);
    weeksWithSessions.set(k, (weeksWithSessions.get(k) ?? 0) + 1);
  }
  // Consecutive completed weeks meeting the (then) revision target — newest first.
  let targetWeeksRun = 0;
  const target = effectiveRevisionTarget(s).perWeek;
  const thisWeek = weekOf(s.today);
  if (target > 0 && sessionsInWeek(s, thisWeek).length >= target) targetWeeksRun++;
  for (const w of weeks) {
    if (target > 0 && sessionsInWeek(s, w).length >= target) targetWeeksRun++;
    else break;
  }
  const maths = s.subjects.filter((x) => /math/i.test(x.name)).map((x) => x.id);
  const exerciseSessions = s.exerciseLogs.filter((e) => e.minutes >= 10).length;
  return {
    activeDays,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    readingMinutes,
    exerciseSessions,
    wakeHits,
    bestWeekPct,
    level: levelFromXp(totalXp(s)).level,
    dailyQuests: doneQuests.filter((q) => q.period === 'day').length,
    weeklyQuests: doneQuests.filter((q) => q.period === 'week').length,
    fullQuestWeeks: [...weeklyByKey.values()].filter((e) => e.n > 0 && e.n === e.done).length,
    waterDays,
    sleepGoodNights: [...s.sleepLogs.values()].filter((x) => x.minutes >= 480 && x.minutes <= 660).length,
    perfectDays,
    revisionSessions: sessions.length,
    maxSessionsInWeek: Math.max(0, ...weeksWithSessions.values()),
    mathsTopics: s.topics.filter((t) => maths.includes(t.subjectId) && t.status >= 3).length,
    reviews: s.topicReviews.length,
    activeRecall: sessions.filter((r) => r.method === 'active-recall').length,
    examSessions: sessions.filter((r) => r.method === 'exam').length,
    practiceSessions: sessions.filter((r) => r.method === 'practice' || r.method === 'exam').length,
    targetWeeksRun,
    topicsStudied: s.topics.filter((t) => t.firstStudied !== null).length,
    confidenceGains: s.topics.filter((t) => t.confidenceHistory.length >= 2 && t.confidenceHistory.at(-1)!.value - t.confidenceHistory[0].value >= 2).length,
    subjectsStudied: new Set(sessions.map((r) => r.subjectId)).size,
  };
}

const weekOf = (d: DateStr) => weekStart(d);

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'epic';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  group: 'life' | 'academy';
  tier: BadgeTier;
  xp: number;
  /** Unlockable title earned with this badge. */
  title?: string;
  target: number;
  value: (st: Stats) => number;
  /** Shown instead of progress numbers (e.g. percentages). */
  format?: (v: number) => string;
}

const pctFmt = (v: number) => `${Math.round(v)}%`;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-steps', name: 'First Steps', description: 'Complete your first day (half your habits or more).', icon: 'Footprints', group: 'life', tier: 'bronze', xp: 25, target: 1, value: (s) => s.activeDays },
  { id: 'consistency', name: 'Consistency', description: 'Complete your habits on 7 days.', icon: 'CalendarCheck', group: 'life', tier: 'silver', xp: 50, title: 'The Consistent', target: 7, value: (s) => s.activeDays },
  { id: 'on-fire', name: 'On Fire', description: 'Reach a 7-day streak.', icon: 'Flame', group: 'life', tier: 'silver', xp: 50, target: 7, value: (s) => s.longestStreak },
  { id: 'bookworm', name: 'Bookworm', description: 'Read for 100 minutes in total.', icon: 'BookOpen', group: 'life', tier: 'silver', xp: 50, title: 'Bookworm', target: 100, value: (s) => s.readingMinutes },
  { id: 'athlete', name: 'Athlete', description: 'Log 10 exercise sessions.', icon: 'Dumbbell', group: 'life', tier: 'silver', xp: 50, title: 'Athlete', target: 10, value: (s) => s.exerciseSessions },
  { id: 'early-bird', name: 'Early Bird', description: 'Meet your wake-up target 7 times.', icon: 'Sunrise', group: 'life', tier: 'silver', xp: 50, title: 'Early Bird', target: 7, value: (s) => s.wakeHits },
  { id: 'hydrated', name: 'Hydrated', description: 'Hit your water target on 10 days.', icon: 'GlassWater', group: 'life', tier: 'bronze', xp: 30, target: 10, value: (s) => s.waterDays },
  { id: 'well-rested', name: 'Well Rested', description: 'Log 7 nights of 8–11 hours sleep.', icon: 'MoonStar', group: 'life', tier: 'silver', xp: 50, title: 'Dreamer', target: 7, value: (s) => s.sleepGoodNights },
  { id: 'perfect-5', name: 'Full House', description: 'Complete every habit on 5 different days.', icon: 'Gem', group: 'life', tier: 'silver', xp: 50, target: 5, value: (s) => s.perfectDays },
  { id: 'quest-10', name: 'Quest Hunter', description: 'Complete 10 daily quests.', icon: 'Swords', group: 'life', tier: 'bronze', xp: 30, title: 'Quest Hunter', target: 10, value: (s) => s.dailyQuests },
  { id: 'quest-50', name: 'Quest Master', description: 'Complete 50 daily quests.', icon: 'Swords', group: 'life', tier: 'gold', xp: 100, title: 'Quest Master', target: 50, value: (s) => s.dailyQuests },
  { id: 'week-warrior', name: 'Week Warrior', description: 'Complete every weekly quest in one week.', icon: 'Shield', group: 'life', tier: 'gold', xp: 75, title: 'Week Warrior', target: 1, value: (s) => s.fullQuestWeeks },
  { id: 'disciplined', name: 'Disciplined', description: 'Achieve 90% consistency in a full week.', icon: 'Target', group: 'life', tier: 'gold', xp: 100, title: 'The Disciplined', target: 90, value: (s) => s.bestWeekPct * 100, format: pctFmt },
  { id: 'unstoppable', name: 'Unstoppable', description: 'Reach a 30-day streak.', icon: 'Zap', group: 'life', tier: 'epic', xp: 200, title: 'Unstoppable', target: 30, value: (s) => s.longestStreak },
  { id: 'level-5', name: 'Rising', description: 'Reach level 5.', icon: 'TrendingUp', group: 'life', tier: 'bronze', xp: 0, target: 5, value: (s) => s.level },
  { id: 'level-10', name: 'Double Digits', description: 'Reach level 10.', icon: 'Crown', group: 'life', tier: 'gold', xp: 0, title: 'Double Digits', target: 10, value: (s) => s.level },
  { id: 'century', name: 'Century', description: 'Be active on 100 days.', icon: 'Medal', group: 'life', tier: 'epic', xp: 250, title: 'Centurion', target: 100, value: (s) => s.activeDays },
  // Academy
  { id: 'first-session', name: 'First Session', description: 'Complete your first revision session.', icon: 'Timer', group: 'academy', tier: 'bronze', xp: 25, target: 1, value: (s) => s.revisionSessions },
  { id: 'study-streak', name: 'Study Streak', description: 'Complete 3 revision sessions in one week.', icon: 'Flame', group: 'academy', tier: 'bronze', xp: 30, target: 3, value: (s) => s.maxSessionsInWeek },
  { id: 'maths-master', name: 'Maths Master', description: 'Get 5 Maths topics to "Understanding" or better.', icon: 'Sigma', group: 'academy', tier: 'gold', xp: 75, title: 'Mathematician', target: 5, value: (s) => s.mathsTopics },
  { id: 'knowledge-builder', name: 'Knowledge Builder', description: 'Complete 10 spaced-repetition reviews.', icon: 'Blocks', group: 'academy', tier: 'silver', xp: 50, title: 'Knowledge Builder', target: 10, value: (s) => s.reviews },
  { id: 'active-learner', name: 'Active Learner', description: 'Complete 10 active recall sessions.', icon: 'Brain', group: 'academy', tier: 'silver', xp: 50, title: 'Active Learner', target: 10, value: (s) => s.activeRecall },
  { id: 'exam-ready', name: 'Exam Ready', description: 'Complete your first set of exam-style questions.', icon: 'FileCheck2', group: 'academy', tier: 'silver', xp: 40, target: 1, value: (s) => s.examSessions },
  { id: 'revision-consistency', name: 'Steady Scholar', description: 'Hit your weekly revision target 4 weeks in a row.', icon: 'GraduationCap', group: 'academy', tier: 'gold', xp: 100, title: 'Scholar', target: 4, value: (s) => s.targetWeeksRun },
  { id: 'explorer', name: 'Topic Explorer', description: 'Study 10 different topics.', icon: 'Compass', group: 'academy', tier: 'bronze', xp: 30, target: 10, value: (s) => s.topicsStudied },
  { id: 'all-rounder', name: 'All-Rounder', description: 'Revise 4 different subjects.', icon: 'LayoutGrid', group: 'academy', tier: 'silver', xp: 40, target: 4, value: (s) => s.subjectsStudied },
  { id: 'growth', name: 'Growth Mindset', description: 'Raise a topic’s confidence by 2 or more points.', icon: 'Sprout', group: 'academy', tier: 'silver', xp: 40, title: 'Growth Mindset', target: 1, value: (s) => s.confidenceGains },
  { id: 'practice-25', name: 'Practice Makes Progress', description: 'Complete 25 practice or exam-question sessions.', icon: 'PencilRuler', group: 'academy', tier: 'epic', xp: 150, target: 25, value: (s) => s.practiceSessions },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a])) as Record<string, AchievementDef>;

export function achievementProgress(a: AchievementDef, st: Stats) {
  const v = a.value(st);
  return { value: v, pct: Math.min(1, v / a.target), done: v >= a.target, label: a.format ? `${a.format(v)} / ${a.format(a.target)}` : `${Math.min(Math.floor(v), a.target)} / ${a.target}` };
}

export const TIER_COLORS: Record<BadgeTier, [string, string]> = {
  bronze: ['#d38b5d', '#7a4a2c'],
  silver: ['#cfd6e6', '#6b7590'],
  gold: ['#ffd36b', '#b07a12'],
  epic: ['#c49bff', '#5b2fd1'],
};

