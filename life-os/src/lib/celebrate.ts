import type { AchievementDef } from './progression';

export type Celebration = { kind: 'level'; level: number; stage: string } | { kind: 'achievement'; def: AchievementDef } | { kind: 'xp'; amount: number };

type Listener = (c: Celebration) => void;
const listeners = new Set<Listener>();

/** Tiny event bus: the engine emits rewards, the UI decides how to present them. */
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
