import { addDays } from '../dates';
import type { DateStr, ReviewRating, Topic } from '../types';
import type { Snapshot } from '../snapshot';

/** Review ladder after first studying a topic: 1, 3, 7, 14, 30 days, then every 60. */
export const INTERVALS = [1, 3, 7, 14, 30, 60];

/** Called the first time a topic is studied (or studied again before it was ever scheduled). */
export function firstSchedule(date: DateStr): { reviewStage: number; nextReview: DateStr } {
  return { reviewStage: 0, nextReview: addDays(date, INTERVALS[0]) };
}

export interface ReviewOutcome {
  reviewStage: number;
  intervalDays: number;
  nextReview: DateStr;
}

/**
 * Easy → move up the ladder. Medium → repeat the same gap (at least 2 days after the first step).
 * Difficult → drop back a step and review again tomorrow.
 */
export function applyReview(stage: number, rating: ReviewRating, date: DateStr): ReviewOutcome {
  let next: number;
  let interval: number;
  if (rating === 'easy') {
    next = Math.min(stage + 1, INTERVALS.length - 1);
    interval = INTERVALS[next];
  } else if (rating === 'medium') {
    next = stage;
    interval = Math.max(2, Math.round(INTERVALS[stage] * 0.7));
  } else {
    next = Math.max(0, stage - 1);
    interval = 1;
  }
  return { reviewStage: next, intervalDays: interval, nextReview: addDays(date, interval) };
}

export function dueTopics(s: Snapshot, date: DateStr = s.today): Topic[] {
  const live = new Set(s.subjects.filter((x) => !x.archived).map((x) => x.id));
  return s.topics
    .filter((t) => t.nextReview !== null && t.nextReview <= date && live.has(t.subjectId))
    .sort((a, b) => (a.nextReview! < b.nextReview! ? -1 : 1));
}

export function upcomingReviews(s: Snapshot, days = 7): Topic[] {
  const end = addDays(s.today, days);
  const live = new Set(s.subjects.filter((x) => !x.archived).map((x) => x.id));
  return s.topics
    .filter((t) => t.nextReview !== null && t.nextReview > s.today && t.nextReview <= end && live.has(t.subjectId))
    .sort((a, b) => (a.nextReview! < b.nextReview! ? -1 : 1));
}

/** Whether a status is allowed yet — statuses are never set automatically, and the top ones need evidence. */
export function statusAllowed(t: Topic, status: number, reviewsEasyAt14Plus: boolean): { ok: boolean; reason?: string } {
  if (status === 4 && (t.confidence ?? 0) < 4) return { ok: false, reason: 'Rate your confidence 4 or 5 first.' };
  if (status === 5 && !reviewsEasyAt14Plus) return { ok: false, reason: 'Unlocks after an "Easy" review two or more weeks after studying it.' };
  return { ok: true };
}

export function hasLongEasyReview(s: Snapshot, topicId: string): boolean {
  return s.topicReviews.some((r) => r.topicId === topicId && r.rating === 'easy' && r.intervalDays >= 14);
}

/** Days since previous review/study when a review was done — used to tell "long gap" easy reviews. */
export function previousIntervalForReview(stage: number): number {
  return INTERVALS[Math.min(stage, INTERVALS.length - 1)];
}
