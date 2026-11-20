/** ISO local date 'YYYY-MM-DD'. */
export type DateStr = string;
/** 'HH:MM' 24h. */
export type TimeStr = string;

export type Difficulty = 'easy' | 'medium' | 'hard';
/** 1 = critical … 4 = low. */
export type Priority = 1 | 2 | 3 | 4;

// ───────────────────────────── Profile & settings ─────────────────────────────

export interface QuizAnswers {
  focusAreas: string[]; // category ids
  routine: 'structured' | 'mixed' | 'unstructured';
  dailyMinutes: number;
  obstacles: string[];
  horizon: '3m' | '1y' | '3y' | '5y';
}

export interface Profile {
  id: 'me';
  name: string;
  onboarded: boolean;
  createdAt: number;
  startDate: DateStr;
  /** Highest level already celebrated, so a level-up is only ever shown once. */
  celebratedLevel: number;
  quiz: QuizAnswers | null;
}

export type ThemePref = 'system' | 'dark' | 'light';

export interface XpConfig {
  taskEasy: number;
  taskMedium: number;
  taskHard: number;
  habitEasy: number;
  habitMedium: number;
  habitHard: number;
  milestone: number;
  majorMilestone: number;
  goal: number;
  weeklyReview: number;
  consistencyWeek: number;
  focusPer25: number;
  /** Anti-farming: the most task XP that can be earned on one day. */
  dailyTaskCap: number;
  /** Anti-farming: the most focus XP that can be earned on one day. */
  dailyFocusCap: number;
}

export type DashboardCard = 'overview' | 'priorities' | 'habits' | 'goals' | 'week' | 'insights' | 'schedule';

export interface LockConfig {
  enabled: boolean;
  salt: string;
  hash: string;
  /** Minutes in the background before the app locks again. */
  timeoutMin: number;
}

export interface AiConfig {
  provider: 'none' | 'anthropic';
  apiKey: string;
  model: string;
}

export interface Settings {
  id: 'settings';
  theme: ThemePref;
  /** Activity before this hour counts towards the previous day. */
  dayStartHour: number;
  dailyFocusTargetMin: number;
  xp: XpConfig;
  /** Multiplies the XP each level needs (1 = standard). */
  levelPace: number;
  dashboard: Record<DashboardCard, boolean>;
  dashboardOrder: DashboardCard[];
  reduceMotion: boolean;
  haptics: boolean;
  /** Progressive disclosure: advanced sections are shown when this is true (or after the first week). */
  showAdvanced: boolean;
  workdayStart: TimeStr;
  workdayEnd: TimeStr;
  lock: LockConfig;
  ai: AiConfig;
  lastBackupAt: number | null;
}

// ───────────────────────────── Categories ─────────────────────────────

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  builtin: boolean;
  order: number;
  archived: boolean;
}

// ───────────────────────────── Goals ─────────────────────────────

export type Horizon = 'vision' | 'annual' | 'quarterly' | 'monthly' | 'weekly';

/**
 * How a goal's progress is measured. Tasks never count directly:
 * - milestones: weighted share of milestones achieved
 * - numeric: where the measured value sits between start and target
 * - hybrid: half milestones, half measured value
 * - children: average of the sub-goals underneath it
 * - binary: 0% until it's marked achieved
 */
export type Measurement = 'milestones' | 'numeric' | 'hybrid' | 'children' | 'binary';

export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface Goal {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  horizon: Horizon;
  parentId: string | null;
  /** What "done" looks like, in words. */
  targetOutcome: string;
  /** Where you are starting from, in words. */
  startingPosition: string;
  measurement: Measurement;
  unit: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  targetDate: DateStr | null;
  priority: Priority;
  difficulty: Difficulty;
  status: GoalStatus;
  createdAt: number;
  startDate: DateStr;
  completedAt: number | null;
  completedDate: DateStr | null;
  order: number;
}

/** History of a numeric goal's measured value (for progress charts). */
export interface GoalUpdate {
  id: string;
  goalId: string;
  date: DateStr;
  value: number;
  note: string;
  ts: number;
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  description: string;
  dueDate: DateStr | null;
  /** Relative size: 1 small, 2 normal, 3 major. Major milestones earn more XP. */
  weight: 1 | 2 | 3;
  done: boolean;
  completedAt: number | null;
  completedDate: DateStr | null;
  createdAt: number;
  order: number;
}

// ───────────────────────────── Habits ─────────────────────────────

export type FrequencyType = 'daily' | 'weekdays' | 'weekly' | 'interval';

export interface Frequency {
  type: FrequencyType;
  /** For 'weekdays': days of week (0 = Sunday … 6 = Saturday). */
  days: number[];
  /** For 'weekly': times per week. */
  timesPerWeek: number;
  /** For 'interval': every N days from the start date. */
  everyDays: number;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';

export interface Habit {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  goalId: string | null;
  frequency: Frequency;
  /** Repetitions (or amount) per occurrence, e.g. 8 glasses, 90 minutes. 1 = a simple tick. */
  target: number;
  unit: string;
  timeOfDay: TimeOfDay;
  preferredTime: TimeStr | null;
  difficulty: Difficulty;
  /** The smallest version that still counts (partial credit, keeps the streak alive). */
  minimumVersion: string;
  /** null = use the difficulty default from settings. */
  xpOverride: number | null;
  startDate: DateStr;
  active: boolean;
  archivedAt: number | null;
  order: number;
  createdAt: number;
}

export type HabitLogStatus = 'done' | 'partial' | 'missed';

export interface HabitLog {
  /** `${habitId}:${date}` */
  id: string;
  habitId: string;
  date: DateStr;
  status: HabitLogStatus;
  count: number;
  note: string;
  ts: number;
}

// ───────────────────────────── Tasks ─────────────────────────────

export type RecurrenceType = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface Recurrence {
  type: RecurrenceType;
  interval: number;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  categoryId: string | null;
  goalId: string | null;
  milestoneId: string | null;
  priority: Priority;
  important: boolean;
  /** Explicitly urgent. Tasks due within 2 days are treated as urgent too. */
  urgent: boolean;
  difficulty: Difficulty;
  estimateMin: number | null;
  dueDate: DateStr | null;
  /** The day you plan to do it (may differ from the deadline). */
  plannedDate: DateStr | null;
  plannedTime: TimeStr | null;
  /** Most Important Task for its planned date. */
  mit: boolean;
  recurrence: Recurrence;
  /** Links every occurrence of a recurring task. */
  seriesId: string | null;
  done: boolean;
  completedAt: number | null;
  completedDate: DateStr | null;
  /** How many times the planned date or deadline has been pushed later. */
  postponed: number;
  createdAt: number;
  order: number;
}

// ───────────────────────────── Schedule & focus ─────────────────────────────

export type EventKind = 'block' | 'event' | 'focus';

export interface CalEvent {
  id: string;
  title: string;
  kind: EventKind;
  date: DateStr;
  start: TimeStr;
  end: TimeStr;
  categoryId: string | null;
  taskId: string | null;
  habitId: string | null;
  recurrence: Recurrence;
  /** Dates of a recurring series that were removed individually. */
  exceptions: DateStr[];
  notes: string;
  createdAt: number;
}

export interface FocusSession {
  id: string;
  date: DateStr;
  startedAt: number;
  minutes: number;
  taskId: string | null;
  goalId: string | null;
  categoryId: string | null;
  learningId: string | null;
  note: string;
  source: 'timer' | 'manual' | 'task';
}

/** A running focus timer, persisted so closing the app never loses it. */
export interface ActiveTimer {
  id: 'timer';
  taskId: string | null;
  categoryId: string | null;
  learningId: string | null;
  label: string;
  plannedMin: number;
  accumulated: number;
  runningSince: number | null;
  startedAt: number;
}

// ───────────────────────────── Personal development ─────────────────────────────

export type LearningType = 'book' | 'course' | 'qualification' | 'skill' | 'project' | 'experience';
export type LearningStatus = 'planned' | 'active' | 'completed' | 'dropped';

export interface LearningItem {
  id: string;
  type: LearningType;
  title: string;
  creator: string;
  status: LearningStatus;
  /** Pages, modules, % — whatever fits. */
  progress: number;
  total: number | null;
  unit: string;
  categoryId: string | null;
  goalId: string | null;
  startedDate: DateStr | null;
  completedDate: DateStr | null;
  rating: number | null;
  notes: string;
  createdAt: number;
}

export interface JournalEntry {
  /** One entry per day: the date. */
  id: DateStr;
  date: DateStr;
  reflection: string;
  lessons: string;
  challenges: string;
  accomplishments: string;
  improvements: string;
  mood: number | null; // 1..5
  energy: number | null; // 1..5
  updatedAt: number;
}

export interface WeeklyReview {
  /** Week start (Monday). */
  id: DateStr;
  wins: string;
  challenges: string;
  lessons: string;
  nextFocus: string[];
  rating: number | null; // 1..5
  completedAt: number;
}

// ───────────────────────────── Progression ─────────────────────────────

export interface AchievementRecord {
  id: string;
  unlockedAt: number;
  date: DateStr;
}

// ───────────────────────────── AI assistant ─────────────────────────────

export interface AiMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  /** Set when the request failed; the message is shown with the error rather than as advice. */
  error: string | null;
}
