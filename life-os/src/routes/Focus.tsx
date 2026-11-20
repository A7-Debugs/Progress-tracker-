import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pause, Play, Square, Trash2, X } from 'lucide-react';
import { db } from '@/lib/db';
import { useStore } from '@/lib/store';
import * as A from '@/lib/actions';
import { useTicker } from '@/lib/hooks';
import { filterTasks, sortByScore } from '@/lib/tasks';
import { fmtShort } from '@/lib/dates';
import { Button } from '@/components/ui/Button';
import { Field, Segmented } from '@/components/ui/Chips';
import { Input, NumberField } from '@/components/ui/Input';
import { NONE, Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Ring, hours } from '@/components/Visuals';
import { useToast } from '@/components/ui/Toaster';
import { Confirm } from '@/components/ui/Dialog';

export default function Focus() {
  // null = no timer; undefined = still loading.
  const timer = useLiveQuery(async () => (await db.timer.get('timer')) ?? null, []);
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <header className="safe-top">
        <div className="mx-auto max-w-lg flex items-center justify-between px-4 h-14">
          <h1 className="text-[15px] font-semibold">Focus</h1>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
            <X size={18} />
          </Button>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-lg px-4 pb-10">{timer === undefined ? null : timer ? <Running /> : <Setup />}</main>
    </div>
  );
}

function Running() {
  const timer = useLiveQuery(() => db.timer.get('timer'), [])!;
  const toast = useToast();
  const navigate = useNavigate();
  const [discard, setDiscard] = useState(false);
  const t = useTicker(!!timer?.runningSince, 500);
  if (!timer) return null;
  const secs = A.timerSeconds(timer, t);
  const planned = timer.plannedMin * 60;
  const left = planned - secs;
  const over = left < 0;
  const mm = Math.floor(Math.abs(left) / 60);
  const ss = String(Math.floor(Math.abs(left) % 60)).padStart(2, '0');
  return (
    <div className="flex flex-col items-center pt-8">
      <p className="text-[13px] text-fg-3">{timer.runningSince ? 'Focusing on' : 'Paused'}</p>
      <p className="text-lg font-medium text-center mt-1">{timer.label}</p>
      <Ring value={Math.min(1, secs / planned)} size={240} stroke={10} className="my-10" color={over ? 'var(--success)' : 'var(--accent)'}>
        <div className="text-center">
          <div className="text-5xl font-semibold tnum tracking-tight">
            {over ? '+' : ''}
            {mm}:{ss}
          </div>
          <div className="text-xs text-fg-3 mt-1">{over ? 'past your plan' : `of ${timer.plannedMin} min`}</div>
        </div>
      </Ring>
      <div className="flex gap-2 w-full">
        {timer.runningSince ? (
          <Button variant="secondary" size="lg" className="flex-1" onClick={() => A.pauseTimer()}>
            <Pause size={17} /> Pause
          </Button>
        ) : (
          <Button variant="secondary" size="lg" className="flex-1" onClick={() => A.resumeTimer()}>
            <Play size={17} /> Resume
          </Button>
        )}
        <Button
          size="lg"
          className="flex-1"
          onClick={async () => {
            const m = await A.stopTimer(true);
            toast(m ? `Logged ${hours(m)} of focus` : 'Under a minute: not logged', m ? 'success' : 'info');
            navigate(-1);
          }}
        >
          <Square size={15} /> Finish
        </Button>
      </div>
      <button className="mt-4 text-[13px] text-fg-3 hover:text-danger inline-flex items-center gap-1" onClick={() => setDiscard(true)}>
        <Trash2 size={13} /> Discard session
      </button>
      <p className="mt-8 text-xs text-fg-3 text-center max-w-xs">Keeps running if you close the app. Focus time counts towards your daily target and, if linked, the task's actual time.</p>
      <Confirm open={discard} onOpenChange={setDiscard} title="Discard this session?" body="The time won't be logged." confirmLabel="Discard" onConfirm={() => A.stopTimer(false).then(() => navigate(-1))} />
    </div>
  );
}

function Setup() {
  const { s } = useStore();
  const toast = useToast();
  const tasks = sortByScore(s, filterTasks(s, 'today').concat(filterTasks(s, 'week').filter((t) => !filterTasks(s, 'today').includes(t))));
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? NONE);
  const [label, setLabel] = useState('');
  const [mins, setMins] = useState(50);
  const [cat, setCat] = useState(NONE);
  const [manual, setManual] = useState(30);
  const task = s.tasks.find((t) => t.id === taskId);
  const recent = [...s.focusSessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 8);

  return (
    <div className="space-y-6 pt-4">
      <div className="space-y-4">
        <Field label="Working on">
          <Select value={taskId} onValueChange={setTaskId} options={[{ value: NONE, label: 'Something else' }, ...tasks.map((t) => ({ value: t.id, label: t.title }))]} />
        </Field>
        {taskId === NONE && (
          <>
            <Field label="Label">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Study: financial reporting" />
            </Field>
            <Field label="Life area">
              <Select value={cat} onValueChange={setCat} options={[{ value: NONE, label: 'None' }, ...s.categories.filter((c) => !c.archived).map((c) => ({ value: c.id, label: c.name }))]} />
            </Field>
          </>
        )}
        <Field label="Planned length">
          <Segmented value={mins} onChange={setMins} options={[25, 50, 90].map((m) => ({ value: m, label: `${m} min` }))} />
        </Field>
        <Button
          size="lg"
          className="w-full"
          onClick={() =>
            A.startTimer({ label: task?.title ?? (label || 'Focus session'), taskId: task?.id ?? null, categoryId: task?.categoryId ?? (cat === NONE ? null : cat), plannedMin: mins }).catch((e) => toast(e.message, 'error'))
          }
        >
          <Play size={17} /> Start focus
        </Button>
      </div>
      <Card className="p-4">
        <p className="text-[13px] font-semibold mb-3">Log time you already spent</p>
        <div className="flex gap-2">
          <NumberField aria-label="Minutes" min={1} max={720} value={manual} onChange={(e) => setManual(Number(e.target.value))} />
          <Button
            variant="secondary"
            onClick={() =>
              A.logFocus({ date: s.today, minutes: manual, taskId: task?.id ?? null, goalId: task?.goalId ?? null, categoryId: task?.categoryId ?? (cat === NONE ? null : cat), learningId: null, note: task ? '' : label })
                .then(() => toast(`Logged ${hours(manual)}`))
                .catch((e) => toast(e.message, 'error'))
            }
          >
            Log minutes
          </Button>
        </div>
      </Card>
      {recent.length > 0 && (
        <div>
          <p className="text-[13px] font-semibold mb-2">Recent sessions</p>
          <ul className="divide-y divide-line text-[13px]">
            {recent.map((f) => (
              <li key={f.id} className="flex items-center gap-2 py-2">
                <span className="text-fg-3 w-14 shrink-0">{fmtShort(f.date)}</span>
                <span className="flex-1 truncate">{f.taskId ? (s.tasks.find((t) => t.id === f.taskId)?.title ?? 'Task') : f.note || (f.learningId ? s.learning.find((l) => l.id === f.learningId)?.title : null) || 'Focus'}</span>
                <span className="tnum">{hours(f.minutes)}</span>
                <button aria-label="Delete session" className="text-fg-3 hover:text-danger" onClick={() => A.deleteFocus(f.id)}>
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
