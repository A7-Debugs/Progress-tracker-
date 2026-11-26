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
  | 'morningWalk'
  // Optional unlocks: available at a level, scored only once you add them
  | 'caffeine'
  | 'news'
  | 'zone2'
  | 'fermented'
  | 'nature'
  | 'cold'
  /** Habits you create yourself. */
  | `c-${string}`;

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
  /** Ill today: habits aren't scheduled, so the day can't count as a miss, break a streak or trigger a deload. */
  sick?: boolean;
  /** Optional sleep timing (HH:mm) for the sleep-regularity score. bedTime is the night before. */
  bedTime?: string;
  wakeTime?: string;
  /** Daylight walk happened before 10am (needed for the ideal). */
  walkEarly?: boolean;
  /** Pay multiplier for today's hours (e.g. 1.5 for overtime). Default 1. */
  rateMultiplier?: number;
  /** Optional: total spent today, and (on money-check days) total spent this week. */
  spentToday?: number | null;
  spentWeek?: number | null;
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
  /** Set when the Sunday review for this week was saved. */
  reviewedAt?: number;
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
  propertyContribution?: number | null; // mortgage overpayments / deposit saving / BTL costs this month
  /** True when `spending` already includes the invested + property amounts (so they aren't counted twice). */
  spendingIncludesContributions?: boolean;
  cash: number | null; // current account + general savings
  emergencyFund: number | null; // ring-fenced
  carFund: number | null; // ring-fenced GT3 RS fund
  investments: number | null; // ISA, GIA, etc.
  pension: number | null;
  homeValue: number | null;
  mortgage: number | null;
  investmentPropertyEquity: number | null;
  otherDebt: number | null; // cards, loans, car finance
  /** UK-style income-contingent student loan: in net worth, but not treated as consumer debt. */
  studentLoan?: number | null;
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

export type GoalMetricKey =
  | 'weeklyReviews'
  | 'qualifyingWeeks'
  | 'trainingSessions'
  | 'deepWorkHours'
  | 'snapshots'
  | 'savingsRateMonths'
  | 'proteinDays'
  | 'connectDays'
  | 'fiProgress';

/** Optional measurable tracker on a goal, so the app can check whether you are on pace. */
export interface GoalMetric {
  key: GoalMetricKey;
  target: number;
  start: string;
  deadline: string;
}

/** A habit you created. Values for the check-in are stored in habits[id] (tick) or minutes[id] (minutes / number). */
export interface CustomHabitDef {
  id: `c-${string}`;
  name: string;
  input: 'bool' | 'minutes' | 'count';
  unit: string; // for 'count', e.g. "pages"
  min: number;
  ideal: number;
  perWeek: number;
  domain: Domain;
  why: string;
  trigger: string;
  goalLink: string;
  /** Scored from this date (the Monday after it was added). */
  startDate: string;
}

/** Your edits to a built-in habit. */
export interface HabitOverride {
  name?: string;
  trigger?: string;
  why?: string;
  /** Replaces the level-based targets at every level. */
  targets?: { min: number; ideal: number; perWeek: number };
  /** Scored from this date (e.g. Supplements moving to Level 1 doesn't rescore past weeks). */
  startDate?: string;
}

/** Removed (no longer scored or shown) or track-only (shown, logged, not scored), from a date. History before it is kept. */
export interface HabitStatus {
  /** 'active' = restored (only `past` periods still apply). */
  state: 'removed' | 'trackOnly' | 'active';
  from: string;
  /** Earlier removed / track-only periods, kept so old weeks score the way they did. */
  past?: { state: 'removed' | 'trackOnly'; from: string; to: string }[];
}

/** Snapshot balance a transfer adds to. */
export type AssetKey = 'investmentPropertyEquity' | 'homeValue' | 'investments' | 'pension' | 'cash' | 'emergencyFund' | 'carFund';

export interface RecurringTransfer {
  id: string;
  label: string;
  amount: number;
  dayOfMonth: number;
  kind: 'property' | 'invest' | 'pension' | 'savings' | 'bill';
  /** Which balance it builds (bills build nothing). Defaults from `kind`. */
  asset?: AssetKey | null;
  /** Taken from salary before you're paid (e.g. workplace pension) — not deducted from take-home again. */
  fromSalary?: boolean;
  /** First month it applies (yyyy-MM); earlier months aren't counted. */
  since?: string;
}

export interface Payslip {
  month: string; // yyyy-MM the pay is for
  gross: number;
  net: number;
  tax: number | null;
  ni: number | null;
  pension: number | null;
  studentLoan: number | null;
}

/** Totals from an imported bank statement (individual transactions are not stored). */
export interface BankMonth {
  id: string; // `${source}-${month}`
  source: 'starling' | 'monzo';
  month: string;
  spending: number;
  income: number;
  excluded: number; // transfers / savings pots / recurring transfers left out
  byCategory: Record<string, number>;
  importedAt: number;
}

export interface PaySettings {
  /** Gross hourly rate history, oldest first. */
  rates: { from: string; gross: number }[];
  /** Paid this many working days before the last working day of the month. */
  paydayOffset: number;
  /** true = paid for the same month you worked it. */
  paidSameMonth: boolean;
  recurring: RecurringTransfer[];
  payslips: Payslip[];
  bankMonths: BankMonth[];
  /** Unpaid break per shift (minutes), taken off shifts longer than 6 hours — so you can log clock-in to clock-out time. */
  unpaidBreakMin?: number;
}

export interface GoalNode {
  id: string;
  parentId: string | null;
  tier: GoalTier;
  title: string;
  domain: Domain | null;
  /** undefined = use the built-in default for this goal (if any); null = no tracker. */
  metric?: GoalMetric | null;
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
  customHabits?: CustomHabitDef[];
  habitOverrides?: Partial<Record<HabitId, HabitOverride>>;
  habitStatus?: Partial<Record<HabitId, HabitStatus>>;
  /** Shown with the Supplements habit, e.g. ["Vitamin D3 10µg", "Creatine 5g"]. */
  supplements?: string[];
  pay?: PaySettings;
  /** One-off data migrations already applied (by name). */
  migrations?: string[];
  /** Optional unlocked habits you've added, with the date they start being scored. */
  optIn?: Partial<Record<HabitId, string>>;
  pausedHabits: HabitId[];
  fiAnnualSpend: number | null; // null → derive from snapshots
  withdrawalRate: number; // 0.04
  emergencyMonths: number; // 6
  savingsRateTarget: number; // 0.2
  investRateTarget: number; // 0.15
  gt3rs: Gt3rsConfig;
  goals: GoalNode[];
}
