import type { LifeXpDB } from './db';
import type {
  AchievementRecord,
  ActiveTimer,
  DateStr,
  ExerciseLog,
  Habit,
  HabitLog,
  NutritionLog,
  Profile,
  QuestRecord,
  RevisionSession,
  Settings,
  SleepLog,
  Subject,
  Topic,
  TopicReview,
  WeekPlan,
  XpEvent,
} from './types';
import { logicalDate } from './dates';

/**
 * Everything the engine needs, loaded into memory. LIFE XP is single-user, so even years of data
 * is only a few thousand small rows — computing from the full history keeps every number honest.
 */
export interface Snapshot {
  today: DateStr;
  profile: Profile;
  settings: Settings;
  habits: Habit[];
  habitLogs: Map<string, HabitLog>;
  xpEvents: XpEvent[];
  sleepLogs: Map<DateStr, SleepLog>;
  exerciseLogs: ExerciseLog[];
  exerciseMinutes: Map<DateStr, number>;
  nutrition: Map<DateStr, NutritionLog>;
  quests: QuestRecord[];
  achievements: Map<string, AchievementRecord>;
  subjects: Subject[];
  topics: Topic[];
  revisionSessions: RevisionSession[];
  revisionMinutes: Map<DateStr, number>;
  topicReviews: TopicReview[];
  weekPlans: Map<DateStr, WeekPlan>;
  timer: ActiveTimer | null;
}

export async function loadSnapshot(db: LifeXpDB, now: Date = new Date()): Promise<Snapshot | null> {
  const [profile, settings] = await Promise.all([db.profile.get('me'), db.settings.get('settings')]);
  if (!profile || !settings) return null;
  const [habits, habitLogs, xpEvents, sleepLogs, exerciseLogs, nutrition, quests, achievements, subjects, topics, revisionSessions, topicReviews, weekPlans, timer] =
    await Promise.all([
      db.habits.orderBy('order').toArray(),
      db.habitLogs.toArray(),
      db.xpEvents.toArray(),
      db.sleepLogs.toArray(),
      db.exerciseLogs.toArray(),
      db.nutritionLogs.toArray(),
      db.quests.toArray(),
      db.achievements.toArray(),
      db.subjects.orderBy('order').toArray(),
      db.topics.toArray(),
      db.revisionSessions.toArray(),
      db.topicReviews.toArray(),
      db.weekPlans.toArray(),
      db.timer.get('timer'),
    ]);
  return buildSnapshot({
    today: logicalDate(now, settings.dayStartHour),
    profile,
    settings,
    habits,
    habitLogs,
    xpEvents,
    sleepLogs,
    exerciseLogs,
    nutrition,
    quests,
    achievements,
    subjects,
    topics,
    revisionSessions,
    topicReviews,
    weekPlans,
    timer: timer ?? null,
  });
}

export function buildSnapshot(x: {
  today: DateStr;
  profile: Profile;
  settings: Settings;
  habits: Habit[];
  habitLogs: HabitLog[];
  xpEvents: XpEvent[];
  sleepLogs: SleepLog[];
  exerciseLogs: ExerciseLog[];
  nutrition: NutritionLog[];
  quests: QuestRecord[];
  achievements: AchievementRecord[];
  subjects: Subject[];
  topics: Topic[];
  revisionSessions: RevisionSession[];
  topicReviews: TopicReview[];
  weekPlans: WeekPlan[];
  timer: ActiveTimer | null;
}): Snapshot {
  const exerciseMinutes = new Map<DateStr, number>();
  for (const e of x.exerciseLogs) exerciseMinutes.set(e.date, (exerciseMinutes.get(e.date) ?? 0) + e.minutes);
  const revisionMinutes = new Map<DateStr, number>();
  for (const s of x.revisionSessions) revisionMinutes.set(s.date, (revisionMinutes.get(s.date) ?? 0) + Math.floor(s.focusedSeconds / 60));
  return {
    today: x.today,
    profile: x.profile,
    settings: x.settings,
    habits: x.habits,
    habitLogs: new Map(x.habitLogs.map((l) => [l.id, l])),
    xpEvents: x.xpEvents,
    sleepLogs: new Map(x.sleepLogs.map((s) => [s.date, s])),
    exerciseLogs: x.exerciseLogs,
    exerciseMinutes,
    nutrition: new Map(x.nutrition.map((n) => [n.date, n])),
    quests: x.quests,
    achievements: new Map(x.achievements.map((a) => [a.id, a])),
    subjects: x.subjects,
    topics: x.topics,
    revisionSessions: x.revisionSessions,
    revisionMinutes,
    topicReviews: x.topicReviews,
    weekPlans: new Map(x.weekPlans.map((p) => [p.id, p])),
    timer: x.timer,
  };
}
