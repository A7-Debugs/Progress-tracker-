import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Plus, Trash2, Play, Archive, ArchiveRestore } from 'lucide-react';
import { useSnapshot } from '@/lib/hooks';
import { Loading, Page, PageHeader } from '@/components/layout';
import { Bar, SectionTitle } from '@/components/game';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Chips, Field } from '@/components/ui/Chips';
import { Switch } from '@/components/ui/Switch';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toaster';
import { SUBJECT_COLORS, SUGGESTED_SUBJECTS, TOPIC_STATUSES } from '@/lib/academy/academy';
import { addSubject, addTopic, deleteSubject, updateSubject } from '@/lib/actions';
import { relDay } from '@/lib/dates';
import { cn } from '@/lib/cn';

export function Subjects() {
  const s = useSnapshot();
  const toast = useToast();
  const [name, setName] = useState('');
  if (!s) return <Loading />;
  const have = new Set(s.subjects.map((x) => x.name.toLowerCase()));
  const add = async (n: string) => {
    try {
      await addSubject(n);
      setName('');
      toast(`Added ${n}`);
    } catch (e) {
      toast((e as Error).message, 'warn');
    }
  };
  return (
    <>
      <PageHeader title="Subjects" back />
      <Page className="pb-8">
        <div className="space-y-2">
          {s.subjects.map((sub) => (
            <Link key={sub.id} to={`/academy/subject/${sub.id}`} className={cn('flex items-center gap-3 rounded-2xl bg-base-900 border border-base-800 p-3', sub.archived && 'opacity-50')}>
              <span className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${sub.color}22`, color: sub.color }}>
                <Icon name={sub.icon} size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-base-50 truncate">{sub.name}</p>
                <p className="text-xs text-base-400">
                  {s.topics.filter((t) => t.subjectId === sub.id).length} topics · {['', 'Lighter', 'Normal', 'Focus'][sub.priority]}
                  {sub.archived ? ' · hidden' : ''}
                </p>
              </div>
              <ChevronRight size={16} className="text-base-500" />
            </Link>
          ))}
        </div>
        <SectionTitle>Add a subject</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_SUBJECTS.filter((x) => !have.has(x.name.toLowerCase())).map((x) => (
            <button key={x.name} onClick={() => add(x.name)} className="h-9 px-3 rounded-xl border border-base-700 bg-base-850 text-sm text-base-200 flex items-center gap-1.5">
              <Plus size={14} style={{ color: x.color }} /> {x.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Other subject (e.g. Art, PE, Music)" onKeyDown={(e) => e.key === 'Enter' && name.trim() && add(name)} />
          <Button onClick={() => name.trim() && add(name)} disabled={!name.trim()}>
            Add
          </Button>
        </div>
      </Page>
    </>
  );
}

export function SubjectDetail() {
  const { subjectId } = useParams();
  const s = useSnapshot();
  const navigate = useNavigate();
  const toast = useToast();
  const [topicName, setTopicName] = useState('');
  const [confirm, setConfirm] = useState(false);
  if (!s) return <Loading />;
  const sub = s.subjects.find((x) => x.id === subjectId);
  if (!sub) return <Loading />;
  const topics = s.topics.filter((t) => t.subjectId === sub.id).sort((a, b) => a.order - b.order);
  const sessions = s.revisionSessions.filter((r) => r.subjectId === sub.id);
  const add = async () => {
    if (!topicName.trim()) return;
    await addTopic(sub.id, topicName);
    setTopicName('');
  };
  return (
    <>
      <PageHeader title={sub.name} subtitle={`${topics.length} topics · ${sessions.length} sessions`} back />
      <Page className="pb-8">
        <Button className="w-full" onClick={() => navigate(`/academy/start?subject=${sub.id}`)}>
          <Play size={16} /> Revise {sub.name}
        </Button>

        <SectionTitle>Topics</SectionTitle>
        <div className="flex gap-2 mb-2">
          <Input value={topicName} onChange={(e) => setTopicName(e.target.value)} placeholder="Add a topic, e.g. Quadratic equations" onKeyDown={(e) => e.key === 'Enter' && add()} />
          <Button onClick={add} disabled={!topicName.trim()} aria-label="Add topic">
            <Plus size={18} />
          </Button>
        </div>
        {topics.length === 0 && <p className="text-sm text-base-400 p-3">Add the topics you're learning in class. Your teacher's scheme of work or the exam spec is a good list.</p>}
        <div className="space-y-2">
          {topics.map((t) => {
            const st = TOPIC_STATUSES[t.status];
            return (
              <Link key={t.id} to={`/academy/topic/${t.id}`} className="block rounded-2xl bg-base-900 border border-base-800 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-base-50 truncate">{t.name}</p>
                  <span className="text-[11px] font-bold shrink-0" style={{ color: st.color }}>{st.label}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Bar value={t.status / 5} color={st.color} className="flex-1" height={4} />
                  <span className="text-[11px] text-base-400 shrink-0">
                    {t.confidence ? `Confidence ${t.confidence}/5` : 'Not rated'}
                    {t.nextReview ? ` · review ${relDay(t.nextReview, s.today).toLowerCase()}` : ''}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <SectionTitle>Subject settings</SectionTitle>
        <div className="space-y-4 rounded-2xl bg-base-900 border border-base-800 p-3">
          <Field label="Name">
            <Input defaultValue={sub.name} onBlur={(e) => e.target.value.trim() && updateSubject(sub.id, { name: e.target.value.trim().slice(0, 40) })} />
          </Field>
          <Field label="Revision priority" hint="The planner gives focus subjects more sessions. Not every subject needs equal time.">
            <Chips value={sub.priority} onChange={(priority) => updateSubject(sub.id, { priority })} options={[{ value: 1, label: 'Lighter' }, { value: 2, label: 'Normal' }, { value: 3, label: 'Focus' }]} size="sm" />
          </Field>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-base-100">Test / exam coming up</p>
              <p className="text-xs text-base-400">Planner prioritises this subject.</p>
            </div>
            <Switch checked={sub.examSoon} onCheckedChange={(examSoon) => updateSubject(sub.id, { examSoon })} />
          </div>
          <Field label="Colour">
            <div className="flex flex-wrap gap-2">
              {SUBJECT_COLORS.map((c) => (
                <button key={c} onClick={() => updateSubject(sub.id, { color: c })} className={cn('h-8 w-8 rounded-full border-2', sub.color === c ? 'border-base-50' : 'border-transparent')} style={{ background: c }} aria-label={`Colour ${c}`} />
              ))}
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button variant="secondary" onClick={async () => { await updateSubject(sub.id, { archived: !sub.archived }); toast(sub.archived ? 'Subject shown again' : 'Subject hidden', 'info'); }}>
            {sub.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />} {sub.archived ? 'Show' : 'Hide'}
          </Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            <Trash2 size={16} /> Delete
          </Button>
        </div>
        <Dialog open={confirm} onOpenChange={setConfirm} title={`Delete ${sub.name}?`} description="Removes its topics, sessions and reviews. XP you earned stays. Hiding keeps everything instead.">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={async () => { await deleteSubject(sub.id); navigate('/academy', { replace: true }); }}>Delete</Button>
          </div>
        </Dialog>
      </Page>
    </>
  );
}
