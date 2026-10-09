import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import type { BodyweightLog } from '@/lib/types';
import type { CalorieGoal, FoodItem, FoodLog, Hit, LifeProfile } from './types';

type StarterFood = Pick<FoodItem, 'name' | 'serving' | 'protein' | 'calories'>;

/** Generic UK starter list. Approximate values — edit them to match your brands and portions. */
export const STARTER_FOODS: StarterFood[] = [
  { name: 'Chicken breast', serving: '150g cooked', protein: 46, calories: 240 },
  { name: 'Turkey mince (2% fat)', serving: '125g cooked', protein: 30, calories: 170 },
  { name: 'Beef mince (5% fat)', serving: '125g cooked', protein: 33, calories: 210 },
  { name: 'Salmon fillet', serving: '120g', protein: 25, calories: 250 },
  { name: 'Tuna, tinned in water', serving: '1 tin (110g drained)', protein: 27, calories: 115 },
  { name: 'Prawns, cooked', serving: '100g', protein: 20, calories: 90 },
  { name: 'Ham', serving: '3 slices (50g)', protein: 9, calories: 55 },
  { name: 'Eggs', serving: '2 large', protein: 13, calories: 150 },
  { name: 'Greek yoghurt, 0% fat', serving: '170g pot', protein: 17, calories: 95 },
  { name: 'Skyr / Icelandic yoghurt', serving: '150g pot', protein: 16, calories: 95 },
  { name: 'Cottage cheese', serving: '150g', protein: 17, calories: 150 },
  { name: 'Cheddar', serving: '30g', protein: 7, calories: 125 },
  { name: 'Semi-skimmed milk', serving: '250ml', protein: 9, calories: 125 },
  { name: 'Whey protein', serving: '1 scoop (30g)', protein: 24, calories: 120 },
  { name: 'Protein bar', serving: '1 bar', protein: 20, calories: 220 },
  { name: 'Beef jerky', serving: '25g bag', protein: 11, calories: 80 },
  { name: 'Tofu, firm', serving: '150g', protein: 18, calories: 190 },
  { name: 'Lentils, cooked', serving: '150g', protein: 13, calories: 175 },
  { name: 'Chickpeas', serving: '120g drained', protein: 9, calories: 145 },
  { name: 'Baked beans', serving: '½ tin (200g)', protein: 9, calories: 160 },
  { name: 'Porridge oats', serving: '50g dry', protein: 6, calories: 185 },
  { name: 'Wholemeal bread', serving: '2 slices', protein: 8, calories: 190 },
  { name: 'Rice, cooked', serving: '180g', protein: 5, calories: 230 },
  { name: 'Pasta, cooked', serving: '200g', protein: 12, calories: 315 },
  { name: 'Peanut butter', serving: '1 tbsp (15g)', protein: 4, calories: 90 },
  { name: 'Almonds', serving: 'Handful (30g)', protein: 6, calories: 175 },
  { name: 'Meal-deal chicken sandwich', serving: '1 pack', protein: 25, calories: 400 },
];

/** Rough guides for quick adds when eating out. */
export const PORTION_GUIDES = [
  { label: 'Palm of meat / fish', protein: 30 },
  { label: 'Fist of beans / lentils', protein: 10 },
  { label: 'Glass of milk', protein: 8 },
  { label: 'Handful of nuts', protein: 6 },
];

/** Seed the starter list once. Never re-seeds, even if every food is later deleted. */
export async function ensureStarterFoods(): Promise<void> {
  const profile = await db.lifeProfile.get('life');
  if (!profile || profile.foodsSeeded) return;
  if ((await db.foods.count()) === 0) {
    const now = Date.now();
    await db.foods.bulkAdd(STARTER_FOODS.map((f) => ({ ...f, id: newId(), archived: false, useCount: 0, lastUsedAt: 0, createdAt: now })));
  }
  await db.lifeProfile.update('life', { foodsSeeded: true });
}

// ---------------------------------------------------------------------------
// Protein targets
// ---------------------------------------------------------------------------

export const DEFAULT_PER_KG = { min: 1.6, ideal: 2.0 };
const round5 = (x: number) => Math.round(x / 5) * 5;

/** Latest weigh-in on or before `date` (logs sorted by date ascending). */
export function bodyweightOn(bw: BodyweightLog[], date: string): number | null {
  let w: number | null = null;
  for (const b of bw) {
    if (b.date > date) break;
    if (b.weight !== null) w = b.weight;
  }
  return w;
}

export interface ProteinTargets {
  min: number;
  ideal: number;
  source: 'bodyweight' | 'manual';
  weight: number | null;
}

export function proteinTargets(profile: LifeProfile, bw: BodyweightLog[], date: string): ProteinTargets {
  const weight = bodyweightOn(bw, date);
  const perKg = profile.proteinPerKg ?? DEFAULT_PER_KG;
  if ((profile.proteinAuto ?? true) && weight) {
    return { min: round5(weight * perKg.min), ideal: round5(weight * perKg.ideal), source: 'bodyweight', weight };
  }
  return { min: profile.proteinMinG, ideal: profile.proteinIdealG, source: 'manual', weight };
}

// ---------------------------------------------------------------------------
// Daily totals
// ---------------------------------------------------------------------------

export interface DayNutrition {
  protein: number;
  /** Sum of entries that have calories; null if none do. */
  calories: number | null;
  entries: number;
  /** Entries logged without a calorie value (calorie total is a lower bound). */
  missingCalories: number;
}

export function nutritionByDate(logs: FoodLog[]): Map<string, DayNutrition> {
  const out = new Map<string, DayNutrition>();
  for (const l of logs) {
    const d = out.get(l.date) ?? { protein: 0, calories: null, entries: 0, missingCalories: 0 };
    d.protein += l.protein;
    d.entries += 1;
    if (l.calories === null) d.missingCalories += 1;
    else d.calories = (d.calories ?? 0) + l.calories;
    out.set(l.date, d);
  }
  for (const d of out.values()) d.protein = Math.round(d.protein);
  return out;
}

// ---------------------------------------------------------------------------
// Calories
// ---------------------------------------------------------------------------

export const AWARENESS_DAYS = 14;
export const CALORIE_OFFSETS: Record<CalorieGoal, number> = { cut: -400, maintain: 0, bulk: 250 };
export const CALORIE_BANDS = { ideal: 100, min: 250 };
export const KCAL_PER_KG = 7700;

export const GOAL_LABELS: Record<CalorieGoal, string> = {
  cut: 'Cut (−400 kcal, ~0.4 kg/week)',
  maintain: 'Maintain',
  bulk: 'Lean bulk (+250 kcal, ~0.2 kg/week)',
};

/** Within ±100 kcal of target = ideal, within ±250 = minimum. */
export function gradeCalories(calories: number, target: number): Hit {
  const diff = Math.abs(calories - target);
  if (diff <= CALORIE_BANDS.ideal) return 'ideal';
  if (diff <= CALORIE_BANDS.min) return 'min';
  return 'miss';
}

export interface MaintenanceEstimate {
  ok: boolean;
  reason: string;
  maintenance: number | null;
  avgIntake: number | null;
  kgPerWeek: number | null;
  days: number;
  weighIns: number;
}

/**
 * Maintenance ≈ average logged intake − (weight change per day × 7,700 kcal).
 * Needs ≥10 days with calories and ≥4 weigh-ins spanning ≥10 days in the window.
 */
export function estimateMaintenance(nut: Map<string, DayNutrition>, bw: BodyweightLog[], start: string, end: string): MaintenanceEstimate {
  const intake = [...nut.entries()].filter(([d, n]) => d >= start && d <= end && n.calories !== null && n.calories > 0).map(([, n]) => n.calories!);
  const weights = bw.filter((b) => b.date >= start && b.date <= end && b.weight !== null);
  const base = { maintenance: null, avgIntake: null, kgPerWeek: null, days: intake.length, weighIns: weights.length };
  if (intake.length < 10) return { ...base, ok: false, reason: `Needs 10 days with calories logged (have ${intake.length}).` };
  const avgIntake = intake.reduce((a, b) => a + b, 0) / intake.length;
  const t0 = weights.length ? new Date(weights[0].date).getTime() : 0;
  const xs = weights.map((w) => (new Date(w.date).getTime() - t0) / 86400000);
  const span = xs.length ? xs[xs.length - 1] : 0;
  if (weights.length < 4 || span < 10)
    return { ...base, avgIntake: Math.round(avgIntake), ok: false, reason: `Needs 4+ weigh-ins over 10+ days (have ${weights.length} over ${Math.round(span)} days). Log bodyweight in the check-in.` };
  const ys = weights.map((w) => w.weight!);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den ? num / den : 0; // kg per day
  const maintenance = Math.round((avgIntake - slope * KCAL_PER_KG) / 10) * 10;
  return { ...base, ok: true, reason: '', maintenance, avgIntake: Math.round(avgIntake), kgPerWeek: Math.round(slope * 7 * 100) / 100 };
}
