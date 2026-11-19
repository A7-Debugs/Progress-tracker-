import { addMonths, endOfMonth, format, parseISO } from 'date-fns';
import type { BankMonth, DailyCheckin, PaySettings, Payslip } from './types';

/** Used until the first payslip is entered (UK basic-rate tax + NI + pension at this pay level). */
export const DEFAULT_TAKE_HOME = 0.8;

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Gross hourly rate in force on a date. */
export function rateOn(pay: PaySettings | undefined, date: string): number {
  const rates = pay?.rates ?? [];
  if (!rates.length) return 0;
  let r = rates[0].gross;
  for (const x of rates) if (x.from <= date) r = x.gross;
  return r;
}

export function grossFor(pay: PaySettings | undefined, c: Pick<DailyCheckin, 'date' | 'workHours' | 'rateMultiplier'>): number {
  return round2((c.workHours ?? 0) * rateOn(pay, c.date) * (c.rateMultiplier ?? 1));
}

/** Take-home ÷ gross, averaged over the last 3 payslips (or the default until one is entered). */
export function takeHomeRatio(pay: PaySettings | undefined): { ratio: number; source: 'payslips' | 'default'; count: number } {
  const slips = [...(pay?.payslips ?? [])].filter((p) => p.gross > 0 && p.net > 0).sort((a, b) => a.month.localeCompare(b.month)).slice(-3);
  if (!slips.length) return { ratio: DEFAULT_TAKE_HOME, source: 'default', count: 0 };
  return { ratio: slips.reduce((a, p) => a + p.net / p.gross, 0) / slips.length, source: 'payslips', count: slips.length };
}

const isWeekday = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;

/** Payday: `offset` working days before the last working day of the month (bank holidays not included). */
export function payday(month: string, offset: number): string {
  const d = endOfMonth(parseISO(`${month}-01`));
  while (!isWeekday(d)) d.setDate(d.getDate() - 1);
  let left = offset;
  while (left > 0) {
    d.setDate(d.getDate() - 1);
    if (isWeekday(d)) left--;
  }
  return format(d, 'yyyy-MM-dd');
}

/** The month whose hours are paid on a given month's payday. */
export function workMonthPaidIn(month: string, paidSameMonth: boolean): string {
  return paidSameMonth ? month : format(addMonths(parseISO(`${month}-01`), -1), 'yyyy-MM');
}

export interface MonthEarnings {
  month: string;
  hours: number;
  daysWorked: number;
  gross: number;
  estNet: number;
  payslip: Payslip | null;
  /** Actual take-home if a payslip exists for the month, else the estimate. */
  net: number;
}

export function monthEarnings(pay: PaySettings | undefined, checkins: DailyCheckin[], month: string): MonthEarnings {
  const days = checkins.filter((c) => c.date.startsWith(month) && (c.workHours ?? 0) > 0);
  const hours = days.reduce((a, c) => a + (c.workHours ?? 0), 0);
  const gross = round2(days.reduce((a, c) => a + grossFor(pay, c), 0));
  const estNet = round2(gross * takeHomeRatio(pay).ratio);
  const payslip = pay?.payslips.find((p) => p.month === month) ?? null;
  return { month, hours, daysWorked: days.length, gross, estNet, payslip, net: payslip?.net ?? estNet };
}

export function recurringTotal(pay: PaySettings | undefined, kind?: 'property' | 'invest' | 'savings' | 'bill'): number {
  return (pay?.recurring ?? []).filter((r) => !kind || r.kind === kind).reduce((a, r) => a + r.amount, 0);
}

/** Average hours per calendar day over the last 28 days of check-ins (days without hours count as 0). */
export function avgDailyHours(checkins: DailyCheckin[], today: string): number | null {
  const start = format(addMonths(parseISO(today), 0).getTime() - 27 * 86400000, 'yyyy-MM-dd');
  const recent = checkins.filter((c) => c.date >= start && c.date <= today);
  if (recent.length < 7) return null;
  return recent.reduce((a, c) => a + (c.workHours ?? 0), 0) / recent.length;
}

export interface Projection {
  month: string;
  grossSoFar: number;
  projectedGross: number;
  projectedNet: number;
  daysLeft: number;
  basis: string;
}

/** Month-end projection: hours logged so far + your recent average hours/day for the days left. */
export function projectMonth(pay: PaySettings | undefined, checkins: DailyCheckin[], today: string): Projection {
  const month = today.slice(0, 7);
  const soFar = monthEarnings(pay, checkins, month);
  const end = format(endOfMonth(parseISO(today)), 'yyyy-MM-dd');
  const daysLeft = Math.max(0, Math.round((parseISO(end).getTime() - parseISO(today).getTime()) / 86400000));
  const perDay = avgDailyHours(checkins, today);
  const rest = perDay === null ? 0 : perDay * daysLeft * rateOn(pay, today);
  const projectedGross = round2(soFar.gross + rest);
  return {
    month,
    grossSoFar: soFar.gross,
    projectedGross,
    projectedNet: soFar.payslip?.net ?? round2(projectedGross * takeHomeRatio(pay).ratio),
    daysLeft,
    basis: perDay === null ? 'hours logged so far only' : `hours so far + ${perDay.toFixed(1)} h/day for ${daysLeft} more days`,
  };
}

/**
 * Spending so far in a month, with the least typing:
 * imported bank totals if available, else weekly totals entered at the money check, plus any "spent today"
 * entries on days not covered by a weekly total.
 */
export function spentInMonth(checkins: DailyCheckin[], bank: BankMonth[], month: string): { amount: number; source: 'bank' | 'checkins' | 'none' } {
  const b = bank.filter((x) => x.month === month);
  if (b.length) return { amount: round2(b.reduce((a, x) => a + x.spending, 0)), source: 'bank' };
  const inMonth = checkins.filter((c) => c.date.startsWith(month));
  const weekly = inMonth.filter((c) => c.spentWeek != null);
  const covered = new Set<string>();
  for (const w of weekly) for (let i = 0; i < 7; i++) covered.add(format(parseISO(w.date).getTime() - i * 86400000, 'yyyy-MM-dd'));
  const daily = inMonth.filter((c) => c.spentToday != null && !covered.has(c.date));
  const amount = weekly.reduce((a, c) => a + (c.spentWeek ?? 0), 0) + daily.reduce((a, c) => a + (c.spentToday ?? 0), 0);
  return { amount: round2(amount), source: weekly.length || daily.length ? 'checkins' : 'none' };
}

export interface SafeToSpend {
  income: number;
  recurring: number;
  bills: number;
  spent: number;
  left: number;
  perDay: number | null;
  daysLeft: number;
}

/** What's left this month after the Cyprus transfer and other recurring payments, bills and spending so far. */
export function safeToSpend(pay: PaySettings | undefined, checkins: DailyCheckin[], today: string, monthlyBills: number): SafeToSpend {
  const p = projectMonth(pay, checkins, today);
  const recurring = recurringTotal(pay);
  const spent = spentInMonth(checkins, pay?.bankMonths ?? [], p.month).amount;
  const left = round2(p.projectedNet - recurring - monthlyBills - spent);
  const daysLeft = p.daysLeft + 1;
  return { income: p.projectedNet, recurring, bills: monthlyBills, spent, left, perDay: daysLeft > 0 ? round2(left / daysLeft) : null, daysLeft };
}

/** How many hours of work (after tax) something costs. */
export function hoursOfWork(amount: number, pay: PaySettings | undefined, date: string): number | null {
  const perHour = rateOn(pay, date) * takeHomeRatio(pay).ratio;
  return perHour > 0 ? amount / perHour : null;
}
