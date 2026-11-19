import type { AchievementDef } from './achievements';
import type { LevelUnlock } from './levels';
import type { QuestRecord } from './types';

export type Celebration =
  | { kind: 'level'; level: number; title: string; unlocks: LevelUnlock[] }
  | { kind: 'achievement'; def: AchievementDef }
  | { kind: 'quest'; quest: QuestRecord }
  | { kind: 'combo'; label: string; xp: number }
  | { kind: 'xp'; amount: number; label?: string };

type Listener = (c: Celebration) => void;
const listeners = new Set<Listener>();

/** Tiny event bus: the engine emits rewards, the UI decides how to celebrate them. */
export function onCelebrate(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function celebrate(c: Celebration) {
  for (const l of listeners) l(c);
}

export function vibrate(pattern: number | number[]) {
  try {
    if (document.documentElement.dataset.haptics === 'on') navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}
