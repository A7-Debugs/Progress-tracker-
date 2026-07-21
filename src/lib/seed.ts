import { db } from './db';
import { newId } from './id';
import type { MuscleGroup } from './types';

interface SeedExercise {
  name: string;
  muscleGroup: MuscleGroup;
  equipment: string;
  sets: number;
  repLow: number;
  repHigh: number;
  rpe: number;
  restSec: number;
}

interface SeedWorkout {
  name: string;
  exercises: SeedExercise[];
}

const SPLIT: SeedWorkout[] = [
  {
    name: 'Upper Strength',
    exercises: [
      { name: 'Incline Dumbbell Press', muscleGroup: 'Chest', equipment: 'Dumbbell', sets: 3, repLow: 6, repHigh: 8, rpe: 8, restSec: 150 },
      { name: 'Weighted Pull-Ups', muscleGroup: 'Back', equipment: 'Bodyweight', sets: 4, repLow: 4, repHigh: 6, rpe: 8, restSec: 180 },
      { name: 'Flat Machine Chest Press', muscleGroup: 'Chest', equipment: 'Machine', sets: 3, repLow: 6, repHigh: 8, rpe: 8, restSec: 120 },
      { name: 'Chest Supported Row', muscleGroup: 'Back', equipment: 'Machine', sets: 3, repLow: 6, repHigh: 8, rpe: 8, restSec: 120 },
      { name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders', equipment: 'Dumbbell', sets: 3, repLow: 6, repHigh: 8, rpe: 8, restSec: 120 },
      { name: 'Cable Lateral Raise', muscleGroup: 'Shoulders', equipment: 'Cable', sets: 3, repLow: 12, repHigh: 15, rpe: 9, restSec: 60 },
      { name: 'EZ Bar Curl', muscleGroup: 'Biceps', equipment: 'Barbell', sets: 3, repLow: 8, repHigh: 10, rpe: 8, restSec: 75 },
      { name: 'Tricep Pushdown', muscleGroup: 'Triceps', equipment: 'Cable', sets: 3, repLow: 8, repHigh: 10, rpe: 8, restSec: 75 },
    ],
  },
  {
    name: 'Lower Strength',
    exercises: [
      { name: 'Squat', muscleGroup: 'Quads', equipment: 'Barbell', sets: 4, repLow: 4, repHigh: 6, rpe: 8, restSec: 180 },
      { name: 'Romanian Deadlift', muscleGroup: 'Hamstrings', equipment: 'Barbell', sets: 3, repLow: 6, repHigh: 8, rpe: 8, restSec: 150 },
      { name: 'Leg Press', muscleGroup: 'Quads', equipment: 'Machine', sets: 3, repLow: 8, repHigh: 10, rpe: 8, restSec: 120 },
      { name: 'Hamstring Curl', muscleGroup: 'Hamstrings', equipment: 'Machine', sets: 3, repLow: 10, repHigh: 12, rpe: 9, restSec: 90 },
      { name: 'Leg Extension', muscleGroup: 'Quads', equipment: 'Machine', sets: 3, repLow: 10, repHigh: 12, rpe: 9, restSec: 90 },
      { name: 'Standing Calf Raise', muscleGroup: 'Calves', equipment: 'Machine', sets: 4, repLow: 8, repHigh: 12, rpe: 9, restSec: 75 },
    ],
  },
  {
    name: 'Upper Hypertrophy',
    exercises: [
      { name: 'Incline Smith Press', muscleGroup: 'Chest', equipment: 'Smith Machine', sets: 3, repLow: 8, repHigh: 10, rpe: 8, restSec: 120 },
      { name: 'Lat Pulldown', muscleGroup: 'Back', equipment: 'Cable', sets: 3, repLow: 8, repHigh: 10, rpe: 8, restSec: 120 },
      { name: 'Seated Cable Row', muscleGroup: 'Back', equipment: 'Cable', sets: 3, repLow: 10, repHigh: 12, rpe: 8, restSec: 90 },
      { name: 'Pec Deck', muscleGroup: 'Chest', equipment: 'Machine', sets: 3, repLow: 12, repHigh: 15, rpe: 9, restSec: 75 },
      { name: 'Machine Shoulder Press', muscleGroup: 'Shoulders', equipment: 'Machine', sets: 3, repLow: 8, repHigh: 10, rpe: 8, restSec: 90 },
      { name: 'Lateral Raises', muscleGroup: 'Shoulders', equipment: 'Dumbbell', sets: 4, repLow: 12, repHigh: 15, rpe: 9, restSec: 60 },
      { name: 'Bayesian Curl', muscleGroup: 'Biceps', equipment: 'Cable', sets: 3, repLow: 10, repHigh: 12, rpe: 9, restSec: 60 },
      { name: 'Overhead Rope Extension', muscleGroup: 'Triceps', equipment: 'Cable', sets: 3, repLow: 10, repHigh: 12, rpe: 9, restSec: 60 },
    ],
  },
  {
    name: 'Lower Hypertrophy',
    exercises: [
      { name: 'Hack Squat', muscleGroup: 'Quads', equipment: 'Machine', sets: 3, repLow: 8, repHigh: 10, rpe: 8, restSec: 120 },
      { name: 'Bulgarian Split Squat', muscleGroup: 'Glutes', equipment: 'Dumbbell', sets: 3, repLow: 8, repHigh: 10, rpe: 8, restSec: 120 },
      { name: 'Leg Curl', muscleGroup: 'Hamstrings', equipment: 'Machine', sets: 3, repLow: 10, repHigh: 12, rpe: 9, restSec: 90 },
      { name: 'Leg Extension', muscleGroup: 'Quads', equipment: 'Machine', sets: 3, repLow: 12, repHigh: 15, rpe: 9, restSec: 75 },
      { name: 'Calf Raise', muscleGroup: 'Calves', equipment: 'Machine', sets: 4, repLow: 10, repHigh: 15, rpe: 9, restSec: 60 },
      { name: 'Hanging Leg Raise', muscleGroup: 'Abs', equipment: 'Bodyweight', sets: 3, repLow: 10, repHigh: 15, rpe: 8, restSec: 60 },
    ],
  },
];

export async function seedIfEmpty() {
  // Wrap the emptiness check + inserts in one transaction so two concurrent
  // callers (e.g. React StrictMode's double effect invocation) can't both
  // pass the count check and seed duplicate data.
  await db.transaction(
    'rw',
    [db.programs, db.workoutTemplates, db.workoutExercises, db.exerciseDefs, db.settings],
    async () => {
      const programCount = await db.programs.count();
      if (programCount > 0) return;

      const now = Date.now();
      const programId = newId();

      await db.programs.add({
        id: programId,
        name: 'My Split',
        active: true,
        archived: false,
        order: 0,
        createdAt: now,
      });

      const exerciseDefIdByName = new Map<string, string>();

      for (let wi = 0; wi < SPLIT.length; wi++) {
        const workout = SPLIT[wi];
        const workoutTemplateId = newId();
        await db.workoutTemplates.add({
          id: workoutTemplateId,
          programId,
          name: workout.name,
          order: wi,
          archived: false,
        });

        for (let ei = 0; ei < workout.exercises.length; ei++) {
          const ex = workout.exercises[ei];
          let exerciseDefId = exerciseDefIdByName.get(ex.name);
          if (!exerciseDefId) {
            exerciseDefId = newId();
            exerciseDefIdByName.set(ex.name, exerciseDefId);
            await db.exerciseDefs.add({
              id: exerciseDefId,
              name: ex.name,
              muscleGroup: ex.muscleGroup,
              equipment: ex.equipment,
              notes: '',
              restTimeSec: ex.restSec,
              tempo: '',
              videoUrl: '',
              archived: false,
              createdAt: now,
            });
          }
          await db.workoutExercises.add({
            id: newId(),
            workoutTemplateId,
            exerciseDefId,
            order: ei,
            targetSets: ex.sets,
            targetRepLow: ex.repLow,
            targetRepHigh: ex.repHigh,
            rpeTarget: ex.rpe,
            restTimeSec: ex.restSec,
          });
        }
      }

      await db.settings.put({
        id: 'settings',
        units: 'kg',
        reminderEnabled: false,
        reminderTime: '18:00',
        reminderDays: [1, 2, 3, 4, 5],
      });
    },
  );
}
