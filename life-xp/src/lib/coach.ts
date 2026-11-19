import { addDays, weekStart } from './dates';
import { calendarWeekConsistency, habitCompletionRate, pastWeekStarts, totalXp } from './performance';
import type { Snapshot } from './snapshot';
import { HABIT_LIBRARY, libraryTierForLevel, recommendedMax, type HabitTemplate } from './habits';
import { levelFromXp, tierForLevel } from './levels';
import { effectiveRevisionTarget, sessionsInWeek } from './academy/academy';
import type { Habit } from './types';

export type CoachKind = 'grow' | 'maintain' | 'simplify' | 'sleep' | 'study-up' | 'study-ease' | 'welcome';

export interface CoachAdvice {
  key: string; // dismissal key — one per kind per week
  kind: CoachKind;
  headline: string;
  body: string;
  /** Options the user can choose from. Nothing is ever applied automatically. */
  habitOptions?: HabitTemplate[];
  pauseHabit?: Habit;
  stepUp?: { perWeek: number; minutes: number };
  stepDown?: { perWeek: number };
}

/**
 * Weekly adaptive coach. Looks at the last completed weeks and suggests ONE next step.
 * It never changes anything by itself and it never punishes: the worst it says is "keep it simple".
 */
export function coachAdvice(s: Snapshot): CoachAdvice[] {
  const out: CoachAdvice[] = [];
  const ws = weekStart(s.today);
  const weeks = pastWeekStarts(s, 3).map((w) => ({ w, c: calendarWeekConsistency(s, w) })).filter((x) => x.c.days >= 4 && x.c.pct !== null);
  const level = levelFromXp(totalXp(s)).level;
  const active = s.habits.filter((h) => h.active);
  const dismissed = new Set(s.settings.coachDismissed);
  const key = (k: CoachKind) => `${k}:${ws}`;

  if (!weeks.length) {
    out.push({ key: key('welcome'), kind: 'welcome', headline: 'Your first week', body: 'Focus on showing up. Half your habits counts as a win and keeps your streak alive. Your coach checks in after your first full week.' });
  }

  // Sleep comes first: never suggest more workload while sleep is short.
  const sleepLogs = [...s.sleepLogs.values()].filter((x) => x.date > addDays(s.today, -14));
  const avgSleep = sleepLogs.length >= 4 ? sleepLogs.reduce((a, x) => a + x.minutes, 0) / sleepLogs.length : null;
  const shortSleep = avgSleep !== null && avgSleep < 8 * 60;
  if (shortSleep) {
    out.push({ key: key('sleep'), kind: 'sleep', headline: 'Sleep is your superpower', body: `You're averaging ${(avgSleep! / 60).toFixed(1)}h. Teenagers need 8–10 hours. Before adding anything new, try moving bedtime 15 minutes earlier this week.` });
  }

  if (weeks.length) {
    const last = weeks[0].c.pct!;
    const prev = weeks[1]?.c.pct ?? null;
    const strong = last >= 0.85 || (last >= 0.8 && prev !== null && prev >= 0.8);
    if (strong && !shortSleep) {
      if (active.length < recommendedMax(level)) {
        const tier = libraryTierForLevel(level);
        const have = new Set(s.habits.filter((h) => h.active).map((h) => h.templateId));
        const options = HABIT_LIBRARY.filter((t) => t.tier <= tier && !have.has(t.id)).sort((a, b) => b.tier - a.tier).slice(0, 3);
        if (options.length) {
          out.push({ key: key('grow'), kind: 'grow', headline: `${Math.round(last * 100)}% last week. You're ready for more`, body: 'Want to add ONE new habit? Pick one below, or skip. Keeping things as they are is fine too.', habitOptions: options });
        }
      } else {
        out.push({ key: key('maintain'), kind: 'maintain', headline: 'Elite consistency', body: `${Math.round(last * 100)}% last week with ${active.length} habits. That's a full routine. Keep it steady rather than adding more.` });
      }
    } else if (last < 0.5 || (prev !== null && last < prev - 0.15 && last < 0.65)) {
      const rates = active
        .map((h) => ({ h, r: habitCompletionRate(s, h, addDays(s.today, -14), addDays(s.today, -1)) }))
        .filter((x) => x.r.scheduled >= 4 && x.r.pct !== null)
        .sort((a, b) => a.r.pct! - b.r.pct!);
      const weakest = rates[0];
      out.push({
        key: key('simplify'),
        kind: 'simplify',
        headline: 'Busy week? Keep it simple',
        body: weakest && weakest.r.pct! < 0.4 && active.length > 4
          ? `"${weakest.h.name}" has been hard to fit in (${Math.round(weakest.r.pct! * 100)}%). You could pause it for now and bring it back later. No XP lost.`
          : 'Missing days happens. Nothing is lost. Focus on your 2–3 easiest habits this week to rebuild momentum.',
        pauseHabit: weakest && weakest.r.pct! < 0.4 && active.length > 4 ? weakest.h : undefined,
      });
    } else if (!shortSleep) {
      out.push({ key: key('maintain'), kind: 'maintain', headline: `Solid: ${Math.round(last * 100)}% last week`, body: 'Same routine this week. Consistency at this level is how habits become automatic.' });
    }
  }

  // Academy: suggest stepping up only after sustained success AND a new tier being available.
  const target = effectiveRevisionTarget(s);
  if (target.perWeek > 0 && s.subjects.some((x) => !x.archived)) {
    const pw = pastWeekStarts(s, 3);
    const hits = pw.map((w) => sessionsInWeek(s, w).length >= target.perWeek);
    const tier = tierForLevel(level);
    const canStep = s.settings.revisionPerWeek < tier.perWeek || s.settings.revisionMinutes < tier.minutes[0];
    if (pw.length >= 3 && hits.every(Boolean) && canStep && !shortSleep && s.settings.workload === 'term') {
      out.push({
        key: key('study-up'),
        kind: 'study-up',
        headline: '3 weeks on target in the Academy',
        body: `Level ${level} unlocks tier ${tier.tier}: ${tier.focus} Want to try ${Math.max(s.settings.revisionPerWeek, tier.perWeek)} sessions of ${Math.max(s.settings.revisionMinutes, tier.minutes[0])} min? Only if it feels right.`,
        stepUp: { perWeek: Math.max(s.settings.revisionPerWeek, tier.perWeek), minutes: Math.max(s.settings.revisionMinutes, tier.minutes[0]) },
      });
    } else if (pw.length >= 2 && hits.slice(0, 2).every((h) => !h) && sessionsInWeek(s, pw[0]).length < target.perWeek / 2 && s.settings.revisionPerWeek > 2) {
      out.push({
        key: key('study-ease'),
        kind: 'study-ease',
        headline: 'Revision target feels heavy?',
        body: 'Two weeks under target. That is normal when school gets busy. You could lower it by one session, or switch to "Busy week" mode in Settings.',
        stepDown: { perWeek: s.settings.revisionPerWeek - 1 },
      });
    }
  }
  return out.filter((a) => !dismissed.has(a.key));
}
