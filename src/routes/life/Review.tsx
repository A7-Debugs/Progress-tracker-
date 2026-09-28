import { useMemo, useState } from 'react';
import { addMonths, endOfMonth, format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { SectionTitle } from '@/components/life/Visuals';
import { scoreColor } from '@/components/life/colors';
import { useLife } from '@/lib/life/useLife';
import { DOMAIN_LABELS, LEVELS } from '@/lib/life/habits';
import { addDaysStr, ds, evaluatePeriod, type LifeContext, type PeriodEval } from '@/lib/life/engine';
import { classify, explainTrajectory, frictionReports, goalAlignment, type Trajectory } from '@/lib/life/insights';
import { derive, fiStatus } from '@/lib/life/finance';
import type { Domain } from '@/lib/life/types';
import { WeekReview } from './WeekReview';

export default function Review() {
  const ctx = useLife();
  if (!ctx) return null;
  return (
    <div className="animate-fade-in">
      <TopBar title="Reviews" />
      <div className="px-4 pt-3 pb-24">
        <Tabs defaultValue="week">
          <TabsList className="w-full grid grid-cols-3 mb-3">
            <TabsTrigger value="week">Weekly</TabsTrigger>
            <TabsTrigger value="month">Monthly</TabsTrigger>
            <TabsTrigger value="quarter">Quarterly</TabsTrigger>
          </TabsList>
          <TabsContent value="week">
            <WeekReview ctx={ctx} />
          </TabsContent>
          <TabsContent value="month">
            <MonthReview ctx={ctx} />
          </TabsContent>
          <TabsContent value="quarter">
            <QuarterReview ctx={ctx} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

const TRAJ_VARIANT: Record<Trajectory, 'danger' | 'neutral' | 'accent' | 'info'> = {
  Declining: 'danger',
  Stable: 'neutral',
  Improving: 'accent',
  Accelerating: 'info',
  'Insufficient data': 'neutral',
};

function monthEval(ctx: LifeContext, month: string): PeriodEval {
  const start = `${month}-01`;
  return evaluatePeriod(ctx, start, ds(endOfMonth(parseISO(start))));
}

const scoreOf = (p: PeriodEval, d: Domain | 'overall') => (p.loggedDays < 3 ? null : d === 'overall' ? p.overall : p.domains[d].score);

function MonthReview({ ctx }: { ctx: LifeContext }) {
  const [month, setMonth] = useState(ctx.today.slice(0, 7));
  const shift = (m: string, n: number) => format(addMonths(parseISO(`${m}-01`), n), 'yyyy-MM');
  const data = useMemo(() => {
    const cur = monthEval(ctx, month);
    const prev = monthEval(ctx, shift(month, -1));
    const pp = monthEval(ctx, shift(month, -2));
    return { cur, prev, pp };
  }, [ctx, month]);
  const rows: (Domain | 'overall')[] = ['overall', 'consistency', 'fitness', 'health', 'career', 'learning', 'finance', 'recovery', 'personal', 'relationships'];
  const t = (k: Domain | 'overall') => classify(scoreOf(data.cur, k), scoreOf(data.prev, k), scoreOf(data.pp, k));
  const overall = t('overall');
  const snapCur = ctx.finance.find((f) => f.month === month);
  const snapPrev = ctx.finance.find((f) => f.month === shift(month, -1));
  const money = (x: number) => `${ctx.profile.currency}${Math.round(x).toLocaleString()}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setMonth(shift(month, -1))} className="h-9 w-9 flex items-center justify-center rounded-lg text-base-300 hover:bg-base-800" aria-label="Previous month">
          <ChevronLeft size={20} />
        </button>
        <p className="text-sm font-semibold text-base-100">{format(parseISO(`${month}-01`), 'MMMM yyyy')}</p>
        <button
          onClick={() => month < ctx.today.slice(0, 7) && setMonth(shift(month, 1))}
          disabled={month >= ctx.today.slice(0, 7)}
          className="h-9 w-9 flex items-center justify-center rounded-lg text-base-300 hover:bg-base-800 disabled:opacity-30"
          aria-label="Next month"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <Card className="p-4">
        <p className="text-xs text-base-400">This month vs last month</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xl font-bold text-base-50">{overall === 'Insufficient data' ? 'Insufficient data' : `You are ${overall.toLowerCase()}`}</p>
          <Badge variant={TRAJ_VARIANT[overall]}>{overall}</Badge>
        </div>
        <p className="text-xs text-base-400 mt-1">{explainTrajectory(overall, scoreOf(data.cur, 'overall'), scoreOf(data.prev, 'overall'), scoreOf(data.pp, 'overall'))}</p>
        <p className="text-[11px] text-base-500 mt-2">
          Rules: Declining ≤ −5 pts · Stable ±5 · Improving +5 to +15 · Accelerating ≥ +15, or improving two months running.
        </p>
      </Card>

      <Card className="p-4">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-2 text-xs items-center">
          <span className="text-base-500">Area</span>
          <span className="text-base-500 text-right">Last</span>
          <span className="text-base-500 text-right">This</span>
          <span className="text-base-500 text-right">Trend</span>
          {rows.map((k) => {
            const a = scoreOf(data.prev, k);
            const b = scoreOf(data.cur, k);
            const tr = t(k);
            return (
              <Row key={k} label={k === 'overall' ? 'Overall' : DOMAIN_LABELS[k]} a={a} b={b} tr={tr} bold={k === 'overall'} />
            );
          })}
        </div>
      </Card>

      <Card className="p-4 text-xs flex flex-col gap-1">
        <p className="text-sm font-semibold text-base-50 mb-1">Month in numbers</p>
        <p className="text-base-300">Logged days: {data.prev.loggedDays} → {data.cur.loggedDays}</p>
        <p className="text-base-300">Training sessions: {data.prev.metrics.trainingSessions} → {data.cur.metrics.trainingSessions}</p>
        <p className="text-base-300">Deep work: {(data.prev.metrics.deepWorkMinutes / 60).toFixed(1)}h → {(data.cur.metrics.deepWorkMinutes / 60).toFixed(1)}h</p>
        <p className="text-base-300">
          Avg sleep: {data.prev.metrics.avgSleep?.toFixed(1) ?? '—'}h → {data.cur.metrics.avgSleep?.toFixed(1) ?? '—'}h
        </p>
        {snapCur && snapPrev ? (
          <p className="text-base-300">
            Net worth: {money(derive(snapPrev).netWorth)} → {money(derive(snapCur).netWorth)} · Savings rate:{' '}
            {derive(snapPrev).savingsRate === null ? '—' : `${Math.round(derive(snapPrev).savingsRate! * 100)}%`} →{' '}
            {derive(snapCur).savingsRate === null ? '—' : `${Math.round(derive(snapCur).savingsRate! * 100)}%`}
          </p>
        ) : (
          <p className="text-base-500">Finance comparison needs snapshots for both months.</p>
        )}
      </Card>
    </div>
  );
}

function QuarterReview({ ctx }: { ctx: LifeContext }) {
  const data = useMemo(() => {
    const cur = evaluatePeriod(ctx, addDaysStr(ctx.today, -89), ctx.today);
    const prev = evaluatePeriod(ctx, addDaysStr(ctx.today, -179), addDaysStr(ctx.today, -90));
    const align = goalAlignment(ctx);
    const friction = frictionReports(ctx);
    const snaps = ctx.finance;
    const threeAgo = format(addMonths(parseISO(ctx.today), -3), 'yyyy-MM');
    const fiNow = fiStatus(ctx.profile, snaps);
    const fiThen = fiStatus(ctx.profile, snaps.filter((s) => s.month <= threeAgo));
    return { cur, prev, align, friction, fiNow, fiThen };
  }, [ctx]);
  const daysOfData = Math.max(0, Math.round((parseISO(ctx.today).getTime() - parseISO(ctx.firstDate).getTime()) / 86400000) + 1);
  const levelChanges = ctx.profile.levelHistory.filter((h) => h.from >= addDaysStr(ctx.today, -89));
  const mismatches = data.align.rows.filter((r) => r.verdict.startsWith('Mismatch'));

  return (
    <div className="flex flex-col gap-3">
      <Card className="p-4 border-info/30">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-info flex items-center gap-1.5">
          <HelpCircle size={12} /> The quarterly question
        </p>
        <p className="text-base font-semibold text-base-50 mt-1">"Are my current behaviours producing the life I say I want?"</p>
        <p className="text-xs text-base-400 mt-1.5">
          {daysOfData < 60
            ? `Only ${daysOfData} days of data so far — this audit becomes meaningful after ~90 days. Early answers below are provisional.`
            : mismatches.length === 0
              ? 'The data says mostly yes: every 1-year goal has consistent daily behaviour behind it.'
              : `Not fully. ${mismatches.length} goal${mismatches.length === 1 ? '' : 's'} ha${mismatches.length === 1 ? 's' : 've'} a mismatch between what you say and what you do.`}
        </p>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-semibold text-base-50 mb-2">Last 90 days vs previous 90</p>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-2 text-xs items-center">
          <span className="text-base-500">Area</span>
          <span className="text-base-500 text-right">Prev</span>
          <span className="text-base-500 text-right">Now</span>
          <span className="text-base-500 text-right">Trend</span>
          {(['overall', 'consistency', 'fitness', 'health', 'career', 'learning', 'finance', 'recovery', 'relationships'] as const).map((k) => (
            <Row key={k} label={k === 'overall' ? 'Overall' : DOMAIN_LABELS[k]} a={scoreOf(data.prev, k)} b={scoreOf(data.cur, k)} tr={classify(scoreOf(data.cur, k), scoreOf(data.prev, k), null)} bold={k === 'overall'} />
          ))}
        </div>
      </Card>

      <SectionTitle>Goal alignment (1-year goals ← daily habits)</SectionTitle>
      {data.align.rows.map((r) => (
        <Card key={r.goal.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-base-50">{r.goal.title}</p>
            <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: scoreColor(r.score) }}>{r.score === null ? '—' : `${r.score}%`}</span>
          </div>
          <p className="text-xs text-base-400 mt-1">{r.verdict}</p>
          {r.habits.length > 0 && (
            <p className="text-[11px] text-base-500 mt-1.5">
              Fed by: {r.habits.map((h) => `${h.h.name} (${h.c90 === null ? '—' : `${Math.round(h.c90 * 100)}%`})`).join(' · ')}
            </p>
          )}
        </Card>
      ))}
      {data.align.orphans.length > 0 && (
        <Card className="p-4 border-warn/30">
          <p className="text-sm font-semibold text-base-50">Habits not connected to any goal</p>
          <p className="text-xs text-base-400 mt-1">
            {data.align.orphans.map((h) => h.name).join(', ')} — link them in the Goal tree, or question whether they deserve to stay.
          </p>
        </Card>
      )}

      <Card className="p-4 text-xs flex flex-col gap-1">
        <p className="text-sm font-semibold text-base-50 mb-1">Quarter in numbers</p>
        <p className="text-base-300">Training sessions: {data.prev.metrics.trainingSessions} → {data.cur.metrics.trainingSessions}</p>
        <p className="text-base-300">Deep work: {(data.prev.metrics.deepWorkMinutes / 60).toFixed(0)}h → {(data.cur.metrics.deepWorkMinutes / 60).toFixed(0)}h</p>
        <p className="text-base-300">
          FI progress: {data.fiThen.progress === null ? '—' : `${(data.fiThen.progress * 100).toFixed(1)}%`} → {data.fiNow.progress === null ? '—' : `${(data.fiNow.progress * 100).toFixed(1)}%`}
        </p>
        <p className="text-base-300">
          Level: {levelChanges.length ? levelChanges.map((l) => `L${l.level} ${LEVELS[l.level - 1].name} (from ${l.from})`).join(' → ') : `L${ctx.profile.level} all quarter`}
        </p>
        <p className="text-base-300">Habits needing redesign: {data.friction.length ? data.friction.map((f) => f.h.name).join(', ') : 'none'}</p>
      </Card>

      <Card className="p-4 text-xs text-base-300 flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-base-50">Audit prompts</p>
        <p>• Which habit would I keep if I could only keep one? Is it being protected?</p>
        <p>• Which goal have I been "working on" without a single daily behaviour behind it?</p>
        <p>• Is my savings rate moving me toward FI on the timeline I want — or am I optimising the wrong thing?</p>
        <p>• What am I tolerating (sleep, stress, a relationship) that the data keeps flagging?</p>
        <p>• Update the Goal tree if a 1-year goal no longer reflects the life I want.</p>
      </Card>
    </div>
  );
}

function Row({ label, a, b, tr, bold }: { label: string; a: number | null; b: number | null; tr: Trajectory; bold?: boolean }) {
  return (
    <>
      <span className={bold ? 'text-base-50 font-semibold' : 'text-base-200'}>{label}</span>
      <span className="text-right tabular-nums text-base-400">{a ?? '—'}</span>
      <span className="text-right tabular-nums font-semibold" style={{ color: scoreColor(b) }}>{b ?? '—'}</span>
      <span className="text-right">
        <Badge variant={TRAJ_VARIANT[tr]}>{tr === 'Insufficient data' ? '—' : tr}</Badge>
      </span>
    </>
  );
}
