import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertTriangle, ArrowUpRight, CalendarCheck, ChevronRight, ClipboardCheck, Flame, Gauge, Layers, LineChart, Target, TrendingUp, Utensils, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { GoalBar, HitDot, Ring, SectionTitle, TrendBars } from '@/components/life/Visuals';
import { COLORS, scoreColor } from '@/components/life/colors';
import { useLife } from '@/lib/life/useLife';
import { LEVELS, MODE_LABELS, formatTarget, frequencyLabel } from '@/lib/life/habits';
import { addDaysStr, evaluateWeek, habitStreaks, modeOn, pastWeeks, targetExtras, weekStartOf } from '@/lib/life/engine';
import { db } from '@/lib/db';
import { goalProgress, todayHabits } from '@/lib/life/summary';
import { detectGaming, weeklyInsights } from '@/lib/life/insights';
import { calorieStatus, calorieUnlockStatus, recommendProgression } from '@/lib/life/progression';
import { gt3rsReadiness } from '@/lib/life/finance';

export default function LifeDashboard() {
  const navigate = useNavigate();
  const ctx = useLife();

  const data = useMemo(() => {
    if (!ctx) return null;
    const ws = weekStartOf(ctx.today);
    const week = evaluateWeek(ctx, ws);
    const last = pastWeeks(ctx, 8);
    const prev = last[0] ?? null;
    // The ONE recommendation comes from last week's review; fall back to this week once it has data.
    const insightWeek = prev && prev.loggedDays >= 3 ? prev : week;
    const insightPrev = insightWeek === prev ? (last[1] ?? null) : prev;
    const insights = weeklyInsights(ctx, insightWeek, insightPrev);
    const plan = ctx.planByWeek.get(ws);
    return {
      week,
      today: todayHabits(ctx),
      bars: goalProgress(ctx),
      trend: [...last].reverse().map((w) => ({ label: format(new Date(w.start + 'T00:00:00'), 'd MMM'), value: w.overall })),
      rec: insights.find((i) => i.key === 'recommendation')!,
      focus: plan?.focus?.trim() || null,
      progression: recommendProgression(ctx),
      flags: detectGaming(ctx),
      mode: modeOn(ctx, ctx.today),
      gt: gt3rsReadiness(ctx.profile, ctx.finance),
      streaks: todayHabits(ctx).map((t) => ({ spec: t.spec, s: habitStreaks(ctx, t.spec) })),
      checkedIn: ctx.byDate.has(ctx.today),
      calUnlock: calorieUnlockStatus(ctx),
      calStatus: calorieStatus(ctx),
      yesterdayMissing: !ctx.byDate.has(addDaysStr(ctx.today, -1)) && addDaysStr(ctx.today, -1) >= ctx.profile.startDate,
    };
  }, [ctx]);

  if (!ctx || !data) return null;
  const { profile } = ctx;
  const level = LEVELS[profile.level - 1];
  const doneToday = data.today.filter((t) => t.hit === 'min' || t.hit === 'ideal').length;
  const dailyToday = data.today.filter((t) => !t.week);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const extras = targetExtras(ctx, ctx.today);
  const nutToday = ctx.nutrition.get(ctx.today);
  const proteinNow = nutToday?.protein ?? 0;

  async function unlockCalories() {
    await db.lifeProfile.update('life', { calorie: { unlockedAt: ctx!.today, goal: null, maintenance: null, target: null, targetSetAt: null } });
  }

  return (
    <div className="animate-fade-in">
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-2">
        <p className="text-sm text-base-400">{format(new Date(), 'EEEE, d MMMM')}</p>
        <div className="flex items-end justify-between gap-2">
          <h1 className="text-2xl font-bold text-base-50 mt-0.5">{greeting}</h1>
          <div className="flex gap-1.5 pb-1">
            <Badge variant="accent">L{profile.level} · {level.name}</Badge>
          </div>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          <Badge variant={data.mode === 'minimum' ? 'warn' : data.mode === 'high' ? 'info' : 'neutral'}>{MODE_LABELS[data.mode]}</Badge>
          {profile.phase !== 'build' && <Badge variant="warn">{profile.phase === 'deload' ? 'Deload week' : 'Stabilising'}</Badge>}
        </div>
      </div>

      <div className="px-4 flex flex-col gap-3 pb-8">
        {/* Hero: weekly score + today rings */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <Ring value={data.week.overall === null ? null : data.week.overall / 100} size={108} stroke={10}>
              <div className="text-center">
                <p className="text-3xl font-bold text-base-50 tabular-nums leading-none">{data.week.overall ?? '—'}</p>
                <p className="text-[10px] text-base-400 mt-1">/100 this week</p>
              </div>
            </Ring>
            <div className="flex-1 min-w-0 grid grid-cols-3 gap-2">
              <MiniRing label="Today" value={data.today.length ? doneToday / data.today.length : null} text={`${doneToday}/${data.today.length}`} color={COLORS.accent} />
              <MiniRing
                label="Sleep"
                value={ctx.byDate.get(ctx.today)?.sleepHours != null ? ctx.byDate.get(ctx.today)!.sleepHours! / 8 : null}
                text={ctx.byDate.get(ctx.today)?.sleepHours != null ? `${ctx.byDate.get(ctx.today)!.sleepHours}h` : '—'}
                color={COLORS.violet}
              />
              <MiniRing
                label="Deep work"
                value={ctx.byDate.get(ctx.today)?.deepWorkMinutes != null ? ctx.byDate.get(ctx.today)!.deepWorkMinutes! / 60 : null}
                text={ctx.byDate.get(ctx.today)?.deepWorkMinutes != null ? `${ctx.byDate.get(ctx.today)!.deepWorkMinutes}m` : '—'}
                color={COLORS.info}
              />
            </div>
          </div>
          {data.week.overall === null && (
            <p className="text-xs text-base-500 mt-3">Weekly score appears after 3 logged days ({data.week.loggedDays} so far).</p>
          )}
        </Card>

        {!data.checkedIn ? (
          <Button size="lg" onClick={() => navigate('/checkin')} className="w-full">
            <ClipboardCheck size={18} /> Daily check-in · 60 seconds
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => navigate('/checkin')} className="w-full">
            <ClipboardCheck size={16} /> Edit today's check-in
          </Button>
        )}
        <Button variant="secondary" onClick={() => navigate('/food')} className="w-full">
          <Utensils size={16} />
          {nutToday?.calories != null
            ? `Food · ${proteinNow}/${extras.protein!.min}g · ${nutToday.calories.toLocaleString()} kcal`
            : `Log food · ${proteinNow}/${extras.protein!.min}g protein`}
        </Button>
        {data.yesterdayMissing && (
          <button onClick={() => navigate(`/checkin?date=${addDaysStr(ctx.today, -1)}`)} className="text-xs text-warn text-left -mt-1">
            Yesterday isn't logged yet — tap to fill it in (missed days are data, not failure).
          </button>
        )}

        {/* ONE thing */}
        <Card className="p-4 border-accent/30 bg-accent-bg/40">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent flex items-center gap-1.5">
            <Target size={13} /> This week's ONE priority
          </p>
          <p className="text-sm text-base-50 mt-1.5 leading-relaxed">{data.focus ?? data.rec.body}</p>
        </Card>

        {/* Today's habits */}
        <SectionTitle right={<span className="text-xs text-base-500">{dailyToday.filter((t) => t.hit === 'min' || t.hit === 'ideal').length}/{dailyToday.length} daily done</span>}>
          Today's habits
        </SectionTitle>
        <Card className="divide-y divide-base-800">
          {data.today.map(({ spec, target, hit, week }) => {
            const t = formatTarget(spec, target, extras);
            const food = spec.id === 'protein' || spec.id === 'calories';
            const right =
              spec.id === 'protein' && nutToday
                ? `${proteinNow}/${extras.protein!.min}g`
                : spec.id === 'calories' && nutToday?.calories != null
                  ? `${nutToday.calories} kcal`
                  : null;
            return (
              <button key={spec.id} onClick={() => navigate(food ? '/food' : '/checkin')} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-base-850">
                <HitDot hit={hit} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-base-50 truncate">{spec.name}</p>
                  <p className="text-xs text-base-400 truncate">
                    Min {t.min} · Ideal {t.ideal}
                  </p>
                </div>
                <span className="text-xs text-base-500 shrink-0 tabular-nums">
                  {right ?? (week ? `${week.done}/${week.of} wk` : hit === 'ideal' ? 'Ideal' : hit === 'min' ? 'Min ✓' : frequencyLabel(target.perWeek))}
                </span>
              </button>
            );
          })}
        </Card>

        {/* Calorie unlock / target prompts */}
        {data.calUnlock.eligible && (
          <Card className="p-4 border-info/40">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-info">Unlocked by consistency</p>
            <p className="text-sm font-semibold text-base-50 mt-1">Calorie awareness is ready</p>
            <p className="text-xs text-base-400 mt-1 leading-relaxed">
              {data.calUnlock.reason} For the first 2 weeks you only log, with no target, using the same food log. Then a target is set from your own intake and weight trend.
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={unlockCalories}>Unlock calories</Button>
              <Button size="sm" variant="ghost" onClick={() => navigate('/system')}>Not yet</Button>
            </div>
          </Card>
        )}
        {data.calStatus.stage === 'ready-to-set' && (
          <Card className="p-4 border-info/40 cursor-pointer" onClick={() => navigate('/system')}>
            <p className="text-sm font-semibold text-base-50">Set your calorie target</p>
            <p className="text-xs text-base-400 mt-1">
              Awareness phase complete. Estimated maintenance: ~{data.calStatus.estimate!.maintenance} kcal/day. Choose cut, maintain or lean bulk →
            </p>
          </Card>
        )}

        {/* Anti-gaming flags */}
        {data.flags.length > 0 && (
          <Card className="p-4 border-warn/30">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-warn flex items-center gap-1.5 mb-2">
              <AlertTriangle size={13} /> System check
            </p>
            <div className="flex flex-col gap-2.5">
              {data.flags.slice(0, 2).map((f) => (
                <div key={f.title}>
                  <p className="text-sm font-semibold text-base-50">{f.title}</p>
                  <p className="text-xs text-base-400 leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Goal progress */}
        <SectionTitle>Goal progress</SectionTitle>
        <Card className="p-4 flex flex-col gap-4">
          {data.bars.map((b) => (
            <GoalBar key={b.key} label={b.label} value={b.value} formula={b.formula} detail={b.detail} color={b.key === 'gt3rs' ? COLORS.gold : undefined} />
          ))}
        </Card>

        {/* GT3 RS teaser */}
        <Card className="p-4 cursor-pointer active:bg-base-850" onClick={() => navigate('/finance')}>
          <div className="flex items-center gap-3">
            <Ring value={data.gt.readiness === null ? null : data.gt.readiness / 100} size={56} stroke={6} color={COLORS.gold}>
              <span className="text-xs font-bold text-base-50">{data.gt.readiness ?? '—'}</span>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-base-50">GT3 RS readiness</p>
              <p className="text-xs text-base-400 line-clamp-2">{data.gt.headline}</p>
            </div>
            <ChevronRight size={16} className="text-base-500" />
          </div>
          {data.gt.status !== 'insufficient' && (
            <div className="flex gap-1.5 mt-3">
              <Badge variant={data.gt.canAfford ? 'accent' : 'neutral'}>Can afford: {data.gt.canAfford ? 'yes' : 'no'}</Badge>
              <Badge variant={data.gt.comfortable ? 'accent' : 'neutral'}>Comfortably: {data.gt.comfortable ? 'yes' : 'no'}</Badge>
            </div>
          )}
        </Card>

        {/* Weekly trend */}
        <SectionTitle right={<button className="text-xs text-accent flex items-center gap-0.5" onClick={() => navigate('/trends')}>All trends <ChevronRight size={12} /></button>}>
          Weekly score trend
        </SectionTitle>
        <Card className="p-3">
          <TrendBars data={data.trend} domain={[0, 100]} height={140} />
        </Card>

        {/* Upcoming progression */}
        <SectionTitle>Progression</SectionTitle>
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-base-800 flex items-center justify-center shrink-0">
              <TrendingUp size={17} className="text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-base-50">{data.progression.headline}</p>
              <p className="text-xs text-base-400 mt-0.5 leading-relaxed">{data.progression.reasons[0]}</p>
            </div>
          </div>
          {data.progression.criteria.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5">
              {data.progression.criteria.map((c) => (
                <div key={c.label} className="flex items-center justify-between text-xs">
                  <span className={c.met ? 'text-accent' : 'text-base-400'}>{c.met ? '✓' : '○'} {c.label}</span>
                  <span className="text-base-300 tabular-nums">{c.current} / {c.target}</span>
                </div>
              ))}
            </div>
          )}
          {profile.level < 6 && (
            <p className="text-[11px] text-base-500 mt-3">
              Next: Level {profile.level + 1} · {LEVELS[profile.level].name} — {LEVELS[profile.level].summary}
            </p>
          )}
        </Card>

        {/* Streaks */}
        <SectionTitle>Consistency (streaks matter less)</SectionTitle>
        <Card className="p-4">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-2 text-xs items-center">
            <span className="text-base-500 font-semibold">Habit</span>
            <span className="text-base-500 font-semibold text-right">7d</span>
            <span className="text-base-500 font-semibold text-right">30d</span>
            <span className="text-base-500 font-semibold text-right">Streak</span>
            {data.streaks.map(({ spec, s }) => (
              <Row key={spec.id} name={spec.name} c7={s.c7} c30={s.c30} streak={`${s.current}${s.unit === 'days' ? 'd' : 'w'}`} best={`${s.longest}`} />
            ))}
          </div>
          <p className="text-[11px] text-base-500 mt-3">90% over six months beats 100% for ten days. Consistency % is the headline; streaks are a bonus.</p>
        </Card>

        {/* Navigation */}
        <div className="grid grid-cols-2 gap-2.5 mt-2">
          <NavTile icon={CalendarCheck} label="Weekly review" onClick={() => navigate('/review')} />
          <NavTile icon={LineChart} label="Trends" onClick={() => navigate('/trends')} />
          <NavTile icon={Wallet} label="Finance & GT3 RS" onClick={() => navigate('/finance')} />
          <NavTile icon={Layers} label="Goal tree" onClick={() => navigate('/goals')} />
          <NavTile icon={Gauge} label="The system" onClick={() => navigate('/system')} />
          <NavTile icon={Flame} label="Train" onClick={() => navigate('/train')} />
        </div>
      </div>
    </div>
  );
}

function MiniRing({ label, value, text, color }: { label: string; value: number | null; text: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Ring value={value} size={52} stroke={5} color={color}>
        <span className="text-[11px] font-bold text-base-50 tabular-nums">{text}</span>
      </Ring>
      <span className="text-[10px] text-base-400">{label}</span>
    </div>
  );
}

function Row({ name, c7, c30, streak, best }: { name: string; c7: number | null; c30: number | null; streak: string; best: string }) {
  const f = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
  return (
    <>
      <span className="text-base-200 truncate">{name}</span>
      <span className="text-right tabular-nums" style={{ color: scoreColor(c7 === null ? null : c7 * 100) }}>{f(c7)}</span>
      <span className="text-right tabular-nums font-semibold" style={{ color: scoreColor(c30 === null ? null : c30 * 100) }}>{f(c30)}</span>
      <span className="text-right tabular-nums text-base-300" title={`Longest: ${best}`}>{streak}</span>
    </>
  );
}

function NavTile({ icon: Icon, label, onClick }: { icon: typeof Target; label: string; onClick: () => void }) {
  return (
    <Card className="p-3.5 flex items-center gap-2.5 cursor-pointer active:bg-base-850" onClick={onClick}>
      <Icon size={17} className="text-accent shrink-0" />
      <span className="text-sm font-medium text-base-100 flex-1 truncate">{label}</span>
      <ArrowUpRight size={14} className="text-base-500" />
    </Card>
  );
}
