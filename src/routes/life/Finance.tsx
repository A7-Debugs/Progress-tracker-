import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { todayStr } from '@/lib/id';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Textarea } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toaster';
import { Collapsible, GoalBar, Ring, SectionTitle, Stat } from '@/components/life/Visuals';
import { COLORS } from '@/components/life/colors';
import { useLife } from '@/lib/life/useLife';
import { derive, fiStatus, gt3rsReadiness } from '@/lib/life/finance';
import type { FinanceSnapshot, LifeProfile } from '@/lib/life/types';

type NumKey = Exclude<keyof FinanceSnapshot, 'id' | 'month' | 'notes' | 'createdAt' | 'updatedAt'>;

const FIELDS: { key: NumKey; label: string; hint: string; group: 'flow' | 'assets' | 'liabilities' }[] = [
  { key: 'netIncome', label: 'Net income', hint: 'Take-home pay this month', group: 'flow' },
  { key: 'spending', label: 'Total spending', hint: 'Everything spent (excl. investing)', group: 'flow' },
  { key: 'essentialSpending', label: 'Essential spending', hint: 'Housing, bills, food, transport', group: 'flow' },
  { key: 'housingCost', label: 'Rent / mortgage payment', hint: 'Monthly housing cost', group: 'flow' },
  { key: 'invested', label: 'Invested this month', hint: 'ISA, pension top-ups, etc.', group: 'flow' },
  { key: 'cash', label: 'Cash & savings', hint: 'Current + general savings', group: 'assets' },
  { key: 'emergencyFund', label: 'Emergency fund', hint: 'Ring-fenced', group: 'assets' },
  { key: 'carFund', label: 'GT3 RS fund', hint: 'Ring-fenced car savings', group: 'assets' },
  { key: 'investments', label: 'Investments', hint: 'ISA, GIA, shares', group: 'assets' },
  { key: 'pension', label: 'Pension', hint: 'All pension pots', group: 'assets' },
  { key: 'homeValue', label: 'Home value', hint: 'Primary residence (0 if renting)', group: 'assets' },
  { key: 'investmentPropertyEquity', label: 'Investment property equity', hint: 'Buy-to-let value − its mortgage', group: 'assets' },
  { key: 'mortgage', label: 'Mortgage balance', hint: 'Primary residence', group: 'liabilities' },
  { key: 'otherDebt', label: 'Other debt', hint: 'Cards, loans, car finance', group: 'liabilities' },
];

const emptySnap = (month: string): FinanceSnapshot => ({
  id: month,
  month,
  netIncome: null,
  spending: null,
  essentialSpending: null,
  housingCost: null,
  invested: null,
  cash: null,
  emergencyFund: null,
  carFund: null,
  investments: null,
  pension: null,
  homeValue: null,
  mortgage: null,
  investmentPropertyEquity: null,
  otherDebt: null,
  notes: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export default function Finance() {
  const ctx = useLife();
  const toast = useToast();
  const [editing, setEditing] = useState<FinanceSnapshot | null>(null);

  const d = useMemo(() => {
    if (!ctx) return null;
    const snaps = ctx.finance;
    const latest = snaps[snaps.length - 1];
    return {
      latest,
      derived: latest ? derive(latest) : null,
      fi: fiStatus(ctx.profile, snaps),
      gt: gt3rsReadiness(ctx.profile, snaps),
      essentials: latest?.essentialSpending ?? null,
    };
  }, [ctx]);

  if (!ctx || !d) return null;
  const { profile } = ctx;
  const cur = profile.currency;
  const money = (x: number | null | undefined) => (x == null ? '—' : `${cur}${Math.round(x).toLocaleString()}`);

  function startNew() {
    const month = todayStr().slice(0, 7);
    const existing = ctx!.finance.find((f) => f.month === month);
    // Carry balances forward from the last snapshot so a monthly update takes seconds.
    const last = ctx!.finance[ctx!.finance.length - 1];
    setEditing(existing ?? (last ? { ...last, id: month, month, notes: '', createdAt: Date.now(), updatedAt: Date.now() } : emptySnap(month)));
  }

  async function saveSnap(s: FinanceSnapshot, originalId: string) {
    if (originalId !== s.month && ctx!.finance.some((f) => f.id === originalId)) await db.financeSnapshots.delete(originalId);
    await db.financeSnapshots.put({ ...s, id: s.month, updatedAt: Date.now() });
    setEditing(null);
    toast('Snapshot saved — weekly money check ticked');
  }

  async function removeSnap(id: string) {
    if (!confirm('Delete this snapshot?')) return;
    await db.financeSnapshots.delete(id);
  }

  const efMonths = d.latest && d.essentials ? (d.latest.emergencyFund ?? 0) / d.essentials : null;

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Finance & GT3 RS"
        right={
          <Button size="icon" variant="ghost" onClick={startNew} aria-label="Add snapshot">
            <Plus size={20} />
          </Button>
        }
      />
      <div className="px-4 pt-3 pb-24 flex flex-col gap-3">
        {!d.latest ? (
          <Card className="p-5 text-center">
            <p className="text-base font-semibold text-base-50">No finance data yet</p>
            <p className="text-sm text-base-400 mt-1">Add a monthly snapshot (5 minutes, once a month). Every number here is calculated from it — nothing is estimated.</p>
            <Button className="mt-4" onClick={startNew}>
              <Plus size={16} /> Add this month's snapshot
            </Button>
          </Card>
        ) : (
          <>
            <p className="text-xs text-base-500">Latest snapshot: {format(parseISO(`${d.latest.month}-01`), 'MMMM yyyy')}</p>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Net worth" value={money(d.derived!.netWorth)} />
              <Stat label="Liquid" value={money(d.derived!.liquid)} sub="Cash + EF + car fund" />
              <Stat label="Invested" value={money(d.derived!.fiAssets)} sub="Investments + pension + BTL" />
              <Stat label="Savings rate" value={d.derived!.savingsRate === null ? '—' : `${Math.round(d.derived!.savingsRate * 100)}%`} sub={`Target ${Math.round(profile.savingsRateTarget * 100)}%`} />
              <Stat label="Monthly surplus" value={money(d.derived!.surplus)} sub="After spending & investing" />
              <Stat label="Emergency fund" value={efMonths === null ? '—' : `${efMonths.toFixed(1)} mo`} sub={`Target ${profile.emergencyMonths} months`} />
            </div>
          </>
        )}

        <SectionTitle>Financial independence</SectionTitle>
        <Card className="p-4">
          <GoalBar
            label="Progress to FI"
            value={d.fi.progress}
            formula={`FI assets ÷ FI number. FI number = annual spending ÷ ${Math.round(profile.withdrawalRate * 100)}% safe withdrawal rate. Home equity and cash excluded — they don't fund your life.`}
            detail={d.fi.fiNumber ? `${money(d.fi.fiAssets)} of ${money(d.fi.fiNumber)}` : undefined}
            color={COLORS.accent}
          />
          <p className="text-xs text-base-400 mt-3">
            {d.fi.fiNumber
              ? `FI number ${money(d.fi.fiNumber)} = ${money(d.fi.annualSpend)}/yr spending (${d.fi.spendSource === 'profile' ? 'your setting' : '3-month average × 12'}) ÷ ${profile.withdrawalRate * 100}%.`
              : 'Insufficient data: add spending to a snapshot, or set target annual spending below.'}
          </p>
        </Card>

        <SectionTitle>GT3 RS readiness</SectionTitle>
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <Ring value={d.gt.readiness === null ? null : d.gt.readiness / 100} size={92} stroke={9} color={COLORS.gold}>
              <div className="text-center">
                <p className="text-xl font-bold text-base-50">{d.gt.readiness === null ? '—' : `${d.gt.readiness}%`}</p>
                <p className="text-[9px] text-base-400">ready</p>
              </div>
            </Ring>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-base-50 leading-snug">{d.gt.headline}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge variant={d.gt.canAfford ? 'accent' : 'neutral'}>"I can afford it": {d.gt.canAfford ? 'yes' : 'no'}</Badge>
                <Badge variant={d.gt.comfortable ? 'accent' : 'warn'}>"Comfortably, while progressing": {d.gt.comfortable ? 'yes' : 'no'}</Badge>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-base-500 mt-3">
            Symbolic milestone of financial independence — not a purchase target. Readiness is the weighted average of the 10 conditions below (scale conditions 2×, foundations 1×); the verdict is only "comfortable" when all 10 are met.
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-semibold text-base-50 flex items-center gap-1.5">
            <ShieldCheck size={15} className="text-gold" style={{ color: COLORS.gold }} /> What would make the GT3 RS a sensible purchase?
          </p>
          <p className="text-xs text-base-400 mt-0.5 mb-3">
            Price {money(profile.gt3rs.price)} · running {money(profile.gt3rs.annualRunningCost)}/yr · depreciation {Math.round(profile.gt3rs.annualDepreciationPct * 100)}%/yr
          </p>
          {d.gt.conditions.length === 0 ? (
            <p className="text-sm text-base-500">Insufficient data — add a snapshot.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {d.gt.conditions.map((c, i) => (
                <div key={c.key}>
                  <GoalBar label={`${i + 1}. ${c.label}${c.met ? ' ✓' : ''}`} value={c.progress} formula={c.formula} color={c.met ? COLORS.accent : COLORS.gold} />
                  <p className="text-xs text-base-300 mt-1">{c.requirement}</p>
                  <p className="text-[11px] text-base-500">Now: {c.current}</p>
                </div>
              ))}
            </div>
          )}
          {d.gt.missing.length > 0 && d.gt.conditions.length > 0 && (
            <p className="text-[11px] text-warn mt-3">Missing inputs (conditions score 0 until provided): {d.gt.missing.join(', ')}.</p>
          )}
        </Card>

        <SectionTitle right={<button onClick={startNew} className="text-xs text-accent">+ Snapshot</button>}>Monthly snapshots</SectionTitle>
        {[...ctx.finance].reverse().map((s) => {
          const x = derive(s);
          return (
            <Card key={s.id} className="p-3.5 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-base-100">{format(parseISO(`${s.month}-01`), 'MMMM yyyy')}</p>
                <p className="text-xs text-base-400">
                  NW {money(x.netWorth)} · saved {x.savingsRate === null ? '—' : `${Math.round(x.savingsRate * 100)}%`} · invested {money(s.invested)}
                </p>
              </div>
              <div className="flex shrink-0">
                <button onClick={() => setEditing(s)} className="h-8 w-8 flex items-center justify-center text-base-400 hover:text-base-100" aria-label="Edit">
                  <Pencil size={15} />
                </button>
                <button onClick={() => removeSnap(s.id)} className="h-8 w-8 flex items-center justify-center text-base-500 hover:text-danger" aria-label="Delete">
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          );
        })}

        <Card className="p-4">
          <Collapsible title="Financial settings & GT3 RS assumptions">
            <ProfileSettings profile={profile} />
          </Collapsible>
        </Card>
      </div>

      {editing && <SnapshotDialog snap={editing} currency={cur} onClose={() => setEditing(null)} onSave={saveSnap} />}
    </div>
  );
}

function SnapshotDialog({ snap, currency, onClose, onSave }: { snap: FinanceSnapshot; currency: string; onClose: () => void; onSave: (s: FinanceSnapshot, originalId: string) => void }) {
  const [s, setS] = useState(snap);
  const group = (g: (typeof FIELDS)[number]['group'], title: string) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-base-500 mb-2">{title}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {FIELDS.filter((f) => f.group === g).map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-base-300">
              {f.label} ({currency})
            </label>
            <Input type="number" inputMode="decimal" value={s[f.key] ?? ''} onChange={(e) => setS({ ...s, [f.key]: e.target.value === '' ? null : Number(e.target.value) })} />
            <span className="text-[10px] text-base-500">{f.hint}</span>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Monthly snapshot" description="Balances carry forward from last month — just update what changed.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-base-300">Month</label>
          <Input type="month" value={s.month} onChange={(e) => setS({ ...s, month: e.target.value, id: e.target.value })} />
        </div>
        {group('flow', 'This month')}
        {group('assets', 'Assets (balances)')}
        {group('liabilities', 'Liabilities')}
        <Textarea rows={2} placeholder="Notes" value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} />
        <Button onClick={() => onSave(s, snap.id)} disabled={!s.month}>
          Save snapshot
        </Button>
      </div>
    </Dialog>
  );
}

function ProfileSettings({ profile }: { profile: LifeProfile }) {
  const upd = (patch: Partial<LifeProfile>) => db.lifeProfile.update('life', patch);
  const g = profile.gt3rs;
  return (
    <div className="flex flex-col gap-3">
      <Row label="Currency symbol">
        <CommitInput value={profile.currency} text onCommit={(v) => upd({ currency: v || '£' })} />
      </Row>
      <Row label="Target annual spending in FI (blank = from snapshots)">
        <CommitInput value={profile.fiAnnualSpend ?? ''} onCommit={(v) => upd({ fiAnnualSpend: v === '' ? null : Number(v) })} />
      </Row>
      <PctRow label="Safe withdrawal rate %" value={profile.withdrawalRate} onCommit={(v) => upd({ withdrawalRate: v || 0.04 })} />
      <Row label="Emergency fund months">
        <CommitInput value={profile.emergencyMonths} onCommit={(v) => upd({ emergencyMonths: Number(v) || 6 })} />
      </Row>
      <PctRow label="Savings-rate target %" value={profile.savingsRateTarget} onCommit={(v) => upd({ savingsRateTarget: v || 0.2 })} />
      <PctRow label="Investing-rate target %" value={profile.investRateTarget} onCommit={(v) => upd({ investRateTarget: v || 0.15 })} />
      <p className="text-xs font-semibold uppercase tracking-wide text-base-500 mt-2">GT3 RS</p>
      <Row label="Purchase price">
        <CommitInput value={g.price} onCommit={(v) => Number(v) > 0 && upd({ gt3rs: { ...g, price: Number(v) } })} />
      </Row>
      <Row label="Annual running cost (insurance, servicing, tyres, fuel)">
        <CommitInput value={g.annualRunningCost} onCommit={(v) => Number(v) > 0 && upd({ gt3rs: { ...g, annualRunningCost: Number(v) } })} />
      </Row>
      <PctRow label="Annual depreciation %" value={g.annualDepreciationPct} onCommit={(v) => upd({ gt3rs: { ...g, annualDepreciationPct: v } })} />
      <PctRow label="Expected real investment return %" value={g.expectedRealReturnPct} onCommit={(v) => upd({ gt3rs: { ...g, expectedRealReturnPct: v } })} />
    </div>
  );
}

/** Edits locally and writes on blur, so partially typed numbers never hit the database. */
function CommitInput({ value, onCommit, text }: { value: string | number; onCommit: (v: string) => void; text?: boolean }) {
  const [v, setV] = useState(String(value));
  return (
    <Input
      type={text ? 'text' : 'number'}
      inputMode={text ? undefined : 'decimal'}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== String(value) && onCommit(v.trim())}
    />
  );
}

function PctRow({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  return (
    <Row label={label}>
      <CommitInput value={Math.round(value * 1000) / 10} onCommit={(v) => onCommit((Number(v) || 0) / 100)} />
    </Row>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-base-400">{label}</label>
      {children}
    </div>
  );
}
