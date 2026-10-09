import Dexie, { type EntityTable } from 'dexie';
import type {
  ExerciseDef,
  Program,
  WorkoutTemplate,
  WorkoutExercise,
  Session,
  SetLog,
  BodyweightLog,
  ProgressPhoto,
  Settings,
} from './types';
import type { DailyCheckin, WeekPlan, FinanceSnapshot, LifeProfile, FoodItem, FoodLog } from './life/types';

class OverloadDB extends Dexie {
  exerciseDefs!: EntityTable<ExerciseDef, 'id'>;
  programs!: EntityTable<Program, 'id'>;
  workoutTemplates!: EntityTable<WorkoutTemplate, 'id'>;
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  setLogs!: EntityTable<SetLog, 'id'>;
  bodyweightLogs!: EntityTable<BodyweightLog, 'id'>;
  progressPhotos!: EntityTable<ProgressPhoto, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  checkins!: EntityTable<DailyCheckin, 'id'>;
  weekPlans!: EntityTable<WeekPlan, 'id'>;
  financeSnapshots!: EntityTable<FinanceSnapshot, 'id'>;
  lifeProfile!: EntityTable<LifeProfile, 'id'>;
  foods!: EntityTable<FoodItem, 'id'>;
  foodLogs!: EntityTable<FoodLog, 'id'>;

  constructor() {
    super('overload-db');
    // Note: boolean fields (active/archived/completed) are intentionally NOT indexed —
    // IndexedDB key paths don't support boolean or null values, so those are filtered in JS.
    this.version(1).stores({
      exerciseDefs: 'id, name, muscleGroup',
      programs: 'id, order',
      workoutTemplates: 'id, programId, order',
      workoutExercises: 'id, workoutTemplateId, exerciseDefId, [workoutTemplateId+order]',
      sessions: 'id, workoutTemplateId, programId, date',
      setLogs: 'id, sessionId, exerciseDefId, [exerciseDefId+createdAt], createdAt',
      bodyweightLogs: 'id, date',
      progressPhotos: 'id, date, angle',
      settings: 'id',
    });
    // Life OS: daily check-ins, weekly plans/reviews, monthly finance snapshots, profile.
    this.version(2).stores({
      checkins: 'id, date',
      weekPlans: 'id, weekStart',
      financeSnapshots: 'id, month',
      lifeProfile: 'id',
    });
    // Nutrition: saved foods and per-day food log entries.
    this.version(3).stores({
      foods: 'id, name, lastUsedAt',
      foodLogs: 'id, date, foodId',
    });
  }
}

export const db = new OverloadDB();
