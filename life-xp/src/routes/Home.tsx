import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, BedDouble, Brain, ChevronRight, Flame, GlassWater, ListChecks, Settings as Cog, Shield, Sparkles, Swords, Trophy, Zap } from 'lucide-react';
import { useSnapshot } from '@/lib/hooks';
import { Loading, Page } from '@/components/layout';
import { Avatar, Bar, Medal, Ring, SectionTitle, XpBar } from '@/components/game';
import { HabitCard } from '@/components/HabitCard';
import { QuestCard } from '@/components/QuestCard';
import { ExerciseDialog, SleepDialog } from '@/components/LogDialogs';
import { CoachCard } from '@/components/CoachCard';
import { useToast } from '@/components/ui/Toaster';
import { addWater } from '@/lib/actions';
import { dayStatus, habitProgress, streakInfo, weeklyConsistency, xpOn, currentLevel } from '@/lib/performance';
import { questsFor, DAILY_COMBO_XP } from '@/lib/quests';
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, achievementProgress, computeStats } from '@/lib/achievements';
import { LEVEL_UNLOCKS, hasFeature } from '@/lib/levels';
import { coachAdvice } from '@/lib/coach';
import { dueTopics } from '@/lib/academy/srs';
import { addDays, weekStart } from '@/lib/dates';
import { CATEGORIES } from '@/lib/habits';
import { cn } from '@/lib/cn';

export default function Home() {
  const s = useSnapshot();
  const navigate = useNavigate();
  const toast = useToast();
  const [sleepOpen, setSleepOpen] = useState(false);
  const [exOpen, setExOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const derived = useMemo(() => {
    if (!s) return null;
    const level = currentLevel(s);
    const today = dayStatus(s, s.today);
    const yesterday = dayStatus(s, addDays(s.today, -1));
    const streak = streakInfo(s);
    const weekly = weeklyConsistency(s);
    const dq = questsFor(s, 'day', s.today);
    const wq = questsFor(s, 'week', weekStart(s.today));
    const stats = computeStats(s);
    const nextBadges = ACHIEVEMENTS.filter((a) => !s.achievements.has(a.id))
      .map((a) => ({ a, p: achievementProgress(a, stats) }))
      .filter((x) => x.p.pct > 0)
      .sort((x, y) => y.p.pct - x.p.pct)
      .slice(0, 2);
    const recent = [...s.achievements.values()].sort((a, b) => b.unlockedAt - a.unlockedAt).slice(0, 4);
    const nextUnlock = LEVEL_UNLOCKS.find((u) => u.level > level.level);
    return { level, today, yesterday, streak, weekly, dq, wq, nextBadges, recent, nextUnlock, advice: coachAdvice(s)[0], due: dueTopics(s).length };
  }, [s]);

  if (!s || !derived) return <Loading />;
  const { level, today, yesterday, streak, weekly, dq, wq, nextBadges, recent, nextUnlock, advice, due } = derived;
  const xpToday = xpOn(s, s.today);
  const dqDone = dq.filter((q) => q.completedAt !== null).length;
  const water = s.habits.find((h) => h.active && h.link === 'water');
  const pending = today.scheduled.filter((h) => !habitProgress(s, h, s.today).done);
  const doneList = today.scheduled.filter((h) => habitProgress(s, h, s.today).done);
  const catOrder = (c: string) => CATEGORIES.findIndex((x) => x.id === c);
  const sortedPending = [...pending].sort((a, b) => catOrder(a.category) - catOrder(b.category) || a.order - b.order);
  const yesterdayMissing = yesterday.scheduled.length > 0 && yesterday.done.length < yesterday.scheduled.length && addDays(s.today, -1) >= s.profile.startDate;
  const name = s.profile.nickname || 'Player';
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="safe-top">
      <Page className="pt-4">
        {/* CHARACTER PROFILE */}
        <section className="relative overflow-hidden rounded-3xl border border-base-700 bg-gradient-to-br from-base-850 via-base-900 to-base-950 p-4">
          <div className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-violet/20 blur-3xl" />
          <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative flex items-center gap-3.5">
            <button onClick={() => navigate('/profile')} aria-label="Open profile">
              <Avatar config={s.profile.avatar} size={76} level={level.level} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-base-400">{greet}</p>
              <p className="text-xl font-black tracking-tight text-base-50 truncate">{name}</p>
              <p className="text-xs font-bold text-accent truncate">{s.profile.title}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Link to="/settings" className="h-9 w-9 rounded-xl bg-base-800/80 flex items-center justify-center text-base-300" aria-label="Settings">
                <Cog size={18} />
              </Link>
            </div>
          </div>
          <div className="relative mt-4">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm font-extrabold text-base-50">
                Level {level.level}
              </span>
              <span className="text-xs font-semibold tabular-nums text-base-300">
                {level.into.toLocaleString()} / {level.needed.toLocaleString()} XP
              </span>
            </div>
            <XpBar value={level.progress} height={12} />
            <div className="mt-1.5 flex justify-between text-[11px] text-base-400">
              <span className="tabular-nums">{level.total.toLocaleString()} total XP</span>
              <span className="tabular-nums font-semibold text-base-200">{level.remaining.toLocaleString()} XP to level {level.level + 1}</span>
            </div>
          </div>
          <div className="relative mt-3 grid grid-cols-3 gap-2">
            <Pill icon={<Flame size={16} className={cn(streak.current > 0 ? 'text-flame' : 'text-base-500')} />} value={`${streak.current}`} label="streak" />
            <Pill icon={<Shield size={16} className={streak.shields ? 'text-accent' : 'text-base-500'} />} value={`${streak.shields}`} label="shields" />
            <Pill icon={<Zap size={16} className="text-xp" />} value={`+${xpToday}`} label="today" />
          </div>
        </section>

        {/* DAILY PERFORMANCE */}
        <section className="mt-3 grid grid-cols-[auto_1fr] gap-3.5 items-center rounded-3xl border border-base-800 bg-base-900 p-3.5">
          <Ring value={today.pct ?? 0} size={96} stroke={10} gradient={['#a47bff', '#3fe3ff']}>
            <div className="text-center">
              <div className="text-[28px] font-black tabular-nums text-base-50 leading-none">{today.pct === null ? '–' : Math.round(today.pct * 100)}<span className="text-base">%</span></div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-base-400 mt-1">Today</div>
            </div>
          </Ring>
          <div className="space-y-2.5 min-w-0">
            <Metric label="Habits" value={today.pct === null ? 'Rest day' : `${today.done.length}/${today.scheduled.length} done`} />
            <Metric label="Daily quests" value={`${dqDone}/${dq.length} complete`} bar={dq.length ? dqDone / dq.length : 0} color="#ffc845" />
            <Metric label="7-day consistency" value={weekly.pct === null ? 'Starts tomorrow' : `${Math.round(weekly.pct * 100)}%`} bar={weekly.pct} color="#3ee8a4" />
          </div>
        </section>

        {/* QUICK ACTIONS */}
        <section className="mt-3 grid grid-cols-5 gap-1.5">
          <Quick icon={<ListChecks size={20} />} label="Habits" color="#3fe3ff" onClick={() => document.getElementById('today-habits')?.scrollIntoView({ behavior: 'smooth' })} />
          <Quick icon={<Activity size={20} />} label="Move" color="#ff8a3d" onClick={() => setExOpen(true)} />
          <Quick icon={<BedDouble size={20} />} label="Sleep" color="#7b8cff" onClick={() => setSleepOpen(true)} />
          <Quick
            icon={<GlassWater size={20} />}
            label={water ? `${habitProgress(s, water, s.today).count}/${water.target}` : 'Water'}
            color="#3ee8a4"
            onClick={async () => {
              await addWater(1);
              toast('+1 glass of water');
            }}
          />
          <Quick icon={<Swords size={20} />} label="Quests" color="#ffc845" onClick={() => navigate('/quests')} />
        </section>

        {advice && <CoachCard advice={advice} className="mt-3" />}

        {due > 0 && (
          <Link to="/academy/reviews" className="mt-3 flex items-center gap-3 rounded-2xl border border-violet/40 bg-violet/10 p-3">
            <Brain size={22} className="text-violet shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-base-50 text-sm">{due} topic review{due === 1 ? '' : 's'} due</p>
              <p className="text-xs text-base-300">Quick memory checks: 15 XP each</p>
            </div>
            <ChevronRight size={18} className="text-base-400" />
          </Link>
        )}

        {/* DAILY QUESTS */}
        <SectionTitle right={<Link to="/quests" className="text-xs font-semibold text-accent">All quests</Link>}>Daily quests</SectionTitle>
        <div className="space-y-2">
          {dq.map((q) => (
            <QuestCard key={q.id} q={q} compact />
          ))}
          {dq.length > 0 && (
            <p className={cn('text-xs text-center', dqDone === dq.length ? 'text-xp font-bold' : 'text-base-400')}>
              {dqDone === dq.length ? `All quests complete · +${DAILY_COMBO_XP} bonus XP earned` : `Complete all ${dq.length} for +${DAILY_COMBO_XP} bonus XP`}
            </p>
          )}
          {hasFeature(level.level, 'weekly-quests') && wq.length > 0 && (
            <Link to="/quests" className="flex items-center justify-between rounded-xl bg-base-900 border border-base-800 px-3 py-2.5 text-sm">
              <span className="font-semibold text-base-200">Weekly quests</span>
              <span className="text-base-300 tabular-nums">
                {wq.filter((q) => q.completedAt).length}/{wq.length} <ChevronRight size={14} className="inline" />
              </span>
            </Link>
          )}
        </div>

        {/* TODAY'S HABITS */}
        <SectionTitle right={<Link to="/habits" className="text-xs font-semibold text-accent">Manage</Link>}>
          <span id="today-habits">{today.pct === null ? 'Rest day' : pending.length ? `Up next · ${pending.length} left` : 'All done today'}</span>
        </SectionTitle>
        {today.scheduled.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-base-700 p-5 text-center text-sm text-base-300">
            Nothing scheduled today. Enjoy the rest. Streaks don't break on rest days.
          </div>
        ) : (
          <div className="space-y-2">
            {pending.length === 0 && (
              <div className="rounded-2xl border border-xp/40 bg-xp/10 p-4 text-center">
                <Trophy className="mx-auto text-xp" />
                <p className="font-black text-base-50 mt-1">Perfect day!</p>
                <p className="text-xs text-base-300">Full routine bonus earned. See you tomorrow.</p>
              </div>
            )}
            {sortedPending.map((h) => (
              <HabitCard key={h.id} habit={h} snap={s} date={s.today} />
            ))}
            {doneList.length > 0 && (
              <button onClick={() => setShowDone(!showDone)} className="w-full text-xs font-semibold text-base-400 py-2">
                {showDone ? 'Hide' : 'Show'} completed ({doneList.length})
              </button>
            )}
            {showDone && doneList.map((h) => <HabitCard key={h.id} habit={h} snap={s} date={s.today} />)}
          </div>
        )}
        {yesterdayMissing && (
          <Link to="/habits?day=yesterday" className="mt-2 block text-center text-xs font-semibold text-base-400 underline underline-offset-4">
            Forgot to log something yesterday?
          </Link>
        )}

        {/* REWARDS */}
        <SectionTitle right={<Link to="/achievements" className="text-xs font-semibold text-accent">Badges</Link>}>Rewards in reach</SectionTitle>
        <div className="space-y-2">
          {nextUnlock && (
            <div className="flex items-center gap-3 rounded-2xl bg-base-900 border border-base-800 p-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet to-accent flex items-center justify-center text-base-950 font-black text-lg shrink-0">{nextUnlock.level}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-base-50">Level {nextUnlock.level} unlocks</p>
                <p className="text-xs text-base-300 truncate">{nextUnlock.lines.join(' · ')}</p>
              </div>
            </div>
          )}
          {nextBadges.map(({ a, p }) => (
            <Link to="/achievements" key={a.id} className="flex items-center gap-3 rounded-2xl bg-base-900 border border-base-800 p-3">
              <Medal def={a} unlocked={false} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-bold text-base-50 truncate">{a.name}</p>
                  <span className="text-[11px] font-bold text-base-300 tabular-nums">{p.label}</span>
                </div>
                <p className="text-xs text-base-400 truncate">{a.description}</p>
                <Bar value={p.pct} color="#ffc845" className="mt-1.5" />
              </div>
            </Link>
          ))}
        </div>
        {recent.length > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-base-900 border border-base-800 p-3">
            <Sparkles size={16} className="text-xp" />
            <span className="text-xs font-semibold text-base-300 mr-auto">Recently unlocked</span>
            {recent.map((r) => ACHIEVEMENT_BY_ID[r.id] && <Medal key={r.id} def={ACHIEVEMENT_BY_ID[r.id]} unlocked size={34} />)}
          </div>
        )}
      </Page>
      <SleepDialog open={sleepOpen} onOpenChange={setSleepOpen} />
      <ExerciseDialog open={exOpen} onOpenChange={setExOpen} />
    </div>
  );
}

function Pill({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-base-950/50 border border-base-800 px-2.5 py-2 min-w-0">
      {icon}
      <div className="min-w-0">
        <div className="text-sm font-black tabular-nums text-base-50 leading-none">{value}</div>
        <div className="text-[10px] text-base-400 truncate">{label}</div>
      </div>
    </div>
  );
}

function Metric({ label, value, bar, color }: { label: string; value: string; bar?: number | null; color?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-base-400 truncate">{label}</div>
      <div className="text-[13px] text-base-50 font-bold tabular-nums truncate">{value}</div>
      {bar !== undefined && color && <Bar value={bar} color={color} className="mt-1" height={5} />}
    </div>
  );
}

function Quick({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-base-900 border border-base-800 py-2.5 active:scale-95 transition-transform min-w-0">
      <span className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${color}22`, color }}>
        {icon}
      </span>
      <span className="text-[10.5px] font-semibold text-base-200 truncate max-w-full px-0.5">{label}</span>
    </button>
  );
}
