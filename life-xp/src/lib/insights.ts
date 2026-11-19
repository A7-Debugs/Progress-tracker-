import { addDays, dateRange, dayOfWeek, DAY_SHORT, monthStart } from './dates';
import { calendarWeekConsistency, consistency, dayStatus, habitCompletionRate, pastWeekStarts } from './performance';
import type { Snapshot } from './snapshot';
import { weekStart } from './dates';

export interface Insight {
  tone: 'positive' | 'focus' | 'neutral';
  text: string;
}

/** Plain-English observations from real data only. Returns nothing rather than guessing. */
export function insights(s: Snapshot): Insight[] {
  const out: Insight[] = [];
  const yesterday = addDays(s.today, -1);
  const thisWeek = calendarWeekConsistency(s, weekStart(s.today));
  const [lw, pw] = pastWeekStarts(s, 2).map((w) => calendarWeekConsistency(s, w));
  if (lw?.pct != null && pw?.pct != null) {
    const d = Math.round((lw.pct - pw.pct) * 100);
    if (d >= 5) out.push({ tone: 'positive', text: `Last week was ${d} points better than the week before. Momentum is building.` });
    else if (d <= -10) out.push({ tone: 'focus', text: `Last week dipped ${-d} points. That happens. Pick your easiest habits first this week.` });
  }
  if (thisWeek.pct !== null && thisWeek.days >= 3 && lw?.pct != null && thisWeek.pct > lw.pct + 0.05) {
    out.push({ tone: 'positive', text: `This week is on track to beat last week (${Math.round(thisWeek.pct * 100)}% vs ${Math.round(lw.pct * 100)}%).` });
  }

  // Best and hardest day of week over the last 8 weeks.
  const from = addDays(s.today, -56);
  const start = from < s.profile.startDate ? s.profile.startDate : from;
  if (start <= yesterday) {
    const byDow = new Map<number, { d: number; s: number }>();
    for (const d of dateRange(start, yesterday)) {
      const st = dayStatus(s, d);
      if (!st.scheduled.length) continue;
      const e = byDow.get(dayOfWeek(d)) ?? { d: 0, s: 0 };
      e.d += st.done.length;
      e.s += st.scheduled.length;
      byDow.set(dayOfWeek(d), e);
    }
    const ranked = [...byDow.entries()].filter(([, v]) => v.s >= 8).map(([k, v]) => ({ k, p: v.d / v.s })).sort((a, b) => b.p - a.p);
    if (ranked.length >= 3) {
      out.push({ tone: 'positive', text: `${DAY_SHORT[ranked[0].k]} is your strongest day (${Math.round(ranked[0].p * 100)}%).` });
      const worst = ranked.at(-1)!;
      if (ranked[0].p - worst.p > 0.2) out.push({ tone: 'focus', text: `${DAY_SHORT[worst.k]} is the hardest (${Math.round(worst.p * 100)}%). Could you prep the night before?` });
    }
  }

  // Most consistent and most-missed habits over 4 weeks.
  const rates = s.habits
    .filter((h) => h.active)
    .map((h) => ({ h, r: habitCompletionRate(s, h, addDays(s.today, -28), yesterday) }))
    .filter((x) => x.r.scheduled >= 7 && x.r.pct !== null)
    .sort((a, b) => b.r.pct! - a.r.pct!);
  if (rates.length >= 2) {
    const top = rates[0];
    if (top.r.pct! >= 0.8) out.push({ tone: 'positive', text: `"${top.h.name}" is locked in at ${Math.round(top.r.pct! * 100)}%. That's a real habit now.` });
    const low = rates.at(-1)!;
    if (low.r.pct! < 0.5) out.push({ tone: 'focus', text: `"${low.h.name}" is at ${Math.round(low.r.pct! * 100)}%. Try linking it to something you already do.` });
  }

  // Sleep trend.
  const sleeps = [...s.sleepLogs.values()].filter((x) => x.date > addDays(s.today, -14));
  if (sleeps.length >= 5) {
    const avg = sleeps.reduce((a, x) => a + x.minutes, 0) / sleeps.length;
    if (avg >= 480) out.push({ tone: 'positive', text: `Averaging ${(avg / 60).toFixed(1)}h sleep: right in the 8–10h zone.` });
    else out.push({ tone: 'focus', text: `Averaging ${(avg / 60).toFixed(1)}h sleep. Aim for 8–10h. An earlier screens-off helps most.` });
  }

  // Month vs last month.
  const ms = monthStart(s.today);
  const lastMs = monthStart(addDays(ms, -1));
  const thisM = consistency(s, ms, yesterday < ms ? ms : yesterday);
  const lastM = consistency(s, lastMs, addDays(ms, -1));
  if (thisM.days >= 7 && lastM.days >= 7 && thisM.pct !== null && lastM.pct !== null) {
    const d = Math.round((thisM.pct - lastM.pct) * 100);
    if (d >= 3) out.push({ tone: 'positive', text: `This month is ${d} points ahead of last month.` });
  }
  return out.slice(0, 5);
}
