import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Brain, CalendarDays, ChevronRight, Lock, NotebookPen, Play, Plus, Timer } from 'lucide-react';
import { useSnapshot } from '@/lib/hooks';
import { Loading, Page, PageHeader } from '@/components/layout';
import { Bar, Ring, SectionTitle, StatTile } from '@/components/game';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { currentWeekSessions, effectiveRevisionTarget, TOPIC_STATUSES, WORKLOAD_MODES } from '@/lib/academy/academy';
import { dueTopics, upcomingReviews } from '@/lib/academy/srs';
import { topicNeedScore } from '@/lib/academy/planner';
import { currentLevel, habitProgress, scheduledHabits, xpBetween } from '@/lib/performance';
import { hasFeature, tierForLevel } from '@/lib/levels';
import { addDays, fmtDuration, relDay, weekStart } from '@/lib/dates';

export default function Academy() {
  const s = useSnapshot();
  const navigate = useNavigate();
  const d = useMemo(() => {
    if (!s) return null;
    const ws = weekStart(s.today);
    const target = effectiveRevisionTarget(s);
    const sessions = currentWeekSessions(s);
    const weekMinutes = sessions.reduce((a, r) => a + Math.floor(r.focusedSeconds / 60), 0);
    const totalMinutes = s.revisionSessions.reduce((a, r) => a + Math.floor(r.focusedSeconds / 60), 0);
    const live = new Set(s.subjects.filter((x) => !x.archived).map((x) => x.id));
    const topics = s.topics.filter((t) => live.has(t.subjectId));
    const covered = topics.filter((t) => t.firstStudied !== null).length;
    const attention = topics.filter((t) => t.firstStudied !== null && (t.needsRevisit || t.status <= 2 || (t.confidence ?? 5) <= 2)).sort((a, b) => topicNeedScore(b) - topicNeedScore(a));
    const plan = s.weekPlans.get(ws);
    const upcomingPlan = (plan?.items ?? []).filter((i) => !i.done && i.date >= s.today).slice(0, 3);
    const homework = scheduledHabits(s, s.today).find((h) => h.templateId === 'homework');
    return {
      ws,
      target,
      sessions,
      weekMinutes,
      totalMinutes,
      topics,
      covered,
      attention,
      due: dueTopics(s),
      upcoming: upcomingReviews(s, 7),
      upcomingPlan,
      homework,
      academicXp: xpBetween(s, '0000-01-01', s.today, 'academic'),
      weekXp: xpBetween(s, ws, addDays(ws, 6), 'academic'),
    };
  }, [s]);
  if (!s || !d) return <Loading />;
  const level = currentLevel(s).level;
  const tier = tierForLevel(level);
  const subjects = s.subjects.filter((x) => !x.archived);
  const subjectById = new Map(s.subjects.map((x) => [x.id, x]));
  const topicById = new Map(s.topics.map((t) => [t.id, t]));
  const plannerUnlocked = hasFeature(level, 'planner');
  const mode = WORKLOAD_MODES.find((m) => m.value === s.settings.workload)!;
  const pct = d.target.perWeek ? Math.min(1, d.sessions.length / d.target.perWeek) : 1;

  return (
    <>
      <PageHeader title="GCSE Academy" subtitle={`Tier ${tier.tier} · ${tier.focus}`} right={<Link to="/academy/stats" className="h-10 w-10 rounded-xl flex items-center justify-center text-base-300" aria-label="Academy analytics"><BarChart3 size={20} /></Link>} />
      <Page className="pb-8">
        <section className="relative overflow-hidden rounded-3xl border border-violet/30 bg-gradient-to-br from-violet/15 via-base-900 to-base-950 p-4">
          <div className="flex items-center gap-4">
            <Ring value={pct} size={104} stroke={10} gradient={['#a47bff', '#ff5fa2']}>
              <div className="text-center">
                <div className="text-3xl font-black tabular-nums leading-none">
                  {d.sessions.length}
                  <span className="text-base text-base-400">/{d.target.perWeek}</span>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-base-400 mt-1">sessions</div>
              </div>
            </Ring>
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-xs text-base-400">This week's target</p>
              <p className="font-black text-base-50">
                {d.target.perWeek === 0 ? 'Rest week' : `${d.target.perWeek} × ${d.target.minutes} min`}
              </p>
              <p className="text-xs text-base-300">{fmtDuration(d.weekMinutes)} focused · +{d.weekXp} academic XP</p>
              <Link to="/settings" className="inline-flex text-[11px] font-bold rounded-full bg-base-800 px-2 py-0.5 text-base-300">
                Mode: {mode.label}
              </Link>
            </div>
          </div>
          {d.target.note && <p className="text-xs text-base-300 mt-3">{d.target.note}</p>}
          <Button size="lg" className="w-full mt-4 bg-violet hover:bg-violet/90 shadow-[0_0_24px_-6px_var(--color-violet)]" onClick={() => navigate(s.timer ? '/academy/session' : '/academy/start')} disabled={!subjects.length}>
            {s.timer ? <><Timer size={18} /> Resume session</> : <><Play size={18} /> Start focus session</>}
          </Button>
        </section>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <StatTile label="XP" value={d.academicXp.toLocaleString()} color="#a47bff" />
          <StatTile label="Focus" value={fmtDuration(d.totalMinutes)} sub="all time" />
          <StatTile label="Topics" value={`${d.covered}/${d.topics.length}`} sub="covered" />
        </div>

        {d.homework && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-base-900 border border-base-800 p-3">
            <NotebookPen size={20} className="text-violet" />
            <p className="flex-1 text-sm font-semibold text-base-100">Homework today</p>
            <span className={`text-xs font-bold ${habitProgress(s, d.homework, s.today).done ? 'text-mint' : 'text-base-400'}`}>{habitProgress(s, d.homework, s.today).done ? 'Done ✓' : 'Tick it in Habits'}</span>
          </div>
        )}

        <SectionTitle right={d.due.length > 0 ? <Link to="/academy/reviews" className="text-xs font-semibold text-accent">Start reviews</Link> : undefined}>Spaced repetition</SectionTitle>
        {d.due.length > 0 ? (
          <Link to="/academy/reviews" className="flex items-center gap-3 rounded-2xl border border-violet/40 bg-violet/10 p-3">
            <Brain size={24} className="text-violet" />
            <div className="flex-1">
              <p className="font-bold text-base-50">{d.due.length} review{d.due.length === 1 ? '' : 's'} due now</p>
              <p className="text-xs text-base-300 truncate">{d.due.slice(0, 3).map((t) => t.name).join(' · ')}</p>
            </div>
            <ChevronRight size={18} className="text-base-400" />
          </Link>
        ) : (
          <p className="text-sm text-base-400 rounded-2xl bg-base-900 border border-base-800 p-3">No reviews due. Topics come back 1, 3, 7, 14 and 30 days after you study them.</p>
        )}
        {d.upcoming.length > 0 && (
          <div className="mt-2 rounded-2xl bg-base-900 border border-base-800 divide-y divide-base-800">
            {d.upcoming.slice(0, 4).map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="h-2 w-2 rounded-full" style={{ background: subjectById.get(t.subjectId)?.color }} />
                <span className="flex-1 truncate text-base-200">{t.name}</span>
                <span className="text-xs text-base-400">{relDay(t.nextReview!, s.today)}</span>
              </div>
            ))}
          </div>
        )}

        <SectionTitle right={plannerUnlocked ? <Link to="/academy/planner" className="text-xs font-semibold text-accent">Planner</Link> : undefined}>Upcoming revision</SectionTitle>
        {!plannerUnlocked ? (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-base-700 p-3 text-sm text-base-400">
            <Lock size={16} /> The weekly planner unlocks at level 3.
          </div>
        ) : d.upcomingPlan.length ? (
          <div className="rounded-2xl bg-base-900 border border-base-800 divide-y divide-base-800">
            {d.upcomingPlan.map((i) => (
              <button key={i.id} onClick={() => navigate(`/academy/start?subject=${i.subjectId}${i.topicId ? `&topic=${i.topicId}` : ''}&method=${i.method}&minutes=${i.minutes}&plan=${i.id}`)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                <CalendarDays size={16} className="text-base-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-base-100 truncate">
                    {subjectById.get(i.subjectId)?.name ?? 'Subject'}
                    {i.topicId && topicById.get(i.topicId) ? ` · ${topicById.get(i.topicId)!.name}` : ''}
                  </p>
                  <p className="text-xs text-base-400">
                    {relDay(i.date, s.today)} {i.time} · {i.minutes} min · {i.kind === 'review' ? 'review' : 'study'}
                  </p>
                </div>
                <Play size={15} className="text-violet" />
              </button>
            ))}
          </div>
        ) : (
          <Link to="/academy/planner" className="block rounded-2xl bg-base-900 border border-base-800 p-3 text-sm text-base-300">
            Nothing planned yet. <span className="text-accent font-semibold">Build this week's plan →</span>
          </Link>
        )}

        {d.attention.length > 0 && (
          <>
            <SectionTitle>Needs more revision</SectionTitle>
            <div className="rounded-2xl bg-base-900 border border-base-800 divide-y divide-base-800">
              {d.attention.slice(0, 5).map((t) => {
                const st = TOPIC_STATUSES[t.status];
                return (
                  <Link key={t.id} to={`/academy/topic/${t.id}`} className="flex items-center gap-2 px-3 py-2.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: subjectById.get(t.subjectId)?.color }} />
                    <span className="flex-1 text-sm text-base-100 truncate">{t.name}</span>
                    <span className="text-[11px] font-bold" style={{ color: st.color }}>{st.label}</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        <SectionTitle right={<Link to="/academy/subjects" className="text-xs font-semibold text-accent">Manage</Link>}>Subjects</SectionTitle>
        {subjects.length === 0 ? (
          <Link to="/academy/subjects">
            <Button variant="secondary" className="w-full">
              <Plus size={16} /> Add your subjects
            </Button>
          </Link>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {subjects.map((sub) => {
              const ts = d.topics.filter((t) => t.subjectId === sub.id);
              const good = ts.filter((t) => t.status >= 3).length;
              const sessions = s.revisionSessions.filter((r) => r.subjectId === sub.id).length;
              return (
                <Link key={sub.id} to={`/academy/subject/${sub.id}`} className="rounded-2xl bg-base-900 border border-base-800 p-3 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${sub.color}22`, color: sub.color }}>
                      <Icon name={sub.icon} size={16} />
                    </span>
                    <p className="text-sm font-bold text-base-50 truncate">{sub.name}</p>
                  </div>
                  <p className="text-[11px] text-base-400 mt-2">
                    {ts.length} topics · {sessions} sessions{sub.examSoon ? ' · exam soon' : ''}
                  </p>
                  <Bar value={ts.length ? good / ts.length : 0} color={sub.color} className="mt-1.5" height={5} />
                </Link>
              );
            })}
          </div>
        )}
        <p className="text-xs text-base-500 mt-6 text-center">Short, focused sessions with active recall beat long hours of re-reading. Quality over quantity.</p>
      </Page>
    </>
  );
}
