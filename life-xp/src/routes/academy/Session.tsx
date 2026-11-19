import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Pause, Play, Square, X, Lightbulb, Sparkles } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSnapshot, useTicker } from '@/lib/hooks';
import { Loading, Page, PageHeader } from '@/components/layout';
import { Ring, SectionTitle } from '@/components/game';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Chips, Field } from '@/components/ui/Chips';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toaster';
import { db } from '@/lib/db';
import { METHODS, METHOD_BY_ID, MIN_XP_MINUTES, SESSION_LENGTHS, MAX_SESSION_MINUTES, sessionXp, revisionXpOn, DAILY_REVISION_XP_CAP } from '@/lib/academy/academy';
import { addTopic, cancelTimer, finishSession, pauseTimer, resumeTimer, startTimer, timerSeconds } from '@/lib/actions';
import { tierForLevel } from '@/lib/levels';
import { currentLevel } from '@/lib/performance';
import { suggestMethod } from '@/lib/academy/planner';
import { vibrate } from '@/lib/celebrate';
import { cn } from '@/lib/cn';
import type { RevisionMethod, RevisionSession } from '@/lib/types';

export function StartSession() {
  const s = useSnapshot();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const subjects = s?.subjects.filter((x) => !x.archived) ?? [];
  const [subjectId, setSubjectId] = useState<string | null>(params.get('subject'));
  const [topicId, setTopicId] = useState<string | null>(params.get('topic'));
  const [method, setMethod] = useState<RevisionMethod | null>((params.get('method') as RevisionMethod) || null);
  const [minutes, setMinutes] = useState<number | null>(params.get('minutes') ? Number(params.get('minutes')) : null);
  const [custom, setCustom] = useState('');
  const [newTopic, setNewTopic] = useState('');
  if (!s) return <Loading />;
  if (s.timer) {
    navigate('/academy/session', { replace: true });
    return null;
  }
  const level = currentLevel(s).level;
  const tier = tierForLevel(level);
  const sid = subjectId ?? subjects[0]?.id ?? null;
  const topics = s.topics.filter((t) => t.subjectId === sid);
  const topic = topics.find((t) => t.id === topicId) ?? null;
  const m = method ?? suggestMethod(topic, tier.tier);
  const mins = minutes ?? s.settings.revisionMinutes;
  const usedToday = revisionXpOn(s, s.today);
  const preview = sessionXp(mins * 60, mins, m, usedToday);

  const start = async () => {
    if (!sid) return toast('Add a subject first', 'warn');
    try {
      let tId = topicId;
      if (!tId && newTopic.trim()) tId = await addTopic(sid, newTopic);
      await startTimer({ subjectId: sid, topicId: tId, method: m, plannedMinutes: mins, planItemId: params.get('plan') });
      vibrate(30);
      navigate('/academy/session', { replace: true });
    } catch (e) {
      toast((e as Error).message, 'warn');
    }
  };

  if (!subjects.length) {
    return (
      <>
        <PageHeader title="Focus session" back />
        <Page>
          <p className="text-sm text-base-300 mt-4">Add a subject first.</p>
          <Button className="mt-3" onClick={() => navigate('/academy/subjects')}>Add subjects</Button>
        </Page>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Focus session" subtitle={`Tier ${tier.tier} suggestion: ${tier.minutes[0]}–${tier.minutes[1]} min`} back />
      <Page className="space-y-4 pb-8">
        <Field label="Subject">
          <Chips value={sid} onChange={(v) => { setSubjectId(v); setTopicId(null); }} options={subjects.map((x) => ({ value: x.id, label: x.name, color: x.color }))} size="sm" />
        </Field>
        <Field label="Topic">
          {topics.length > 0 && (
            <Select value={topicId ?? 'none'} onValueChange={(v) => setTopicId(v === 'none' ? null : v)} options={[{ value: 'none', label: topics.length ? 'New topic or general revision' : 'General revision' }, ...topics.map((t) => ({ value: t.id, label: t.name }))]} />
          )}
          {!topicId && <Input className="mt-2" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="New topic name (optional)" />}
        </Field>
        <Field label="Revision method">
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((x) => (
              <button key={x.id} onClick={() => setMethod(x.id)} className={cn('flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left', m === x.id ? 'border-violet bg-violet/15 text-base-50' : 'border-base-700 bg-base-850 text-base-300')}>
                <Icon name={x.icon} size={16} className={m === x.id ? 'text-violet' : undefined} />
                <span className="text-xs font-semibold leading-tight flex-1">{x.label}</span>
                {x.bonus > 0 && <span className="text-[10px] font-bold text-xp">+{x.bonus}</span>}
              </button>
            ))}
          </div>
        </Field>
        <p className="flex gap-2 text-xs text-base-300 rounded-xl bg-base-900 border border-base-800 p-2.5">
          <Lightbulb size={15} className="text-xp shrink-0" />
          {METHOD_BY_ID[m].tip}
        </p>
        <Field label="Length">
          <Chips value={SESSION_LENGTHS.includes(mins) && !custom ? mins : null} onChange={(v) => { setMinutes(v); setCustom(''); }} options={SESSION_LENGTHS.map((x) => ({ value: x, label: `${x} min` }))} />
          <Input className="mt-2" type="number" inputMode="numeric" min={5} max={MAX_SESSION_MINUTES} value={custom} onChange={(e) => { setCustom(e.target.value); const n = Number(e.target.value); if (n >= 1) setMinutes(Math.min(MAX_SESSION_MINUTES, n)); }} placeholder={`Custom (5–${MAX_SESSION_MINUTES} min)`} />
        </Field>
        <div className="rounded-2xl bg-base-900 border border-base-800 p-3 flex items-center justify-between">
          <span className="text-sm text-base-300">Reward if completed</span>
          <span className="text-lg font-black text-xp">+{preview} XP</span>
        </div>
        {usedToday >= DAILY_REVISION_XP_CAP && <p className="text-xs text-warn">You've hit today's revision XP cap ({DAILY_REVISION_XP_CAP}). Great work! Rest is part of learning too.</p>}
        <Button size="lg" className="w-full bg-violet hover:bg-violet/90" onClick={start}>
          <Play size={18} /> Start {mins}-minute session
        </Button>
      </Page>
    </>
  );
}

export function Session() {
  const timer = useLiveQuery(() => db.timer.get('timer').then((t) => t ?? null), []);
  const s = useSnapshot();
  const navigate = useNavigate();
  const toast = useToast();
  const t = useTicker(!!timer?.runningSince, 500);
  const [cancel, setCancel] = useState(false);
  const [result, setResult] = useState<RevisionSession | null>(null);
  const [reflect, setReflect] = useState(false);
  const notified = useRef(false);

  const elapsed = timer ? timerSeconds(timer, t) : 0;
  const total = timer ? timer.plannedMinutes * 60 : 1;
  const complete = timer ? elapsed >= total : false;

  useEffect(() => {
    if (complete && timer?.runningSince && !notified.current) {
      notified.current = true;
      pauseTimer();
      vibrate([200, 100, 200, 100, 400]);
      setReflect(true);
    }
  }, [complete, timer]);

  if (result) return <SessionDone session={result} onDone={() => navigate('/academy', { replace: true })} />;
  if (timer === undefined || !s) return <Loading />;
  if (timer === null) {
    return (
      <>
        <PageHeader title="Focus session" back />
        <Page>
          <p className="text-sm text-base-300 mt-4">No session running.</p>
          <Button className="mt-3" onClick={() => navigate('/academy/start', { replace: true })}>Start one</Button>
        </Page>
      </>
    );
  }
  const subject = s.subjects.find((x) => x.id === timer.subjectId);
  const topic = s.topics.find((x) => x.id === timer.topicId);
  const left = Math.max(0, total - elapsed);
  const running = timer.runningSince !== null;
  const mm = Math.floor(left / 60);
  const ss = Math.floor(left % 60);
  const enough = elapsed >= MIN_XP_MINUTES * 60;

  if (reflect) return <Reflection method={timer.method} onSubmit={async (r) => { const res = await finishSession(r); if (res) setResult(res); else toast('Session already finished', 'info'); }} onBack={complete ? undefined : () => setReflect(false)} focusedMinutes={Math.floor(elapsed / 60)} />;

  return (
    <div className="min-h-dvh flex flex-col safe-top safe-bottom">
      <div className="mx-auto w-full max-w-lg flex-1 flex flex-col px-5">
        <div className="flex items-center justify-between h-14">
          <button onClick={() => navigate('/academy')} className="text-sm text-base-400">Minimise</button>
          <span className="text-xs font-bold uppercase tracking-widest text-violet">Focus mode</span>
          <button onClick={() => setCancel(true)} className="h-10 w-10 flex items-center justify-center text-base-400" aria-label="Cancel session"><X size={20} /></button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-bold" style={{ color: subject?.color }}>{subject?.name}</p>
          <p className="text-lg font-black text-base-50">{topic?.name ?? 'General revision'}</p>
          <p className="text-xs text-base-400 mb-6">{METHOD_BY_ID[timer.method].label}</p>
          <Ring value={elapsed / total} size={260} stroke={14} gradient={['#a47bff', '#3fe3ff']}>
            <div>
              <div className="text-6xl font-black tabular-nums text-base-50" aria-live="polite">
                {mm}:{String(ss).padStart(2, '0')}
              </div>
              <div className="text-xs font-bold uppercase tracking-widest text-base-400 mt-1">{complete ? 'complete' : running ? 'focusing' : 'paused'}</div>
            </div>
          </Ring>
          <p className="text-xs text-base-400 mt-6 max-w-xs">{METHOD_BY_ID[timer.method].tip}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 pb-6">
          {running ? (
            <Button variant="secondary" size="lg" onClick={() => pauseTimer()}>
              <Pause size={18} /> Pause
            </Button>
          ) : (
            <Button variant="secondary" size="lg" onClick={() => resumeTimer()} disabled={complete}>
              <Play size={18} /> Resume
            </Button>
          )}
          <Button size="lg" className="bg-violet hover:bg-violet/90" onClick={async () => { await pauseTimer(); setReflect(true); }}>
            <Square size={16} /> {complete ? 'Finish' : 'End early'}
          </Button>
        </div>
        {!enough && <p className="text-center text-[11px] text-base-500 -mt-3 pb-4">Sessions under {MIN_XP_MINUTES} minutes are saved but earn no XP.</p>}
      </div>
      <Dialog open={cancel} onOpenChange={setCancel} title="Cancel this session?" description="Nothing will be saved and no XP is awarded.">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setCancel(false)}>Keep going</Button>
          <Button variant="danger" onClick={async () => { await cancelTimer(); navigate('/academy', { replace: true }); }}>Cancel session</Button>
        </div>
      </Dialog>
    </div>
  );
}

function Reflection({ method, onSubmit, onBack, focusedMinutes }: { method: RevisionMethod; onSubmit: (r: Parameters<typeof finishSession>[0]) => Promise<void>; onBack?: () => void; focusedMinutes: number }) {
  const [studied, setStudied] = useState('');
  const [difficult, setDifficult] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [revisit, setRevisit] = useState(false);
  const [correct, setCorrect] = useState('');
  const [totalQ, setTotalQ] = useState('');
  const [busy, setBusy] = useState(false);
  const practice = METHOD_BY_ID[method].practice;
  return (
    <>
      <PageHeader title="Session check-in" subtitle={`${focusedMinutes} focused minutes`} right={onBack && <Button size="sm" variant="ghost" onClick={onBack}>Back</Button>} />
      <Page className="space-y-4 pb-8">
        <Field label="What did you study?">
          <Textarea rows={2} value={studied} onChange={(e) => setStudied(e.target.value)} placeholder="e.g. Solving simultaneous equations by elimination" />
        </Field>
        <Field label="How confident do you feel?">
          <Chips value={confidence} onChange={setConfidence} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}` }))} />
          <div className="flex justify-between text-[10px] text-base-500 mt-1">
            <span>1 · lost</span>
            <span>5 · totally got it</span>
          </div>
        </Field>
        <Field label="What did you find difficult?" hint="Optional, but it helps you know what to revisit.">
          <Textarea rows={2} value={difficult} onChange={(e) => setDifficult(e.target.value)} placeholder="e.g. When to multiply both equations" />
        </Field>
        {practice && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Questions right">
              <Input type="number" inputMode="numeric" min={0} value={correct} onChange={(e) => setCorrect(e.target.value)} />
            </Field>
            <Field label="Out of">
              <Input type="number" inputMode="numeric" min={1} value={totalQ} onChange={(e) => setTotalQ(e.target.value)} />
            </Field>
          </div>
        )}
        <div className="flex items-center justify-between rounded-2xl bg-base-900 border border-base-800 p-3">
          <div>
            <p className="text-sm font-semibold text-base-100">Do you need to revisit this topic?</p>
            <p className="text-xs text-base-400">The planner will bring it back sooner.</p>
          </div>
          <Switch checked={revisit} onCheckedChange={setRevisit} />
        </div>
        <Button
          size="lg"
          className="w-full bg-violet hover:bg-violet/90"
          disabled={busy || confidence === null}
          onClick={async () => {
            setBusy(true);
            await onSubmit({ studied, difficult, confidence, revisit, practiceCorrect: correct === '' ? null : Number(correct), practiceTotal: totalQ === '' ? null : Number(totalQ) });
          }}
        >
          Save session
        </Button>
        {confidence === null && <p className="text-xs text-center text-base-500">Rate your confidence to save.</p>}
      </Page>
    </>
  );
}

function SessionDone({ session, onDone }: { session: RevisionSession; onDone: () => void }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center safe-top safe-bottom animate-fade-in">
      <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-violet to-accent flex items-center justify-center animate-pop">
        <Sparkles size={44} className="text-base-950" />
      </div>
      <h1 className="text-3xl font-black mt-5">Session complete</h1>
      <p className="text-base-300 mt-1">{Math.floor(session.focusedSeconds / 60)} focused minutes · {METHOD_BY_ID[session.method].label}</p>
      <p className="text-4xl font-black text-gradient-xp mt-4">+{session.xp} XP</p>
      {session.xp === 0 && <p className="text-xs text-base-400 mt-1 max-w-xs">Saved to your history. Sessions earn XP from {MIN_XP_MINUTES} focused minutes, up to the daily cap.</p>}
      {session.practiceTotal && <p className="text-sm text-base-200 mt-3">Practice: {session.practiceCorrect}/{session.practiceTotal} ({Math.round(((session.practiceCorrect ?? 0) / session.practiceTotal) * 100)}%)</p>}
      <SectionTitle className="justify-center">&nbsp;</SectionTitle>
      <Button size="lg" className="w-full max-w-xs" onClick={onDone}>
        Back to Academy
      </Button>
    </div>
  );
}
