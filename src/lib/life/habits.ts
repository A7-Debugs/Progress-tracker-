import type { CustomHabitDef, Domain, HabitId, Level, LifeProfile, Mode } from './types';

export interface LevelTarget {
  /** Threshold for a successful (minimum) day. Units depend on `input`. */
  min: number;
  /** Threshold for an ideal day. */
  ideal: number;
  /** How many successful days per week the habit is scheduled for (7 = daily). */
  perWeek: number;
}

export type HabitInput = 'hours' | 'minutes' | 'steps' | 'tri' | 'bool' | 'session' | 'protein' | 'calories' | 'count';

export interface HabitSpec {
  id: HabitId;
  name: string;
  domain: Domain;
  secondary: Domain[];
  input: HabitInput;
  unit: string;
  why: string;
  /** Goal-tree node this habit serves (90-day objective). */
  goalLink: string;
  trigger: string;
  track: string;
  minLabel: string;
  idealLabel: string;
  estMinutes: { min: number; ideal: number };
  difficulty: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  unlock: Level;
  targets: Record<Level, LevelTarget>;
  /** Minimum Mode override. `null` = paused (not scored) during Minimum Mode. */
  minimumMode: LevelTarget | null;
  /** Extra scheduled days per week in High-Performance Mode. */
  highBump: number;
  redesign: { smaller: string; environment: string; trigger: string };
  /** Custom habits: scored from this date. */
  startDate?: string;
  custom?: boolean;
  /** Unlocks at `unlock` level as an option; scored only after you add it (profile.optIn). */
  optional?: boolean;
  /** The evidence, shown on the unlock card. */
  science?: string;
}

const same = (t: LevelTarget): Record<Level, LevelTarget> => ({ 1: t, 2: t, 3: t, 4: t, 5: t, 6: t });

/** Optional science-based habits: unlocked by level, added by choice so you stay under the habit cap. */
function optionalHabit(o: {
  id: HabitId;
  name: string;
  domain: Domain;
  secondary?: Domain[];
  input: 'bool' | 'minutes';
  min?: number;
  ideal?: number;
  perWeek: number;
  unlock: Level;
  why: string;
  science: string;
  trigger: string;
  minLabel: string;
  idealLabel: string;
  est: [number, number];
  smaller: string;
}): HabitSpec {
  const t = { min: o.min ?? 1, ideal: o.ideal ?? 1, perWeek: o.perWeek };
  return {
    id: o.id,
    name: o.name,
    domain: o.domain,
    secondary: o.secondary ?? [],
    input: o.input,
    unit: o.input === 'minutes' ? 'min' : '',
    why: o.why,
    science: o.science,
    goalLink: o.domain === 'fitness' || o.domain === 'health' || o.domain === 'recovery' ? 'd90-health' : 'd90-personal',
    trigger: o.trigger,
    track: o.input === 'bool' ? 'One tap in the check-in.' : 'Enter minutes in the check-in.',
    minLabel: o.minLabel,
    idealLabel: o.idealLabel,
    estMinutes: { min: o.est[0], ideal: o.est[1] },
    difficulty: 2,
    impact: 3,
    unlock: o.unlock,
    targets: same(t),
    minimumMode: null,
    highBump: 0,
    redesign: { smaller: o.smaller, environment: 'Make the cue visible where the habit happens.', trigger: o.trigger },
    optional: true,
  };
}

const OPTIONAL_HABITS: HabitSpec[] = [
  optionalHabit({
    id: 'caffeine',
    name: 'Caffeine cut-off',
    domain: 'recovery',
    secondary: ['health'],
    input: 'bool',
    perWeek: 5,
    unlock: 2,
    why: 'Caffeine late in the day quietly shortens and lightens your sleep, even when you fall asleep fine.',
    science: 'Drake et al. 2013 (J Clin Sleep Med): caffeine taken 6 hours before bed still cut sleep by about an hour. Huberman also suggests waiting 90–120 min after waking for the first coffee.',
    trigger: 'Last coffee with lunch; after 2pm switch to decaf or water.',
    minLabel: 'None after 2pm',
    idealLabel: 'None after 2pm',
    est: [0, 0],
    smaller: 'Move the cut-off to 4pm first, then 2pm.',
  }),
  optionalHabit({
    id: 'news',
    name: 'Mindful news',
    domain: 'personal',
    secondary: ['recovery'],
    input: 'bool',
    perWeek: 5,
    unlock: 2,
    why: 'One deliberate news check keeps you informed without the stress and lost focus of constant checking.',
    science: 'Holman, Garfin & Silver 2014 (PNAS): hours of news exposure predicted acute stress more than being directly affected. Checking only after deep work protects your best focus hours.',
    trigger: 'One 10-minute check after your deep-work block; nothing in the hour before bed.',
    minLabel: 'One check, ≤10 min',
    idealLabel: 'One check, ≤10 min',
    est: [10, 10],
    smaller: 'Just no news before deep work.',
  }),
  optionalHabit({
    id: 'zone2',
    name: 'Zone 2 cardio',
    domain: 'fitness',
    secondary: ['health'],
    input: 'minutes',
    min: 20,
    ideal: 45,
    perWeek: 2,
    unlock: 3,
    why: 'Easy aerobic work (you can still talk in full sentences) builds the engine that recovery, energy and long-term health run on.',
    science: 'WHO/NHS: 150 min of moderate activity a week. Cardiorespiratory fitness is one of the strongest predictors of all-cause mortality (Mandsager et al. 2018, JAMA). Huberman suggests ~150–180 min/week of Zone 2.',
    trigger: 'Incline walk or easy bike straight after a lifting session, or a brisk walk home.',
    minLabel: '20 min easy',
    idealLabel: '45 min easy',
    est: [20, 45],
    smaller: '15 minutes of brisk walking counts.',
  }),
  optionalHabit({
    id: 'fermented',
    name: 'Fermented food',
    domain: 'health',
    input: 'bool',
    perWeek: 5,
    unlock: 3,
    why: 'A daily serving of fermented food supports a more diverse gut microbiome, which is linked to fewer illness setbacks.',
    science: 'Wastyk et al. 2021 (Cell, Stanford): a high-fermented-food diet increased microbiome diversity and lowered 19 inflammatory markers in 10 weeks.',
    trigger: 'Greek yoghurt or kefir with breakfast; kimchi or sauerkraut with dinner.',
    minLabel: '1 serving',
    idealLabel: '1–2 servings',
    est: [1, 2],
    smaller: 'A pot of yoghurt counts.',
  }),
  optionalHabit({
    id: 'nature',
    name: 'Time in nature',
    domain: 'recovery',
    secondary: ['personal'],
    input: 'minutes',
    min: 15,
    ideal: 30,
    perWeek: 4,
    unlock: 4,
    why: 'Green space lowers stress and improves mood — and it stacks with your daylight walk and Zone 2.',
    science: 'White et al. 2019 (Scientific Reports, ~20,000 people): 120+ minutes a week in nature was linked to better health and wellbeing; below that, no benefit.',
    trigger: 'Take the daylight walk or Zone 2 through a park or along water.',
    minLabel: '15 min outdoors',
    idealLabel: '30 min outdoors',
    est: [15, 30],
    smaller: 'Walk one green route you already pass.',
  }),
  optionalHabit({
    id: 'cold',
    name: 'Deliberate cold',
    domain: 'recovery',
    input: 'bool',
    perWeek: 3,
    unlock: 5,
    why: 'Short cold exposure raises alertness and mood for hours. Keep it away from training that you want to build muscle from.',
    science: 'Søberg et al. 2021 (Cell Reports Medicine): ~11 minutes of cold per week, split into short sessions. Huberman: avoid within ~4h after strength training, as it can blunt adaptation.',
    trigger: 'Last 1–3 minutes of the morning shower on cold.',
    minLabel: '1 min cold',
    idealLabel: '3 min cold',
    est: [1, 3],
    smaller: '30 seconds at the end of the shower.',
  }),
];


/** The built-in habit definitions. Use HABITS (built-ins with your edits, plus your own habits) everywhere else. */
export const BUILTIN_HABITS: HabitSpec[] = [
  {
    id: 'sleep',
    name: 'Sleep 7h+',
    domain: 'recovery',
    secondary: ['health'],
    input: 'hours',
    unit: 'h',
    why: 'Sleep is the multiplier on everything else: strength gains, fat loss, focus for study, mood and willpower. Poor sleep is the most common hidden cause of a collapsing routine.',
    goalLink: 'd90-health',
    trigger: 'Phone goes on charge outside the bedroom at a fixed time (e.g. 22:30).',
    track: 'Enter hours slept in the morning check-in (from a watch or best estimate).',
    minLabel: '7 hours',
    idealLabel: '8 hours',
    estMinutes: { min: 0, ideal: 0 },
    difficulty: 3,
    impact: 5,
    unlock: 1,
    targets: same({ min: 7, ideal: 8, perWeek: 7 }),
    minimumMode: { min: 6.5, ideal: 7.5, perWeek: 7 },
    highBump: 0,
    redesign: {
      smaller: 'Set one non-negotiable: lights out within 30 minutes of the same time every night — ignore duration for 2 weeks.',
      environment: 'Charger outside the bedroom, blackout curtains, room cool, caffeine cut-off at 14:00.',
      trigger: 'A recurring 21:45 "wind-down" alarm that starts the evening routine.',
    },
  },
  {
    id: 'morningWalk',
    name: 'Daylight walk',
    domain: 'recovery',
    secondary: ['health'],
    input: 'minutes',
    unit: 'min',
    why: 'Daylight early in the day sets your body clock: easier sleep, more daytime energy and better mood. Outdoor light is far brighter than indoor light, even when it is grey. In winter the mornings are dark, so any daylight before early afternoon counts.',
    goalLink: 'd90-health',
    trigger: 'Before work if it is light; otherwise a lunchtime walk outside. No sunglasses; cloudy days still count.',
    track: 'One tap in the check-in: 5, 10 or 15 minutes outside in daylight (before ~1pm).',
    minLabel: '5 minutes outside',
    idealLabel: '15 minutes outside',
    estMinutes: { min: 5, ideal: 15 },
    difficulty: 1,
    impact: 4,
    unlock: 1,
    targets: same({ min: 5, ideal: 15, perWeek: 7 }),
    minimumMode: { min: 5, ideal: 10, perWeek: 5 },
    highBump: 0,
    redesign: {
      smaller: 'Five minutes outside with a coffee at lunchtime — the light is what matters, not the distance.',
      environment: 'Coat by the door; a lunchtime walk blocked in the calendar for dark months.',
      trigger: 'Lunch bought / eaten → five minutes outside.',
    },
  },
  {
    id: 'train',
    name: 'Train',
    domain: 'fitness',
    secondary: ['health'],
    input: 'session',
    unit: 'min',
    why: 'Strength and physique compound like money. Consistent training is the backbone of physical excellence, energy and long-term health.',
    goalLink: 'd90-health',
    trigger: 'Gym bag packed the night before; train straight after work/morning routine at a fixed slot.',
    track: 'Automatic when you finish a workout in the Train tab. Otherwise log minutes in the check-in.',
    minLabel: '30 minutes',
    idealLabel: 'Full planned workout',
    estMinutes: { min: 30, ideal: 75 },
    difficulty: 2,
    impact: 5,
    unlock: 1,
    targets: {
      1: { min: 30, ideal: 60, perWeek: 3 },
      2: { min: 30, ideal: 60, perWeek: 4 },
      3: { min: 30, ideal: 60, perWeek: 4 },
      4: { min: 40, ideal: 70, perWeek: 4 },
      5: { min: 40, ideal: 70, perWeek: 5 },
      6: { min: 45, ideal: 75, perWeek: 5 },
    },
    // Training frequency holds at 3 even in heavy weeks: a short full-body session is the minimum version.
    minimumMode: { min: 25, ideal: 45, perWeek: 3 },
    highBump: 1,
    redesign: {
      smaller: 'On bad weeks, do a 25-minute full-body session (one squat/leg press, one push, one pull). It still counts.',
      environment: 'Gym within 10 minutes of home/work, bag in the car, workout pre-planned in the app.',
      trigger: 'Calendar-block the sessions on Sunday during the weekly review.',
    },
  },
  {
    id: 'steps',
    name: 'Steps',
    domain: 'health',
    secondary: ['recovery'],
    input: 'steps',
    unit: 'steps',
    why: 'Daily movement drives fat loss, cardiovascular health and recovery with almost no willpower cost. Office work quietly erodes it.',
    goalLink: 'd90-health',
    trigger: '10-minute walk after lunch and after dinner (your morning light walk adds ~1,500 more).',
    track: 'Copy the day\'s step count from your phone/watch into the check-in.',
    minLabel: '6,000',
    idealLabel: '10,000',
    estMinutes: { min: 20, ideal: 60 },
    difficulty: 1,
    impact: 4,
    unlock: 1,
    targets: {
      1: { min: 6000, ideal: 10000, perWeek: 7 },
      2: { min: 7000, ideal: 10000, perWeek: 7 },
      3: { min: 8000, ideal: 11000, perWeek: 7 },
      4: { min: 8000, ideal: 12000, perWeek: 7 },
      5: { min: 9000, ideal: 12000, perWeek: 7 },
      6: { min: 10000, ideal: 12500, perWeek: 7 },
    },
    minimumMode: { min: 5000, ideal: 8000, perWeek: 7 },
    highBump: 0,
    redesign: {
      smaller: 'One 10-minute walk after lunch. Nothing else required.',
      environment: 'Take calls walking; park further away; stairs by default.',
      trigger: 'Stand up from lunch → shoes on → walk.',
    },
  },
  {
    id: 'protein',
    name: 'Protein target',
    domain: 'health',
    secondary: ['fitness'],
    input: 'protein',
    unit: 'g',
    why: 'Protein is the single nutrition behaviour that most affects muscle, satiety and body composition. Easy to measure, high return.',
    goalLink: 'd90-health',
    trigger: 'Log it the moment you finish eating — phone out, + Food, one tap. A protein source planned into every meal (breakfast is the usual gap).',
    track: 'Tap + Food after each meal — the total and the result are calculated for you. (Or one tap in the check-in if you didn\'t log food.)',
    minLabel: '1.6 g/kg bodyweight',
    idealLabel: '2.0 g/kg bodyweight',
    estMinutes: { min: 5, ideal: 10 },
    difficulty: 2,
    impact: 4,
    unlock: 1,
    targets: {
      1: { min: 1, ideal: 2, perWeek: 5 },
      2: { min: 1, ideal: 2, perWeek: 6 },
      3: { min: 1, ideal: 2, perWeek: 6 },
      4: { min: 1, ideal: 2, perWeek: 6 },
      5: { min: 1, ideal: 2, perWeek: 7 },
      6: { min: 1, ideal: 2, perWeek: 7 },
    },
    minimumMode: { min: 1, ideal: 2, perWeek: 4 },
    highBump: 1,
    redesign: {
      smaller: 'Fix breakfast only: the same high-protein breakfast every weekday (e.g. Greek yoghurt + whey).',
      environment: 'Keep ready-to-eat protein at work and at home (yoghurt, shakes, cooked chicken).',
      trigger: 'Weekly shop list auto-includes protein staples.',
    },
  },
  {
    id: 'deepWork',
    name: 'Deep work / study',
    domain: 'career',
    secondary: ['learning'],
    input: 'minutes',
    unit: 'min',
    why: 'ACCA, Excel, modelling and AI skills are what raise your earning power — the engine of financial freedom. Focused minutes, not hours "at a desk", build them.',
    goalLink: 'd90-career',
    trigger: 'Same slot every day (e.g. first 25 min after getting home, before phone), materials left open the night before.',
    track: 'Enter focused minutes (timer-based, no phone) in the check-in.',
    minLabel: '25 minutes',
    idealLabel: '60 minutes',
    estMinutes: { min: 25, ideal: 60 },
    difficulty: 3,
    impact: 5,
    unlock: 1,
    targets: {
      1: { min: 25, ideal: 60, perWeek: 5 },
      2: { min: 30, ideal: 75, perWeek: 5 },
      3: { min: 45, ideal: 90, perWeek: 5 },
      4: { min: 60, ideal: 120, perWeek: 5 },
      5: { min: 60, ideal: 120, perWeek: 6 },
      6: { min: 75, ideal: 150, perWeek: 6 },
    },
    minimumMode: { min: 15, ideal: 30, perWeek: 3 },
    highBump: 1,
    redesign: {
      smaller: 'One 15-minute Pomodoro on a single pre-chosen topic. Stop when the timer rings if you want.',
      environment: 'Study materials open on the desk, phone in another room, one tab only.',
      trigger: 'Tomorrow\'s study topic is written as item #1 in the evening plan.',
    },
  },
  {
    id: 'plan',
    name: 'Plan tomorrow',
    domain: 'personal',
    secondary: ['career'],
    input: 'tri',
    unit: '',
    why: 'Two minutes of planning removes decisions from tomorrow, which is where most habits die. It links weekly goals to daily actions.',
    goalLink: 'd90-personal',
    trigger: 'Immediately after dinner (or when you shut the laptop).',
    track: 'One tap: missed / top 3 written (min) / top 3 + time-blocked (ideal).',
    minLabel: 'Write tomorrow\'s top 3',
    idealLabel: 'Top 3 + time-blocked calendar',
    estMinutes: { min: 2, ideal: 10 },
    difficulty: 1,
    impact: 4,
    unlock: 1,
    targets: {
      1: { min: 1, ideal: 2, perWeek: 5 },
      2: { min: 1, ideal: 2, perWeek: 6 },
      3: { min: 1, ideal: 2, perWeek: 6 },
      4: { min: 1, ideal: 2, perWeek: 6 },
      5: { min: 1, ideal: 2, perWeek: 6 },
      6: { min: 1, ideal: 2, perWeek: 7 },
    },
    minimumMode: { min: 1, ideal: 2, perWeek: 3 },
    highBump: 1,
    redesign: {
      smaller: 'Write only ONE thing that would make tomorrow a win.',
      environment: 'A notepad and pen permanently on the desk/kitchen counter.',
      trigger: 'Closing the laptop lid = write the list.',
    },
  },
  {
    id: 'moneyReview',
    name: 'Weekly money check',
    domain: 'finance',
    secondary: [],
    input: 'bool',
    unit: '',
    why: 'Financial freedom is built on awareness. Ten minutes a week keeps spending intentional and makes the monthly snapshot effortless.',
    goalLink: 'd90-fin',
    trigger: 'Sunday weekly review, before planning next week.',
    track: 'Tick it in the check-in, or it ticks itself when you update a finance snapshot.',
    minLabel: 'Check balances + last week\'s spending',
    idealLabel: '…and update the monthly snapshot',
    estMinutes: { min: 5, ideal: 15 },
    difficulty: 1,
    impact: 4,
    unlock: 1,
    targets: same({ min: 1, ideal: 1, perWeek: 1 }),
    minimumMode: { min: 1, ideal: 1, perWeek: 1 },
    highBump: 0,
    redesign: {
      smaller: 'Open your banking app and read one number: this week\'s total spend.',
      environment: 'Banking apps on the home screen; one spreadsheet/app for balances.',
      trigger: 'Sunday coffee = money check.',
    },
  },
  // ---------- Unlocked by progression (not active in V1.0) ----------
  {
    id: 'read',
    name: 'Read',
    domain: 'learning',
    secondary: ['personal'],
    input: 'tri',
    unit: '',
    why: 'Reading compounds knowledge (finance, business, psychology) and replaces low-value evening screen time.',
    goalLink: 'd90-career',
    trigger: 'Immediately after brushing teeth, book on the pillow.',
    track: 'One tap: missed / 2 pages (min) / 20 minutes (ideal).',
    minLabel: '2 pages',
    idealLabel: '20 minutes',
    estMinutes: { min: 3, ideal: 20 },
    difficulty: 1,
    impact: 3,
    unlock: 2,
    targets: {
      1: { min: 1, ideal: 2, perWeek: 5 },
      2: { min: 1, ideal: 2, perWeek: 5 },
      3: { min: 1, ideal: 2, perWeek: 5 },
      4: { min: 1, ideal: 2, perWeek: 6 },
      5: { min: 1, ideal: 2, perWeek: 6 },
      6: { min: 1, ideal: 2, perWeek: 6 },
    },
    minimumMode: null,
    highBump: 1,
    redesign: {
      smaller: 'One page. Put the book on the pillow every morning.',
      environment: 'Kindle/book by the bed, phone charging elsewhere.',
      trigger: 'Brush teeth → read.',
    },
  },
  {
    id: 'mobility',
    name: 'Mobility / prehab',
    domain: 'fitness',
    secondary: ['recovery'],
    input: 'minutes',
    unit: 'min',
    why: 'Keeps you training for decades. Cheap insurance against the injuries that break consistency.',
    goalLink: 'd90-health',
    trigger: 'Straight after the training warm-up, or while the kettle boils.',
    track: 'Enter minutes in the check-in.',
    minLabel: '5 minutes',
    idealLabel: '15 minutes',
    estMinutes: { min: 5, ideal: 15 },
    difficulty: 1,
    impact: 3,
    unlock: 3,
    targets: {
      1: { min: 5, ideal: 15, perWeek: 3 },
      2: { min: 5, ideal: 15, perWeek: 3 },
      3: { min: 5, ideal: 15, perWeek: 3 },
      4: { min: 5, ideal: 15, perWeek: 4 },
      5: { min: 10, ideal: 20, perWeek: 4 },
      6: { min: 10, ideal: 20, perWeek: 5 },
    },
    minimumMode: null,
    highBump: 1,
    redesign: {
      smaller: 'Two exercises (hip flexor + thoracic) for 2 minutes each.',
      environment: 'Band and mat left out in the living room.',
      trigger: 'TV on → floor.',
    },
  },
  {
    id: 'connect',
    name: 'Meaningful connection',
    domain: 'relationships',
    secondary: ['personal'],
    input: 'bool',
    unit: '',
    why: 'Relationships are part of the life you are building — and a buffer against stress. Easy to neglect during career-building years.',
    goalLink: 'd90-rel',
    trigger: 'Pre-scheduled: a weekly call, a regular meal, a training partner.',
    track: 'Tick when you spend real, present time with someone who matters.',
    minLabel: 'A real conversation (call/meal)',
    idealLabel: 'Quality time in person',
    estMinutes: { min: 15, ideal: 90 },
    difficulty: 2,
    impact: 4,
    unlock: 4,
    targets: same({ min: 1, ideal: 1, perWeek: 3 }),
    minimumMode: { min: 1, ideal: 1, perWeek: 1 },
    highBump: 0,
    redesign: {
      smaller: 'Send one voice note to someone you care about.',
      environment: 'Recurring calendar slots with friends/family.',
      trigger: 'Commute home = call someone.',
    },
  },
  {
    id: 'shutdown',
    name: 'Screen shutdown',
    domain: 'recovery',
    secondary: ['personal'],
    input: 'tri',
    unit: '',
    why: 'Late screens delay sleep and steal the time for reading, planning and people.',
    goalLink: 'd90-health',
    trigger: 'Wind-down alarm → phone on charger outside bedroom.',
    track: 'One tap: missed / 15 min screen-free before bed (min) / 45 min (ideal).',
    minLabel: '15 min screen-free before bed',
    idealLabel: '45 min screen-free',
    estMinutes: { min: 0, ideal: 0 },
    difficulty: 3,
    impact: 3,
    unlock: 4,
    targets: {
      1: { min: 1, ideal: 2, perWeek: 4 },
      2: { min: 1, ideal: 2, perWeek: 4 },
      3: { min: 1, ideal: 2, perWeek: 4 },
      4: { min: 1, ideal: 2, perWeek: 4 },
      5: { min: 1, ideal: 2, perWeek: 5 },
      6: { min: 1, ideal: 2, perWeek: 5 },
    },
    minimumMode: null,
    highBump: 1,
    redesign: {
      smaller: 'Phone out of the bedroom — that is the whole habit.',
      environment: 'Charger in the hallway; app limits after 22:00.',
      trigger: 'Wind-down alarm.',
    },
  },
  {
    id: 'journal',
    name: 'Journal',
    domain: 'personal',
    secondary: [],
    input: 'tri',
    unit: '',
    why: 'Turns experience into lessons and catches drift early. Useful once the foundation is automatic.',
    goalLink: 'd90-personal',
    trigger: 'Right after planning tomorrow.',
    track: 'One tap: missed / one line (min) / 5-minute reflection (ideal).',
    minLabel: 'One line',
    idealLabel: '5-minute reflection',
    estMinutes: { min: 1, ideal: 5 },
    difficulty: 1,
    impact: 2,
    unlock: 5,
    targets: same({ min: 1, ideal: 2, perWeek: 5 }),
    minimumMode: null,
    highBump: 0,
    redesign: {
      smaller: 'Answer one question: "What worked today?"',
      environment: 'Journal on top of the planning notepad.',
      trigger: 'Plan written → one line.',
    },
  },
  {
    id: 'calories',
    name: 'Calorie awareness',
    domain: 'health',
    secondary: ['fitness'],
    input: 'calories',
    unit: 'kcal',
    why: 'Once protein is automatic, calories are the next lever for body composition. Built on the same food log, so it adds almost no effort.',
    goalLink: 'd90-health',
    trigger: 'Same as protein: log food straight after eating.',
    track: 'Automatic from the food log. First 2 weeks: just log (awareness). Then a target range set from your own intake and weight trend.',
    minLabel: 'Within ±250 kcal of target',
    idealLabel: 'Within ±100 kcal',
    estMinutes: { min: 2, ideal: 5 },
    difficulty: 3,
    impact: 4,
    // Unlocked by protein consistency, not by level — see calorieUnlockStatus().
    unlock: 1,
    targets: same({ min: 250, ideal: 100, perWeek: 5 }),
    minimumMode: null,
    highBump: 1,
    redesign: {
      smaller: 'Log calories on weekdays only — weekends are awareness, not scored.',
      environment: 'Save your regular meals as single foods so logging is one tap.',
      trigger: 'Plate down → + Food.',
    },
  },
  {
    id: 'vitamins',
    name: 'Supplements',
    domain: 'health',
    secondary: ['recovery'],
    input: 'bool',
    unit: '',
    why: 'Fewer setbacks from illness and better training. Strongest evidence: vitamin D3 (the NHS advises 10µg/day for everyone in the UK from October to March; it modestly reduces respiratory infections in people who are low) and creatine monohydrate 3–5g/day (strength and training progress). Check with a pharmacist if you take medication.',
    goalLink: 'd90-health',
    trigger: 'Bottles next to the kettle — take them with breakfast.',
    track: 'One tap in the check-in.',
    minLabel: 'Taken today',
    idealLabel: 'Taken today',
    estMinutes: { min: 1, ideal: 1 },
    difficulty: 1,
    impact: 3,
    unlock: 1,
    targets: same({ min: 1, ideal: 1, perWeek: 7 }),
    minimumMode: { min: 1, ideal: 1, perWeek: 5 },
    highBump: 0,
    redesign: {
      smaller: 'Move the bottles to wherever you already are every morning (next to the kettle or your toothbrush).',
      environment: 'A weekly pill organiser removes the "did I take them?" question.',
      trigger: 'Kettle on → supplements.',
    },
  },
  ...OPTIONAL_HABITS,
];

/**
 * The live habit list: built-ins with your edits applied, followed by habits you created.
 * Rebuilt by applyHabitConfig() whenever the profile is loaded (buildContext calls it), so every screen
 * and calculation sees the same list.
 */
export const HABITS: HabitSpec[] = [...BUILTIN_HABITS];
export const HABIT_BY_ID = new Map<HabitId, HabitSpec>(HABITS.map((h) => [h.id, h]));

export function customToSpec(c: CustomHabitDef): HabitSpec {
  const t = { min: c.min, ideal: c.ideal, perWeek: c.perWeek };
  const lbl = (x: number) => (c.input === 'bool' ? 'Done' : c.input === 'minutes' ? `${x} min` : `${x} ${c.unit}`.trim());
  return {
    id: c.id,
    name: c.name,
    domain: c.domain,
    secondary: [],
    input: c.input,
    unit: c.input === 'minutes' ? 'min' : c.unit,
    why: c.why || 'Your own habit.',
    goalLink: c.goalLink,
    trigger: c.trigger || 'Set a cue: "After I …, I will …".',
    track: c.input === 'bool' ? 'One tap in the check-in.' : `Enter ${c.input === 'minutes' ? 'minutes' : c.unit || 'the number'} in the check-in.`,
    minLabel: lbl(c.min),
    idealLabel: lbl(c.ideal),
    estMinutes: c.input === 'minutes' ? { min: c.min, ideal: c.ideal } : { min: 2, ideal: 5 },
    difficulty: 2,
    impact: 3,
    unlock: 1,
    targets: same(t),
    minimumMode: { min: c.min, ideal: c.ideal, perWeek: Math.max(1, c.perWeek - 2) },
    highBump: 0,
    redesign: { smaller: `Shrink it: the smallest version of "${c.name}" you could do on your worst day.`, environment: 'Make it obvious and easy where you already are.', trigger: c.trigger || 'Attach it to something you already do daily.' },
    startDate: c.startDate,
    custom: true,
  };
}

/** Rebuild HABITS / HABIT_BY_ID from the profile (edits to built-ins + your own habits). */
export function applyHabitConfig(profile: Pick<LifeProfile, 'habitOverrides' | 'customHabits'>): void {
  const built = BUILTIN_HABITS.map((h) => {
    const o = profile.habitOverrides?.[h.id];
    if (!o) return h;
    return {
      ...h,
      name: o.name || h.name,
      trigger: o.trigger || h.trigger,
      why: o.why || h.why,
      ...(o.startDate ? { startDate: o.startDate } : {}),
      ...(o.targets ? { targets: same(o.targets), minimumMode: h.minimumMode && { ...o.targets, perWeek: Math.min(o.targets.perWeek, h.minimumMode.perWeek) } } : {}),
    };
  });
  const list = [...built, ...(profile.customHabits ?? []).map(customToSpec)];
  HABITS.splice(0, HABITS.length, ...list);
  HABIT_BY_ID.clear();
  for (const h of list) HABIT_BY_ID.set(h.id, h);
}

export const CORE_V1: HabitId[] = ['sleep', 'morningWalk', 'train', 'steps', 'protein', 'deepWork', 'plan', 'moneyReview', 'vitamins'];

export const LEVELS: { level: Level; name: string; summary: string; unlocks: HabitId[] }[] = [
  { level: 1, name: 'Foundation', summary: 'A handful of small habits. Win by showing up, not by intensity.', unlocks: CORE_V1 },
  { level: 2, name: 'Consistency', summary: 'Train 4x/week, slightly longer study blocks, add 2 pages of reading. Optional: caffeine cut-off, mindful news.', unlocks: ['read'] },
  { level: 3, name: 'Momentum', summary: '45-minute study minimum, 8k steps, add mobility/prehab. Optional: Zone 2, fermented food.', unlocks: ['mobility'] },
  { level: 4, name: 'Expansion', summary: 'Hour-long deep work, add relationships and an evening screen shutdown. Optional: time in nature.', unlocks: ['connect', 'shutdown'] },
  { level: 5, name: 'High Performance', summary: '5 training days, 6 study days, protein daily, add journaling. Optional: deliberate cold.', unlocks: ['journal'] },
  { level: 6, name: 'Elite Lifestyle', summary: 'Sustained high standards on autopilot. Elite means durable, not more.', unlocks: [] },
];

export const DOMAIN_LABELS: Record<Domain, string> = {
  health: 'Health',
  fitness: 'Fitness',
  career: 'Career',
  learning: 'Learning',
  finance: 'Finance',
  personal: 'Personal dev',
  relationships: 'Relationships',
  recovery: 'Recovery',
  consistency: 'Consistency',
};

export const MODE_LABELS: Record<Mode, string> = {
  minimum: 'Minimum Mode',
  normal: 'Normal Mode',
  high: 'High-Performance Mode',
};

/** Is the habit part of the system? Calories unlock by protein consistency (profile.calorie.unlockedAt), everything else by level. */
export function isUnlocked(spec: HabitSpec, level: Level, profile: Pick<LifeProfile, 'calorie' | 'optIn'>, date?: string): boolean {
  if (spec.startDate && date && date < spec.startDate) return false;
  if (spec.optional) {
    const at = profile.optIn?.[spec.id];
    return spec.unlock <= level && !!at && (!date || date >= at);
  }
  if (spec.id === 'calories') {
    const at = profile.calorie?.unlockedAt;
    return !!at && (!date || date >= at);
  }
  return spec.unlock <= level;
}

export type HabitState = 'active' | 'paused' | 'trackOnly' | 'removed' | 'upcoming';

/** Removed / track-only on a date (dated, so history before a change keeps its score). */
export function offOn(profile: Pick<LifeProfile, 'habitStatus'>, id: HabitId, date: string): 'removed' | 'trackOnly' | null {
  const st = profile.habitStatus?.[id];
  if (!st) return null;
  if (st.state !== 'active' && date >= st.from) return st.state;
  return st.past?.find((p) => date >= p.from && date < p.to)?.state ?? null;
}

export function habitState(profile: Pick<LifeProfile, 'habitStatus' | 'pausedHabits'>, spec: HabitSpec, date: string): HabitState {
  const off = offOn(profile, spec.id, date);
  if (off) return off;
  if (spec.startDate && date < spec.startDate) return 'upcoming';
  return profile.pausedHabits.includes(spec.id) ? 'paused' : 'active';
}

/** New status map entry for a change made today. */
export function withStatus(profile: Pick<LifeProfile, 'habitStatus'>, id: HabitId, state: 'removed' | 'trackOnly' | 'active', today: string): NonNullable<LifeProfile['habitStatus']> {
  const map = { ...(profile.habitStatus ?? {}) };
  const cur = map[id];
  const past = [...(cur?.past ?? [])];
  if (cur && cur.state !== 'active' && cur.from < today) past.push({ state: cur.state, from: cur.from, to: today });
  if (state === 'active' && !past.length) delete map[id];
  else map[id] = { state, from: today, ...(past.length ? { past } : {}) };
  return map;
}

export function activeHabits(profile: Pick<LifeProfile, 'calorie' | 'level' | 'pausedHabits' | 'habitStatus'>, date?: string): HabitSpec[] {
  return HABITS.filter((h) => isUnlocked(h, profile.level, profile, date) && !profile.pausedHabits.includes(h.id) && !(date && offOn(profile, h.id, date)));
}

export type StatusAction = 'active' | 'paused' | 'trackOnly' | 'removed';

/** Change one habit's status. Pauses live in pausedHabits; removed / track-only are dated so history keeps its score. */
export function statusPatch(profile: LifeProfile, id: HabitId, to: StatusAction, today: string): Partial<LifeProfile> {
  const paused = profile.pausedHabits.filter((x) => x !== id);
  if (to === 'paused') return { pausedHabits: [...paused, id], habitStatus: withStatus(profile, id, 'active', today) };
  return { pausedHabits: paused, habitStatus: withStatus(profile, id, to, today) };
}

/** Is the habit switched off today (paused, removed or track-only)? */
export const isOff = (profile: Pick<LifeProfile, 'habitStatus' | 'pausedHabits'>, id: HabitId, date: string) => profile.pausedHabits.includes(id) || !!offOn(profile, id, date);

/** Scored-habit cap: 8 at Level 1, +1 per level — more than this and adherence drops for all of them. */
export const habitCap = (level: number) => 8 + (level - 1);

export interface TargetExtras {
  protein?: { min: number; ideal: number };
  /** null = calorie awareness phase (no target yet). */
  calorieTarget?: number | null;
}

/** Targets for a habit given level and mode. `null` means not scheduled in this mode. */
export function targetFor(spec: HabitSpec, level: Level, mode: Mode): LevelTarget | null {
  const base = spec.targets[level];
  if (mode === 'minimum') return spec.minimumMode;
  if (mode === 'high') return { ...base, perWeek: Math.min(7, base.perWeek + spec.highBump) };
  return base;
}

export function formatTarget(spec: HabitSpec, t: LevelTarget, extras: TargetExtras = {}): { min: string; ideal: string } {
  switch (spec.input) {
    case 'protein':
      return extras.protein ? { min: `${extras.protein.min}g`, ideal: `${extras.protein.ideal}g` } : { min: spec.minLabel, ideal: spec.idealLabel };
    case 'count':
      return { min: `${t.min} ${spec.unit}`.trim(), ideal: `${t.ideal} ${spec.unit}`.trim() };
    case 'calories':
      if (extras.calorieTarget == null) return { min: 'Log calories (awareness)', ideal: 'Log every meal' };
      return { min: `${extras.calorieTarget - t.min}–${extras.calorieTarget + t.min} kcal`, ideal: `${extras.calorieTarget} ±${t.ideal}` };
    case 'hours':
      return { min: `${t.min}h`, ideal: `${t.ideal}h` };
    case 'minutes':
    case 'session':
      return { min: `${t.min} min`, ideal: spec.input === 'session' ? `Full workout (~${t.ideal} min)` : `${t.ideal} min` };
    case 'steps':
      return { min: t.min.toLocaleString(), ideal: t.ideal.toLocaleString() };
    default:
      return { min: spec.minLabel, ideal: spec.idealLabel };
  }
}

export function frequencyLabel(perWeek: number): string {
  return perWeek >= 7 ? 'Daily' : `${perWeek}x / week`;
}
