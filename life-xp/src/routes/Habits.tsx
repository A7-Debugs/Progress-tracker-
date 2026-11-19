import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, Library, Pause, Plus } from 'lucide-react';
import { useSnapshot } from '@/lib/hooks';
import { Loading, Page, PageHeader } from '@/components/layout';
import { HabitCard } from '@/components/HabitCard';
import { SectionTitle, XpChip } from '@/components/game';
import { Icon } from '@/components/Icon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { CATEGORIES, daysLabel, recommendedMax } from '@/lib/habits';
import { dayStatus, habitCompletionRate, currentLevel } from '@/lib/performance';
import { restoreHabit } from '@/lib/actions';
import { addDays, fmtDay } from '@/lib/dates';

export default function Habits() {
  const s = useSnapshot();
  const [params, setParams] = useSearchParams();
  if (!s) return <Loading />;
  const yesterday = params.get('day') === 'yesterday' && addDays(s.today, -1) >= s.profile.startDate;
  const date = yesterday ? addDays(s.today, -1) : s.today;
  const st = dayStatus(s, date);
  const active = s.habits.filter((h) => h.active);
  const paused = s.habits.filter((h) => !h.active);
  const level = currentLevel(s).level;
  const max = recommendedMax(level);

  return (
    <>
      <PageHeader
        title="Habits"
        subtitle={`${active.length} active · recommended up to ${max} at level ${level}`}
        right={
          <Link to="/habits/new" className="h-10 w-10 rounded-xl bg-accent text-base-950 flex items-center justify-center" aria-label="Add habit">
            <Plus size={20} strokeWidth={2.6} />
          </Link>
        }
      />
      <Page>
        <Tabs value={yesterday ? 'yesterday' : 'today'} onValueChange={(v) => setParams(v === 'yesterday' ? { day: 'yesterday' } : {})}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="yesterday" disabled={addDays(s.today, -1) < s.profile.startDate}>
              Yesterday
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-xs text-base-400 mt-2 text-center">
          {fmtDay(date)} · {st.done.length}/{st.scheduled.length} done{yesterday ? ' · you can still log yesterday' : ''}
        </p>

        {st.scheduled.length === 0 && <div className="mt-4 rounded-2xl border border-dashed border-base-700 p-5 text-center text-sm text-base-300">Nothing scheduled for this day.</div>}
        {CATEGORIES.map((c) => {
          const list = st.scheduled.filter((h) => h.category === c.id);
          if (!list.length) return null;
          const done = list.filter((h) => st.done.includes(h)).length;
          return (
            <div key={c.id}>
              <SectionTitle right={<span className="text-xs font-bold tabular-nums" style={{ color: c.color }}>{done}/{list.length}</span>}>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name={c.icon} size={14} className="opacity-80" />
                  {c.label}
                </span>
              </SectionTitle>
              <div className="space-y-2">
                {list.map((h) => (
                  <HabitCard key={h.id} habit={h} snap={s} date={date} />
                ))}
              </div>
            </div>
          );
        })}

        <SectionTitle>Your habits</SectionTitle>
        <div className="rounded-2xl bg-base-900 border border-base-800 divide-y divide-base-800 overflow-hidden">
          {active.map((h) => {
            const r = habitCompletionRate(s, h, addDays(s.today, -27), s.today);
            return (
              <Link key={h.id} to={`/habits/${h.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-base-850">
                <Icon name={h.icon} size={18} className="text-base-300" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-base-100 truncate">{h.name}</p>
                  <p className="text-xs text-base-400">
                    {daysLabel(h.days)}
                    {r.pct !== null && ` · ${Math.round(r.pct * 100)}% last 4 weeks`}
                  </p>
                </div>
                <XpChip xp={h.xp} />
                <ChevronRight size={16} className="text-base-500" />
              </Link>
            );
          })}
        </div>
        {active.length > max && <p className="text-xs text-warn mt-2">That's more than the {max} recommended for your level. Fewer habits done consistently beats lots done sometimes.</p>}

        <div className="grid grid-cols-2 gap-2 mt-3">
          <Link to="/habits/library">
            <Button variant="secondary" className="w-full">
              <Library size={16} /> Habit library
            </Button>
          </Link>
          <Link to="/habits/new">
            <Button variant="secondary" className="w-full">
              <Plus size={16} /> Custom habit
            </Button>
          </Link>
        </div>

        {paused.length > 0 && (
          <>
            <SectionTitle>Paused</SectionTitle>
            <div className="rounded-2xl bg-base-900 border border-base-800 divide-y divide-base-800">
              {paused.map((h) => (
                <div key={h.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Pause size={16} className="text-base-500" />
                  <Link to={`/habits/${h.id}`} className="flex-1 text-sm text-base-300 truncate">
                    {h.name}
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => restoreHabit(h.id)}>
                    Resume
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </Page>
    </>
  );
}
