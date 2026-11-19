import type { DateStr } from './types';

/**
 * All date maths uses plain 'YYYY-MM-DD' strings handled as UTC-noon dates, so daylight-saving
 * changes (late March / late October in the UK) can never shift a day.
 */
const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date of a JS Date. */
export function localDate(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The "logical" today: before `dayStartHour` (e.g. 4am) still counts as yesterday. */
export function logicalDate(now: Date = new Date(), dayStartHour = 4): DateStr {
  const d = new Date(now.getTime());
  if (d.getHours() < dayStartHour) d.setDate(d.getDate() - 1);
  return localDate(d);
}

function toUTC(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}
function fromUTC(d: Date): DateStr {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = toUTC(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: DateStr, b: DateStr): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86400000);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(s: DateStr): number {
  return toUTC(s).getUTCDay();
}

/** Monday of the week containing s (UK weeks start on Monday). */
export function weekStart(s: DateStr): DateStr {
  const dow = dayOfWeek(s);
  return addDays(s, dow === 0 ? -6 : 1 - dow);
}

export function monthKey(s: DateStr): string {
  return s.slice(0, 7);
}

export function monthStart(s: DateStr): DateStr {
  return `${s.slice(0, 7)}-01`;
}

/** Inclusive list of dates from a to b. */
export function dateRange(a: DateStr, b: DateStr): DateStr[] {
  const out: DateStr[] = [];
  const n = daysBetween(a, b);
  for (let i = 0; i <= n; i++) out.push(addDays(a, i));
  return out;
}

export function weekDates(ws: DateStr): DateStr[] {
  return dateRange(ws, addDays(ws, 6));
}

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtShort(s: DateStr): string {
  const d = toUTC(s);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
export function fmtDay(s: DateStr): string {
  return `${DAY_SHORT[dayOfWeek(s)]} ${fmtShort(s)}`;
}
export function fmtMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Friendly relative label: Today, Tomorrow, Yesterday, in 3 days, 2 days ago. */
export function relDay(s: DateStr, today: DateStr): string {
  const n = daysBetween(today, s);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return `In ${n} days`;
  if (n < -1 && n > -7) return `${-n} days ago`;
  return fmtShort(s);
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
export function fromMinutes(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Sleep duration in minutes from bedtime to wake, crossing midnight if needed. */
export function sleepMinutes(bedtime: string, wake: string): number {
  let d = toMinutes(wake) - toMinutes(bedtime);
  if (d <= 0) d += 1440;
  return d;
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function hoursLabel(min: number): string {
  return `${(min / 60).toFixed(1)}h`;
}
