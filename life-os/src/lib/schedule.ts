import { daysBetween, dayOfWeek, toMinutes } from './dates';
import type { Snapshot } from './snapshot';
import type { CalEvent, DateStr, Recurrence } from './types';
import { taskDay } from './tasks';

/** Does a recurring series land on this date? */
export function recursOn(start: DateStr, r: Recurrence, date: DateStr): boolean {
  if (date < start) return false;
  if (date === start) return true;
  const n = Math.max(1, r.interval || 1);
  const diff = daysBetween(start, date);
  switch (r.type) {
    case 'none':
      return false;
    case 'daily':
      return diff % n === 0;
    case 'weekly':
      return diff % (7 * n) === 0;
    case 'weekdays': {
      const d = dayOfWeek(date);
      return d >= 1 && d <= 5;
    }
    case 'monthly': {
      const [sy, sm, sd] = start.split('-').map(Number);
      const [y, m, d] = date.split('-').map(Number);
      const months = (y - sy) * 12 + (m - sm);
      if (months % n !== 0) return false;
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return d === Math.min(sd, last);
    }
  }
}

export function eventOn(e: CalEvent, date: DateStr): boolean {
  if (e.exceptions.includes(date)) return false;
  return e.recurrence.type === 'none' ? e.date === date : recursOn(e.date, e.recurrence, date);
}

export type ItemKind = 'event' | 'block' | 'focus' | 'task' | 'habit';

export interface AgendaItem {
  key: string;
  kind: ItemKind;
  title: string;
  start: number; // minutes from midnight
  end: number;
  color: string | null;
  eventId?: string;
  taskId?: string;
  habitId?: string;
  done?: boolean;
  recurring?: boolean;
}

/** Everything with a time on a date: events and time blocks, timed tasks, timed habits. */
export function agendaFor(s: Snapshot, date: DateStr): AgendaItem[] {
  const out: AgendaItem[] = [];
  for (const e of s.events) {
    if (!eventOn(e, date)) continue;
    const start = toMinutes(e.start);
    let end = toMinutes(e.end);
    if (end <= start) end = start + 30;
    out.push({ key: `e:${e.id}`, kind: e.kind, title: e.title, start, end, color: e.categoryId ? (s.categoryById.get(e.categoryId)?.color ?? null) : null, eventId: e.id, taskId: e.taskId ?? undefined, recurring: e.recurrence.type !== 'none' });
  }
  const blockedTasks = new Set(out.filter((i) => i.taskId).map((i) => i.taskId));
  for (const t of s.tasks) {
    if (!t.plannedTime || blockedTasks.has(t.id)) continue;
    if ((t.done ? t.completedDate : taskDay(t)) !== date && t.plannedDate !== date) continue;
    const start = toMinutes(t.plannedTime);
    out.push({ key: `t:${t.id}`, kind: 'task', title: t.title, start, end: start + Math.max(15, t.estimateMin ?? 30), color: t.categoryId ? (s.categoryById.get(t.categoryId)?.color ?? null) : null, taskId: t.id, done: t.done });
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

export interface Conflict {
  a: AgendaItem;
  b: AgendaItem;
  overlapMin: number;
}

/** Pairs of commitments that overlap in time. Completed tasks are ignored. */
export function conflictsFor(items: AgendaItem[]): Conflict[] {
  const live = items.filter((i) => !i.done);
  const out: Conflict[] = [];
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
      if (overlap > 0) out.push({ a, b, overlapMin: overlap });
    }
  }
  return out;
}

/** Would a new slot clash with what's already on that date? */
export function clashesWith(s: Snapshot, date: DateStr, start: string, end: string, ignoreKey?: string): AgendaItem[] {
  const a = toMinutes(start);
  let b = toMinutes(end);
  if (b <= a) b = a + 30;
  return agendaFor(s, date).filter((i) => i.key !== ignoreKey && !i.done && Math.min(b, i.end) - Math.max(a, i.start) > 0);
}

export function scheduledMinutes(items: AgendaItem[]): number {
  // Union of intervals, so overlaps aren't double-counted.
  const iv = items.filter((i) => !i.done).map((i) => [i.start, i.end] as [number, number]).sort((x, y) => x[0] - y[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const [s0, e0] of iv) {
    if (!cur || s0 > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [s0, e0];
    } else cur[1] = Math.max(cur[1], e0);
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}

// ───────────────────────────── iCalendar export ─────────────────────────────

const icsDate = (d: DateStr, t: string) => `${d.replace(/-/g, '')}T${t.replace(':', '')}00`;
const esc = (x: string) => x.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** RFC 5545 calendar of events and time blocks, importable into Google Calendar and Apple Calendar. */
export function buildIcs(s: Snapshot): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Life OS//Schedule//EN', 'CALSCALE:GREGORIAN'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  for (const e of s.events) {
    lines.push('BEGIN:VEVENT', `UID:${e.id}@life-os`, `DTSTAMP:${stamp}`, `DTSTART:${icsDate(e.date, e.start)}`, `DTEND:${icsDate(e.date, e.end > e.start ? e.end : e.start)}`, `SUMMARY:${esc(e.title)}`);
    if (e.notes) lines.push(`DESCRIPTION:${esc(e.notes)}`);
    const n = Math.max(1, e.recurrence.interval || 1);
    const rr: Record<string, string> = { daily: `FREQ=DAILY;INTERVAL=${n}`, weekly: `FREQ=WEEKLY;INTERVAL=${n}`, weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', monthly: `FREQ=MONTHLY;INTERVAL=${n}` };
    if (e.recurrence.type !== 'none') lines.push(`RRULE:${rr[e.recurrence.type]}`);
    for (const x of e.exceptions) lines.push(`EXDATE:${icsDate(x, e.start)}`);
    lines.push('END:VEVENT');
  }
  for (const t of s.tasks) {
    if (t.done || !t.plannedDate || !t.plannedTime) continue;
    const endMin = toMinutes(t.plannedTime) + Math.max(15, t.estimateMin ?? 30);
    const end = `${String(Math.min(23, Math.floor(endMin / 60))).padStart(2, '0')}:${String(endMin >= 1440 ? 59 : endMin % 60).padStart(2, '0')}`;
    lines.push('BEGIN:VEVENT', `UID:task-${t.id}@life-os`, `DTSTAMP:${stamp}`, `DTSTART:${icsDate(t.plannedDate, t.plannedTime)}`, `DTEND:${icsDate(t.plannedDate, end)}`, `SUMMARY:${esc(t.title)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
