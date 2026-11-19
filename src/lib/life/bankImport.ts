import type { BankMonth, RecurringTransfer } from './types';

/**
 * Reads Starling and Monzo CSV statement exports in the browser and returns monthly totals.
 * Nothing is uploaded and individual transactions are not stored — only the per-month totals you approve.
 */

/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, commas/newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

interface Txn {
  month: string; // yyyy-MM
  amount: number; // negative = money out
  name: string;
  category: string;
  type: string;
}

/** dd/mm/yyyy or yyyy-mm-dd → yyyy-MM */
function monthOf(date: string): string | null {
  const uk = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(date.trim());
  if (uk) return `${uk[3]}-${uk[2].padStart(2, '0')}`;
  const iso = /^(\d{4})-(\d{2})-\d{2}/.exec(date.trim());
  return iso ? `${iso[1]}-${iso[2]}` : null;
}

const num = (s: string) => Number(s.replace(/[£,\s]/g, ''));

export function detectSource(header: string[]): 'starling' | 'monzo' | null {
  const h = header.map((x) => x.trim().toLowerCase());
  if (h.includes('counter party') && h.some((x) => x.startsWith('amount (gbp)'))) return 'starling';
  if (h.includes('transaction id') && h.includes('category') && h.includes('amount')) return 'monzo';
  return null;
}

function toTxns(rows: string[][], source: 'starling' | 'monzo'): Txn[] {
  const header = rows[0].map((x) => x.trim().toLowerCase());
  const col = (name: string) => header.findIndex((x) => x === name || x.startsWith(name));
  const out: Txn[] = [];
  if (source === 'starling') {
    const [d, cp, ref, ty, amt, cat] = ['date', 'counter party', 'reference', 'type', 'amount (gbp)', 'spending category'].map(col);
    for (const r of rows.slice(1)) {
      const month = monthOf(r[d] ?? '');
      const amount = num(r[amt] ?? '');
      if (!month || Number.isNaN(amount)) continue;
      out.push({ month, amount, name: `${r[cp] ?? ''} ${r[ref] ?? ''}`.trim(), category: (r[cat] ?? '').trim(), type: (r[ty] ?? '').trim() });
    }
  } else {
    const [d, ty, nm, cat, amt, desc] = ['date', 'type', 'name', 'category', 'amount', 'description'].map(col);
    for (const r of rows.slice(1)) {
      const month = monthOf(r[d] ?? '');
      const amount = num(r[amt] ?? '');
      if (!month || Number.isNaN(amount)) continue;
      out.push({ month, amount, name: `${r[nm] ?? ''} ${r[desc] ?? ''}`.trim(), category: (r[cat] ?? '').trim(), type: (r[ty] ?? '').trim() });
    }
  }
  return out;
}

/**
 * Money moving between your own accounts/pots isn't spending, and recurring transfers you set up
 * (e.g. £1,651 to the Cyprus build) are counted separately.
 */
function isExcluded(t: Txn, recurring: RecurringTransfer[]): boolean {
  const text = `${t.category} ${t.type}`.toLowerCase();
  if (/transfer|saving|pot|internal/.test(text)) return true;
  return recurring.some((r) => Math.abs(Math.abs(t.amount) - r.amount) < 0.01);
}

export interface ImportResult {
  source: 'starling' | 'monzo';
  months: BankMonth[];
  transactions: number;
}

export function importStatement(text: string, recurring: RecurringTransfer[]): ImportResult {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  if (rows.length < 2) throw new Error('The file has no transactions.');
  const source = detectSource(rows[0]);
  if (!source) throw new Error('Not a Starling or Monzo CSV export (columns not recognised).');
  const txns = toTxns(rows, source);
  const by = new Map<string, BankMonth>();
  for (const t of txns) {
    const m = by.get(t.month) ?? { id: `${source}-${t.month}`, source, month: t.month, spending: 0, income: 0, excluded: 0, byCategory: {}, importedAt: Date.now() };
    if (isExcluded(t, recurring)) m.excluded += Math.abs(t.amount);
    else if (t.amount < 0) {
      m.spending += -t.amount;
      const key = t.category || 'Other';
      m.byCategory[key] = (m.byCategory[key] ?? 0) - t.amount;
    } else m.income += t.amount;
    by.set(t.month, m);
  }
  const months = [...by.values()]
    .map((m) => ({
      ...m,
      spending: Math.round(m.spending * 100) / 100,
      income: Math.round(m.income * 100) / 100,
      excluded: Math.round(m.excluded * 100) / 100,
      byCategory: Object.fromEntries(Object.entries(m.byCategory).map(([k, v]) => [k, Math.round(v * 100) / 100])),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
  return { source, months, transactions: txns.length };
}
