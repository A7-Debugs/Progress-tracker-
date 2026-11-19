import { ACHIEVEMENT_BY_ID } from './achievements';
import { RANKS } from './levels';

export interface Unlockable {
  id: string;
  label: string;
  level?: number;
  achievement?: string;
}

export interface Palette extends Unlockable {
  from: string;
  to: string;
}

export const AVATAR_ICONS: Unlockable[] = [
  { id: 'Gamepad2', label: 'Gamer', level: 1 },
  { id: 'Rocket', label: 'Rocket', level: 1 },
  { id: 'Swords', label: 'Warrior', level: 1 },
  { id: 'Bot', label: 'Mech', level: 1 },
  { id: 'Ghost', label: 'Phantom', level: 2 },
  { id: 'Zap', label: 'Volt', level: 3 },
  { id: 'Mountain', label: 'Summit', level: 4 },
  { id: 'Flame', label: 'Inferno', achievement: 'on-fire' },
  { id: 'BookOpen', label: 'Sage', achievement: 'bookworm' },
  { id: 'Dumbbell', label: 'Titan', achievement: 'athlete' },
  { id: 'Sunrise', label: 'Dawn', achievement: 'early-bird' },
  { id: 'Brain', label: 'Mastermind', achievement: 'active-learner' },
  { id: 'Shield', label: 'Guardian', achievement: 'week-warrior' },
  { id: 'Skull', label: 'Ronin', level: 6 },
  { id: 'Orbit', label: 'Orbit', level: 8 },
  { id: 'Crown', label: 'Monarch', level: 10 },
  { id: 'Gem', label: 'Diamond', level: 13 },
  { id: 'Sparkles', label: 'Mythic', level: 16 },
];

export const PALETTES: Palette[] = [
  { id: 'cyber', label: 'Cyber', from: '#3fe3ff', to: '#a47bff', level: 1 },
  { id: 'toxic', label: 'Toxic', from: '#a6ff4d', to: '#1fbf8f', level: 2 },
  { id: 'sunset', label: 'Sunset', from: '#ffb454', to: '#ff5fa2', level: 2 },
  { id: 'ice', label: 'Ice', from: '#e5f6ff', to: '#5aa9ff', level: 3 },
  { id: 'blaze', label: 'Blaze', from: '#ffd36b', to: '#ff4d2e', achievement: 'on-fire' },
  { id: 'royal', label: 'Royal', from: '#c49bff', to: '#4a2bd1', level: 5 },
  { id: 'emerald', label: 'Emerald', from: '#6dffc2', to: '#0f8a6a', achievement: 'consistency' },
  { id: 'scholar', label: 'Scholar', from: '#9ad0ff', to: '#7b4dff', achievement: 'revision-consistency' },
  { id: 'gold', label: 'Gold', from: '#fff1a8', to: '#d49a1a', level: 10 },
  { id: 'void', label: 'Void', from: '#ff5fa2', to: '#24104f', level: 13 },
];

export const FRAMES: Unlockable[] = [
  { id: 'none', label: 'Clean', level: 1 },
  { id: 'ring', label: 'Ring', level: 1 },
  { id: 'double', label: 'Double', level: 5 },
  { id: 'spikes', label: 'Spikes', level: 7 },
  { id: 'laurel', label: 'Laurel', level: 10 },
  { id: 'flare', label: 'Flare', achievement: 'unstoppable' },
];

export const PALETTE_BY_ID = Object.fromEntries(PALETTES.map((p) => [p.id, p])) as Record<string, Palette>;

export function isUnlocked(u: Unlockable, level: number, achieved: Set<string>): boolean {
  if (u.level !== undefined && level >= u.level) return true;
  if (u.achievement && achieved.has(u.achievement)) return true;
  return false;
}

export function unlockHint(u: Unlockable): string {
  if (u.level !== undefined) return `Reach level ${u.level}`;
  if (u.achievement) return `Earn “${ACHIEVEMENT_BY_ID[u.achievement]?.name ?? u.achievement}”`;
  return '';
}

/** All titles the player can wear: rank titles by level, plus titles from badges. */
export function availableTitles(level: number, achieved: Set<string>): string[] {
  const out = RANKS.filter((r) => level >= r.level).map((r) => r.title);
  for (const id of achieved) {
    const t = ACHIEVEMENT_BY_ID[id]?.title;
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}
