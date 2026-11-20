import type { LifeOsDB } from './db';
import type { Category, DashboardCard, DateStr, Difficulty, Frequency, Horizon, Measurement, Profile, Settings, TimeOfDay, XpConfig } from './types';

export const BUILTIN_CATEGORIES: Omit<Category, 'order' | 'archived' | 'builtin'>[] = [
  { id: 'career', name: 'Career & Professional', color: '#6e7bff', icon: 'Briefcase' },
  { id: 'finance', name: 'Finance & Wealth', color: '#2fb67c', icon: 'Wallet' },
  { id: 'health', name: 'Health & Fitness', color: '#ef6461', icon: 'HeartPulse' },
  { id: 'education', name: 'Education & Knowledge', color: '#e0a33b', icon: 'GraduationCap' },
  { id: 'relationships', name: 'Relationships & Family', color: '#d1679e', icon: 'Users' },
  { id: 'personal', name: 'Personal Development', color: '#9a7bf0', icon: 'Sprout' },
  { id: 'lifestyle', name: 'Lifestyle & Experiences', color: '#3aa9d9', icon: 'Compass' },
  { id: 'business', name: 'Business & Entrepreneurship', color: '#d9773a', icon: 'Rocket' },
];

export const CATEGORY_COLORS = ['#6e7bff', '#2fb67c', '#ef6461', '#e0a33b', '#d1679e', '#9a7bf0', '#3aa9d9', '#d9773a', '#7d8a99', '#4fb3a9'];

export const DEFAULT_XP: XpConfig = {
  taskEasy: 10,
  taskMedium: 20,
  taskHard: 35,
  habitEasy: 5,
  habitMedium: 10,
  habitHard: 15,
  milestone: 100,
  majorMilestone: 250,
  goal: 500,
  weeklyReview: 50,
  consistencyWeek: 75,
  focusPer25: 5,
  dailyTaskCap: 150,
  dailyFocusCap: 40,
};

export const DASHBOARD_CARDS: { id: DashboardCard; label: string; advanced: boolean }[] = [
  { id: 'overview', label: 'Daily overview', advanced: false },
  { id: 'priorities', label: 'Daily priorities (MITs)', advanced: false },
  { id: 'habits', label: "Today's habits", advanced: false },
  { id: 'goals', label: 'Goal progression', advanced: false },
  { id: 'schedule', label: "Today's schedule", advanced: true },
  { id: 'week', label: 'Weekly overview', advanced: true },
  { id: 'insights', label: 'Performance insights', advanced: true },
];

export function defaultSettings(): Settings {
  return {
    id: 'settings',
    theme: 'system',
    dayStartHour: 4,
    dailyFocusTargetMin: 90,
    xp: { ...DEFAULT_XP },
    levelPace: 1,
    dashboard: { overview: true, priorities: true, habits: true, goals: true, schedule: true, week: true, insights: true },
    dashboardOrder: DASHBOARD_CARDS.map((c) => c.id),
    reduceMotion: false,
    haptics: true,
    showAdvanced: false,
    workdayStart: '09:00',
    workdayEnd: '17:30',
    lock: { enabled: false, salt: '', hash: '', timeoutMin: 5 },
    ai: { provider: 'none', apiKey: '', model: 'claude-opus-5-5' },
    lastBackupAt: null,
  };
}

export function defaultProfile(today: DateStr): Profile {
  return { id: 'me', name: '', onboarded: false, createdAt: Date.now(), startDate: today, celebratedLevel: 1, quiz: null };
}

/** Creates the profile, settings and built-in categories if they don't exist yet. Safe to call on every start. */
export async function ensureBase(db: LifeOsDB, today: DateStr) {
  await db.transaction('rw', [db.profile, db.settings, db.categories], async () => {
    if (!(await db.profile.get('me'))) await db.profile.put(defaultProfile(today));
    const s = await db.settings.get('settings');
    if (!s) await db.settings.put(defaultSettings());
    else {
      // Forward-compatible: fill any settings keys added in later versions.
      const d = defaultSettings();
      const merged = { ...d, ...s, xp: { ...d.xp, ...s.xp }, dashboard: { ...d.dashboard, ...s.dashboard }, lock: { ...d.lock, ...s.lock }, ai: { ...d.ai, ...s.ai } };
      const order = [...s.dashboardOrder.filter((c) => c in d.dashboard), ...d.dashboardOrder.filter((c) => !s.dashboardOrder.includes(c))];
      merged.dashboardOrder = order;
      if (JSON.stringify(merged) !== JSON.stringify(s)) await db.settings.put(merged);
    }
    if ((await db.categories.count()) === 0) {
      await db.categories.bulkPut(BUILTIN_CATEGORIES.map((c, i) => ({ ...c, order: i, builtin: true, archived: false })));
    }
  });
}

// ───────────────────────────── Onboarding library ─────────────────────────────

export interface GoalTemplate {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  horizon: Horizon;
  measurement: Measurement;
  unit?: string;
  startValue?: number;
  targetValue?: number;
  /** Months from today for the default target date. */
  months: number;
  difficulty: Difficulty;
  milestones: string[];
  habitIds: string[];
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  // Career
  { id: 'qualification', categoryId: 'career', title: 'Complete a professional qualification', description: 'Finish the remaining exams and requirements to become fully qualified.', horizon: 'annual', measurement: 'milestones', months: 18, difficulty: 'hard', milestones: ['Map out the remaining exams and requirements', 'Pass the next exam', 'Complete the ethics / professional skills module', 'Log the required practical experience', 'Submit for membership'], habitIds: ['study', 'industry-reading'] },
  { id: 'promotion', categoryId: 'career', title: 'Earn a promotion', description: 'Build the skills, visibility and track record for the next role.', horizon: 'annual', measurement: 'milestones', months: 12, difficulty: 'medium', milestones: ['Agree the criteria for the next role with your manager', 'Lead one visible project end to end', 'Close the main skills gap', 'Gather evidence and feedback', 'Have the promotion conversation'], habitIds: ['deep-work', 'industry-reading'] },
  { id: 'career-change', categoryId: 'career', title: 'Move into a new career', description: 'Research, retrain and land a role in a new field.', horizon: 'annual', measurement: 'milestones', months: 12, difficulty: 'hard', milestones: ['Choose the target role', 'Speak to five people in the field', 'Complete the core training', 'Build a portfolio or evidence', 'Apply for ten roles'], habitIds: ['study'] },
  // Finance
  { id: 'savings', categoryId: 'finance', title: 'Build £20,000 in savings', description: 'A solid cash buffer and a base for investing.', horizon: 'annual', measurement: 'numeric', unit: '£', startValue: 0, targetValue: 20000, months: 24, difficulty: 'hard', milestones: ['Set up an automatic monthly transfer', 'Reach a one-month emergency fund', 'Reach £10,000'], habitIds: ['track-spending', 'no-spend'] },
  { id: 'debt', categoryId: 'finance', title: 'Become debt-free', description: 'Clear all consumer debt.', horizon: 'annual', measurement: 'numeric', unit: '£ remaining', startValue: 5000, targetValue: 0, months: 18, difficulty: 'medium', milestones: ['List every debt with its rate', 'Clear the highest-interest debt', 'Close unused credit lines'], habitIds: ['track-spending'] },
  { id: 'invest', categoryId: 'finance', title: 'Start investing regularly', description: 'Build a long-term, diversified portfolio.', horizon: 'annual', measurement: 'milestones', months: 6, difficulty: 'easy', milestones: ['Open an ISA / pension account', 'Choose a simple diversified fund', 'Automate a monthly contribution', 'Review after three months'], habitIds: ['review-investments'] },
  // Health
  { id: 'body-comp', categoryId: 'health', title: 'Reach a target body composition', description: 'Get leaner and stronger with consistent training and nutrition.', horizon: 'annual', measurement: 'numeric', unit: 'kg', startValue: 85, targetValue: 78, months: 9, difficulty: 'hard', milestones: ['Baseline measurements and photos', 'Eight weeks of consistent training', 'Halfway to target', 'Target reached and held for a month'], habitIds: ['exercise', 'nutrition', 'sleep'] },
  { id: 'run', categoryId: 'health', title: 'Run a half marathon', description: 'Train progressively and finish a half marathon.', horizon: 'quarterly', measurement: 'milestones', months: 5, difficulty: 'medium', milestones: ['Run 5k without stopping', 'Run 10k', 'Enter a race', 'Run 18k in training', 'Finish the race'], habitIds: ['exercise', 'sleep'] },
  { id: 'energy', categoryId: 'health', title: 'Sleep and feel better', description: 'Consistent sleep, more energy and lower stress.', horizon: 'quarterly', measurement: 'milestones', months: 3, difficulty: 'easy', milestones: ['Fix a consistent wake time', 'Two weeks of 7h+ sleep', 'Cut caffeine after 2pm'], habitIds: ['sleep', 'water', 'walk'] },
  // Education
  { id: 'books', categoryId: 'education', title: 'Read 20 books this year', description: 'Read widely and keep notes on what you learn.', horizon: 'annual', measurement: 'numeric', unit: 'books', startValue: 0, targetValue: 20, months: 12, difficulty: 'medium', milestones: ['Pick the first five books', 'Finish 5 books', 'Finish 10 books', 'Finish 15 books'], habitIds: ['read'] },
  { id: 'course', categoryId: 'education', title: 'Complete an online course', description: 'Finish a structured course and apply what you learn.', horizon: 'quarterly', measurement: 'milestones', months: 3, difficulty: 'medium', milestones: ['Enrol and plan the schedule', 'Complete the first half', 'Finish the course', 'Build one project using it'], habitIds: ['study'] },
  { id: 'language', categoryId: 'education', title: 'Learn a new language', description: 'Reach conversational level.', horizon: 'annual', measurement: 'milestones', months: 12, difficulty: 'hard', milestones: ['Learn the 500 most common words', 'Hold a 10-minute conversation', 'Pass a beginner exam'], habitIds: ['practise-skill'] },
  // Relationships
  { id: 'family-time', categoryId: 'relationships', title: 'Be more present with family', description: 'Protected, regular time with the people who matter.', horizon: 'quarterly', measurement: 'milestones', months: 3, difficulty: 'easy', milestones: ['Agree a weekly family evening', 'Plan one day out a month', 'Phone-free dinners for a month'], habitIds: ['connect'] },
  { id: 'friendships', categoryId: 'relationships', title: 'Strengthen friendships', description: 'Stay in touch and make plans regularly.', horizon: 'quarterly', measurement: 'milestones', months: 3, difficulty: 'easy', milestones: ['List the friends you want to see more', 'Arrange a meet-up every fortnight', 'Plan a trip together'], habitIds: ['connect'] },
  // Personal development
  { id: 'discipline', categoryId: 'personal', title: 'Build a consistent daily routine', description: 'A morning and evening routine that sticks.', horizon: 'quarterly', measurement: 'milestones', months: 3, difficulty: 'medium', milestones: ['Design the routine', 'Two consistent weeks', 'Six consistent weeks', 'Twelve consistent weeks'], habitIds: ['plan-tomorrow', 'journal'] },
  { id: 'confidence', categoryId: 'personal', title: 'Become a confident public speaker', description: 'Present clearly and calmly.', horizon: 'annual', measurement: 'milestones', months: 9, difficulty: 'hard', milestones: ['Join a speaking group', 'Give a five-minute talk', 'Present at work', 'Speak at an event'], habitIds: ['practise-skill'] },
  // Lifestyle
  { id: 'travel', categoryId: 'lifestyle', title: 'Take a meaningful trip', description: 'Plan and take a trip you have wanted to do for years.', horizon: 'annual', measurement: 'milestones', months: 9, difficulty: 'easy', milestones: ['Choose the destination and budget', 'Save the travel fund', 'Book travel and accommodation', 'Go'], habitIds: [] },
  { id: 'home', categoryId: 'lifestyle', title: 'Create a home you love', description: 'Declutter, organise and improve your space.', horizon: 'quarterly', measurement: 'milestones', months: 4, difficulty: 'easy', milestones: ['Declutter every room', 'Fix the long-standing jobs', 'Finish one improvement project'], habitIds: [] },
  // Business
  { id: 'side-business', categoryId: 'business', title: 'Launch a side business', description: 'Validate an idea and get the first paying customers.', horizon: 'annual', measurement: 'milestones', months: 9, difficulty: 'hard', milestones: ['Pick and validate the idea', 'Build the first version', 'Get the first paying customer', 'Reach £1,000 in revenue'], habitIds: ['deep-work'] },
  { id: 'revenue', categoryId: 'business', title: 'Grow business revenue', description: 'Reach a monthly revenue target.', horizon: 'annual', measurement: 'numeric', unit: '£/month', startValue: 0, targetValue: 5000, months: 12, difficulty: 'hard', milestones: ['Fix the sales pipeline', 'Reach half the target', 'Hire or outsource the first role'], habitIds: ['deep-work'] },
];

export interface HabitTemplate {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  frequency: Frequency;
  target: number;
  unit: string;
  timeOfDay: TimeOfDay;
  difficulty: Difficulty;
  minimumVersion: string;
}

const daily: Frequency = { type: 'daily', days: [], timesPerWeek: 7, everyDays: 1 };
const weekdays: Frequency = { type: 'weekdays', days: [1, 2, 3, 4, 5], timesPerWeek: 5, everyDays: 1 };
const xPerWeek = (n: number): Frequency => ({ type: 'weekly', days: [], timesPerWeek: n, everyDays: 1 });

export const HABIT_TEMPLATES: HabitTemplate[] = [
  { id: 'sleep', name: 'Sleep 7–9 hours', description: 'Consistent bed and wake times.', categoryId: 'health', frequency: daily, target: 1, unit: '', timeOfDay: 'evening', difficulty: 'medium', minimumVersion: 'In bed by the planned time, even if sleep was short' },
  { id: 'exercise', name: 'Exercise', description: 'Planned training session.', categoryId: 'health', frequency: xPerWeek(3), target: 1, unit: '', timeOfDay: 'anytime', difficulty: 'hard', minimumVersion: '15-minute session' },
  { id: 'water', name: 'Drink enough water', description: 'Glasses of water through the day.', categoryId: 'health', frequency: daily, target: 8, unit: 'glasses', timeOfDay: 'anytime', difficulty: 'easy', minimumVersion: '4 glasses' },
  { id: 'nutrition', name: 'Hit nutrition targets', description: 'Protein and whole foods.', categoryId: 'health', frequency: weekdays, target: 1, unit: '', timeOfDay: 'anytime', difficulty: 'medium', minimumVersion: 'Protein at every meal' },
  { id: 'walk', name: 'Daylight walk', description: 'Outside walk, ideally in the morning.', categoryId: 'health', frequency: daily, target: 1, unit: '', timeOfDay: 'morning', difficulty: 'easy', minimumVersion: '5 minutes outside' },
  { id: 'study', name: 'Study session', description: 'Focused study for a qualification or course.', categoryId: 'education', frequency: weekdays, target: 90, unit: 'minutes', timeOfDay: 'evening', difficulty: 'hard', minimumVersion: '25 focused minutes' },
  { id: 'deep-work', name: 'Deep work block', description: 'Uninterrupted work on the most important project.', categoryId: 'career', frequency: weekdays, target: 1, unit: '', timeOfDay: 'morning', difficulty: 'medium', minimumVersion: '30 minutes, notifications off' },
  { id: 'industry-reading', name: 'Read industry material', description: 'Stay current in your field.', categoryId: 'career', frequency: xPerWeek(3), target: 1, unit: '', timeOfDay: 'anytime', difficulty: 'easy', minimumVersion: 'One article' },
  { id: 'track-spending', name: 'Track spending', description: 'Log and categorise what you spent.', categoryId: 'finance', frequency: daily, target: 1, unit: '', timeOfDay: 'evening', difficulty: 'easy', minimumVersion: 'Check the banking app' },
  { id: 'review-investments', name: 'Review finances', description: 'Balances, budget and investments.', categoryId: 'finance', frequency: xPerWeek(1), target: 1, unit: '', timeOfDay: 'anytime', difficulty: 'easy', minimumVersion: 'Check balances' },
  { id: 'no-spend', name: 'No unnecessary purchases', description: 'Pause 24 hours before non-essential buys.', categoryId: 'finance', frequency: daily, target: 1, unit: '', timeOfDay: 'anytime', difficulty: 'medium', minimumVersion: 'Waited before one purchase' },
  { id: 'read', name: 'Read 20 pages', description: 'Books, not feeds.', categoryId: 'education', frequency: daily, target: 20, unit: 'pages', timeOfDay: 'evening', difficulty: 'easy', minimumVersion: '5 pages' },
  { id: 'journal', name: 'Journal', description: 'A short written reflection.', categoryId: 'personal', frequency: daily, target: 1, unit: '', timeOfDay: 'evening', difficulty: 'easy', minimumVersion: 'One sentence' },
  { id: 'practise-skill', name: 'Practise a skill', description: 'Deliberate practice on one skill.', categoryId: 'personal', frequency: xPerWeek(4), target: 30, unit: 'minutes', timeOfDay: 'anytime', difficulty: 'medium', minimumVersion: '10 minutes' },
  { id: 'plan-tomorrow', name: 'Plan tomorrow', description: 'Pick tomorrow’s three most important tasks.', categoryId: 'personal', frequency: weekdays, target: 1, unit: '', timeOfDay: 'evening', difficulty: 'easy', minimumVersion: 'Write down one priority' },
  { id: 'connect', name: 'Meaningful connection', description: 'Quality time or a real conversation with someone close.', categoryId: 'relationships', frequency: xPerWeek(3), target: 1, unit: '', timeOfDay: 'evening', difficulty: 'easy', minimumVersion: 'A message or quick call' },
];

export const HABIT_TEMPLATE_BY_ID = Object.fromEntries(HABIT_TEMPLATES.map((h) => [h.id, h]));
export const GOAL_TEMPLATE_BY_ID = Object.fromEntries(GOAL_TEMPLATES.map((g) => [g.id, g]));

export const OBSTACLES = [
  { id: 'time', label: 'Not enough time' },
  { id: 'energy', label: 'Low energy' },
  { id: 'focus', label: 'Distractions' },
  { id: 'clarity', label: 'Unclear priorities' },
  { id: 'consistency', label: 'Starting strong, then stopping' },
  { id: 'overcommit', label: 'Taking on too much' },
];

/**
 * How many starter habits to suggest, from the quiz. An unstructured routine or little time means
 * fewer habits: it's better to keep two than abandon six.
 */
export function recommendedHabitCount(routine: 'structured' | 'mixed' | 'unstructured', dailyMinutes: number): number {
  let n = routine === 'structured' ? 4 : routine === 'mixed' ? 3 : 2;
  if (dailyMinutes <= 15) n = Math.min(n, 2);
  else if (dailyMinutes >= 90) n += 1;
  return n;
}
