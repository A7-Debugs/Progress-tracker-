import Dexie, { type EntityTable } from 'dexie';
import type {
  AchievementRecord,
  ActiveTimer,
  AiMessage,
  CalEvent,
  Category,
  FocusSession,
  Goal,
  GoalUpdate,
  Habit,
  HabitLog,
  JournalEntry,
  LearningItem,
  Milestone,
  Profile,
  Settings,
  Task,
  WeeklyReview,
} from './types';

/**
 * Life OS's own IndexedDB database. Local-first: every write is persisted immediately, so data
 * survives refreshes, closing the app and going offline. Schema changes go through Dexie versions.
 */
export class LifeOsDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  goalUpdates!: EntityTable<GoalUpdate, 'id'>;
  milestones!: EntityTable<Milestone, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  habitLogs!: EntityTable<HabitLog, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  events!: EntityTable<CalEvent, 'id'>;
  focusSessions!: EntityTable<FocusSession, 'id'>;
  timer!: EntityTable<ActiveTimer, 'id'>;
  learning!: EntityTable<LearningItem, 'id'>;
  journal!: EntityTable<JournalEntry, 'id'>;
  weeklyReviews!: EntityTable<WeeklyReview, 'id'>;
  achievements!: EntityTable<AchievementRecord, 'id'>;
  aiMessages!: EntityTable<AiMessage, 'id'>;

  constructor(name = 'life-os') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      settings: 'id',
      categories: 'id, order',
      goals: 'id, parentId, categoryId, status, order',
      goalUpdates: 'id, goalId, date',
      milestones: 'id, goalId, order',
      habits: 'id, order, goalId',
      habitLogs: 'id, habitId, date',
      tasks: 'id, goalId, milestoneId, plannedDate, dueDate, done, seriesId',
      events: 'id, date, taskId',
      focusSessions: 'id, date, taskId, learningId',
      timer: 'id',
      learning: 'id, type, status',
      journal: 'id, date',
      weeklyReviews: 'id',
      achievements: 'id',
      aiMessages: 'id, threadId, ts',
    });
  }
}

export const db = new LifeOsDB();

export const ALL_TABLES = [
  'profile',
  'settings',
  'categories',
  'goals',
  'goalUpdates',
  'milestones',
  'habits',
  'habitLogs',
  'tasks',
  'events',
  'focusSessions',
  'timer',
  'learning',
  'journal',
  'weeklyReviews',
  'achievements',
  'aiMessages',
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
