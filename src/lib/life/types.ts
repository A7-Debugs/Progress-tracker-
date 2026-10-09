/** Core habit identifiers. V1.0 ships 7; later levels unlock the rest. */
export type HabitId =
  | 'sleep'
  | 'train'
  | 'steps'
  | 'protein'
  | 'deepWork'
  | 'plan'
  | 'moneyReview'
  | 'read'
  | 'mobility'
  | 'connect'
  | 'shutdown'
  | 'journal'
  | 'calories'
  | 'vitamins'
  | 'morningWalk';

export type Domain =
  | 'health'
  | 'fitness'
  | 'career'
  | 'learning'
  | 'finance'
  | 'personal'
  | 'relationships'
  | 'recovery'
  | 'consistency';

export type Mode = 'minimum' | 'normal' | 'high';

/** Result of a habit on a given day. `min` is a success — the minimum always counts. */
export type Hit = 'miss' | 'min' | 'ideal';

export type Level = 1 | 2 | 3 | 4 | 5 | 6;

export type Phase = 'build' | 'deload' | 'stabilise';

/** One row per calendar day. id === date (yyyy-MM-dd) so saves are idempotent upserts. */
export interface DailyCheckin {
  id: string;
  date: string;
  sleepHours: number | null;
  /** Manual training minutes (runs, sport, a gym session not logged in the app). */
  trainingMinutes: number | null;
  steps: number | null;
  deepWorkMinutes: number | null;
  workHours: number | null;
  energy: number | null; // 1-5
  mood: number | null; // 1-5
  stress: number | null; // 1-5
  /** Tri-state habits (protein, plan, read, shutdown, journal) and booleans (connect, moneyReview). */
  habits: Partial<Record<HabitId, Hit>>;
  /** Minutes-based unlockable habits (mobility). */
  minutes: Partial<Record<HabitId, number>>;
  commitments: string;
  createdAt: number;
  updatedAt: number;
}

/** Weekly evaluation + reflection. id === weekStart (Monday, yyyy-MM-dd). */
export interface WeekPlan {
  id: string;
  weekStart: string;
  mode: Mode;
  expectedWorkHours: number | null;
  expectedStress: number | null; // 1-5
  socialCommitments: number | null; // count of evenings committed
  financialPressure: number | null; // 1-5
  importantEvents: string;
  focus: string; // the ONE priority
  reflectionWorked: string;
  reflectionDidnt: string;
  reflectionChange: string;
  createdAt: number;
  updatedAt: number;
}

/** Monthly finance snapshot. id === month (yyyy-MM). All values in the profile currency. */
export interface FinanceSnapshot {
  id: string;
  month: string;
  netIncome: number | null; // take-home this month
  spending: number | null; // total spending this month
  essentialSpending: number | null; // rent/mortgage, bills, food, transport
  housingCost: number | null; // rent or mortgage payment
  invested: number | null; // contributions to investments/pension this month
  cash: number | null; // current account + general savings
  emergencyFund: number | null; // ring-fenced
  carFund: number | null; // ring-fenced GT3 RS fund
  investments: number | null; // ISA, GIA, etc.
  pension: number | null;
  homeValue: number | null;
  mortgage: number | null;
  investmentPropertyEquity: number | null;
  otherDebt: number | null; // cards, loans, car finance, student loan (if you choose)
  notes: string;
  createdAt: number;
  updatedAt: number;
}

/** A saved food or meal. Values are per one serving. */
export interface FoodItem {
  id: string;
  name: string;
  serving: string; // e.g. "150g cooked", "1 scoop", "1 pot"
  protein: number; // grams per serving
  calories: number | null; // kcal per serving
  archived: boolean;
  useCount: number;
  lastUsedAt: number;
  createdAt: number;
}

/** One logged entry on a day. Totals are frozen at log time so editing a food never rewrites history. */
export interface FoodLog {
  id: string;
  date: string;
  foodId: string | null; // null = quick add
  name: string;
  servings: number;
  protein: number; // total grams for this entry
  calories: number | null; // total kcal for this entry
  createdAt: number;
}

export type CalorieGoal = 'cut' | 'maintain' | 'bulk';

export interface CalorieSettings {
  /** Date calorie tracking was unlocked (awareness phase starts). */
  unlockedAt: string | null;
  goal: CalorieGoal | null;
  /** Estimated maintenance kcal/day when the target was set. */
  maintenance: number | null;
  /** Daily target kcal. null = still in the awareness phase. */
  target: number | null;
  targetSetAt: string | null;
}

export interface GoalNode {
  id: string;
  parentId: string | null;
  tier: GoalTier;
  title: string;
  domain: Domain | null;
}

export type GoalTier = 'vision' | 'y10' | 'y5' | 'y1' | 'd90' | 'month' | 'week';

export interface Gt3rsConfig {
  price: number;
  annualRunningCost: number; // insurance, servicing, tyres, fuel, storage
  annualDepreciationPct: number; // e.g. 0.05
  expectedRealReturnPct: number; // e.g. 0.05
}

export interface LifeProfile {
  id: 'life';
  level: Level;
  levelSince: string;
  /** Every level change, oldest first — past weeks are always scored against the level active at the time. */
  levelHistory: { level: Level; from: string }[];
  phase: Phase;
  phaseSince: string;
  startDate: string;
  currency: string;
  proteinMinG: number;
  proteinIdealG: number;
  /** When true (default), protein targets follow the latest bodyweight × g/kg. Optional for older profiles. */
  proteinAuto?: boolean;
  proteinPerKg?: { min: number; ideal: number };
  calorie?: CalorieSettings;
  foodsSeeded?: boolean;
  pausedHabits: HabitId[];
  fiAnnualSpend: number | null; // null → derive from snapshots
  withdrawalRate: number; // 0.04
  emergencyMonths: number; // 6
  savingsRateTarget: number; // 0.2
  investRateTarget: number; // 0.15
  gt3rs: Gt3rsConfig;
  goals: GoalNode[];
}
