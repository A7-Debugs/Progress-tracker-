import { addDays, dayOfWeek, fromMinutes, toMinutes, weekDates } from '../dates';
import { newId } from '../id';
import type { Snapshot } from '../snapshot';
import type { DateStr, PlanItem, RevisionMethod, Subject, Topic, WeekPlan } from '../types';
import { effectiveRevisionTarget } from './academy';
import { levelFromXp, tierForLevel } from '../levels';
import { totalXp } from '../performance';

/** Never plan more than this much revision on one day (on top of homework). */
export const MAX_DAILY_STUDY_MINUTES = 60;
/** Skip study on days where homework already takes this long. */
export const HEAVY_HOMEWORK_MINUTES = 60;

/**
 * Builds a suggested week. Rules:
 * - Spaced-repetition reviews go on (or just after) the day they're due.
 * - Study sessions go on the user's study days, never on rest days, never over the daily cap,
 *   and never on days with heavy homework.
 * - Subjects are weighted by priority (focus subjects and "exam soon" get more), not split equally,
 *   and the same subject is never scheduled on two days in a row if another choice exists.
 * - Topics that need attention (low confidence, flagged for revisit, "needs practice") come first.
 */
export function buildPlan(s: Snapshot, ws: DateStr): WeekPlan {
  const target = effectiveRevisionTarget(s);
  const subjects = s.subjects.filter((x) => !x.archived);
  const days = weekDates(ws).filter((d) => d >= s.today);
  const items: PlanItem[] = [];
  const load = new Map<DateStr, number>();
  const homework = (d: DateStr) => s.settings.homeworkMinutes[String(dayOfWeek(d))] ?? 0;
  const isStudyDay = (d: DateStr) => s.settings.studyDays.includes(dayOfWeek(d));
  const timeFor = (d: DateStr) => {
    const school = s.settings.schoolDays.includes(dayOfWeek(d)) && s.settings.workload !== 'holiday';
    if (!school) return '10:30';
    // After school, then homework, then a short break.
    return fromMinutes(Math.min(toMinutes(s.settings.schoolEnd) + 60 + homework(d), toMinutes('19:30')));
  };
  const level = levelFromXp(totalXp(s)).level;
  const tier = tierForLevel(level);

  // 1. Reviews (short, 10 min each, grouped by day).
  const reviewTopics = s.topics.filter((t) => t.nextReview !== null && t.nextReview <= addDays(ws, 6) && subjects.some((x) => x.id === t.subjectId));
  for (const t of reviewTopics) {
    let d = t.nextReview! < (days[0] ?? ws) ? days[0] : t.nextReview!;
    if (!d) break;
    // Move off overloaded days to the next available.
    let guard = 0;
    while ((load.get(d) ?? 0) + 10 > MAX_DAILY_STUDY_MINUTES && guard++ < 7) d = addDays(d, 1);
    if (d > addDays(ws, 6)) continue;
    items.push({ id: newId(), date: d, time: timeFor(d), subjectId: t.subjectId, topicId: t.id, kind: 'review', method: 'active-recall', minutes: 10, done: false });
    load.set(d, (load.get(d) ?? 0) + 10);
  }

  // 2. Study sessions up to the weekly target (minus sessions already done this week).
  const doneThisWeek = s.revisionSessions.filter((r) => r.date >= ws && r.date <= addDays(ws, 6) && r.focusedSeconds >= 300).length;
  let needed = Math.max(0, target.perWeek - doneThisWeek);
  const candidates = days.filter((d) => isStudyDay(d) && homework(d) < HEAVY_HOMEWORK_MINUTES);
  // Spread evenly: choose days with the biggest gaps between them.
  const chosen = spread(candidates, needed);
  const weights = subjects.map((x) => ({ x, w: x.priority * (x.examSoon ? 2 : 1) * (s.settings.workload === 'exams' && !x.examSoon ? 0.5 : 1) }));
  const used = new Map<string, number>();
  let lastSubject: string | null = null;
  for (const d of chosen) {
    if (needed <= 0 || !weights.length) break;
    if ((load.get(d) ?? 0) + target.minutes > MAX_DAILY_STUDY_MINUTES) continue;
    const subject = pickSubject(weights, used, lastSubject);
    if (!subject) break;
    used.set(subject.id, (used.get(subject.id) ?? 0) + 1);
    lastSubject = subject.id;
    const topic = pickTopic(s.topics.filter((t) => t.subjectId === subject.id), items);
    items.push({ id: newId(), date: d, time: timeFor(d), subjectId: subject.id, topicId: topic?.id ?? null, kind: 'study', method: suggestMethod(topic, tier.tier), minutes: target.minutes, done: false });
    load.set(d, (load.get(d) ?? 0) + target.minutes);
    needed--;
  }
  items.sort((a, b) => (a.date === b.date ? (a.kind === 'review' ? -1 : 1) : a.date < b.date ? -1 : 1));
  return { id: ws, items, generatedAt: Date.now(), edited: false };
}

function spread(days: DateStr[], n: number): DateStr[] {
  if (n <= 0 || !days.length) return [];
  if (n >= days.length) return days;
  const out: DateStr[] = [];
  const step = days.length / n;
  for (let i = 0; i < n; i++) out.push(days[Math.min(days.length - 1, Math.floor(i * step + step / 2))]);
  return [...new Set(out)];
}

function pickSubject(weights: { x: Subject; w: number }[], used: Map<string, number>, last: string | null): Subject | null {
  // Lowest (uses / weight) wins: high-priority subjects come up more often, but everything rotates.
  const ranked = [...weights].sort((a, b) => (used.get(a.x.id) ?? 0) / a.w - (used.get(b.x.id) ?? 0) / b.w || b.w - a.w);
  return (ranked.find((r) => r.x.id !== last) ?? ranked[0])?.x ?? null;
}

/** Most-in-need topic first: flagged for revisit, low confidence, needs practice, never started. */
export function topicNeedScore(t: Topic): number {
  let score = 0;
  if (t.needsRevisit) score += 4;
  if (t.status === 2) score += 3;
  if (t.status === 1) score += 2;
  if (t.status === 0) score += 1.5;
  if (t.confidence !== null) score += (5 - t.confidence) * 0.8;
  score += Math.min(3, t.difficultCount * 0.5);
  if (t.status >= 4) score -= 3;
  return score;
}

function pickTopic(topics: Topic[], planned: PlanItem[]): Topic | null {
  const already = new Set(planned.map((p) => p.topicId));
  const ranked = [...topics].sort((a, b) => topicNeedScore(b) - topicNeedScore(a));
  return ranked.find((t) => !already.has(t.id)) ?? ranked[0] ?? null;
}

export function suggestMethod(topic: Topic | null, tier: number): RevisionMethod {
  if (!topic || topic.status <= 1) return tier >= 2 ? 'active-recall' : 'reading';
  if (topic.needsRevisit || topic.difficultCount >= 2) return 'mistakes';
  if (topic.status === 2) return tier >= 3 ? 'practice' : 'flashcards';
  if (topic.status >= 3) return tier >= 4 ? 'exam' : tier >= 3 ? 'practice' : 'active-recall';
  return 'active-recall';
}
