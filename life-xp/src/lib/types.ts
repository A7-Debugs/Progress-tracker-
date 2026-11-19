/** ISO local date 'YYYY-MM-DD'. */
export type DateStr = string;

export type HabitCategory = 'morning' | 'school' | 'health' | 'fitness' | 'evening' | 'personal';

/**
 * Where a habit's progress comes from.
 * - manual: ticked (or counted) on the habit card, stored in habitLogs
 * - water / meals / fruitveg: the day's nutrition log
 * - exercise: minutes of exercise logged that day
 * - revision: focused revision minutes that day (Academy)
 */
export type HabitLink = 'manual' | 'water' | 'meals' | 'fruitveg' | 'exercise' | 'revision';

export interface Habit {
  id: string;
  templateId: string | null;
  name: string;
  category: HabitCategory;
  icon: string;
  xp: number;
  /** Days of week this habit is scheduled (0 = Sunday … 6 = Saturday). */
  days: number[];
  /** 1 for a simple tick; otherwise an amount (glasses, minutes, portions…). */
  target: number;
  unit: string | null;
  /** Step for the +/- control on count habits. */
  step: number;
  link: HabitLink;
  /** Academic habits (homework, revision) count as Academic XP. */
  xpKind: 'life' | 'academic';
  active: boolean;
  order: number;
  createdAt: number;
  /** First date the habit counts from (so adding a habit never lowers past scores). */
  startDate: DateStr;
  archivedAt: number | null;
}

export interface HabitLog {
  /** `${habitId}:${date}` — one record per habit per day. */
  id: string;
  habitId: string;
  date: DateStr;
  count: number;
  completedAt: number | null;
}

export type XpSource = 'habit' | 'routine' | 'daily-quest' | 'daily-combo' | 'weekly-quest' | 'weekly-combo' | 'achievement' | 'revision' | 'review';

export interface XpEvent {
  /** Deterministic key — the same activity can never be awarded twice. */
  id: string;
  date: DateStr;
  ts: number;
  amount: number;
  source: XpSource;
  kind: 'life' | 'academic';
  label: string;
}

export interface SleepLog {
  /** The date you woke up on. */
  id: DateStr;
  date: DateStr;
  bedtime: string; // HH:MM (previous evening, or after midnight)
  wake: string; // HH:MM
  minutes: number;
  quality: number | null; // 1..5, optional
}

export type ExerciseType = 'walk' | 'run' | 'cycle' | 'football' | 'basketball' | 'swim' | 'gym' | 'pe' | 'dance' | 'martial-arts' | 'stretch' | 'other';

export interface ExerciseLog {
  id: string;
  date: DateStr;
  type: ExerciseType;
  minutes: number;
  effort: 'easy' | 'moderate' | 'hard';
  note: string;
  createdAt: number;
}

export interface NutritionLog {
  id: DateStr;
  date: DateStr;
  water: number; // glasses
  meals: number; // balanced meals
  fruitVeg: number; // portions
}

export type QuestDifficulty = 'easy' | 'medium' | 'hard';

export interface QuestRecord {
  /** `d:${date}:${questId}` or `w:${weekStart}:${questId}` */
  id: string;
  period: 'day' | 'week';
  periodKey: DateStr;
  questId: string;
  title: string;
  description: string;
  difficulty: QuestDifficulty;
  xp: number;
  target: number;
  progress: number;
  completedAt: number | null;
  order: number;
}

export interface AchievementRecord {
  id: string;
  unlockedAt: number;
  date: DateStr;
}

export interface AvatarConfig {
  icon: string;
  palette: string;
  frame: string;
}

export interface Profile {
  id: 'me';
  nickname: string;
  avatar: AvatarConfig;
  title: string;
  onboarded: boolean;
  createdAt: number;
  startDate: DateStr;
  /** Highest level already celebrated — level-up screens only ever show once. */
  celebratedLevel: number;
}

export type WorkloadMode = 'term' | 'busy' | 'exams' | 'holiday' | 'rest';

export interface Settings {
  id: 'settings';
  wakeTarget: string;
  bedTarget: string;
  /** Activity before this hour counts towards the previous day (late-night ticks). */
  dayStartHour: number;
  schoolDays: number[];
  schoolStart: string;
  schoolEnd: string;
  healthEnabled: boolean;
  haptics: boolean;
  reduceMotion: boolean;
  workload: WorkloadMode;
  /** Chosen by the user — never raised automatically. */
  revisionPerWeek: number;
  revisionMinutes: number;
  /** Days the planner may schedule revision (0 = Sun). */
  studyDays: number[];
  /** Typical homework minutes per weekday, used by the planner to avoid overload. */
  homeworkMinutes: Record<string, number>;
  routineBonusXp: number;
  lastBackupAt: number | null;
  coachDismissed: string[];
}

// ───────────────────────────── Academy ─────────────────────────────

export interface Subject {
  id: string;
  name: string;
  color: string;
  icon: string;
  /** 1 = lighter, 2 = normal, 3 = focus subject. The planner weights by this. */
  priority: 1 | 2 | 3;
  examSoon: boolean;
  order: number;
  createdAt: number;
  archived: boolean;
}

/** 0 Not started · 1 Learning · 2 Needs practice · 3 Understanding · 4 Confident · 5 Retained */
export type TopicStatus = 0 | 1 | 2 | 3 | 4 | 5;

export interface PracticeResult {
  date: DateStr;
  correct: number;
  total: number;
  sessionId: string;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  status: TopicStatus;
  confidence: number | null; // 1..5
  confidenceHistory: { date: DateStr; value: number }[];
  firstStudied: DateStr | null;
  lastRevised: DateStr | null;
  nextReview: DateStr | null;
  /** Index into the spaced-repetition ladder (1, 3, 7, 14, 30, 60 days). */
  reviewStage: number;
  needsRevisit: boolean;
  difficultCount: number;
  practice: PracticeResult[];
  createdAt: number;
  order: number;
}

export type RevisionMethod = 'reading' | 'active-recall' | 'flashcards' | 'mind-map' | 'practice' | 'exam' | 'mistakes' | 'video';

export interface RevisionSession {
  id: string;
  date: DateStr;
  startedAt: number;
  endedAt: number;
  subjectId: string;
  topicId: string | null;
  method: RevisionMethod;
  plannedMinutes: number;
  focusedSeconds: number;
  studied: string;
  difficult: string;
  confidence: number | null;
  revisit: boolean;
  practiceCorrect: number | null;
  practiceTotal: number | null;
  xp: number;
}

export type ReviewRating = 'easy' | 'medium' | 'hard';

export interface TopicReview {
  id: string;
  topicId: string;
  subjectId: string;
  date: DateStr;
  dueDate: DateStr;
  rating: ReviewRating;
  intervalDays: number;
  xp: number;
}

export interface PlanItem {
  id: string;
  date: DateStr;
  time: string;
  subjectId: string;
  topicId: string | null;
  kind: 'review' | 'study';
  method: RevisionMethod;
  minutes: number;
  done: boolean;
}

export interface WeekPlan {
  id: DateStr; // week start (Monday)
  items: PlanItem[];
  generatedAt: number;
  edited: boolean;
}

/** In-progress revision timer — persisted so closing the app never loses a session. */
export interface ActiveTimer {
  id: 'timer';
  subjectId: string;
  topicId: string | null;
  method: RevisionMethod;
  plannedMinutes: number;
  startedAt: number;
  /** Seconds accumulated before the current running stretch. */
  accumulated: number;
  /** When the current running stretch began, or null while paused. */
  runningSince: number | null;
  planItemId: string | null;
}
