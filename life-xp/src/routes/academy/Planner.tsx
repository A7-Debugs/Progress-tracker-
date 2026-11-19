import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Lock, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useSnapshot } from '@/lib/hooks';
import { Loading, Page, PageHeader } from '@/components/layout';
import { SectionTitle } from '@/components/game';
import { Button } from '@/components/ui/Button';
import { Chips, DayPicker, Field } from '@/components/ui/Chips';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toaster';
import { buildPlan, MAX_DAILY_STUDY_MINUTES } from '@/lib/academy/planner';
import { effectiveRevisionTarget, METHOD_BY_ID, SESSION_LENGTHS } from '@/lib/academy/academy';
import { removePlanItem, savePlan, togglePlanItem, updateSettings } from '@/lib/actions';
import { addDays, DAY_SHORT, dayOfWeek, fmtDay, fmtShort, weekDates, weekStart } from '@/lib/dates';
import { hasFeature, tierForLevel } from '@/lib/levels';
import { currentLevel } from '@/lib/performance';
import { newId } from '@/lib/id';
import { cn } from '@/lib/cn';
import type { PlanItem } from '@/lib/types';

export default function Planner() {
  const s = useSnapshot();
  const navigate = useNavigate();
  const toast = useToast();
  const [adding, setAdding] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  if (!s) return <Loading />;
  const level = currentLevel(s).level;
  if (!hasFeature(level, 'planner')) {
    return (
      <>
        <PageHeader title="Revision planner" back />
        <Page>
          <div className="mt-6 rounded-2xl border border-dashed border-base-700 p-6 text-center">
            <Lock className="mx-auto text-base-500" />
            <p className="font-bold mt-2">Unlocks at level 3</p>
            <p className="text-sm text-base-400 mt-1">For now, just start a short session whenever suits you.</p>
          </div>
        </Page>
      </>
    );
  }
  const ws = weekStart(s.today);
  const plan = s.weekPlans.get(ws);
  const target = effectiveRevisionTarget(s);
  const tier = tierForLevel(level);
  const subjects = new Map(s.subjects.map((x) => [x.id, x]));
  const topics = new Map(s.topics.map((x) => [x.id, x]));
  const generate = async () => {
    await savePlan(buildPlan(s, ws));
    toast('Plan built for this week');
  };
  const st = s.settings;

  return (
    <>
      <PageHeader title="Revision planner" subtitle={`${fmtShort(ws)} – ${fmtShort(addDays(ws, 6))} · target ${target.perWeek} × ${target.minutes} min`} back />
      <Page className="pb-8">
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={generate}>
            <RefreshCw size={16} /> {plan ? 'Rebuild plan' : 'Build my week'}
          </Button>
          <Button variant="secondary" onClick={() => setShowSettings(true)}>
            Plan settings
          </Button>
        </div>
        <p className="text-xs text-base-400 mt-2">
          Reviews go on the day they're due. Study sessions avoid rest days and heavy-homework days, rotate subjects, and favour topics that need attention. Never more than {MAX_DAILY_STUDY_MINUTES} min a day. Edit anything.
        </p>
        {plan?.edited && <p className="text-[11px] text-base-500 mt-1">You've edited this plan. Rebuilding will replace your changes.</p>}

        {weekDates(ws).map((d) => {
          const items = (plan?.items ?? []).filter((i) => i.date === d);
          const past = d < s.today;
          const rest = !st.studyDays.includes(dayOfWeek(d));
          return (
            <div key={d}>
              <SectionTitle right={!past && <button onClick={() => setAdding(d)} className="h-7 w-7 rounded-lg bg-base-800 text-base-300 flex items-center justify-center" aria-label={`Add session on ${fmtDay(d)}`}><Plus size={14} /></button>}>
                <span className={cn(d === s.today && 'text-accent')}>
                  {fmtDay(d)}
                  {d === s.today ? ' · today' : ''}
                  {rest ? ' · rest day' : ''}
                  {(st.homeworkMinutes[String(dayOfWeek(d))] ?? 0) > 0 ? ` · ${st.homeworkMinutes[String(dayOfWeek(d))]}m homework` : ''}
                </span>
              </SectionTitle>
              {items.length === 0 ? (
                <p className={cn('text-xs px-1', past ? 'text-base-600' : 'text-base-500')}>{rest ? 'Rest. Recharge.' : 'Free'}</p>
              ) : (
                <div className="space-y-1.5">
                  {items.map((i) => {
                    const sub = subjects.get(i.subjectId);
                    const topic = i.topicId ? topics.get(i.topicId) : undefined;
                    return (
                      <div key={i.id} className={cn('flex items-center gap-2 rounded-xl border px-3 py-2', i.done ? 'border-mint/30 bg-mint/5' : 'border-base-800 bg-base-900')}>
                        <button onClick={() => togglePlanItem(ws, i.id)} className={cn('h-7 w-7 rounded-lg border-2 flex items-center justify-center shrink-0', i.done ? 'bg-mint border-mint' : 'border-base-600')} aria-label={i.done ? 'Mark not done' : 'Mark done'}>
                          {i.done && <Check size={14} strokeWidth={3} className="text-base-950" />}
                        </button>
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: sub?.color }} />
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-semibold truncate', i.done ? 'text-base-400 line-through' : 'text-base-100')}>
                            {sub?.name ?? 'Subject'}
                            {topic ? ` · ${topic.name}` : ''}
                          </p>
                          <p className="text-[11px] text-base-400">
                            {i.time} · {i.minutes} min · {i.kind === 'review' ? 'Review' : METHOD_BY_ID[i.method].label}
                          </p>
                        </div>
                        {!i.done && !past && (
                          <button onClick={() => navigate(`/academy/start?subject=${i.subjectId}${i.topicId ? `&topic=${i.topicId}` : ''}&method=${i.method}&minutes=${i.minutes}&plan=${i.id}`)} className="h-8 w-8 rounded-lg bg-violet/20 text-violet flex items-center justify-center" aria-label="Start this session">
                            <Play size={14} />
                          </button>
                        )}
                        <button onClick={() => removePlanItem(ws, i.id)} className="h-8 w-8 flex items-center justify-center text-base-500" aria-label="Remove">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </Page>

      {adding && <AddItem date={adding} onClose={() => setAdding(null)} onAdd={async (item) => { const p = plan ?? { id: ws, items: [], generatedAt: Date.now(), edited: true }; await savePlan({ ...p, edited: true, items: [...p.items, item].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.time < b.time ? -1 : 1)) }); setAdding(null); }} />}

      <Dialog open={showSettings} onOpenChange={setShowSettings} title="Plan settings" description="Your targets. They never go up unless you change them.">
        <div className="space-y-4">
          <Field label={`Sessions per week: ${st.revisionPerWeek}`} hint={`Suggested for tier ${tier.tier}: about ${tier.perWeek}.`}>
            <Chips value={st.revisionPerWeek} onChange={(revisionPerWeek) => updateSettings({ revisionPerWeek })} options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}` }))} size="sm" />
          </Field>
          <Field label="Session length" hint={`Suggested for tier ${tier.tier}: ${tier.minutes[0]}–${tier.minutes[1]} min.`}>
            <Chips value={st.revisionMinutes} onChange={(revisionMinutes) => updateSettings({ revisionMinutes })} options={[...SESSION_LENGTHS, 30].map((n) => ({ value: n, label: `${n}m` }))} size="sm" />
          </Field>
          <Field label="Study days" hint="Days off are rest days.">
            <DayPicker value={st.studyDays} onChange={(studyDays) => updateSettings({ studyDays })} />
          </Field>
          <div>
            <p className="text-sm font-semibold text-base-200 mb-1.5">Typical homework (minutes)</p>
            <div className="grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <label key={d} className="text-center">
                  <span className="text-[10px] text-base-400">{DAY_SHORT[d]}</span>
                  <Input type="number" inputMode="numeric" className="h-9 px-1 text-center text-sm" value={st.homeworkMinutes[String(d)] ?? 0} onChange={(e) => updateSettings({ homeworkMinutes: { ...st.homeworkMinutes, [String(d)]: Math.max(0, Math.min(240, Number(e.target.value) || 0)) } })} />
                </label>
              ))}
            </div>
            <p className="text-xs text-base-400 mt-1">Days with 60+ min homework get no extra study session.</p>
          </div>
          <Button className="w-full" onClick={() => setShowSettings(false)}>Done</Button>
        </div>
      </Dialog>
    </>
  );
}

function AddItem({ date, onClose, onAdd }: { date: string; onClose: () => void; onAdd: (i: PlanItem) => void }) {
  const s = useSnapshot();
  const subjects = s?.subjects.filter((x) => !x.archived) ?? [];
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [topicId, setTopicId] = useState('none');
  const [minutes, setMinutes] = useState(s?.settings.revisionMinutes ?? 15);
  const [time, setTime] = useState('17:30');
  if (!s) return null;
  const topics = s.topics.filter((t) => t.subjectId === subjectId);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Add session · ${fmtDay(date)}`}>
      <div className="space-y-3">
        <Field label="Subject">
          <Chips value={subjectId} onChange={(v) => { setSubjectId(v); setTopicId('none'); }} options={subjects.map((x) => ({ value: x.id, label: x.name, color: x.color }))} size="sm" />
        </Field>
        {topics.length > 0 && (
          <Field label="Topic">
            <Select value={topicId} onValueChange={setTopicId} options={[{ value: 'none', label: 'Any topic' }, ...topics.map((t) => ({ value: t.id, label: t.name }))]} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Minutes">
            <Input type="number" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(Math.max(5, Math.min(60, Number(e.target.value) || 10)))} />
          </Field>
        </div>
        <Button className="w-full" disabled={!subjectId} onClick={() => onAdd({ id: newId(), date, time, subjectId, topicId: topicId === 'none' ? null : topicId, kind: 'study', method: 'active-recall', minutes, done: false })}>
          Add to plan
        </Button>
      </div>
    </Dialog>
  );
}
