/**
 * Level curve: XP needed to go from level L to L+1 = round(100 × L^1.5).
 *   L1→2: 100 · L2→3: 283 · L3→4: 520 · L4→5: 800 · L5→6: 1,118 · L9→10: 2,700 · L15→16: 5,809
 * With ~100 XP on a typical day: level 2 on day one, level 4 in about a week, level 10 in roughly
 * three to four months, and level 16 in about a year — fast early wins, then steady effort.
 */
export const LEVEL_BASE = 100;
export const LEVEL_EXPONENT = 1.5;
export const MAX_LEVEL = 99;

export function xpToNext(level: number): number {
  return Math.round(LEVEL_BASE * Math.pow(level, LEVEL_EXPONENT));
}

/** Total XP needed to *reach* a level (level 1 = 0). */
export function totalXpForLevel(level: number): number {
  let t = 0;
  for (let l = 1; l < level; l++) t += xpToNext(l);
  return t;
}

export interface LevelInfo {
  level: number;
  /** XP earned inside the current level. */
  into: number;
  /** XP the current level needs in total. */
  needed: number;
  /** XP still to earn for the next level. */
  remaining: number;
  progress: number; // 0..1
  total: number;
}

export function levelFromXp(totalXp: number): LevelInfo {
  const total = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let floor = 0;
  while (level < MAX_LEVEL && total >= floor + xpToNext(level)) {
    floor += xpToNext(level);
    level++;
  }
  const needed = xpToNext(level);
  const into = total - floor;
  return { level, into, needed, remaining: needed - into, progress: Math.min(1, into / needed), total };
}

export interface RankTitle {
  level: number;
  title: string;
}

export const RANKS: RankTitle[] = [
  { level: 1, title: 'Rookie' },
  { level: 3, title: 'Apprentice' },
  { level: 5, title: 'Challenger' },
  { level: 7, title: 'Adept' },
  { level: 10, title: 'Veteran' },
  { level: 13, title: 'Elite' },
  { level: 16, title: 'Master' },
  { level: 20, title: 'Grandmaster' },
  { level: 25, title: 'Legend' },
];

export function rankFor(level: number): string {
  let t = RANKS[0].title;
  for (const r of RANKS) if (level >= r.level) t = r.title;
  return t;
}

export type Feature = 'weekly-quests' | 'library-2' | 'library-3' | 'personal-quests' | 'planner' | 'custom-colours';

export interface LevelUnlock {
  level: number;
  features: Feature[];
  lines: string[];
}

/** What each level opens up. New *habits* are always offered, never added automatically. */
export const LEVEL_UNLOCKS: LevelUnlock[] = [
  { level: 1, features: [], lines: ['Core daily habits', 'Morning & evening routines', 'Daily quests', 'Academy: 10–15 minute focus sessions'] },
  { level: 2, features: ['custom-colours'], lines: ['Avatar colour themes'] },
  { level: 3, features: ['planner'], lines: ['Weekly revision planner', 'New title: Apprentice'] },
  { level: 4, features: ['weekly-quests', 'library-2'], lines: ['Weekly quests', 'New habits to choose from: reading, exercise, stretching, fruit & veg', 'Academy tier 2: active recall'] },
  { level: 5, features: [], lines: ['New title: Challenger', 'New avatar frame'] },
  { level: 7, features: ['library-3'], lines: ['Advanced habits: planning, journaling, skill practice', 'Academy tier 3: practice questions'] },
  { level: 10, features: [], lines: ['New title: Veteran', 'New avatar frame'] },
  { level: 11, features: ['personal-quests'], lines: ['Personalised quests built from your own history', 'Academy tier 4: structured revision'] },
  { level: 16, features: [], lines: ['New title: Master', 'Academy tier 5: personalised GCSE preparation'] },
];

export function hasFeature(level: number, f: Feature): boolean {
  return LEVEL_UNLOCKS.some((u) => u.level <= level && u.features.includes(f));
}

export function unlocksBetween(from: number, to: number): LevelUnlock[] {
  return LEVEL_UNLOCKS.filter((u) => u.level > from && u.level <= to);
}

/** Suggested revision tiers. These are suggestions — the user picks their own target. */
export interface RevisionTier {
  tier: number;
  fromLevel: number;
  toLevel: number | null;
  minutes: [number, number];
  perWeek: number;
  focus: string;
}

export const REVISION_TIERS: RevisionTier[] = [
  { tier: 1, fromLevel: 1, toLevel: 3, minutes: [10, 15], perWeek: 3, focus: 'Build the habit: short, regular sessions.' },
  { tier: 2, fromLevel: 4, toLevel: 6, minutes: [15, 20], perWeek: 3, focus: 'Start using active recall: test yourself instead of re-reading.' },
  { tier: 3, fromLevel: 7, toLevel: 10, minutes: [20, 25], perWeek: 4, focus: 'Add practice questions to check what you really know.' },
  { tier: 4, fromLevel: 11, toLevel: 15, minutes: [25, 30], perWeek: 4, focus: 'More structured revision: mix subjects and review mistakes.' },
  { tier: 5, fromLevel: 16, toLevel: null, minutes: [25, 30], perWeek: 5, focus: 'Personalised GCSE prep: subject-specific schedules and exam questions.' },
];

export function tierForLevel(level: number): RevisionTier {
  return [...REVISION_TIERS].reverse().find((t) => level >= t.fromLevel) ?? REVISION_TIERS[0];
}
