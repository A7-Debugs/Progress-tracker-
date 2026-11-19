import type { Habit, HabitCategory, HabitLink } from './types';

export const CATEGORIES: { id: HabitCategory; label: string; color: string; icon: string }[] = [
  { id: 'morning', label: 'Morning routine', color: '#ffc845', icon: 'Sunrise' },
  { id: 'school', label: 'School & learning', color: '#a47bff', icon: 'GraduationCap' },
  { id: 'health', label: 'Health', color: '#3ee8a4', icon: 'HeartPulse' },
  { id: 'fitness', label: 'Fitness', color: '#ff8a3d', icon: 'Dumbbell' },
  { id: 'evening', label: 'Evening routine', color: '#7b8cff', icon: 'MoonStar' },
  { id: 'personal', label: 'Personal growth', color: '#ff5fa2', icon: 'Sparkles' },
];
export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<HabitCategory, (typeof CATEGORIES)[number]>;

export const XP_LIMITS = { min: 1, max: 40 };
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const SCHOOL_DAYS = [1, 2, 3, 4, 5];
export const SCHOOL_NIGHTS = [0, 1, 2, 3, 4];

export interface HabitTemplate {
  id: string;
  name: string;
  category: HabitCategory;
  icon: string;
  xp: number;
  days: number[];
  target: number;
  unit: string | null;
  step: number;
  link: HabitLink;
  xpKind: 'life' | 'academic';
  /** Library tier: 1 from the start, 2 from level 4, 3 from level 7. */
  tier: 1 | 2 | 3;
  starter?: boolean;
  why: string;
}

const t = (x: Partial<HabitTemplate> & Pick<HabitTemplate, 'id' | 'name' | 'category' | 'icon' | 'xp' | 'why'>): HabitTemplate => ({
  days: ALL_DAYS,
  target: 1,
  unit: null,
  step: 1,
  link: 'manual',
  xpKind: 'life',
  tier: 1,
  ...x,
});

export const HABIT_LIBRARY: HabitTemplate[] = [
  // Morning
  t({ id: 'wake', name: 'Wake up on time', category: 'morning', icon: 'AlarmClock', xp: 10, starter: true, why: 'A steady wake time is the single best thing for energy and sleep.' }),
  t({ id: 'bed-made', name: 'Make bed', category: 'morning', icon: 'BedDouble', xp: 5, starter: true, why: 'A 60-second win that starts the day in control.' }),
  t({ id: 'teeth-am', name: 'Brush teeth (morning)', category: 'morning', icon: 'Smile', xp: 5, starter: true, why: 'Two minutes, twice a day.' }),
  t({ id: 'ready', name: 'Get ready for school', category: 'morning', icon: 'Shirt', xp: 5, days: SCHOOL_DAYS, why: 'Leave on time without the rush.' }),
  // School
  t({ id: 'school', name: 'Attend school', category: 'school', icon: 'School', xp: 5, days: SCHOOL_DAYS, xpKind: 'academic', why: 'Turning up is half the battle.' }),
  t({ id: 'homework', name: 'Complete homework', category: 'school', icon: 'NotebookPen', xp: 20, days: SCHOOL_NIGHTS, xpKind: 'academic', starter: true, why: 'Done on the day it is set means no stress later.' }),
  t({ id: 'revise', name: 'Revise (Academy session)', category: 'school', icon: 'Brain', xp: 10, days: [1, 2, 4, 0], target: 10, unit: 'min', step: 5, link: 'revision', xpKind: 'academic', tier: 2, why: 'Ticks itself when you finish a focus session in the Academy.' }),
  t({ id: 'read', name: 'Read', category: 'school', icon: 'BookOpen', xp: 15, target: 20, unit: 'min', step: 5, tier: 2, why: 'Twenty minutes a day is over 120 hours a year.' }),
  // Health
  t({ id: 'water', name: 'Drink water', category: 'health', icon: 'GlassWater', xp: 10, target: 6, unit: 'glasses', step: 1, link: 'water', starter: true, why: 'Around 6–8 glasses a day keeps your focus sharp.' }),
  t({ id: 'meals', name: 'Eat balanced meals', category: 'health', icon: 'UtensilsCrossed', xp: 10, target: 2, unit: 'meals', step: 1, link: 'meals', why: 'Meals with protein, carbs and veg power your brain and body.' }),
  t({ id: 'fruitveg', name: 'Fruit & veg', category: 'health', icon: 'Apple', xp: 10, target: 5, unit: 'portions', step: 1, link: 'fruitveg', tier: 2, why: 'Five a day: fresh, frozen, tinned and juice all count.' }),
  t({ id: 'hygiene', name: 'Shower / personal hygiene', category: 'health', icon: 'ShowerHead', xp: 5, why: 'Feel fresh, feel confident.' }),
  // Fitness
  t({ id: 'active', name: 'Physical activity', category: 'fitness', icon: 'Activity', xp: 20, target: 20, unit: 'min', step: 5, link: 'exercise', starter: true, why: 'PE, sport, cycling, walking fast: it all counts. Log it in Health.' }),
  t({ id: 'walk', name: 'Walk 15 minutes', category: 'fitness', icon: 'Footprints', xp: 10, why: 'Easy movement that clears your head.' }),
  t({ id: 'sport', name: 'Play sport', category: 'fitness', icon: 'Trophy', xp: 15, days: [3, 6], tier: 2, why: 'Fun first: football, basketball, anything with mates.' }),
  t({ id: 'stretch', name: 'Stretch 5 minutes', category: 'fitness', icon: 'StretchHorizontal', xp: 5, tier: 2, why: 'Helps you recover and stay injury-free.' }),
  // Evening
  t({ id: 'bag', name: 'Prepare school bag', category: 'evening', icon: 'Backpack', xp: 5, days: SCHOOL_NIGHTS, why: 'Tomorrow-you will thank you.' }),
  t({ id: 'teeth-pm', name: 'Brush teeth (evening)', category: 'evening', icon: 'Smile', xp: 5, starter: true, why: 'The most important brush of the day.' }),
  t({ id: 'screens', name: 'Screens off 30 min before bed', category: 'evening', icon: 'SmartphoneNfc', xp: 10, why: 'Blue light and scrolling push sleep later.' }),
  t({ id: 'bedtime', name: 'In bed on time', category: 'evening', icon: 'Moon', xp: 10, why: 'Teenagers need 8–10 hours. Bedtime is where that starts.' }),
  // Tier 3 — advanced personal development
  t({ id: 'plan', name: 'Plan tomorrow (top 3)', category: 'personal', icon: 'ListChecks', xp: 10, days: SCHOOL_NIGHTS, tier: 3, why: 'Know your three priorities before you sleep.' }),
  t({ id: 'journal', name: 'Journal 3 lines', category: 'personal', icon: 'PenLine', xp: 10, tier: 3, why: 'What went well, what was hard, what is next.' }),
  t({ id: 'skill', name: 'Practise a skill', category: 'personal', icon: 'Guitar', xp: 15, target: 15, unit: 'min', step: 5, tier: 3, why: 'An instrument, coding, drawing: small daily reps add up.' }),
  t({ id: 'tidy', name: 'Tidy room (5 min)', category: 'personal', icon: 'Sparkles', xp: 5, tier: 3, why: 'Clear space, clear head.' }),
  t({ id: 'help', name: 'Help at home', category: 'personal', icon: 'HandHeart', xp: 10, tier: 3, why: 'Cooking, washing up, helping out.' }),
  t({ id: 'nophone', name: 'No phone first 30 minutes', category: 'personal', icon: 'PhoneOff', xp: 10, tier: 3, why: 'Own your morning before the feed does.' }),
];

export const TEMPLATE_BY_ID = Object.fromEntries(HABIT_LIBRARY.map((h) => [h.id, h])) as Record<string, HabitTemplate>;

export function libraryTierForLevel(level: number): 1 | 2 | 3 {
  return level >= 7 ? 3 : level >= 4 ? 2 : 1;
}

/** Start with ~6 habits. Recommended maximum grows slowly with level. */
export function recommendedMax(level: number): number {
  return Math.min(14, 7 + Math.floor((level - 1) / 3));
}

export function isScheduled(h: Pick<Habit, 'days'>, dow: number): boolean {
  return h.days.includes(dow);
}

export function clampXp(xp: number): number {
  return Math.max(XP_LIMITS.min, Math.min(XP_LIMITS.max, Math.round(xp)));
}

export function daysLabel(days: number[]): string {
  const s = [...days].sort().join(',');
  if (s === '0,1,2,3,4,5,6') return 'Every day';
  if (s === '1,2,3,4,5') return 'School days';
  if (s === '0,1,2,3,4') return 'School nights';
  if (s === '0,6') return 'Weekends';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => names[d]).join(' ');
}
