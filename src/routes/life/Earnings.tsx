import { useMemo, useRef, useState } from 'react';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { FileUp, Plus, Receipt, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toaster';
import { Collapsible, SectionTitle, Stat, TrendBars } from '@/components/life/Visuals';
import { COLORS } from '@/components/life/colors';
import { defaultPay } from '@/lib/life/defaults';
import { grossFor, hoursOfWork, monthEarnings, paidHours, payday, projectMonth, rateOn, safeToSpend, spentInMonth, takeHomeRatio, workMonthPaidIn } from '@/lib/life/earnings';
import { importStatement, type ImportResult } from '@/lib/life/bankImport';
import { ASSET_KEYS, ASSET_LABELS, assetFor } from '@/lib/life/assets';
import type { LifeContext } from '@/lib/life/engine';
import type { AssetKey, BankMonth, PaySettings, Payslip, RecurringTransfer } from '@/lib/life/types';

const gbp = (x: number) => `£${Math.round(x).toLocaleString()}`;
const gbp2 = (x: number) => `£${x.toFixed(2)}`;

export function Earnings({ ctx }: { ctx: LifeContext }) {
  const pay = ctx.profile.pay ?? defaultPay();
  const toast = useToast();
  const [slipOpen, setSlipOpen] = useState(false);
  const [preview, setPreview] = useState<ImportResult[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const save = (patch: Partial<PaySettings>) => db.lifeProfile.update('life', { pay: { ...pay, ...patch } });

  const d = useMemo(() => {
    const month = ctx.today.slice(0, 7);
    const latest = ctx.finance[ctx.finance.length - 1];
    const bills = latest?.essentialSpending ?? 0;
    const today = ctx.byDate.get(ctx.today);
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const ws = startOfWeek(addDays(parseISO(ctx.today), -7 * (7 - i)), {
        weekStartsOn: 1,
      });
      const days = ctx.checkins.filter((c) => {
        const t = parseISO(c.date).getTime();
        return t >= ws.getTime() && t < addDays(ws, 7).getTime();
      });
      const hours = days.reduce((a, c) => a + paidHours(pay, c.workHours), 0);
      const gross = days.reduce((a, c) => a + grossFor(pay, c), 0);
      return {
        label: format(ws, 'd MMM'),
        hours: Math.round(hours * 10) / 10,
        net: Math.round(gross * takeHomeRatio(pay).ratio),
      };
    });
    const withHours = weeks.filter((w) => w.hours > 0);
    return {
      month,
      bills,
      thisMonth: monthEarnings(pay, ctx.checkins, month),
      proj: projectMonth(pay, ctx.checkins, ctx.today),
      safe: safeToSpend(pay, ctx.checkins, ctx.today, bills),
      spent: spentInMonth(ctx.checkins, pay.bankMonths, month),
      todayGross: today ? grossFor(pay, today) : 0,
      todayHours: today ? paidHours(pay, today.workHours) : 0,
      payday: payday(month, pay.paydayOffset),
      ratio: takeHomeRatio(pay),
      weeks,
      avgWeekHours: withHours.length ? withHours.reduce((a, w) => a + w.hours, 0) / withHours.length : null,
    };
  }, [ctx, pay]);

  const rate = rateOn(pay, ctx.today);
  const netHour = rate * d.ratio.ratio;
  const daysToPay = Math.round((parseISO(d.payday).getTime() - parseISO(ctx.today).getTime()) / 86400000);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const results: ImportResult[] = [];
    for (const f of Array.from(files)) {
      try {
        results.push(importStatement(await f.text(), pay.recurring));
      } catch (e) {
        toast(`${f.name}: ${(e as Error).message}`, 'warn');
      }
    }
    if (fileRef.current) fileRef.current.value = '';
    if (results.length) setPreview(results);
  }

  async function applyImport() {
    const incoming = preview!.flatMap((r) => r.months);
    const ids = new Set(incoming.map((m) => m.id));
    await save({
      bankMonths: [...pay.bankMonths.filter((m) => !ids.has(m.id)), ...incoming].sort((a, b) => a.month.localeCompare(b.month)),
    });
    setPreview(null);
    toast(`Imported ${incoming.length} month${incoming.length === 1 ? '' : 's'} of spending totals`);
  }

  return (
    <>
      <SectionTitle>Earnings · {format(parseISO(`${d.month}-01`), 'MMMM')}</SectionTitle>
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Hours" value={d.thisMonth.hours.toFixed(1)} sub={`${d.thisMonth.daysWorked} days`} />
          <Stat label="Gross" value={gbp(d.thisMonth.gross)} sub={`£${rate.toFixed(2)}/h`} />
          <Stat label="Take-home" value={gbp(d.thisMonth.net)} sub={d.thisMonth.payslip ? 'payslip' : `est. ${Math.round(d.ratio.ratio * 100)}%`} />
        </div>
        <p className="text-xs text-base-300 mt-3">
          Today: {d.todayHours ? `${d.todayHours}h → ${gbp2(d.todayGross)} gross (~${gbp2(d.todayGross * d.ratio.ratio)} take-home)` : 'no hours logged yet'}
        </p>
        <p className="text-xs text-base-300 mt-1">
          On pace for <span className="text-base-50 font-semibold">{gbp(d.proj.projectedNet)}</span> take-home ({d.proj.basis}).
        </p>
        <p className="text-xs text-base-300 mt-1">
          Payday: {format(parseISO(d.payday), 'EEE d MMM')}
          {daysToPay > 0 ? ` · in ${daysToPay} day${daysToPay === 1 ? '' : 's'}` : daysToPay === 0 ? ' · today' : ''}
          {!pay.paidSameMonth && ` (pays ${format(parseISO(`${workMonthPaidIn(d.month, false)}-01`), 'MMMM')}'s hours)`}
        </p>
        {d.ratio.source === 'default' && <p className="text-[11px] text-warn mt-1">Take-home is an 80% estimate until you add a payslip.</p>}
      </Card>

      <Card className="p-4">
        <p className="text-sm font-semibold text-base-50">Where this month's money goes</p>
        <div className="mt-2 text-xs flex flex-col gap-1">
          <Row label="Expected take-home" value={gbp(d.safe.income)} />
          {pay.recurring.map((r) => (
            <Row key={r.id} label={`${r.label} (${ordinal(r.dayOfMonth)})`} value={`−${gbp(r.amount)}`} />
          ))}
          <Row label="Essential bills (latest snapshot)" value={`−${gbp(d.safe.bills)}`} />
          <Row label={`Spent so far (${d.spent.source === 'bank' ? 'bank import' : d.spent.source === 'checkins' ? 'check-ins' : 'nothing logged'})`} value={`−${gbp(d.safe.spent)}`} />
          <div className="border-t border-base-800 pt-1 mt-1">
            <Row label="Left for the rest of the month" value={gbp(d.safe.left)} strong color={d.safe.left < 0 ? COLORS.danger : COLORS.accent} />
          </div>
        </div>
        {d.safe.income <= 0 ? (
          <p className="text-xs text-base-400 mt-2">Log hours in the check-in's Work card (or add this month's payslip) to see what's safe to spend.</p>
        ) : (
          <>
            <p className={`text-sm font-semibold mt-2 ${d.safe.left < 0 ? 'text-danger' : 'text-accent'}`}>
              {d.safe.perDay !== null &&
                (d.safe.left >= 0 ? `Safe to spend: ${gbp2(d.safe.perDay)} / day for ${d.safe.daysLeft} days` : `Over by ${gbp(-d.safe.left)} — the gap comes from savings this month`)}
            </p>
            {d.safe.recurring > d.safe.income * 0.7 && (
              <p className="text-[11px] text-base-400 mt-1">Recurring transfers take {Math.round((d.safe.recurring / Math.max(1, d.safe.income)) * 100)}% of expected take-home this month.</p>
            )}
          </>
        )}
      </Card>

      <Card className="p-4">
        <p className="text-sm font-semibold text-base-50">Weekly take-home</p>
        <p className="text-[11px] text-base-500 mb-2">Estimated from hours × rate × take-home %</p>
        <TrendBars data={d.weeks} dataKey="net" unit="" color={COLORS.accent} height={140} />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Stat label="Avg hours / week" value={d.avgWeekHours === null ? '—' : d.avgWeekHours.toFixed(1)} sub="weeks with work" />
          <Stat label="Take-home / hour" value={gbp2(netHour)} sub={`£${rate.toFixed(2)} gross`} />
        </div>
        <p className="text-[11px] text-base-400 mt-3">
          In hours of work: this month's spending so far = {fmtHours(hoursOfWork(d.safe.spent, pay, ctx.today))} · the GT3 RS = {fmtHours(hoursOfWork(ctx.profile.gt3rs.price, pay, ctx.today))}.
        </p>
      </Card>

      <Card className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-base-50">Payslips</p>
          <Button size="sm" variant="secondary" onClick={() => setSlipOpen(true)}>
            <Receipt size={14} /> Add payslip
          </Button>
        </div>
        <p className="text-[11px] text-base-500">
          Each payslip corrects that month's income and sharpens the take-home % (
          {d.ratio.source === 'payslips' ? `${Math.round(d.ratio.ratio * 1000) / 10}% from ${d.ratio.count} payslip${d.ratio.count === 1 ? '' : 's'}` : 'using an 80% estimate'}
          ).
        </p>
        {[...pay.payslips].reverse().map((p) => {
          const est = monthEarnings({ ...pay, payslips: [] }, ctx.checkins, p.month).estNet;
          return (
            <div key={p.month} className="flex items-center justify-between text-xs border-t border-base-800 pt-2">
              <div>
                <p className="text-base-100 font-medium">{format(parseISO(`${p.month}-01`), 'MMMM yyyy')}</p>
                <p className="text-base-400">
                  {gbp2(p.gross)} gross → {gbp2(p.net)} net ({Math.round((p.net / p.gross) * 100)}%)
                  {est > 0 && ` · hours estimate was ${gbp(est)}`}
                </p>
              </div>
              <button
                onClick={() =>
                  save({
                    payslips: pay.payslips.filter((x) => x.month !== p.month),
                  })
                }
                className="h-8 w-8 flex items-center justify-center text-base-500 hover:text-danger"
                aria-label="Delete payslip"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </Card>

      <Card className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-base-50">Bank statements</p>
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
            <FileUp size={14} /> Import CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        </div>
        <p className="text-[11px] text-base-500">
          Starling: Account → Statements → Export CSV. Monzo: Account → Bank statements → Export → CSV. Read on this phone only; just the monthly totals are kept. Transfers between your own
          accounts/pots and recurring transfers (Cyprus) are left out of spending.
        </p>
        {[...pay.bankMonths]
          .reverse()
          .slice(0, 6)
          .map((m) => (
            <div key={m.id} className="flex items-center justify-between text-xs border-t border-base-800 pt-2">
              <span className="text-base-100">
                {format(parseISO(`${m.month}-01`), 'MMM yyyy')} · {m.source === 'starling' ? 'Starling' : 'Monzo'}
              </span>
              <span className="text-base-300">
                spent {gbp(m.spending)} · in {gbp(m.income)}
              </span>
            </div>
          ))}
      </Card>

      <Card className="p-4">
        <Collapsible title="Pay settings">
          <PaySettingsPanel pay={pay} today={ctx.today} save={save} />
        </Collapsible>
      </Card>

      {slipOpen && (
        <PayslipDialog
          onClose={() => setSlipOpen(false)}
          defaultMonth={workMonthPaidIn(d.month, pay.paidSameMonth)}
          onSave={(p) =>
            save({
              payslips: [...pay.payslips.filter((x) => x.month !== p.month), p],
            })
          }
        />
      )}
      {preview && <ImportPreview results={preview} onCancel={() => setPreview(null)} onSave={applyImport} />}
    </>
  );
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
const fmtHours = (h: number | null) => (h === null ? '—' : h >= 100 ? `${Math.round(h).toLocaleString()} h` : `${h.toFixed(1)} h`);

function Row({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className={strong ? 'text-base-50 font-semibold' : 'text-base-400'}>{label}</span>
      <span className={`tabular-nums ${strong ? 'font-semibold' : 'text-base-200'}`} style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

function PayslipDialog({ defaultMonth, onClose, onSave }: { defaultMonth: string; onClose: () => void; onSave: (p: Payslip) => void }) {
  const [f, setF] = useState({
    month: defaultMonth,
    gross: '',
    net: '',
    tax: '',
    ni: '',
    pension: '',
    studentLoan: '',
  });
  const n = (x: string) => (x.trim() === '' ? null : Number(x));
  const ok = f.month && Number(f.gross) > 0 && Number(f.net) > 0 && Number(f.net) <= Number(f.gross);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Add payslip" description="Copy these from your payslip. Only gross and take-home are required.">
      <div className="flex flex-col gap-3">
        <Field label="Month the pay is for">
          <Input type="month" value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gross pay (£)">
            <Input type="number" inputMode="decimal" value={f.gross} onChange={(e) => setF({ ...f, gross: e.target.value })} />
          </Field>
          <Field label="Take-home / net pay (£)">
            <Input type="number" inputMode="decimal" value={f.net} onChange={(e) => setF({ ...f, net: e.target.value })} />
          </Field>
          <Field label="Tax (optional)">
            <Input type="number" inputMode="decimal" value={f.tax} onChange={(e) => setF({ ...f, tax: e.target.value })} />
          </Field>
          <Field label="NI (optional)">
            <Input type="number" inputMode="decimal" value={f.ni} onChange={(e) => setF({ ...f, ni: e.target.value })} />
          </Field>
          <Field label="Pension (optional)">
            <Input type="number" inputMode="decimal" value={f.pension} onChange={(e) => setF({ ...f, pension: e.target.value })} />
          </Field>
          <Field label="Student loan (optional)">
            <Input type="number" inputMode="decimal" value={f.studentLoan} onChange={(e) => setF({ ...f, studentLoan: e.target.value })} />
          </Field>
        </div>
        <Button
          disabled={!ok}
          onClick={() => {
            onSave({
              month: f.month,
              gross: Number(f.gross),
              net: Number(f.net),
              tax: n(f.tax),
              ni: n(f.ni),
              pension: n(f.pension),
              studentLoan: n(f.studentLoan),
            });
            onClose();
          }}
        >
          Save payslip
        </Button>
      </div>
    </Dialog>
  );
}

function ImportPreview({ results, onCancel, onSave }: { results: ImportResult[]; onCancel: () => void; onSave: () => void }) {
  const months: BankMonth[] = results.flatMap((r) => r.months);
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()} title="Check the import" description="Only these monthly totals will be saved. Nothing leaves your phone.">
      <div className="flex flex-col gap-2">
        {results.map((r) => (
          <p key={r.source} className="text-xs text-base-400">
            {r.source === 'starling' ? 'Starling' : 'Monzo'}: {r.transactions} transactions
          </p>
        ))}
        {months.map((m) => {
          const top = Object.entries(m.byCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([k, v]) => `${k.replace(/_/g, ' ').toLowerCase()} ${gbp(v)}`)
            .join(' · ');
          return (
            <div key={m.id} className="rounded-xl bg-base-850 border border-base-700 p-3 text-xs">
              <p className="text-base-50 font-semibold">
                {format(parseISO(`${m.month}-01`), 'MMMM yyyy')} · {m.source === 'starling' ? 'Starling' : 'Monzo'}
              </p>
              <p className="text-base-300 mt-0.5">
                Spent {gbp(m.spending)} · money in {gbp(m.income)} · left out {gbp(m.excluded)} (transfers / pots / recurring)
              </p>
              {top && <p className="text-base-500 mt-0.5">Top: {top}</p>}
            </div>
          );
        })}
        <Button onClick={onSave}>Save totals</Button>
      </div>
    </Dialog>
  );
}

function PaySettingsPanel({ pay, today, save }: { pay: PaySettings; today: string; save: (p: Partial<PaySettings>) => void }) {
  const [rate, setRate] = useState(String(rateOn(pay, today)));
  const [from, setFrom] = useState(today);
  const [offset, setOffset] = useState(String(pay.paydayOffset));
  const [brk, setBrk] = useState(String(pay.unpaidBreakMin ?? 0));
  const [r, setR] = useState<RecurringTransfer>({
    id: '',
    label: '',
    amount: 0,
    dayOfMonth: 1,
    kind: 'property',
  });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-base-400">Hourly rate history: {pay.rates.map((x) => `£${x.gross.toFixed(2)} from ${x.from}`).join(' → ')}</p>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <Field label="New gross rate (£/h)">
          <Input type="number" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </Field>
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Button
          size="sm"
          disabled={!(Number(rate) > 0)}
          onClick={() =>
            save({
              rates: [...pay.rates.filter((x) => x.from !== from), { from, gross: Number(rate) }].sort((a, b) => a.from.localeCompare(b.from)),
            })
          }
        >
          Set
        </Button>
      </div>
      <Field label="Unpaid break per shift (minutes, taken off shifts over 6h)">
        <Input type="number" inputMode="numeric" value={brk} onChange={(e) => setBrk(e.target.value)} onBlur={() => save({ unpaidBreakMin: Math.max(0, Math.min(120, Number(brk) || 0)) })} />
      </Field>
      <p className="text-[11px] text-base-500 -mt-2">Set this if you log clock-in to clock-out time. Leave at 0 if you log paid hours only.</p>
      <Field label="Paid this many working days before the month's last working day">
        <Input type="number" value={offset} onChange={(e) => setOffset(e.target.value)} onBlur={() => save({ paydayOffset: Math.max(0, Number(offset) || 0) })} />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-base-100">Paid for the same month you work</span>
        <Switch checked={pay.paidSameMonth} onCheckedChange={(v) => save({ paidSameMonth: v })} />
      </div>
      <p className="text-xs font-semibold text-base-200 mt-1">Recurring transfers</p>
      <p className="text-[11px] text-base-500 -mt-2">Each transfer adds to the asset you pick, every month, so your balances grow between snapshots.</p>
      {pay.recurring.map((x) => {
        const upd = (patch: Partial<RecurringTransfer>) => save({ recurring: pay.recurring.map((y) => (y.id === x.id ? { ...y, ...patch } : y)) });
        return (
          <div key={x.id} className="flex flex-col gap-1.5 border-t border-base-800 pt-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-base-100 font-medium">
                {x.label} · £{x.amount.toLocaleString()} on the {ordinal(x.dayOfMonth)}
              </span>
              <button onClick={() => save({ recurring: pay.recurring.filter((y) => y.id !== x.id) })} className="h-8 w-8 flex items-center justify-center text-base-500 hover:text-danger" aria-label={`Remove ${x.label}`}>
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base-500 shrink-0">Adds to</span>
              <select
                aria-label={`Asset for ${x.label}`}
                value={assetFor(x) ?? 'none'}
                onChange={(e) => upd({ asset: e.target.value === 'none' ? null : (e.target.value as AssetKey) })}
                className="h-9 flex-1 min-w-0 rounded-lg bg-base-850 border border-base-700 px-2 text-xs text-base-100"
              >
                {ASSET_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {ASSET_LABELS[k]}
                  </option>
                ))}
                <option value="none">Nothing (it's a bill)</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-base-300">
              <input type="checkbox" checked={!!x.fromSalary} onChange={(e) => upd({ fromSalary: e.target.checked })} />
              Taken from salary before pay (e.g. workplace pension) — don't take it off take-home again
            </label>
          </div>
        );
      })}
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Label" value={r.label} onChange={(e) => setR({ ...r, label: e.target.value })} />
        <Input type="number" placeholder="£ amount" value={r.amount || ''} onChange={(e) => setR({ ...r, amount: Number(e.target.value) })} />
        <Input
          type="number"
          placeholder="Day of month"
          value={r.dayOfMonth}
          onChange={(e) =>
            setR({
              ...r,
              dayOfMonth: Math.min(28, Math.max(1, Number(e.target.value) || 1)),
            })
          }
        />
        <select
          value={r.kind}
          onChange={(e) => setR({ ...r, kind: e.target.value as RecurringTransfer['kind'] })}
          className="h-11 rounded-xl bg-base-850 border border-base-700 px-3 text-sm text-base-50"
        >
          <option value="property">Property</option>
          <option value="invest">Investing (ISA / stocks)</option>
          <option value="pension">Pension</option>
          <option value="savings">Savings</option>
          <option value="bill">Bill</option>
        </select>
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={!r.label.trim() || !(r.amount > 0)}
        onClick={() => {
          save({
            recurring: [...pay.recurring, { ...r, id: newId(), label: r.label.trim(), fromSalary: r.kind === 'pension' ? true : undefined, since: today.slice(0, 7) }],
          });
          setR({
            id: '',
            label: '',
            amount: 0,
            dayOfMonth: 1,
            kind: 'property',
          });
        }}
      >
        <Plus size={14} /> Add recurring transfer
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-base-400">{label}</label>
      {children}
    </div>
  );
}
