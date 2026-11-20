import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import * as A from '@/lib/actions';
import { addDays, DAY_SHORT, dayOfWeek, fmtDuration, fromMinutes, monthStart, weekDates, weekStart } from '@/lib/dates';
import { agendaFor, buildIcs, conflictsFor, scheduledMinutes, type AgendaItem } from '@/lib/schedule';
import { habitsForDay } from '@/lib/habits';
import { taskDay } from '@/lib/tasks';
import type { CalEvent, DateStr } from '@/lib/types';
import { cn } from '@/lib/cn';
import { saveFile } from '@/lib/backup';
import { Page, PageHeader } from '@/components/layout';
import { Card, Panel } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EventEditor } from '@/components/editors/EventEditor';
import { TaskEditor } from '@/components/editors/TaskEditor';
import { hours } from '@/components/Visuals';
import { useToast } from '@/components/ui/Toaster';

type View = 'day' | 'week' | 'month';
const START_H = 6;
const END_H = 23;
const PX_PER_MIN = 0.9;

export default function Schedule() {
  const { s } = useStore();
  const toast = useToast();
  const [view, setView] = useState<View>('day');
  const [date, setDate] = useState<DateStr>(s.today);
  const [editing, setEditing] = useState<{ event?: CalEvent; date: DateStr; occurrence?: DateStr; start?: string } | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const task = taskId ? s.tasks.find((t) => t.id === taskId) : undefined;

  const shift = (n: number) => setDate((d) => (view === 'day' ? addDays(d, n) : view === 'week' ? addDays(d, 7 * n) : shiftMonth(d, n)));
  const title = view === 'month' ? new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : view === 'week' ? `Week of ${new Date(`${weekStart(date)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const open = (i: AgendaItem, d: DateStr) => {
    if (i.eventId) setEditing({ event: s.events.find((e) => e.id === i.eventId), date: d, occurrence: d });
    else if (i.taskId) setTaskId(i.taskId);
  };

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle="Time blocks, events, timed tasks and deadlines"
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => saveFile('life-os-schedule.ics', buildIcs(s), 'text/calendar').then(() => toast('Calendar exported'))} title="Export .ics for Google / Apple Calendar">
              <Download size={15} /> <span className="hidden sm:inline">Export .ics</span>
            </Button>
            <Button size="sm" onClick={() => setEditing({ date })}>
              <Plus size={15} /> Block time
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-line p-0.5 bg-surface-2 text-[12px] font-medium">
            {(['day', 'week', 'month'] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn('h-7 px-2.5 rounded-md capitalize', view === v ? 'bg-surface text-fg shadow-[var(--shadow)]' : 'text-fg-3')}>
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 ml-auto">
            <Button size="icon-sm" variant="ghost" onClick={() => shift(-1)} aria-label="Previous">
              <ChevronLeft size={16} />
            </Button>
            <button onClick={() => setDate(s.today)} className="h-8 px-2.5 rounded-lg text-[13px] font-medium text-fg-2 hover:bg-surface-2">
              Today
            </button>
            <Button size="icon-sm" variant="ghost" onClick={() => shift(1)} aria-label="Next">
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
        <p className="text-[13px] font-medium text-fg mt-2">{title}</p>
      </PageHeader>
      <Page>
        {view === 'day' && <DayView date={date} onOpen={(i) => open(i, date)} onNew={(start) => setEditing({ date, start })} onTask={setTaskId} />}
        {view === 'week' && <WeekView date={date} onOpen={open} onPick={(d) => (setDate(d), setView('day'))} />}
        {view === 'month' && <MonthView date={date} onPick={(d) => (setDate(d), setView('day'))} />}
        <p className="text-xs text-fg-3 mt-4">Use “Export .ics” to add these blocks to Google Calendar or Apple Calendar. Direct two-way sync is designed for (see docs) but not connected in this version.</p>
      </Page>
      {editing && <EventEditor open onOpenChange={(o) => !o && setEditing(null)} event={editing.event} date={editing.date} occurrence={editing.occurrence} defaults={editing.start ? { start: editing.start, end: fromMinutes(Math.min(23 * 60 + 59, toMin(editing.start) + 60)) } : undefined} />}
      {task && <TaskEditor open onOpenChange={(o) => !o && setTaskId(null)} task={task} />}
    </>
  );
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function shiftMonth(d: DateStr, n: number): DateStr {
  const [y, m] = d.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;
}

function DayView({ date, onOpen, onNew, onTask }: { date: DateStr; onOpen: (i: AgendaItem) => void; onNew: (start: string) => void; onTask: (id: string) => void }) {
  const { s } = useStore();
  const toast = useToast();
  const items = agendaFor(s, date);
  const conflicts = conflictsFor(items);
  const clashing = new Set(conflicts.flatMap((c) => [c.a.key, c.b.key]));
  const unscheduled = s.tasks.filter((t) => !t.done && !t.plannedTime && (taskDay(t) === date || (date === s.today && !!taskDay(t) && taskDay(t)! < s.today)));
  const deadlines = s.tasks.filter((t) => !t.done && t.dueDate === date);
  const habits = habitsForDay(s, date).filter((p) => p.habit.preferredTime);
  const planned = scheduledMinutes(items);
  const focus = s.focusByDate.get(date) ?? 0;
  const estimate = [...items.filter((i) => i.taskId).map((i) => s.tasks.find((t) => t.id === i.taskId)), ...unscheduled].reduce((a, t) => a + (t?.estimateMin ?? 0), 0);

  // Lay out overlapping blocks side by side.
  const lanes = useMemo(() => {
    const out = new Map<string, { lane: number; of: number }>();
    const groups: AgendaItem[][] = [];
    for (const i of items) {
      const g = groups.find((gr) => gr.some((x) => x.start < i.end && i.start < x.end));
      if (g) g.push(i);
      else groups.push([i]);
    }
    for (const g of groups) g.forEach((i, k) => out.set(i.key, { lane: k, of: g.length }));
    return out;
  }, [items]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
      <Card className="overflow-hidden">
        {conflicts.length > 0 && (
          <div className="px-4 py-2 border-b border-line bg-warning/8 text-xs text-warning flex items-start gap-1.5">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>{conflicts.map((c) => `“${c.a.title}” overlaps “${c.b.title}” by ${fmtDuration(c.overlapMin)}`).join(' · ')}</span>
          </div>
        )}
        <div className="relative" style={{ height: (END_H - START_H) * 60 * PX_PER_MIN }}>
          {Array.from({ length: END_H - START_H }, (_, k) => START_H + k).map((h) => (
            <button key={h} onClick={() => onNew(`${String(h).padStart(2, '0')}:00`)} className="absolute inset-x-0 border-t border-line text-left hover:bg-surface-2/60" style={{ top: (h - START_H) * 60 * PX_PER_MIN, height: 60 * PX_PER_MIN }} aria-label={`New block at ${h}:00`}>
              <span className="absolute left-2 -top-2 bg-surface px-1 text-[10px] text-fg-3 tnum">{String(h).padStart(2, '0')}:00</span>
            </button>
          ))}
          {date === s.today && <NowLine />}
          {items.map((i) => {
            const top = (Math.max(i.start, START_H * 60) - START_H * 60) * PX_PER_MIN;
            const h = Math.max(22, (Math.min(i.end, END_H * 60) - Math.max(i.start, START_H * 60)) * PX_PER_MIN);
            const l = lanes.get(i.key)!;
            return (
              <button key={i.key} onClick={() => onOpen(i)} className={cn('absolute rounded-md px-2 py-1 text-left overflow-hidden border text-[12px] leading-tight shadow-[var(--shadow)]', i.done && 'opacity-50', clashing.has(i.key) ? 'border-warning' : 'border-transparent')} style={{ top, height: h, left: `calc(56px + (100% - 64px) * ${l.lane / l.of})`, width: `calc((100% - 64px) / ${l.of} - 4px)`, background: `color-mix(in oklab, ${i.color ?? 'var(--accent)'} 16%, var(--surface))`, borderLeft: `3px solid ${i.color ?? 'var(--accent)'}` }}>
                <span className={cn('block font-medium text-fg truncate', i.done && 'line-through')}>{i.title}</span>
                <span className="block text-[10.5px] text-fg-3 tnum">
                  {fromMinutes(i.start)}–{fromMinutes(i.end)} · {i.kind === 'task' ? 'Task' : i.kind === 'focus' ? 'Focus' : i.kind === 'event' ? 'Event' : 'Block'}
                  {i.recurring ? ' · repeats' : ''}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
      <div className="space-y-4">
        <Panel title="Day plan">
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <dt className="text-fg-3 text-xs">Scheduled</dt>
              <dd className="font-semibold tnum">{hours(planned)}</dd>
            </div>
            <div>
              <dt className="text-fg-3 text-xs">Focus logged</dt>
              <dd className="font-semibold tnum">{hours(focus)}</dd>
            </div>
            <div>
              <dt className="text-fg-3 text-xs">Task estimates</dt>
              <dd className="font-semibold tnum">{estimate ? hours(estimate) : '—'}</dd>
            </div>
            <div>
              <dt className="text-fg-3 text-xs">Conflicts</dt>
              <dd className={cn('font-semibold tnum', conflicts.length && 'text-warning')}>{conflicts.length}</dd>
            </div>
          </dl>
        </Panel>
        {deadlines.length > 0 && (
          <Panel title="Deadlines">
            {deadlines.map((t) => (
              <button key={t.id} onClick={() => onTask(t.id)} className="block w-full text-left text-[13px] py-1 text-danger hover:underline truncate">
                {t.title}
              </button>
            ))}
          </Panel>
        )}
        <Panel title="Unscheduled tasks" subtitle="Give important work a time slot">
          {unscheduled.length === 0 ? (
            <p className="text-[13px] text-fg-3">Everything for this day has a time, or nothing is planned.</p>
          ) : (
            <ul className="space-y-1">
              {unscheduled.slice(0, 12).map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-[13px]">
                  <button onClick={() => onTask(t.id)} className="flex-1 text-left truncate hover:underline">
                    {t.title}
                  </button>
                  {t.estimateMin && <span className="text-[11px] text-fg-3">{hours(t.estimateMin)}</span>}
                  <input
                    type="time"
                    aria-label={`Schedule ${t.title}`}
                    className="h-7 w-[88px] rounded-md border border-line bg-surface px-1 text-xs"
                    onChange={(e) => e.target.value && A.planTaskFor(t.id, date, e.target.value).then(() => toast(`Scheduled at ${e.target.value}`))}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {habits.length > 0 && (
          <Panel title="Habit times">
            {habits.map((p) => (
              <div key={p.habit.id} className="flex justify-between text-[13px] py-0.5">
                <span className={cn(p.credit >= 1 && 'line-through text-fg-3')}>{p.habit.name}</span>
                <span className="tnum text-fg-3">{p.habit.preferredTime}</span>
              </div>
            ))}
          </Panel>
        )}
      </div>
    </div>
  );
}

function NowLine() {
  const n = new Date();
  const min = n.getHours() * 60 + n.getMinutes();
  if (min < START_H * 60 || min > END_H * 60) return null;
  return (
    <div className="absolute left-12 right-0 z-10 pointer-events-none" style={{ top: (min - START_H * 60) * PX_PER_MIN }}>
      <div className="h-px bg-danger" />
      <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-danger" />
    </div>
  );
}

function WeekView({ date, onOpen, onPick }: { date: DateStr; onOpen: (i: AgendaItem, d: DateStr) => void; onPick: (d: DateStr) => void }) {
  const { s } = useStore();
  const days = weekDates(weekStart(date));
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
      {days.map((d) => {
        const items = agendaFor(s, d);
        const conflicts = conflictsFor(items).length;
        const due = s.tasks.filter((t) => !t.done && t.dueDate === d).length;
        return (
          <Card key={d} className={cn('p-2.5 min-h-28', d === s.today && 'border-accent')}>
            <button onClick={() => onPick(d)} className="w-full flex items-baseline justify-between mb-1.5">
              <span className="text-xs font-medium text-fg-3">{DAY_SHORT[dayOfWeek(d)]}</span>
              <span className={cn('text-[15px] font-semibold tnum', d === s.today && 'text-accent')}>{Number(d.slice(8))}</span>
            </button>
            {conflicts > 0 && <p className="text-[10.5px] text-warning mb-1">{conflicts} conflict{conflicts > 1 ? 's' : ''}</p>}
            {due > 0 && <p className="text-[10.5px] text-danger mb-1">{due} deadline{due > 1 ? 's' : ''}</p>}
            <ul className="space-y-1">
              {items.map((i) => (
                <li key={i.key}>
                  <button onClick={() => onOpen(i, d)} className={cn('w-full text-left rounded px-1.5 py-1 text-[11.5px] leading-tight', i.done && 'opacity-50 line-through')} style={{ background: `color-mix(in oklab, ${i.color ?? 'var(--accent)'} 14%, transparent)` }}>
                    <span className="tnum text-fg-3">{fromMinutes(i.start)}</span> <span className="text-fg">{i.title}</span>
                  </button>
                </li>
              ))}
            </ul>
            {items.length === 0 && <p className="text-[11px] text-fg-3">Free</p>}
          </Card>
        );
      })}
    </div>
  );
}

function MonthView({ date, onPick }: { date: DateStr; onPick: (d: DateStr) => void }) {
  const { s } = useStore();
  const first = monthStart(date);
  const gridStart = weekStart(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const month = first.slice(0, 7);
  return (
    <Card className="p-2">
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-fg-3 pb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const n = agendaFor(s, d).length;
          const due = s.tasks.filter((t) => !t.done && t.dueDate === d).length;
          const inMonth = d.startsWith(month);
          return (
            <button key={d} onClick={() => onPick(d)} className={cn('aspect-square sm:aspect-auto sm:h-20 rounded-lg p-1.5 text-left flex flex-col border border-transparent hover:bg-surface-2', !inMonth && 'opacity-35', d === s.today && 'border-accent')}>
              <span className={cn('text-[12px] font-medium tnum', d === s.today && 'text-accent')}>{Number(d.slice(8))}</span>
              <span className="mt-auto flex flex-wrap gap-0.5">
                {Array.from({ length: Math.min(n, 4) }, (_, k) => (
                  <span key={k} className="h-1.5 w-1.5 rounded-full bg-accent" />
                ))}
                {due > 0 && <span className="h-1.5 w-1.5 rounded-full bg-danger" title={`${due} deadline(s)`} />}
              </span>
              {n > 0 && <span className="hidden sm:block text-[10px] text-fg-3">{n} item{n > 1 ? 's' : ''}</span>}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
