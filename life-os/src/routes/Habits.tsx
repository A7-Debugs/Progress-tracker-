import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, Flame, Plus, Repeat } from 'lucide-react';
import { useStore } from '@/lib/store';
import { addDays, DAY_SHORT, dayOfWeek, relDay } from '@/lib/dates';
import { canLogHabit, frequencyLabel, habitsForDay, habitStats, isWeeklyHabit } from '@/lib/habits';
import { cn } from '@/lib/cn';
import { Page, PageHeader } from '@/components/layout';
import { Card, Panel } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CategoryDot, EmptyState, pct, Progress } from '@/components/Visuals';
import { HabitRow } from '@/components/rows';
import { HabitEditor } from '@/components/editors/HabitEditor';

export default function Habits() {
  const { s } = useStore();
  const [params, setParams] = useSearchParams();
  const [date, setDate] = useState(s.today);
  const [adding, setAdding] = useState(params.get('new') === '1');
  useEffect(() => {
    if (!adding && params.get('new')) setParams({}, { replace: true });
  }, [adding, params, setParams]);
  const plans = habitsForDay(s, date);
  const active = s.habits.filter((h) => h.active);
  const archived = s.habits.filter((h) => !h.active);
  const days = Array.from({ length: 7 }, (_, i) => addDays(s.today, i - 6)).filter((d) => canLogHabit(s.today, d));

  return (
    <>
      <PageHeader
        title="Habits"
        subtitle="Sustainable consistency, not perfection"
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={15} /> New habit
          </Button>
        }
      />
      <Page>
        {active.length === 0 ? (
          <Card>
            <EmptyState icon={<Repeat size={18} />} title="No habits yet" body="Habits are the systems that move your goals. Start with one or two you can keep on a bad day." action={<Button size="sm" onClick={() => setAdding(true)}>Create a habit</Button>} />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
            <Panel title={date === s.today ? 'Today' : relDay(date, s.today)} subtitle="Tick for done, “Min” for the minimum version (half credit, keeps the streak), ✕ for missed">
              <div className="flex gap-1 mb-2 overflow-x-auto no-scrollbar" role="tablist" aria-label="Day to log">
                {days.map((d) => (
                  <button key={d} role="tab" aria-selected={d === date} onClick={() => setDate(d)} className={cn('shrink-0 w-11 h-12 rounded-lg flex flex-col items-center justify-center text-[11px] border transition-colors', d === date ? 'bg-fg text-bg border-fg' : 'border-line text-fg-2 hover:bg-surface-2')}>
                    <span className="opacity-70">{DAY_SHORT[dayOfWeek(d)]}</span>
                    <span className="text-[13px] font-semibold tnum">{Number(d.slice(8))}</span>
                  </button>
                ))}
              </div>
              {plans.length === 0 ? <p className="text-[13px] text-fg-3 py-4">Nothing scheduled on this day.</p> : plans.map((p) => <HabitRow key={p.habit.id} plan={p} date={date} />)}
            </Panel>
            <Panel title="All habits" subtitle="Last 30 days">
              <ul className="-mx-2">
                {active.map((h) => {
                  const st = habitStats(s, h, isWeeklyHabit(h) ? undefined : addDays(s.today, -30), addDays(s.today, -1));
                  return (
                    <li key={h.id}>
                      <Link to={`/habits/${h.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-2">
                        <CategoryDot cat={s.categoryById.get(h.categoryId)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-medium text-fg truncate">{h.name}</span>
                            <span className="text-xs tnum text-fg-2">{pct(st.rate)}</span>
                          </div>
                          <Progress className="mt-1.5" height={4} value={st.rate} color="var(--success)" />
                          <div className="mt-1 flex gap-2 text-[11px] text-fg-3">
                            <span>{frequencyLabel(h.frequency)}</span>
                            <span className="inline-flex items-center gap-0.5">
                              <Flame size={10} /> {st.current} {st.unit} · best {st.longest}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={15} className="text-fg-3 shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {archived.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-fg-3 mb-1">Paused</p>
                  {archived.map((h) => (
                    <Link key={h.id} to={`/habits/${h.id}`} className="block text-[13px] text-fg-3 py-1 hover:text-fg">
                      {h.name}
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        )}
      </Page>
      <HabitEditor open={adding} onOpenChange={setAdding} />
    </>
  );
}
