import Dexie, { type EntityTable } from 'dexie';
import type {
  AchievementRecord,
  ActiveTimer,
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

/** LIFE XP's own database. Completely separate from any other app on the device. */
export class LifeXpDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  habitLogs!: EntityTable<HabitLog, 'id'>;
  xpEvents!: EntityTable<XpEvent, 'id'>;
  sleepLogs!: EntityTable<SleepLog, 'id'>;
  exerciseLogs!: EntityTable<ExerciseLog, 'id'>;
  nutritionLogs!: EntityTable<NutritionLog, 'id'>;
  quests!: EntityTable<QuestRecord, 'id'>;
  achievements!: EntityTable<AchievementRecord, 'id'>;
  subjects!: EntityTable<Subject, 'id'>;
  topics!: EntityTable<Topic, 'id'>;
  revisionSessions!: EntityTable<RevisionSession, 'id'>;
  topicReviews!: EntityTable<TopicReview, 'id'>;
  weekPlans!: EntityTable<WeekPlan, 'id'>;
  timer!: EntityTable<ActiveTimer, 'id'>;

  constructor(name = 'life-xp') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      settings: 'id',
      habits: 'id, order',
      habitLogs: 'id, habitId, date',
      xpEvents: 'id, date, source',
      sleepLogs: 'id, date',
      exerciseLogs: 'id, date',
      nutritionLogs: 'id, date',
      quests: 'id, period, periodKey',
      achievements: 'id',
      subjects: 'id, order',
      topics: 'id, subjectId, nextReview',
      revisionSessions: 'id, date, subjectId, topicId',
      topicReviews: 'id, date, topicId',
      weekPlans: 'id',
      timer: 'id',
    });
  }
}

export const db = new LifeXpDB();

export const ALL_TABLES = [
  'profile',
  'settings',
  'habits',
  'habitLogs',
  'xpEvents',
  'sleepLogs',
  'exerciseLogs',
  'nutritionLogs',
  'quests',
  'achievements',
  'subjects',
  'topics',
  'revisionSessions',
  'topicReviews',
  'weekPlans',
  'timer',
] as const;
export type TableName = (typeof ALL_TABLES)[number];

/** Ask the browser not to evict our data under storage pressure (Chrome grants this to installed PWAs). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* not supported */
  }
  return false;
}
