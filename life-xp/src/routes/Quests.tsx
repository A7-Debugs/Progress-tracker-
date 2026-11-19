import { Lock } from 'lucide-react';
import { useSnapshot } from '@/lib/hooks';
import { Loading, Page, PageHeader } from '@/components/layout';
import { QuestCard } from '@/components/QuestCard';
import { SectionTitle, StatTile } from '@/components/game';
import { DAILY_COMBO_XP, WEEKLY_COMBO_XP, questsFor } from '@/lib/quests';
import { addDays, fmtShort, weekStart } from '@/lib/dates';
import { hasFeature } from '@/lib/levels';
import { currentLevel } from '@/lib/performance';

export default function Quests() {
  const s = useSnapshot();
  if (!s) return <Loading />;
  const level = currentLevel(s).level;
  const ws = weekStart(s.today);
  const dq = questsFor(s, 'day', s.today);
  const wq = questsFor(s, 'week', ws);
  const weeklyUnlocked = hasFeature(level, 'weekly-quests');
  const past = s.quests.filter((q) => q.period === 'day' && q.periodKey < s.today && q.periodKey >= addDays(s.today, -30));
  const rate = past.length ? past.filter((q) => q.completedAt).length / past.length : null;
  const total = s.quests.filter((q) => q.completedAt).length;
  const dDone = dq.filter((q) => q.completedAt).length;
  const wDone = wq.filter((q) => q.completedAt).length;
  return (
    <>
      <PageHeader title="Quests" subtitle="New daily quests every morning · weekly quests every Monday" back />
      <Page className="pb-8">
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Today" value={`${dDone}/${dq.length}`} color="#ffc845" />
          <StatTile label="30-day rate" value={rate === null ? '–' : `${Math.round(rate * 100)}%`} />
          <StatTile label="All time" value={total} sub="completed" />
        </div>
        <SectionTitle right={<span className="text-xs font-bold text-xp">All {dq.length} = +{DAILY_COMBO_XP} XP</span>}>Daily quests</SectionTitle>
        <div className="space-y-2">
          {dq.map((q) => (
            <QuestCard key={q.id} q={q} />
          ))}
        </div>
        <SectionTitle right={weeklyUnlocked ? <span className="text-xs font-bold text-xp">All {wq.length} = +{WEEKLY_COMBO_XP} XP</span> : undefined}>
          Weekly quests {weeklyUnlocked && `· ${fmtShort(ws)} – ${fmtShort(addDays(ws, 6))}`}
        </SectionTitle>
        {weeklyUnlocked ? (
          <div className="space-y-2">
            {wq.map((q) => (
              <QuestCard key={q.id} q={q} />
            ))}
            {wq.length > 0 && <p className="text-xs text-center text-base-400">{wDone}/{wq.length} complete this week</p>}
            {wq.length === 0 && <p className="text-sm text-base-400">Weekly quests arrive on Monday.</p>}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-base-700 p-5 text-center">
            <Lock className="mx-auto text-base-500" />
            <p className="font-bold text-base-100 mt-2">Weekly quests unlock at level 4</p>
            <p className="text-xs text-base-400 mt-1">Bigger challenges with bigger XP rewards.</p>
          </div>
        )}
        <p className="text-xs text-base-500 mt-6 text-center">Quests adapt to school days, weekends and your workload mode. Missing one never costs XP.</p>
      </Page>
    </>
  );
}
