import { useState } from 'react';
import { useSnapshot } from '@/lib/hooks';
import { Loading, Page, PageHeader } from '@/components/layout';
import { Bar, Medal, SectionTitle } from '@/components/game';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { ACHIEVEMENTS, achievementProgress, computeStats } from '@/lib/achievements';
import { fmtShort } from '@/lib/dates';

export default function Achievements() {
  const s = useSnapshot();
  const [tab, setTab] = useState<'all' | 'life' | 'academy'>('all');
  if (!s) return <Loading />;
  const stats = computeStats(s);
  const list = ACHIEVEMENTS.filter((a) => tab === 'all' || a.group === tab);
  const done = list.filter((a) => s.achievements.has(a.id)).sort((a, b) => s.achievements.get(b.id)!.unlockedAt - s.achievements.get(a.id)!.unlockedAt);
  const todo = list.filter((a) => !s.achievements.has(a.id)).map((a) => ({ a, p: achievementProgress(a, stats) })).sort((x, y) => y.p.pct - x.p.pct);
  return (
    <>
      <PageHeader title="Achievements" subtitle={`${s.achievements.size} of ${ACHIEVEMENTS.length} unlocked`} back />
      <Page className="pb-8">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="life">Life</TabsTrigger>
            <TabsTrigger value="academy">Academy</TabsTrigger>
          </TabsList>
        </Tabs>
        {done.length > 0 && (
          <>
            <SectionTitle>Unlocked · history</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              {done.map((a) => (
                <div key={a.id} className="rounded-2xl bg-base-900 border border-base-800 p-3 flex flex-col items-center text-center">
                  <Medal def={a} unlocked size={60} />
                  <p className="text-xs font-bold text-base-50 mt-1.5 leading-tight">{a.name}</p>
                  <p className="text-[10px] text-base-400 mt-0.5">{fmtShort(s.achievements.get(a.id)!.date)}</p>
                  {a.title && <p className="text-[10px] font-bold text-violet mt-0.5">Title: {a.title}</p>}
                </div>
              ))}
            </div>
          </>
        )}
        <SectionTitle>In progress</SectionTitle>
        <div className="space-y-2">
          {todo.map(({ a, p }) => (
            <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-base-900 border border-base-800 p-3">
              <Medal def={a} unlocked={false} size={50} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-bold text-base-50">{a.name}</p>
                  <span className="text-[11px] font-bold text-base-300 tabular-nums shrink-0">{p.label}</span>
                </div>
                <p className="text-xs text-base-400">{a.description}</p>
                <Bar value={p.pct} color="#ffc845" className="mt-1.5" height={5} />
                <p className="text-[10px] text-base-500 mt-1">
                  {a.xp > 0 && <span className="text-xp font-bold">+{a.xp} XP</span>}
                  {a.title && <span className="text-violet font-bold"> · Title: {a.title}</span>}
                </p>
              </div>
            </div>
          ))}
          {todo.length === 0 && <p className="text-sm text-center text-base-300">Every badge in this group unlocked. Legendary.</p>}
        </div>
      </Page>
    </>
  );
}
