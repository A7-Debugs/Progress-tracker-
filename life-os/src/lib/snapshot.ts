import type { LifeOsDB } from './db';
import type {
  AchievementRecord,
  ActiveTimer,
  CalEvent,
  Category,
  DateStr,
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
import { logicalDate } from './dates';

/**
 * Everything the engine needs, loaded into memory. Life OS is single-user, so even years of data
 * is a few thousand small rows. Computing every metric from the full raw history keeps numbers honest:
 * nothing is cached, estimated or invented.
 */
export interface Snapshot {
  today: DateStr;
  profile: Profile;
  settings: Settings;
  categories: Category[];
  categoryById: Map<string, Category>;
  goals: Goal[];
  goalById: Map<string, Goal>;
  goalUpdates: GoalUpdate[];
  milestones: Milestone[];
  milestonesByGoal: Map<string, Milestone[]>;
  habits: Habit[];
  habitLogs: Map<string, HabitLog>;
  tasks: Task[];
  events: CalEvent[];
  focusSessions: FocusSession[];
  focusByDate: Map<DateStr, number>;
  timer: ActiveTimer | null;
  learning: LearningItem[];
  journal: Map<DateStr, JournalEntry>;
  weeklyReviews: Map<DateStr, WeeklyReview>;
  achievements: Map<string, AchievementRecord>;
}

export interface RawData {
  today: DateStr;
  profile: Profile;
  settings: Settings;
  categories: Category[];
  goals: Goal[];
  goalUpdates: GoalUpdate[];
  milestones: Milestone[];
  habits: Habit[];
  habitLogs: HabitLog[];
  tasks: Task[];
  events: CalEvent[];
  focusSessions: FocusSession[];
  timer: ActiveTimer | null;
  learning: LearningItem[];
  journal: JournalEntry[];
  weeklyReviews: WeeklyReview[];
  achievements: AchievementRecord[];
}

export async function loadSnapshot(db: LifeOsDB, now: Date = new Date()): Promise<Snapshot | null> {
  const [profile, settings] = await Promise.all([db.profile.get('me'), db.settings.get('settings')]);
  if (!profile || !settings) return null;
  const [categories, goals, goalUpdates, milestones, habits, habitLogs, tasks, events, focusSessions, timer, learning, journal, weeklyReviews, achievements] = await Promise.all([
    db.categories.orderBy('order').toArray(),
    db.goals.orderBy('order').toArray(),
    db.goalUpdates.toArray(),
    db.milestones.orderBy('order').toArray(),
    db.habits.orderBy('order').toArray(),
    db.habitLogs.toArray(),
    db.tasks.toArray(),
    db.events.toArray(),
    db.focusSessions.toArray(),
    db.timer.get('timer'),
    db.learning.toArray(),
    db.journal.toArray(),
    db.weeklyReviews.toArray(),
    db.achievements.toArray(),
  ]);
  return buildSnapshot({
    today: logicalDate(now, settings.dayStartHour),
    profile,
    settings,
    categories,
    goals,
    goalUpdates,
    milestones,
    habits,
    habitLogs,
    tasks,
    events,
    focusSessions,
    timer: timer ?? null,
    learning,
    journal,
    weeklyReviews,
    achievements,
  });
}

export function buildSnapshot(x: RawData): Snapshot {
  const milestonesByGoal = new Map<string, Milestone[]>();
  for (const m of [...x.milestones].sort((a, b) => a.order - b.order)) {
    const arr = milestonesByGoal.get(m.goalId) ?? [];
    arr.push(m);
    milestonesByGoal.set(m.goalId, arr);
  }
  const focusByDate = new Map<DateStr, number>();
  for (const f of x.focusSessions) focusByDate.set(f.date, (focusByDate.get(f.date) ?? 0) + f.minutes);
  return {
    today: x.today,
    profile: x.profile,
    settings: x.settings,
    categories: x.categories,
    categoryById: new Map(x.categories.map((c) => [c.id, c])),
    goals: x.goals,
    goalById: new Map(x.goals.map((g) => [g.id, g])),
    goalUpdates: [...x.goalUpdates].sort((a, b) => (a.date === b.date ? a.ts - b.ts : a.date < b.date ? -1 : 1)),
    milestones: x.milestones,
    milestonesByGoal,
    habits: x.habits,
    habitLogs: new Map(x.habitLogs.map((l) => [l.id, l])),
    tasks: x.tasks,
    events: x.events,
    focusSessions: x.focusSessions,
    focusByDate,
    timer: x.timer,
    learning: x.learning,
    journal: new Map(x.journal.map((j) => [j.date, j])),
    weeklyReviews: new Map(x.weeklyReviews.map((r) => [r.id, r])),
    achievements: new Map(x.achievements.map((a) => [a.id, a])),
  };
}
