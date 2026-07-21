export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Biceps',
  'Triceps',
  'Abs',
  'Forearms',
  'Cardio',
  'Full Body',
  'Other',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export interface ExerciseDef {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: string;
  notes: string;
  restTimeSec: number;
  tempo: string;
  videoUrl: string;
  archived: boolean;
  createdAt: number;
}

export interface Program {
  id: string;
  name: string;
  active: boolean;
  archived: boolean;
  order: number;
  createdAt: number;
}

export interface WorkoutTemplate {
  id: string;
  programId: string;
  name: string;
  order: number;
  archived: boolean;
}

export interface WorkoutExercise {
  id: string;
  workoutTemplateId: string;
  exerciseDefId: string;
  order: number;
  targetSets: number;
  targetRepLow: number;
  targetRepHigh: number;
  rpeTarget: number | null;
  restTimeSec: number | null;
}

export interface Session {
  id: string;
  workoutTemplateId: string;
  workoutName: string;
  programId: string;
  programName: string;
  date: string; // yyyy-MM-dd
  startedAt: number;
  completedAt: number | null;
  notes: string;
  bodyweight: number | null;
}

export interface SetLog {
  id: string;
  sessionId: string;
  exerciseDefId: string;
  exerciseName: string;
  setNumber: number;
  weight: number;
  reps: number;
  rpe: number | null;
  isWarmup: boolean;
  createdAt: number;
}

export interface BodyweightLog {
  id: string;
  date: string; // yyyy-MM-dd
  weight: number | null;
  bodyFat: number | null;
  calories: number | null;
  protein: number | null;
  sleepHours: number | null;
  waterLiters: number | null;
  mood: number | null;
  energy: number | null;
  createdAt: number;
}

export type PhotoAngle = 'front' | 'side' | 'back';

export interface ProgressPhoto {
  id: string;
  date: string;
  angle: PhotoAngle;
  blob: Blob;
  createdAt: number;
}

export interface Settings {
  id: string;
  units: 'kg' | 'lb';
  reminderEnabled: boolean;
  reminderTime: string; // HH:mm
  reminderDays: number[]; // 0=Sun..6=Sat
}
