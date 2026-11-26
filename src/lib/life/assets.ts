import { addMonths, endOfMonth, format, parseISO } from 'date-fns';
import type { AssetKey, FinanceSnapshot, PaySettings, RecurringTransfer } from './types';

/**
 * Balances between snapshots: your last snapshot + every recurring transfer since (Cyprus build, investing, pension…).
 * Market growth isn't guessed — update balances from your apps in the monthly snapshot to capture it.
 */

export const ASSET_LABELS: Record<AssetKey, string> = {
  investmentPropertyEquity: 'Property (Cyprus build / investment)',
  homeValue: 'Home',
  investments: 'Investments (ISA, stocks)',
  pension: 'Pension',
  cash: 'Cash & savings',
  emergencyFund: 'Emergency fund',
  carFund: 'GT3 RS fund',
};

export const ASSET_KEYS = Object.keys(ASSET_LABELS) as AssetKey[];

export function assetFor(t: RecurringTransfer): AssetKey | null {
  if (t.asset !== undefined) return t.asset;
  return ({ property: 'investmentPropertyEquity', invest: 'investments', pension: 'pension', savings: 'cash', bill: null } as const)[t.kind];
}

const ds = (d: Date) => format(d, 'yyyy-MM-dd');

/** Every date a transfer is paid in (after, upTo]. */
export function transferDates(t: RecurringTransfer, after: string, upTo: string): string[] {
  const out: string[] = [];
  let m = parseISO(`${after.slice(0, 7)}-01`);
  while (ds(m) <= upTo) {
    const last = endOfMonth(m).getDate();
    const d = format(m, 'yyyy-MM') + '-' + String(Math.min(t.dayOfMonth, last)).padStart(2, '0');
    if (d > after && d <= upTo && (!t.since || d.slice(0, 7) >= t.since)) out.push(d);
    m = addMonths(m, 1);
  }
  return out;
}

export interface Contribution {
  transfer: RecurringTransfer;
  asset: AssetKey;
  count: number;
  amount: number;
}

/** Recurring transfers into assets between two dates (after, upTo]. */
export function contributionsBetween(pay: PaySettings | undefined, after: string, upTo: string): Contribution[] {
  return (pay?.recurring ?? []).flatMap((t) => {
    const asset = assetFor(t);
    if (!asset || t.amount <= 0) return [];
    const count = transferDates(t, after, upTo).length;
    return count ? [{ transfer: t, asset, count, amount: count * t.amount }] : [];
  });
}

export const monthEnd = (month: string) => ds(endOfMonth(parseISO(`${month}-01`)));

/** Mortgage is netted against the home so "Home" shows equity. */
export function assetValue(s: FinanceSnapshot, k: AssetKey): number {
  const v = s[k] ?? 0;
  return k === 'homeValue' ? v - (s.mortgage ?? 0) : v;
}

export interface LiveAsset {
  key: AssetKey;
  snapshot: number;
  added: number;
  now: number;
  sources: string[];
}

export interface LiveBalances {
  asOf: string | null; // snapshot month
  rows: LiveAsset[];
  total: number;
  added: number;
}

/** Today's estimated balances: latest snapshot + transfers made since the end of its month. */
export function liveBalances(finance: FinanceSnapshot[], pay: PaySettings | undefined, today: string): LiveBalances {
  const last = finance[finance.length - 1];
  const since = last ? monthEnd(last.month) : null;
  const contrib = since ? contributionsBetween(pay, since, today) : [];
  const rows = ASSET_KEYS.map((key) => {
    const snapshot = last ? assetValue(last, key) : 0;
    const mine = contrib.filter((c) => c.asset === key);
    const added = mine.reduce((a, c) => a + c.amount, 0);
    return { key, snapshot, added, now: snapshot + added, sources: mine.map((c) => `${c.transfer.label} ×${c.count}`) };
  }).filter((r) => r.snapshot !== 0 || r.added !== 0);
  return { asOf: last?.month ?? null, rows, total: rows.reduce((a, r) => a + r.now, 0), added: rows.reduce((a, r) => a + r.added, 0) };
}

/** Balances for a new snapshot month: carried from the previous snapshot + transfers up to the end of that month. */
export function carriedBalances(prev: FinanceSnapshot, pay: PaySettings | undefined, month: string): { values: Partial<Record<AssetKey, number>>; notes: Partial<Record<AssetKey, string>> } {
  const contrib = contributionsBetween(pay, monthEnd(prev.month), monthEnd(month));
  const values: Partial<Record<AssetKey, number>> = {};
  const notes: Partial<Record<AssetKey, string>> = {};
  for (const c of contrib) {
    values[c.asset] = (values[c.asset] ?? prev[c.asset] ?? 0) + c.amount;
    notes[c.asset] = `${notes[c.asset] ? notes[c.asset] + ' + ' : ''}${c.transfer.label} £${c.amount.toLocaleString()}`;
  }
  return { values, notes };
}

/** Transfers paid during one month, by kind — for the snapshot's "invested" and "property contributions" fields. */
export function monthContributions(pay: PaySettings | undefined, month: string): { invested: number; property: number } {
  const prevEnd = monthEnd(format(addMonths(parseISO(`${month}-01`), -1), 'yyyy-MM'));
  const c = contributionsBetween(pay, prevEnd, monthEnd(month));
  return {
    invested: c.filter((x) => x.asset === 'investments' || x.asset === 'pension').reduce((a, x) => a + x.amount, 0),
    property: c.filter((x) => x.asset === 'investmentPropertyEquity' || x.asset === 'homeValue').reduce((a, x) => a + x.amount, 0),
  };
}

/** Five groups for the asset-mix chart. */
export const ASSET_GROUPS: { key: string; label: string; keys: AssetKey[] }[] = [
  { key: 'property', label: 'Property', keys: ['investmentPropertyEquity', 'homeValue'] },
  { key: 'investments', label: 'Investments', keys: ['investments'] },
  { key: 'pension', label: 'Pension', keys: ['pension'] },
  { key: 'cash', label: 'Cash & emergency', keys: ['cash', 'emergencyFund'] },
  { key: 'car', label: 'GT3 RS fund', keys: ['carFund'] },
];
