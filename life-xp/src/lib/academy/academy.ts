import type { DateStr, RevisionMethod, RevisionSession, TopicStatus, WorkloadMode } from '../types';
import { addDays, weekStart } from '../dates';
import type { Snapshot } from '../snapshot';

export const SUGGESTED_SUBJECTS: { name: string; color: string; icon: string }[] = [
  { name: 'Mathematics', color: '#3fe3ff', icon: 'Sigma' },
  { name: 'English Language', color: '#ff5fa2', icon: 'Languages' },
  { name: 'English Literature', color: '#ff8aa8', icon: 'BookOpenText' },
  { name: 'Biology', color: '#3ee8a4', icon: 'Leaf' },
  { name: 'Chemistry', color: '#7cf27c', icon: 'FlaskConical' },
  { name: 'Physics', color: '#6ea8fe', icon: 'Atom' },
  { name: 'Combined Science', color: '#4fd1c5', icon: 'Microscope' },
  { name: 'Geography', color: '#ffb454', icon: 'Globe2' },
  { name: 'History', color: '#d9a066', icon: 'Landmark' },
  { name: 'Computer Science', color: '#a47bff', icon: 'Cpu' },
  { name: 'Religious Studies', color: '#e0c3fc', icon: 'Scale' },
  { name: 'French', color: '#7b8cff', icon: 'MessageCircle' },
  { name: 'Spanish', color: '#ff7b54', icon: 'MessagesSquare' },
];

export const SUBJECT_COLORS = ['#3fe3ff', '#a47bff', '#3ee8a4', '#ff8a3d', '#ff5fa2', '#ffc845', '#6ea8fe', '#7cf27c', '#d9a066', '#e0c3fc'];

export const TOPIC_STATUSES: { value: TopicStatus; label: string; color: string; hint: string }[] = [
  { value: 0, label: 'Not started', color: '#4c5070', hint: "Haven't studied this yet." },
  { value: 1, label: 'Learning', color: '#ff8a3d', hint: 'Studied it, still getting to grips with it.' },
  { value: 2, label: 'Needs practice', color: '#ffb454', hint: 'I get the idea but make mistakes.' },
  { value: 3, label: 'Understanding', color: '#6ea8fe', hint: 'I can explain it and get most questions right.' },
  { value: 4, label: 'Confident', color: '#3fe3ff', hint: 'Confident (rated 4+) and doing well in practice.' },
  { value: 5, label: 'Retained', color: '#3ee8a4', hint: 'Still remembered it easily after 2+ weeks.' },
];

export interface MethodInfo {
  id: RevisionMethod;
  label: string;
  icon: string;
  /** Extra XP on top of the time-based XP, because active methods build real understanding. */
  bonus: number;
  tip: string;
  practice?: boolean;
}

export const METHODS: MethodInfo[] = [
  { id: 'reading', label: 'Reading & understanding', icon: 'BookOpen', bonus: 0, tip: 'Read a section, then close the book and summarise it in your own words.' },
  { id: 'active-recall', label: 'Active recall', icon: 'Brain', bonus: 10, tip: 'Write down everything you remember, then check what you missed.' },
  { id: 'flashcards', label: 'Flashcards', icon: 'Layers', bonus: 5, tip: 'Say the answer out loud before flipping. Put wrong cards back in the pile.' },
  { id: 'mind-map', label: 'Mind mapping', icon: 'Network', bonus: 5, tip: 'Start with the topic in the middle and branch out from memory first.' },
  { id: 'practice', label: 'Practice questions', icon: 'PencilRuler', bonus: 10, tip: 'Mark your answers honestly. Mistakes are where the learning happens.', practice: true },
  { id: 'exam', label: 'Exam-style questions', icon: 'FileCheck2', bonus: 15, tip: 'Use the mark scheme. Look at how marks are awarded, not just the answer.', practice: true },
  { id: 'mistakes', label: 'Reviewing mistakes', icon: 'RotateCcw', bonus: 5, tip: 'Redo questions you got wrong without looking at the answer.' },
  { id: 'video', label: 'Educational video', icon: 'MonitorPlay', bonus: 0, tip: 'Pause and predict what comes next. Make notes after, not during.' },
];
export const METHOD_BY_ID = Object.fromEntries(METHODS.map((m) => [m.id, m])) as Record<RevisionMethod, MethodInfo>;

export const SESSION_LENGTHS = [10, 15, 20, 25];
export const MIN_XP_MINUTES = 5;
export const MAX_SESSION_MINUTES = 60;
/** Daily cap on revision-session XP: rewards consistency, not marathon sessions. */
export const DAILY_REVISION_XP_CAP = 90;
export const REVIEW_XP = 15;

/**
 * XP for a finished revision session.
 * Time XP = focused minutes (capped at the planned length and at 30), so 10 min → 10, 15 → 15, 25 → 25.
 * Plus a method bonus: active recall / practice +10, exam-style +15, flashcards / mind map / mistakes +5.
 * Under 5 focused minutes earns nothing. The daily cap stops marathon farming.
 */
export function sessionXp(focusedSeconds: number, plannedMinutes: number, method: RevisionMethod, xpAlreadyToday: number): number {
  const minutes = Math.min(Math.floor(focusedSeconds / 60), plannedMinutes);
  if (minutes < MIN_XP_MINUTES) return 0;
  const timeXp = Math.min(30, minutes);
  const raw = timeXp + METHOD_BY_ID[method].bonus;
  return Math.max(0, Math.min(raw, DAILY_REVISION_XP_CAP - xpAlreadyToday));
}

export function revisionXpOn(s: Snapshot, date: DateStr): number {
  return s.revisionSessions.filter((r) => r.date === date).reduce((a, r) => a + r.xp, 0);
}

/** A session "counts" towards weekly targets when at least 5 focused minutes were completed. */
export const countsAsSession = (r: RevisionSession) => r.focusedSeconds >= MIN_XP_MINUTES * 60;

export function sessionsInWeek(s: Snapshot, ws: DateStr): RevisionSession[] {
  const end = addDays(ws, 6);
  return s.revisionSessions.filter((r) => r.date >= ws && r.date <= end && countsAsSession(r));
}

/** The weekly revision target after the workload mode is applied. Never raised automatically. */
export function effectiveRevisionTarget(s: Snapshot): { perWeek: number; minutes: number; note: string | null } {
  const { revisionPerWeek: perWeek, revisionMinutes: minutes, workload } = s.settings;
  switch (workload) {
    case 'rest':
      return { perWeek: 0, minutes, note: 'Rest week: no revision target. Recharge.' };
    case 'busy':
      return { perWeek: Math.max(1, perWeek - 1), minutes, note: 'Busy week: target lowered by one session.' };
    case 'holiday':
      return { perWeek, minutes, note: 'Holiday: sessions are optional, so fit them around plans.' };
    case 'exams':
      return { perWeek, minutes, note: 'Exam period: focus on the subjects marked "exam soon".' };
    default:
      return { perWeek, minutes, note: null };
  }
}

export function currentWeekSessions(s: Snapshot) {
  return sessionsInWeek(s, weekStart(s.today));
}

export const WORKLOAD_MODES: { value: WorkloadMode; label: string; hint: string }[] = [
  { value: 'term', label: 'Term time', hint: 'Normal school weeks.' },
  { value: 'busy', label: 'Busy week', hint: 'Lots of homework or plans: revision target drops by one.' },
  { value: 'exams', label: 'Exams / tests', hint: 'Planner focuses on subjects marked "exam soon".' },
  { value: 'holiday', label: 'Holiday', hint: 'No school-day quests, revision optional and flexible.' },
  { value: 'rest', label: 'Rest week', hint: 'No revision target. Recharge.' },
];
