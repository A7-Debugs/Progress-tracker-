import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Lock, Plus, Unlock } from 'lucide-react';
import { db } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toaster';
import { BUILTIN_HABITS, HABITS, LEVELS, habitCap, habitState, isUnlocked, type HabitSpec } from '@/lib/life/habits';
import { habitStreaks, pastWeeks, type LifeContext } from '@/lib/life/engine';
import { LEVEL_UP_RULES } from '@/lib/life/progression';
import { masteryOf } from '@/lib/life/analytics';

/**
 * Gamified unlocks: every habit you can earn, by level, with progress to the next level.
 * Level habits switch on automatically when you level up; optional ones become available to add.
 */
export function UnlockRoadmap({ ctx, compact = false }: { ctx: LifeContext; compact?: boolean }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [showAll, setShowAll] = useState(!compact);
  const { profile, today } = ctx;
  const level = profile.level;

  const d = useMemo(() => {
    // Same weeks the level-up rule uses: the 3 most recent completed weeks with 4+ logged days.
    const last = pastWeeks(ctx, 6)
      .filter((w) => w.loggedDays >= 4 && w.metrics.sickDays < 3 && w.habitAdherence !== null)
      .slice(0, LEVEL_UP_RULES.weeks);
    const mean = last.length ? (last.reduce((a, w) => a + w.habitAdherence!, 0) / last.length) * 100 : null;
    const fullWeeks = last.filter((w) => (w.habitAdherence ?? 0) * 100 >= LEVEL_UP_RULES.eachWeekMin).length;
    const scored = HABITS.filter((h) => (h.custom || isUnlocked(h, level, profile)) && ['active', 'upcoming'].includes(habitState(profile, h, today)));
    const mastery = scored
      .map((h) => ({ h, m: masteryOf(habitStreaks(ctx, h).c30) }))
      .filter((x): x is { h: HabitSpec; m: NonNullable<ReturnType<typeof masteryOf>> } => !!x.m);
    return { mean, fullWeeks: Math.min(fullWeeks, LEVEL_UP_RULES.weeks), scored: scored.length, mastery };
  }, [ctx, level, profile, today]);

  const locked = BUILTIN_HABITS.filter((h) => h.unlock > level && h.id !== 'calories');
  const available = BUILTIN_HABITS.filter((h) => h.optional && h.unlock <= level && !profile.optIn?.[h.id]);
  const progress = d.mean === null ? 0 : Math.min(1, d.mean / LEVEL_UP_RULES.meanMin);
  const cap = habitCap(level);

  async function add(h: HabitSpec) {
    if (d.scored >= cap) {
      toast(`You're at ${cap} scored habits — swap one out under Edit habits first`, 'warn');
      return navigate('/system');
    }
    await db.lifeProfile.update('life', { optIn: { ...(profile.optIn ?? {}), [h.id]: today } });
    toast(`${h.name} added — it counts from today`);
  }

  const byLevel = new Map<number, HabitSpec[]>();
  for (const h of locked) byLevel.set(h.unlock, [...(byLevel.get(h.unlock) ?? []), h]);
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  const shownLevels = showAll ? levels : levels.slice(0, 1);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-base-50 flex items-center gap-2">
          <Unlock size={15} className="text-accent" /> Habit unlocks
        </p>
        {level < 6 && <Badge variant="accent">Level {level} → {level + 1}</Badge>}
      </div>

      {level < 6 && (
        <>
          <div className="mt-3 h-2 rounded-full bg-base-800 overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next level">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="text-[11px] text-base-400 mt-1.5">
            3-week adherence {d.mean === null ? '—' : `${Math.round(d.mean)}%`} of {LEVEL_UP_RULES.meanMin}% needed · {d.fullWeeks}/{LEVEL_UP_RULES.weeks} weeks at {LEVEL_UP_RULES.eachWeekMin}%+. Hit it and the weekly review offers Level {level + 1}.
          </p>
        </>
      )}

      {available.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">Unlocked — ready to add</p>
          {available.map((h) => (
            <div key={h.id} className="rounded-xl border border-accent/30 bg-accent-bg/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-base-50">{h.name}</p>
                <Button size="sm" variant="secondary" onClick={() => add(h)}>
                  <Plus size={14} /> Add
                </Button>
              </div>
              <p className="text-xs text-base-300 mt-1">{h.why}</p>
              {h.science && <p className="text-[11px] text-base-500 mt-1">{h.science}</p>}
            </div>
          ))}
        </div>
      )}

      {shownLevels.map((lv) => (
        <div key={lv} className="mt-3 flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-base-500">
            Level {lv} · {LEVELS[lv - 1].name}
          </p>
          {byLevel.get(lv)!.map((h) => (
            <div key={h.id} className="flex items-start gap-2.5 rounded-xl bg-base-850 border border-base-800 p-2.5">
              <Lock size={14} className="text-base-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-base-200">
                  {h.name} <span className="text-[11px] text-base-500">{h.optional ? '· optional' : '· switches on at this level'}</span>
                </p>
                {!compact && <p className="text-[11px] text-base-500 mt-0.5">{h.science ?? h.why}</p>}
              </div>
            </div>
          ))}
        </div>
      ))}
      {compact && levels.length > 1 && (
        <button className="text-xs text-accent mt-2" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show less' : `See all ${locked.length} locked habits`}
        </button>
      )}

      {d.mastery.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-base-500 flex items-center gap-1.5">
            <Award size={12} /> Mastery (30-day consistency)
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {d.mastery.map(({ h, m }) => (
              <span key={h.id} className="inline-flex items-center gap-1.5 rounded-full bg-base-800 px-2.5 py-1 text-[11px] text-base-200">
                <span className="h-2 w-2 rounded-full" style={{ background: m.color }} aria-hidden />
                {h.name} · {m.tier}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-base-500 mt-1">Bronze 70% · Silver 80% · Gold 90% over 30 days.</p>
        </div>
      )}
    </Card>
  );
}
