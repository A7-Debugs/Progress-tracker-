import { useState } from 'react';
import { db } from '@/lib/db';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Collapsible, SectionTitle } from '@/components/life/Visuals';
import { useLife } from '@/lib/life/useLife';
import { CORE_V1, DOMAIN_LABELS, HABITS, LEVELS, MODE_LABELS, formatTarget, frequencyLabel, isUnlocked, targetFor, type HabitSpec, type TargetExtras } from '@/lib/life/habits';
import { DOMAIN_WEIGHTS, modeOn, targetExtras, type LifeContext } from '@/lib/life/engine';
import { CALORIE_UNLOCK, DELOAD_RULES, LEVEL_UP_RULES, calorieStatus, calorieUnlockStatus } from '@/lib/life/progression';
import { AWARENESS_DAYS, CALORIE_BANDS, CALORIE_OFFSETS, DEFAULT_PER_KG, GOAL_LABELS, proteinTargets } from '@/lib/life/nutrition';
import { Button } from '@/components/ui/Button';
import { TIER_LABELS } from '@/lib/life/defaults';
import type { CalorieGoal, Domain, LifeProfile, Mode } from '@/lib/life/types';

const PRINCIPLES = [
  'Consistency > intensity',
  'Systems > motivation',
  'Progress > perfection',
  'Sustainability > burnout',
  'High-impact habits > long habit lists',
  'Environment > willpower',
  'Long-term compounding > short-term gratification',
  'Financial freedom > looking wealthy',
  'Health > productivity',
  'Discipline should create freedom, not become another prison',
];

export default function SystemPage() {
  const ctx = useLife();
  const [viewMode, setViewMode] = useState<Mode | null>(null);
  if (!ctx) return null;
  const { profile } = ctx;
  const mode = viewMode ?? modeOn(ctx, ctx.today);
  const extras = targetExtras(ctx, ctx.today);
  const active = HABITS.filter((h) => isUnlocked(h, profile.level, profile));

  return (
    <div className="animate-fade-in">
      <TopBar title="The system" back />
      <div className="px-4 pt-3 pb-24 flex flex-col gap-3">
        <Card className="p-4">
          <p className="text-sm font-semibold text-base-50">Version 1.0 — Minimum Viable Routine</p>
          <p className="text-xs text-base-400 mt-1 leading-relaxed">
            {CORE_V1.length} habits, chosen for high impact, low friction and easy measurement, each linked to a long-term goal. The minimum always counts as a
            successful day. Load only increases when the data says you can handle it.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <Badge variant="accent">Level {profile.level} · {LEVELS[profile.level - 1].name}</Badge>
            <Badge>{profile.phase === 'build' ? 'Building' : profile.phase === 'deload' ? 'Deload' : 'Stabilising'}</Badge>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-1.5">
          {(['minimum', 'normal', 'high'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`h-9 rounded-xl text-xs font-semibold border ${mode === m ? 'bg-accent text-base-950 border-accent' : 'bg-base-850 text-base-300 border-base-700'}`}
            >
              {m === 'high' ? 'High-Perf' : m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        <SectionTitle>Your habits · {MODE_LABELS[mode]}</SectionTitle>
        {active.map((h) => (
          <HabitCard key={h.id} h={h} profile={profile} mode={mode} extras={extras} />
        ))}

        <SectionTitle>Progression levels</SectionTitle>
        <Card className="p-4 flex flex-col gap-3">
          {LEVELS.map((l) => (
            <div key={l.level} className={l.level === profile.level ? '' : 'opacity-70'}>
              <p className="text-sm font-semibold text-base-50">
                L{l.level} · {l.name} {l.level === profile.level && <Badge variant="accent" className="ml-1">You</Badge>}
              </p>
              <p className="text-xs text-base-400">{l.summary}</p>
              {l.level > 1 && l.unlocks.length > 0 && <p className="text-[11px] text-base-500">Unlocks: {l.unlocks.map((id) => HABITS.find((h) => h.id === id)!.name).join(', ')}</p>}
            </div>
          ))}
          <div className="border-t border-base-800 pt-3 text-xs text-base-300 flex flex-col gap-1">
            <p className="font-semibold text-base-100">Level up only when ALL are true</p>
            <p>• {LEVEL_UP_RULES.weeks}+ full weeks at the current level</p>
            <p>• Mean adherence ≥ {LEVEL_UP_RULES.meanMin}% over the last {LEVEL_UP_RULES.weeks} weeks, no week below {LEVEL_UP_RULES.eachWeekMin}%</p>
            <p>• Recovery score ≥ {LEVEL_UP_RULES.recoveryMin} every one of those weeks</p>
            <p>• You confirm it in the Sunday review (nothing changes automatically)</p>
            <p className="font-semibold text-base-100 mt-2">Deload → stabilise → rebuild when</p>
            <p>• Adherence &lt; {DELOAD_RULES.twoWeeksBelow}% two weeks running, or &lt; {DELOAD_RULES.oneWeekBelow}% in one week, or recovery &lt; {DELOAD_RULES.recoveryTwoWeeksBelow} two weeks running</p>
            <p>• Deload = 1 week Minimum Mode. Stabilise = Normal Mode until {DELOAD_RULES.stabiliseWeeks} weeks ≥ {DELOAD_RULES.stabiliseMin}%. Then rebuild.</p>
            <p>• If adherence is still &lt; 50% during the deload week → drop one level.</p>
            <p className="text-base-500 mt-1">A week counts as evidence only with 4+ logged days.</p>
            <p className="font-semibold text-base-100 mt-2">Calorie awareness unlocks by consistency, not level</p>
            <p>• 30-day protein adherence ≥ {Math.round(CALORIE_UNLOCK.c30 * 100)}% at {CALORIE_UNLOCK.checkpoints} weekly checkpoints in a row (3 weeks), not during a deload or Minimum Mode week</p>
            <p>• {AWARENESS_DAYS} days of logging only (no target), then a target range from your own data. Never required in Minimum Mode.</p>
          </div>
        </Card>

        <SectionTitle>Modes</SectionTitle>
        <Card className="p-4 text-xs text-base-300 flex flex-col gap-2">
          <p><span className="text-warn font-semibold">Minimum Mode</span> — stressful/busy weeks. Reduced frequencies and thresholds; habits unlocked after Level 1 pause (except connection). Recommended when work ≥ 55h, stress ≥ 4/5, last week's sleep &lt; 6.5h, or two softer warning signs.</p>
          <p><span className="text-base-100 font-semibold">Normal Mode</span> — the standard routine for your level.</p>
          <p><span className="text-info font-semibold">High-Performance Mode</span> — one extra scheduled day for training, study, protein, planning, reading, mobility. Only when last week was ≥ 85% with ≥ 7.3h sleep, energy ≥ 3.8, low stress and a light week ahead. Never more than 2 weeks in a row.</p>
        </Card>

        <SectionTitle>How scores are calculated</SectionTitle>
        <Card className="p-4 text-xs text-base-300 flex flex-col gap-2">
          <p><span className="text-base-100 font-semibold">Habit adherence</span> = successful days ÷ scheduled days (frequency × days ÷ 7), capped at 100%. Minimum counts as success. Unlogged past days count as misses. A 1x/week habit is "pending" until the week ends.</p>
          <p><span className="text-base-100 font-semibold">Weekly score</span> = weighted average of area scores with data ({(Object.keys(DOMAIN_WEIGHTS) as Domain[]).map((d) => `${DOMAIN_LABELS[d]} ${DOMAIN_WEIGHTS[d]}`).join(', ')}). Needs 3 logged days.</p>
          <p>Each area's formula is shown by tapping its bar in the weekly review. The score is diagnostic: it tells you where the system needs adjusting, not how good a person you are.</p>
          <p><span className="text-base-100 font-semibold">Streaks</span> are tracked but secondary. 7/30/90-day consistency is the headline metric.</p>
        </Card>

        <SectionTitle>Goal hierarchy</SectionTitle>
        <Card className="p-4 text-xs text-base-300">
          {Object.values(TIER_LABELS).join(' → ')} → Daily habits. Every habit links to a 90-day objective (see Goal tree).
        </Card>

        <SectionTitle>Principles</SectionTitle>
        <Card className="p-4 text-xs text-base-200 flex flex-col gap-1">
          {PRINCIPLES.map((p) => (
            <p key={p}>• {p}</p>
          ))}
        </Card>

        <SectionTitle>Nutrition</SectionTitle>
        <Card className="p-4">
          <NutritionPanel ctx={ctx} />
        </Card>

        <SectionTitle>Life OS settings</SectionTitle>
        <Card className="p-4">
          <SettingsPanel profile={profile} />
        </Card>
      </div>
    </div>
  );
}

function HabitCard({ h, profile, mode, extras }: { h: HabitSpec; profile: LifeProfile; mode: Mode; extras: TargetExtras }) {
  const t = targetFor(h, profile.level, mode);
  const label = t ? formatTarget(h, t, extras) : null;
  const goal = profile.goals.find((g) => g.id === h.goalLink);
  return (
    <Card className="p-4">
      <Collapsible
        title={
          <span className="flex items-center gap-2">
            {h.name}
            <span className="text-[11px] text-base-500 font-normal">{t ? frequencyLabel(t.perWeek) : 'paused in this mode'}</span>
          </span>
        }
      >
        <dl className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-1.5 text-xs">
          <Item k="Why it matters" v={h.why} />
          <Item k="Serves goal" v={goal ? goal.title : 'Unlinked'} />
          <Item k="Minimum" v={label?.min ?? '—'} />
          <Item k="Ideal" v={label?.ideal ?? '—'} />
          <Item k="Frequency" v={t ? frequencyLabel(t.perWeek) : 'Paused'} />
          <Item k="Est. time" v={h.estMinutes.min === 0 && h.estMinutes.ideal === 0 ? 'No extra time (behaviour change)' : `${h.estMinutes.min}–${h.estMinutes.ideal} min`} />
          <Item k="Difficulty" v={`${h.difficulty}/5`} />
          <Item k="Impact" v={`${h.impact}/5`} />
          <Item k="Trigger / cue" v={h.trigger} />
          <Item k="How to track" v={h.track} />
          <Item k="If it keeps failing" v={h.redesign.smaller} />
        </dl>
      </Collapsible>
    </Card>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-base-500">{k}</dt>
      <dd className="text-base-200 leading-relaxed">{v}</dd>
    </>
  );
}

function SettingsPanel({ profile }: { profile: LifeProfile }) {
  const upd = (patch: Partial<LifeProfile>) => db.lifeProfile.update('life', patch);
  const unlocked = HABITS.filter((h) => isUnlocked(h, profile.level, profile));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-base-200 mt-1">Pause a habit</p>
      <p className="text-[11px] text-base-500 -mt-2">Too many habits? Pause the newest rather than failing all of them. Paused habits aren't scored.</p>
      {unlocked.map((h) => (
        <div key={h.id} className="flex items-center justify-between">
          <span className="text-sm text-base-100">{h.name}</span>
          <Switch
            checked={!profile.pausedHabits.includes(h.id)}
            onCheckedChange={(on) => upd({ pausedHabits: on ? profile.pausedHabits.filter((x) => x !== h.id) : [...profile.pausedHabits, h.id] })}
          />
        </div>
      ))}
    </div>
  );
}

function NutritionPanel({ ctx }: { ctx: LifeContext }) {
  const { profile } = ctx;
  const upd = (patch: Partial<LifeProfile>) => db.lifeProfile.update('life', patch);
  const auto = profile.proteinAuto ?? true;
  const perKg = profile.proteinPerKg ?? DEFAULT_PER_KG;
  const pt = proteinTargets(profile, ctx.bodyweight, ctx.today);
  const [pmin, setPmin] = useState(String(profile.proteinMinG));
  const [pideal, setPideal] = useState(String(profile.proteinIdealG));
  const [kmin, setKmin] = useState(String(perKg.min));
  const [kideal, setKideal] = useState(String(perKg.ideal));
  const unlock = calorieUnlockStatus(ctx);
  const st = calorieStatus(ctx);
  const cal = profile.calorie;
  const est = st.estimate;
  const [goal, setGoal] = useState<CalorieGoal>(cal?.goal ?? 'maintain');

  async function setTarget(g: CalorieGoal) {
    if (!est?.ok || est.maintenance === null) return;
    await upd({ calorie: { ...cal!, goal: g, maintenance: est.maintenance, target: est.maintenance + CALORIE_OFFSETS[g], targetSetAt: ctx.today } });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-base-100">Protein targets from bodyweight</p>
          <p className="text-[11px] text-base-500">
            Now: {pt.min}g min · {pt.ideal}g ideal {pt.source === 'bodyweight' ? `(${pt.weight}kg)` : auto ? '(no weigh-in yet — using manual values)' : '(manual)'}
          </p>
        </div>
        <Switch checked={auto} onCheckedChange={(v) => upd({ proteinAuto: v })} />
      </div>
      {auto ? (
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Minimum g/kg" value={kmin} set={setKmin} commit={() => Number(kmin) > 0 && upd({ proteinPerKg: { ...perKg, min: Number(kmin) } })} />
          <NumField label="Ideal g/kg" value={kideal} set={setKideal} commit={() => Number(kideal) > 0 && upd({ proteinPerKg: { ...perKg, ideal: Number(kideal) } })} />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <NumField label={auto ? 'Fallback minimum (g)' : 'Minimum (g)'} value={pmin} set={setPmin} commit={() => Number(pmin) > 0 && upd({ proteinMinG: Number(pmin) })} />
        <NumField label={auto ? 'Fallback ideal (g)' : 'Ideal (g)'} value={pideal} set={setPideal} commit={() => Number(pideal) > 0 && upd({ proteinIdealG: Number(pideal) })} />
      </div>

      <div className="border-t border-base-800 pt-3">
        <p className="text-sm font-semibold text-base-100">Calories</p>
        {st.stage === 'locked' && (
          <>
            <p className="text-xs text-base-400 mt-1">{unlock.reason}</p>
            <div className="flex gap-1.5 mt-2">
              {[...unlock.checks].reverse().map((c) => (
                <span key={c.date} className={`text-[11px] px-2 py-1 rounded-lg border ${c.c30 !== null && c.c30 >= CALORIE_UNLOCK.c30 ? 'border-accent/50 text-accent' : 'border-base-700 text-base-500'}`}>
                  {c.c30 === null ? '—' : `${Math.round(c.c30 * 100)}%`}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-base-500 mt-1">30-day protein adherence at the last 4 weekly checkpoints (oldest → today).</p>
            {unlock.eligible && (
              <Button size="sm" className="mt-2" onClick={() => upd({ calorie: { unlockedAt: ctx.today, goal: null, maintenance: null, target: null, targetSetAt: null } })}>
                Unlock calorie awareness
              </Button>
            )}
          </>
        )}
        {(st.stage === 'awareness' || st.stage === 'ready-to-set') && (
          <>
            <p className="text-xs text-base-400 mt-1">
              Awareness phase: day {Math.min(st.daysSinceUnlock + 1, AWARENESS_DAYS)} of {AWARENESS_DAYS}. Logging calories is the habit — no target yet.
            </p>
            <p className="text-xs text-base-300 mt-1">
              {est?.ok
                ? `Estimated maintenance ≈ ${est.maintenance} kcal/day (avg intake ${est.avgIntake} kcal, weight ${est.kgPerWeek! > 0 ? '+' : ''}${est.kgPerWeek} kg/week over ${est.days} days).`
                : est?.reason}
            </p>
            {st.stage === 'ready-to-set' && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="grid grid-cols-3 gap-1.5">
                  {(['cut', 'maintain', 'bulk'] as CalorieGoal[]).map((g) => (
                    <button key={g} onClick={() => setGoal(g)} className={`h-9 rounded-xl text-xs font-semibold border ${goal === g ? 'bg-accent text-base-950 border-accent' : 'bg-base-850 text-base-300 border-base-700'}`}>
                      {g === 'bulk' ? 'Lean bulk' : g[0].toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-base-500">{GOAL_LABELS[goal]} → target {est!.maintenance! + CALORIE_OFFSETS[goal]} kcal (±{CALORIE_BANDS.min} counts as success).</p>
                <Button size="sm" onClick={() => setTarget(goal)}>Set target</Button>
              </div>
            )}
          </>
        )}
        {st.stage === 'target' && cal?.target && (
          <>
            <p className="text-xs text-base-300 mt-1">
              {GOAL_LABELS[cal.goal!]} · target {cal.target} kcal (success {cal.target - CALORIE_BANDS.min}–{cal.target + CALORIE_BANDS.min}, ideal ±{CALORIE_BANDS.ideal}). Set {cal.targetSetAt} from maintenance ≈ {cal.maintenance}.
            </p>
            <p className="text-[11px] text-base-500 mt-1">
              {est?.ok ? `Latest estimate: maintenance ≈ ${est.maintenance} kcal (weight ${est.kgPerWeek! > 0 ? '+' : ''}${est.kgPerWeek} kg/week).` : est?.reason}
            </p>
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              {(['cut', 'maintain', 'bulk'] as CalorieGoal[]).map((g) => (
                <button key={g} disabled={!est?.ok} onClick={() => setTarget(g)} className={`h-9 rounded-xl text-xs font-semibold border disabled:opacity-40 ${cal.goal === g ? 'bg-accent text-base-950 border-accent' : 'bg-base-850 text-base-300 border-base-700'}`}>
                  {g === 'bulk' ? 'Lean bulk' : g[0].toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-base-500 mt-1">Tap a goal to re-estimate and reset the target from your latest 4 weeks of data.</p>
          </>
        )}
        {st.stage !== 'locked' && (
          <button
            className="text-xs text-base-500 underline mt-2"
            onClick={() => confirm('Turn calorie tracking off? Your logged calories are kept; it can be unlocked again later.') && upd({ calorie: undefined })}
          >
            Turn calorie tracking off
          </button>
        )}
      </div>
    </div>
  );
}

function NumField({ label, value, set, commit }: { label: string; value: string; set: (v: string) => void; commit: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-base-400">{label}</label>
      <Input type="number" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} onBlur={commit} />
    </div>
  );
}
