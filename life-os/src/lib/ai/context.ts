import { addDays, weekStart } from '../dates';
import type { Snapshot } from '../snapshot';
import { effortVsOutcome, fmtValue, goalPace, goalProgress, HORIZON_BY_ID, liveGoals, nextMilestone } from '../goals';
import { frequencyLabel, habitStats } from '../habits';
import { insights, periodMetrics, workload } from '../analytics';
import { agendaFor, conflictsFor } from '../schedule';
import { filterTasks, quadrant, sortByScore } from '../tasks';
import { levelInfo, xpLedger } from '../progression';

/**
 * Builds the factual brief the assistant reasons over. Everything is computed from the user's own
 * records and is shown to the user before anything is sent, so they can see exactly what leaves the device.
 * Organised around four questions: what they want, what they're doing, what's in the way, and what's next.
 */
export function buildContext(s: Snapshot): string {
  const ledger = xpLedger(s);
  const lines: string[] = [];
  const p = (x = '') => lines.push(x);
  const pc = (v: number | null) => (v === null ? 'n/a' : `${Math.round(v * 100)}%`);

  p(`Today: ${s.today}. Using Life OS since ${s.profile.startDate}. Level ${levelInfo(s, ledger).level}.`);
  if (s.profile.quiz) {
    const q = s.profile.quiz;
    p(`Onboarding answers: routine "${q.routine}", ~${q.dailyMinutes} min/day available, obstacles: ${q.obstacles.join(', ') || 'none given'}, planning horizon ${q.horizon}.`);
  }

  p('\n## 1. What they want to achieve (goals)');
  const goals = liveGoals(s).filter((g) => g.status === 'active' || g.status === 'paused');
  if (!goals.length) p('No active goals.');
  for (const g of goals) {
    const pr = goalProgress(s, g);
    const pace = goalPace(s, g);
    const nm = nextMilestone(s, g);
    const cat = s.categoryById.get(g.categoryId)?.name ?? g.categoryId;
    p(`- [${HORIZON_BY_ID[g.horizon].short}] "${g.title}" (${cat}, P${g.priority}, ${g.status}${g.targetDate ? `, target ${g.targetDate}` : ''}): progress ${pc(pr.value)} (${pr.source}); ${pace.label}.${nm ? ` Next milestone: "${nm.title}".` : ''}${g.measurement === 'numeric' || g.measurement === 'hybrid' ? ` Measured: ${fmtValue(g.currentValue, g.unit)} from ${fmtValue(g.startValue, g.unit)} towards ${fmtValue(g.targetValue, g.unit)}.` : ''}`);
    const e = effortVsOutcome(s, g, addDays(s.today, -13), s.today);
    if (e.tasksDone || e.focusMin) p(`  Last 14 days: ${e.tasksDone} linked tasks done, ${e.focusMin} focus min, progress change ${e.progressDelta === null ? 'n/a' : `${Math.round(e.progressDelta * 100)} pts`}.`);
  }

  p('\n## 2. What they are actually doing');
  const lw = weekStart(addDays(s.today, -7));
  const last = periodMetrics(s, lw, addDays(lw, 6), ledger);
  const cur = periodMetrics(s, weekStart(s.today), s.today, ledger);
  const four = periodMetrics(s, addDays(s.today, -28), addDays(s.today, -1), ledger);
  p(`Last full week: habits ${pc(last.habitRate)}, tasks ${last.tasksDone} done of ${last.tasksDue} due (${pc(last.taskRate)}), focus ${(last.focusMin / 60).toFixed(1)}h, consistent days ${pc(last.consistency)}.`);
  p(`This week so far (${cur.days} days): habits ${pc(cur.habitRate)}, ${cur.tasksDone} tasks done, focus ${(cur.focusMin / 60).toFixed(1)}h.`);
  p(`Last 28 days: habits ${pc(four.habitRate)}, ${four.tasksDone} tasks done, focus ${(four.focusMin / 60).toFixed(1)}h, ${four.milestonesDone} milestones achieved.`);
  p('Habits (last 28 days):');
  for (const h of s.habits.filter((x) => x.active)) {
    const st = habitStats(s, h, addDays(s.today, -28), addDays(s.today, -1));
    p(`- ${h.name} (${frequencyLabel(h.frequency)}${h.target > 1 ? `, target ${h.target} ${h.unit}` : ''}): ${pc(st.rate)}; done ${st.done}, minimum ${st.partial}, missed ${st.missed}; streak ${st.current} ${st.unit}.`);
  }

  p('\n## 3. What may be preventing progress');
  const ins = insights(s).filter((i) => i.kind === 'warning');
  if (!ins.length) p('No warnings detected from the data.');
  for (const i of ins) p(`- ${i.title}: ${i.detail}`);
  const overdue = filterTasks(s, 'overdue');
  if (overdue.length) p(`- ${overdue.length} overdue task(s).`);
  const wl = workload(s);
  if (wl) p(`- Next 7 days: ${(wl.estimateMin / 60).toFixed(1)}h of estimated tasks (${wl.unestimated} unestimated) vs ${(wl.avgWeeklyFocusMin / 60).toFixed(1)}h average weekly focus.`);
  let clashDays = 0;
  for (let i = 0; i < 7; i++) if (conflictsFor(agendaFor(s, addDays(s.today, i))).length) clashDays++;
  if (clashDays) p(`- Calendar conflicts on ${clashDays} of the next 7 days.`);
  const j = [...s.journal.values()].filter((x) => x.date >= addDays(s.today, -14)).sort((a, b) => b.date.localeCompare(a.date));
  for (const x of j.slice(0, 5)) {
    const bits = [x.challenges && `challenges: ${x.challenges}`, x.lessons && `lessons: ${x.lessons}`].filter(Boolean).join('; ');
    if (bits) p(`- Journal ${x.date}: ${bits.slice(0, 300)}`);
  }

  p('\n## 4. Open work');
  const open = sortByScore(s, filterTasks(s, 'all')).slice(0, 25);
  for (const t of open) {
    const g = t.goalId ? s.goalById.get(t.goalId)?.title : null;
    p(`- "${t.title}" P${t.priority}, Q${quadrant(s, t)}${t.dueDate ? `, due ${t.dueDate}` : ''}${t.plannedDate ? `, planned ${t.plannedDate}` : ''}${t.estimateMin ? `, ~${t.estimateMin}m` : ''}${t.postponed ? `, postponed ${t.postponed}×` : ''}${g ? `, for "${g}"` : ''}`);
  }
  const rv = s.weeklyReviews.get(lw);
  if (rv?.nextFocus.some((f) => f)) p(`Last weekly review's focus for this week: ${rv.nextFocus.filter(Boolean).join('; ')}.`);
  return lines.join('\n');
}

export const SYSTEM_PROMPT = `You are the personal life assistant inside Life OS, an app where an adult tracks long-term goals, milestones, habits, tasks, a calendar, focus time and reflections.

You receive a factual brief computed from their own records. Use only that data; when something isn't in it, say you don't have that information rather than assuming. Quote the actual numbers when you make a point.

Keep four things distinct, and make the distinction visible in your answer when it matters:
1. What they want to achieve (their goals).
2. What they are actually doing (habits, tasks, focus time).
3. What appears to be preventing progress.
4. Which actions would produce the greatest improvement.

Task completion is not goal progress: if lots of linked tasks are done but a goal's measured progress hasn't moved, point that out. Flag unrealistic workloads and calendar conflicts when the data shows them. Prefer a small number of specific, high-leverage recommendations over long lists, and prefer sustainable consistency over perfection. Be constructive and direct, never judgmental. Use short paragraphs or brief lists. You cannot change their data; suggest what they could change in the app.`;
