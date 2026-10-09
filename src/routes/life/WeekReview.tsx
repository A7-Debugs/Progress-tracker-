import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, ChevronLeft, ChevronRight, Lightbulb, Save } from 'lucide-react';
import { db } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toaster';
import { Collapsible, GoalBar, Ring, Scale5, SectionTitle } from '@/components/life/Visuals';
import { DOMAIN_LABELS, HABITS, LEVELS, MODE_LABELS, formatTarget, frequencyLabel, isUnlocked, targetFor } from '@/lib/life/habits';
import { addDaysStr, evaluateWeek, strengthTrend, targetExtras, weekStartOf, type LifeContext } from '@/lib/life/engine';
import { correlations, detectGaming, frictionReports, weekNarrative, weeklyInsights } from '@/lib/life/insights';
import { recommendMode, recommendProgression } from '@/lib/life/progression';
import type { Domain, Level, Mode, WeekPlan } from '@/lib/life/types';
import { cn } from '@/lib/cn';

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

export function WeekReview({ ctx }: { ctx: LifeContext }) {
  const thisWeek = weekStartOf(ctx.today);
  const isSunday = parseISO(ctx.today).getDay() === 0;
  const [ws, setWs] = useState(isSunday ? thisWeek : addDaysStr(thisWeek, -7));
  const canNext = addDaysStr(ws, 7) <= thisWeek;

  const d = useMemo(() => {
    const week = evaluateWeek(ctx, ws);
    const prevStart = addDaysStr(ws, -7);
    const prev = prevStart >= weekStartOf(ctx.firstDate) ? evaluateWeek(ctx, prevStart) : null;
    return {
      week,
      prev,
      narrative: weekNarrative(week, prev),
      insights: weeklyInsights(ctx, week, prev),
      corr: correlations(ctx),
      flags: detectGaming(ctx),
      friction: frictionReports(ctx),
      strength: strengthTrend(ctx, addDaysStr(ws, 6) < ctx.today ? addDaysStr(ws, 6) : ctx.today),
    };
  }, [ctx, ws]);

  const { week, prev, narrative } = d;
  const plan = ctx.planByWeek.get(ws);
  const domains = Object.keys(week.domains) as Domain[];
  const sched = HABITS.filter((h) => (week.habits.get(h.id)?.expected ?? 0) > 0);
  const missed = sched.filter((h) => (week.habits.get(h.id)?.adherence ?? 1) < 0.7);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setWs(addDaysStr(ws, -7))} className="h-9 w-9 flex items-center justify-center rounded-lg text-base-300 hover:bg-base-800" aria-label="Previous week">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-base-100">
            {format(parseISO(ws), 'd MMM')} – {format(parseISO(addDaysStr(ws, 6)), 'd MMM')}
          </p>
          <p className="text-[11px] text-base-500">
            {ws === thisWeek ? 'This week (in progress)' : 'Completed week'} · {MODE_LABELS[plan?.mode ?? 'normal']}
          </p>
        </div>
        <button onClick={() => canNext && setWs(addDaysStr(ws, 7))} disabled={!canNext} className="h-9 w-9 flex items-center justify-center rounded-lg text-base-300 hover:bg-base-800 disabled:opacity-30" aria-label="Next week">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* THIS WEEK */}
      <SectionTitle>This week</SectionTitle>
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Ring value={week.overall === null ? null : week.overall / 100} size={96} stroke={9}>
            <div className="text-center">
              <p className="text-2xl font-bold text-base-50 tabular-nums">{week.overall ?? '—'}</p>
              <p className="text-[10px] text-base-400">/100</p>
            </div>
          </Ring>
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-base-50">Weekly Score: {week.overall === null ? 'Insufficient data' : `${week.overall}/100`}</p>
            {prev?.overall != null && week.overall !== null && (
              <p className={cn('text-xs mt-0.5', week.overall >= prev.overall ? 'text-accent' : 'text-warn')}>
                {week.overall >= prev.overall ? '▲' : '▼'} {Math.abs(week.overall - prev.overall)} vs previous week ({prev.overall})
              </p>
            )}
            <p className="text-xs text-base-400 mt-1">
              {week.loggedDays}/{week.elapsed} days logged · habit adherence {pct(week.habitAdherence)}
            </p>
            <p className="text-[11px] text-base-500 mt-1">A diagnostic, not a grade. It shows where the system needs adjusting.</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 flex flex-col gap-3.5">
        {domains.map((k) => {
          const s = week.domains[k];
          const delta = prev && prev.domains[k].score !== null && s.score !== null ? s.score - prev.domains[k].score! : null;
          return (
            <div key={k}>
              <GoalBar
                label={`${DOMAIN_LABELS[k]}${delta !== null && delta !== 0 ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}`}
                value={s.score === null ? null : s.score / 100}
                formula={s.formula}
                detail={s.parts
                  .filter((p) => p.weight > 0)
                  .map((p) => `${p.label}: ${p.value === null ? 'no data' : pct(p.value)}`)
                  .join(' · ')}
              />
            </div>
          );
        })}
      </Card>

      {/* Habits */}
      <Card className="p-4">
        <p className="text-sm font-semibold text-base-50 mb-2">Habits</p>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1.5 text-xs items-center">
          <span className="text-base-500">Habit</span>
          <span className="text-base-500 text-right">Done</span>
          <span className="text-base-500 text-right">Adherence</span>
          <span className="text-base-500 text-right">Ideal</span>
          {sched.map((h) => {
            const st = week.habits.get(h.id)!;
            return (
              <HabitRow key={h.id} name={h.name} done={`${st.successes}/${Math.round(st.expected)}`} adh={pct(st.adherence)} ideal={pct(st.idealShare)} low={(st.adherence ?? 1) < 0.7} />
            );
          })}
        </div>
        {missed.length > 0 && <p className="text-[11px] text-base-500 mt-2">Missed habits (&lt;70%): {missed.map((h) => h.name).join(', ')}. Missed days are data — see Friction below.</p>}
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        <Mini title="Training" lines={[`${week.metrics.trainingSessions} sessions`, d.strength.total ? `${d.strength.improved}/${d.strength.total} lifts holding/rising` : 'Strength: insufficient data']} />
        <Mini title="Sleep" lines={[week.metrics.avgSleep === null ? 'No sleep logged' : `${week.metrics.avgSleep.toFixed(1)}h average`, week.metrics.sleepSd === null ? '' : `±${week.metrics.sleepSd.toFixed(1)}h variability`]} />
        <Mini title="Career" lines={[`${(week.metrics.deepWorkMinutes / 60).toFixed(1)}h deep work`, `Planning ${pct(week.habits.get('plan')!.adherence)}`]} />
        <Mini
          title="Finance"
          lines={[
            `Money check: ${week.habits.get('moneyReview')!.successes ? 'done' : 'not done'}`,
            week.domains.finance.parts[1].value === null ? 'No snapshot yet' : week.domains.finance.parts[1].label.replace('Savings rate', 'Savings'),
          ]}
        />
        <Mini title="Personal dev" lines={[`Score ${week.domains.personal.score ?? '—'}`, `Relationships: ${week.metrics.connectDays} connection days`]} />
        <Mini title="Recovery" lines={[`Energy ${week.metrics.avgEnergy?.toFixed(1) ?? '—'}/5`, `Stress ${week.metrics.avgStress?.toFixed(1) ?? '—'}/5`]} />
      </div>

      {/* DATA ANALYSIS */}
      <SectionTitle>Data analysis</SectionTitle>
      <Card className="p-4 flex flex-col gap-2.5 text-sm">
        {prev === null || week.overall === null || prev.overall === null ? (
          <p className="text-base-400 text-xs">Week-on-week comparison needs two weeks with 3+ logged days each.</p>
        ) : (
          <>
            <Line label="What improved" items={narrative.improved} empty="No domain moved up by 5+ points." good />
            <Line label="What declined" items={narrative.declined} empty="No domain dropped by 5+ points." />
            <Line label="What caused it" items={narrative.causes} empty="No clear cause in the data (sleep, stress, work hours and logging were steady)." />
            <Line label="Highest impact" items={narrative.highestImpact ? [narrative.highestImpact] : []} empty="No habit changed by 10+ points." />
          </>
        )}
      </Card>

      <div className="flex flex-col gap-2">
        {d.insights.map((i) => (
          <Card key={i.key} className={cn('p-4', i.key === 'recommendation' && 'border-accent/40 bg-accent-bg/40')}>
            <p className={cn('text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5', i.key === 'recommendation' ? 'text-accent' : 'text-base-400')}>
              {i.key === 'recommendation' && <Lightbulb size={12} />} {i.title}
            </p>
            <p className="text-sm text-base-100 mt-1 leading-relaxed">{i.body}</p>
          </Card>
        ))}
      </div>

      {d.flags.length > 0 && (
        <Card className="p-4 border-warn/30">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-warn flex items-center gap-1.5 mb-2">
            <AlertTriangle size={12} /> Don't game the system
          </p>
          {d.flags.map((f) => (
            <div key={f.title} className="mb-2 last:mb-0">
              <p className="text-sm font-semibold text-base-50">{f.title}</p>
              <p className="text-xs text-base-400 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </Card>
      )}

      <Card className="p-4">
        <Collapsible title="Correlations (last 90 days)">
          <div className="flex flex-col gap-2.5">
            {d.corr.map((c) => (
              <div key={c.key}>
                <p className="text-xs font-semibold text-base-200">{c.question}</p>
                <p className="text-xs text-base-400 leading-relaxed">{c.text}</p>
              </div>
            ))}
            <p className="text-[11px] text-base-500">|r| &lt; 0.1 none · &lt; 0.3 weak · &lt; 0.5 moderate · ≥ 0.5 strong. Minimum 14 paired days.</p>
          </div>
        </Collapsible>
      </Card>

      <Card className="p-4">
        <Collapsible title={`Friction reduction (${d.friction.length} habit${d.friction.length === 1 ? '' : 's'} below 60% over 30 days)`}>
          {d.friction.length === 0 ? (
            <p className="text-xs text-base-400">No habit is repeatedly failing. Nothing to redesign.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {d.friction.map((f) => (
                <div key={f.h.id}>
                  <p className="text-sm font-semibold text-base-50">
                    {f.h.name} · {pct(f.c30)} (30d) · <span className="text-warn">{f.verdict} problem</span>
                  </p>
                  <p className="text-xs text-base-300 mt-0.5 leading-relaxed">
                    Discipline problem, or poorly designed system? {f.diagnosis}
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {f.prompts.map((p) => (
                      <div key={p.dimension} className="text-xs">
                        <span className="text-base-200 font-medium">{p.dimension}: </span>
                        <span className="text-base-400">{p.question}</span>
                        {p.hint && <span className="block text-accent/90 mt-0.5">→ {p.hint}</span>}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-base-200 mt-2">
                    Redesigned habit: <span className="text-accent">{f.h.redesign.smaller}</span> Once it's automatic (≥ 85% for 3 weeks), grow it back.
                  </p>
                </div>
              ))}
            </div>
          )}
        </Collapsible>
      </Card>

      {/* NEXT WEEK */}
      {ws >= addDaysStr(thisWeek, -7) && <NextWeek ctx={ctx} reviewed={ws} reviewedPlan={plan} rec={d.insights.find((i) => i.key === 'recommendation')!.body} />}
    </div>
  );
}

function NextWeek({ ctx, reviewed, reviewedPlan, rec }: { ctx: LifeContext; reviewed: string; reviewedPlan: WeekPlan | undefined; rec: string }) {
  const toast = useToast();
  const next = addDaysStr(reviewed, 7);
  const existing = ctx.planByWeek.get(next);
  const prog = useMemo(() => recommendProgression(ctx), [ctx]);
  const [inputs, setInputs] = useState({
    expectedWorkHours: existing?.expectedWorkHours ?? null,
    expectedStress: existing?.expectedStress ?? null,
    socialCommitments: existing?.socialCommitments ?? null,
    financialPressure: existing?.financialPressure ?? null,
    importantEvents: existing?.importantEvents ?? '',
  });
  const [applyProg, setApplyProg] = useState(prog.status !== 'hold' && prog.status !== 'insufficient');
  const phase = applyProg ? prog.nextPhase : ctx.profile.phase;
  const modeRec = useMemo(() => recommendMode(ctx, inputs, phase), [ctx, inputs, phase]);
  const [mode, setMode] = useState<Mode | null>(existing?.mode ?? null);
  const chosen = mode ?? modeRec.mode;
  const level: Level = applyProg ? prog.nextLevel : ctx.profile.level;
  const [focus, setFocus] = useState(existing?.focus ?? '');
  const [refl, setRefl] = useState({
    reflectionWorked: reviewedPlan?.reflectionWorked ?? '',
    reflectionDidnt: reviewedPlan?.reflectionDidnt ?? '',
    reflectionChange: reviewedPlan?.reflectionChange ?? '',
  });
  useEffect(() => setApplyProg(prog.status !== 'hold' && prog.status !== 'insufficient'), [prog.status]);

  const extras = targetExtras(ctx, next);
  const curLevel = ctx.profile.level;
  const curMode = ctx.planByWeek.get(reviewed)?.mode ?? 'normal';
  const rows = HABITS.filter((h) => isUnlocked(h, level, ctx.profile, next) && !ctx.profile.pausedHabits.includes(h.id)).map((h) => {
    const t = targetFor(h, level, chosen);
    const before = isUnlocked(h, curLevel, ctx.profile, reviewed) ? targetFor(h, curLevel, curMode) : null;
    const change = !t ? 'paused' : !before ? 'new' : t.perWeek > before.perWeek || t.min > before.min ? 'up' : t.perWeek < before.perWeek || t.min < before.min ? 'down' : 'same';
    return { h, t, change };
  });

  async function save() {
    const now = Date.now();
    const base = (weekStart: string, p: WeekPlan | undefined): WeekPlan => ({
      id: weekStart,
      weekStart,
      mode: 'normal',
      expectedWorkHours: null,
      expectedStress: null,
      socialCommitments: null,
      financialPressure: null,
      importantEvents: '',
      focus: '',
      reflectionWorked: '',
      reflectionDidnt: '',
      reflectionChange: '',
      createdAt: now,
      ...p,
      updatedAt: now,
    });
    await db.weekPlans.put({ ...base(reviewed, reviewedPlan), ...refl });
    await db.weekPlans.put({ ...base(next, existing), ...inputs, mode: chosen, focus: focus.trim() || rec });
    if (applyProg && (prog.nextLevel !== ctx.profile.level || prog.nextPhase !== ctx.profile.phase)) {
      const p = ctx.profile;
      const levelChanged = prog.nextLevel !== p.level;
      await db.lifeProfile.update('life', {
        level: prog.nextLevel,
        levelSince: levelChanged ? next : p.levelSince,
        levelHistory: levelChanged ? [...p.levelHistory.filter((h) => h.from < next), { level: prog.nextLevel, from: next }] : p.levelHistory,
        phase: prog.nextPhase,
        phaseSince: prog.nextPhase !== p.phase ? next : p.phaseSince,
      });
    }
    toast('Review saved — next week is planned');
  }

  return (
    <>
      <SectionTitle>Next week · {format(parseISO(next), 'd MMM')}</SectionTitle>
      <Card className="p-4 flex flex-col gap-3">
        <p className="text-sm font-semibold text-base-50">Weekly evaluation</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Expected work hours">
            <Input type="number" inputMode="numeric" value={inputs.expectedWorkHours ?? ''} onChange={(e) => setInputs({ ...inputs, expectedWorkHours: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Evenings committed (social)">
            <Input type="number" inputMode="numeric" value={inputs.socialCommitments ?? ''} onChange={(e) => setInputs({ ...inputs, socialCommitments: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Expected stress">
          <Scale5 value={inputs.expectedStress} onChange={(v) => setInputs({ ...inputs, expectedStress: v })} low="Calm" high="Very high" />
        </Field>
        <Field label="Financial pressure">
          <Scale5 value={inputs.financialPressure} onChange={(v) => setInputs({ ...inputs, financialPressure: v })} low="None" high="Severe" />
        </Field>
        <Field label="Important upcoming events">
          <Input value={inputs.importantEvents} onChange={(e) => setInputs({ ...inputs, importantEvents: e.target.value })} placeholder="Exam, deadline, travel, wedding…" />
        </Field>
        <p className="text-[11px] text-base-500">Sleep, training, learning and recovery are read from last week's data automatically.</p>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-semibold text-base-50">Progression: {prog.headline}</p>
        {prog.reasons.map((r) => (
          <p key={r} className="text-xs text-base-400 mt-1 leading-relaxed">{r}</p>
        ))}
        {prog.changes.length > 0 && (
          <>
            <ul className="mt-2 text-xs text-base-200 list-disc pl-4 flex flex-col gap-0.5">
              {prog.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <label className="flex items-center gap-2 mt-3 text-sm text-base-100">
              <input type="checkbox" checked={applyProg} onChange={(e) => setApplyProg(e.target.checked)} className="accent-[#7ce281] h-4 w-4" />
              Apply this change from next week
            </label>
          </>
        )}
      </Card>

      <Card className="p-4">
        <p className="text-sm font-semibold text-base-50 mb-1">Mode</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(['minimum', 'normal', 'high'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn('h-10 rounded-xl text-xs font-semibold border', chosen === m ? 'bg-accent text-base-950 border-accent' : 'bg-base-850 text-base-300 border-base-700')}
            >
              {m === 'high' ? 'High-Perf' : m[0].toUpperCase() + m.slice(1)}
              {modeRec.mode === m && ' ★'}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-col gap-0.5">
          {modeRec.reasons.map((r) => (
            <p key={r} className="text-xs text-base-400">★ {r}</p>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-semibold text-base-50 mb-2">
          Optimal targets · L{level} {LEVELS[level - 1].name} · {MODE_LABELS[chosen]}
        </p>
        <div className="flex flex-col divide-y divide-base-800">
          {rows.map(({ h, t, change }) => {
            const lbl = t ? formatTarget(h, t, extras) : null;
            return (
              <div key={h.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                <span className="text-base-100 font-medium">{h.name}</span>
                <span className="text-right text-base-400">
                  {lbl ? `${lbl.min} · ${frequencyLabel(t!.perWeek)}` : 'Paused this week'}{' '}
                  {change !== 'same' && (
                    <Badge variant={change === 'up' || change === 'new' ? 'info' : 'neutral'} className="ml-1">
                      {change === 'up' ? '↑' : change === 'down' ? '↓' : change}
                    </Badge>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-base-500 mt-2">Nothing increases unless the progression rules above say the data supports it.</p>
      </Card>

      <Card className="p-4 flex flex-col gap-3">
        <Field label="Next week's ONE priority">
          <Textarea rows={2} value={focus} onChange={(e) => setFocus(e.target.value)} placeholder={rec} />
        </Field>
        <Field label="What worked?">
          <Textarea rows={2} value={refl.reflectionWorked} onChange={(e) => setRefl({ ...refl, reflectionWorked: e.target.value })} />
        </Field>
        <Field label="What didn't?">
          <Textarea rows={2} value={refl.reflectionDidnt} onChange={(e) => setRefl({ ...refl, reflectionDidnt: e.target.value })} />
        </Field>
        <Field label="What will I change?">
          <Textarea rows={2} value={refl.reflectionChange} onChange={(e) => setRefl({ ...refl, reflectionChange: e.target.value })} />
        </Field>
        <Button onClick={save}>
          <Save size={16} /> Save review & plan next week
        </Button>
      </Card>
    </>
  );
}

function HabitRow({ name, done, adh, ideal, low }: { name: string; done: string; adh: string; ideal: string; low: boolean }) {
  return (
    <>
      <span className="text-base-200 truncate">{name}</span>
      <span className="text-right tabular-nums text-base-300">{done}</span>
      <span className={cn('text-right tabular-nums font-semibold', low ? 'text-warn' : 'text-accent')}>{adh}</span>
      <span className="text-right tabular-nums text-base-400">{ideal}</span>
    </>
  );
}

function Mini({ title, lines }: { title: string; lines: string[] }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] uppercase tracking-wide font-semibold text-base-500">{title}</p>
      {lines.filter(Boolean).map((l) => (
        <p key={l} className="text-xs text-base-200 mt-0.5 truncate">{l}</p>
      ))}
    </Card>
  );
}

function Line({ label, items, empty, good }: { label: string; items: string[]; empty: string; good?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-base-300">{label}</p>
      {items.length ? (
        items.map((i) => (
          <p key={i} className={cn('text-xs', good ? 'text-accent' : 'text-base-100')}>• {i}</p>
        ))
      ) : (
        <p className="text-xs text-base-500">{empty}</p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-base-400">{label}</label>
      {children}
    </div>
  );
}
