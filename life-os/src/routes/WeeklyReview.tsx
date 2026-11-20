import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import * as A from '@/lib/actions';
import { addDays, fmtShort, weekStart } from '@/lib/dates';
import { insights, periodMetrics } from '@/lib/analytics';
import { goalProgress, liveGoals } from '@/lib/goals';
import { habitStats, isWeeklyHabit } from '@/lib/habits';
import { Page, PageHeader } from '@/components/layout';
import { Panel } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Segmented } from '@/components/ui/Chips';
import { Input, Textarea } from '@/components/ui/Input';
import { hours, pct, StatCard } from '@/components/Visuals';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toaster';

/** End-of-week review: the numbers first, then a short reflection and next week's focus. */
export default function WeeklyReview() {
  const { s, ledger } = useStore();
  const toast = useToast();
  const cur = weekStart(s.today);
  const reviewable = addDays(cur, 4) <= s.today ? cur : addDays(cur, -7);
  const options = Array.from({ length: 8 }, (_, i) => addDays(reviewable, -7 * i)).filter((w) => addDays(w, 6) >= s.profile.startDate);
  const [ws, setWs] = useState(reviewable);
  const existing = s.weeklyReviews.get(ws);
  const [wins, setWins] = useState('');
  const [challenges, setChallenges] = useState('');
  const [lessons, setLessons] = useState('');
  const [focus, setFocus] = useState(['', '', '']);
  const [rating, setRating] = useState<number | null>(null);
  useEffect(() => {
    setWins(existing?.wins ?? '');
    setChallenges(existing?.challenges ?? '');
    setLessons(existing?.lessons ?? '');
    setFocus([0, 1, 2].map((i) => existing?.nextFocus[i] ?? ''));
    setRating(existing?.rating ?? null);
  }, [ws, existing]);

  const end = addDays(ws, 6);
  const m = periodMetrics(s, ws, end, ledger);
  const prevFocus = s.weeklyReviews.get(addDays(ws, -7))?.nextFocus.filter(Boolean) ?? [];
  const goals = liveGoals(s)
    .filter((g) => g.horizon !== 'vision' && g.startDate <= end)
    .map((g) => ({ g, before: goalProgress(s, g, addDays(ws, -1)).value ?? 0, after: goalProgress(s, g, end < s.today ? end : s.today).value }))
    .filter((x) => x.after !== null);
  const habits = s.habits
    .filter((h) => h.startDate <= end)
    .map((h) => ({ h, st: habitStats(s, h, isWeeklyHabit(h) ? ws : ws, end < s.today ? end : addDays(s.today, -1)) }))
    .filter((x) => x.st.rate !== null);
  const notes = ws === cur || ws === addDays(cur, -7) ? insights(s).filter((i) => i.kind === 'warning').slice(0, 3) : [];

  async function save() {
    try {
      await A.saveWeeklyReview(ws, { wins, challenges, lessons, nextFocus: focus, rating });
      toast(existing ? 'Review updated' : `Review saved · +${s.settings.xp.weeklyReview} XP`, existing ? 'success' : 'xp');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <>
      <PageHeader back title="Weekly review" subtitle={`${fmtShort(ws)} – ${fmtShort(end)}`} />
      <Page className="max-w-4xl">
        <div className="w-60 mb-4">
          <Select ariaLabel="Week" value={ws} onValueChange={setWs} options={options.map((w) => ({ value: w, label: `${w === cur ? 'This week' : `Week of ${fmtShort(w)}`}${s.weeklyReviews.has(w) ? ' ✓' : ''}` }))} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Habits" value={pct(m.habitRate)} sub={`${Math.round(m.habitCredit)} of ${m.habitTotal}`} />
          <StatCard label="Tasks" value={m.tasksDone} sub={m.tasksDue ? `${pct(m.taskRate)} of due` : 'completed'} />
          <StatCard label="Focus" value={hours(m.focusMin)} />
          <StatCard label="Goal progress" value={m.goalDelta === null ? '—' : `${m.goalDelta >= 0 ? '+' : ''}${Math.round(m.goalDelta * 100)} pts`} sub={`${m.milestonesDone} milestones`} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Panel title="Did your actions move your goals?">
            {goals.length === 0 ? (
              <p className="text-[13px] text-fg-3">No measurable goals in this week.</p>
            ) : (
              <ul className="space-y-1.5 text-[13px]">
                {goals.map(({ g, before, after }) => {
                  const d = (after ?? 0) - before;
                  return (
                    <li key={g.id} className="flex justify-between gap-2">
                      <Link to={`/goals/${g.id}`} className="truncate hover:underline">
                        {g.title}
                      </Link>
                      <span className={d > 0 ? 'text-success tnum' : 'text-fg-3 tnum'}>{d > 0 ? `+${Math.round(d * 100)} pts` : 'no change'}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <Panel title="Habits this week">
            {habits.length === 0 ? (
              <p className="text-[13px] text-fg-3">Nothing settled yet.</p>
            ) : (
              <ul className="space-y-1.5 text-[13px]">
                {habits.map(({ h, st }) => (
                  <li key={h.id} className="flex justify-between gap-2">
                    <span className="truncate">{h.name}</span>
                    <span className="tnum text-fg-2">
                      {pct(st.rate)} <span className="text-fg-3 text-xs">({st.done}✓ {st.partial}½ {st.missed}✕)</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {prevFocus.length > 0 && (
            <Panel title="Last week you planned to focus on">
              <ul className="list-disc pl-4 text-[13px] text-fg-2 space-y-1">
                {prevFocus.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Panel>
          )}
          {notes.length > 0 && (
            <Panel title="Worth looking at">
              <ul className="space-y-2 text-[13px]">
                {notes.map((n) => (
                  <li key={n.id}>
                    <span className="font-medium">{n.title}</span>
                    <span className="block text-xs text-fg-3">{n.detail}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
        <Panel title="Reflection" className="mt-4" subtitle={existing ? `Saved ${new Date(existing.completedAt).toLocaleDateString('en-GB')}` : `Earns ${s.settings.xp.weeklyReview} XP once per week`} action={existing ? <CheckCircle2 size={16} className="text-success" /> : undefined}>
          <div className="space-y-4">
            <Field label="What went well?">
              <Textarea value={wins} onChange={(e) => setWins(e.target.value)} />
            </Field>
            <Field label="What got in the way?">
              <Textarea value={challenges} onChange={(e) => setChallenges(e.target.value)} />
            </Field>
            <Field label="What did you learn?">
              <Textarea value={lessons} onChange={(e) => setLessons(e.target.value)} />
            </Field>
            <Field label="Next week's three priorities">
              <div className="space-y-2">
                {focus.map((f, i) => (
                  <Input key={i} value={f} onChange={(e) => setFocus(focus.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Priority ${i + 1}`} aria-label={`Priority ${i + 1}`} />
                ))}
              </div>
            </Field>
            <Field label="How did the week feel overall?">
              <Segmented value={rating} onChange={setRating} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: ['', 'Poor', 'Below par', 'OK', 'Good', 'Excellent'][n] }))} />
            </Field>
            <Button onClick={save} disabled={!(wins.trim() || challenges.trim() || lessons.trim() || focus.some((f) => f.trim()))}>
              {existing ? 'Update review' : 'Save review'}
            </Button>
          </div>
        </Panel>
      </Page>
    </>
  );
}
