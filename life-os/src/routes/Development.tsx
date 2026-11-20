import { useEffect, useState } from 'react';
import { BookOpen, Briefcase, Clock, Compass, GraduationCap, Hammer, Plus, Sparkles, Trophy } from 'lucide-react';
import { useStore } from '@/lib/store';
import * as A from '@/lib/actions';
import { addDays, fmtShort } from '@/lib/dates';
import type { DateStr, LearningItem, LearningStatus, LearningType } from '@/lib/types';
import { ACHIEVEMENT_BY_ID } from '@/lib/progression';
import { cn } from '@/lib/cn';
import { Page, PageHeader } from '@/components/layout';
import { Card, Panel } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog, Confirm } from '@/components/ui/Dialog';
import { Field, Segmented } from '@/components/ui/Chips';
import { Input, NumberField, Textarea } from '@/components/ui/Input';
import { NONE, Select } from '@/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyState, hours, Progress, StatCard } from '@/components/Visuals';
import { useToast } from '@/components/ui/Toaster';
import { liveGoals } from '@/lib/goals';

const TYPES: { id: LearningType; label: string; plural: string; icon: typeof BookOpen; unit: string }[] = [
  { id: 'book', label: 'Book', plural: 'Books', icon: BookOpen, unit: 'pages' },
  { id: 'course', label: 'Course', plural: 'Courses', icon: GraduationCap, unit: 'modules' },
  { id: 'qualification', label: 'Qualification', plural: 'Qualifications', icon: Briefcase, unit: 'exams' },
  { id: 'skill', label: 'Skill', plural: 'Skills', icon: Sparkles, unit: 'hours' },
  { id: 'project', label: 'Project', plural: 'Personal projects', icon: Hammer, unit: '%' },
  { id: 'experience', label: 'Experience', plural: 'Experiences', icon: Compass, unit: '' },
];
const TYPE = Object.fromEntries(TYPES.map((t) => [t.id, t])) as Record<LearningType, (typeof TYPES)[number]>;

export default function Development() {
  const { s } = useStore();
  const [tab, setTab] = useState('learning');
  const year = s.today.slice(0, 4);
  const learningMin = s.focusSessions.filter((f) => f.learningId || f.categoryId === 'education').reduce((a, f) => a + f.minutes, 0);
  const done = (t: LearningType) => s.learning.filter((l) => l.type === t && l.status === 'completed');
  return (
    <>
      <PageHeader title="Personal development" subtitle="Learning, growth and reflection beyond day-to-day tasks" />
      <Page>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <StatCard label={`Books in ${year}`} value={done('book').filter((b) => b.completedDate?.startsWith(year)).length} sub={`${done('book').length} all time`} />
          <StatCard label="Courses completed" value={done('course').length} />
          <StatCard label="Qualifications" value={done('qualification').length} sub={`${s.learning.filter((l) => l.type === 'qualification' && l.status === 'active').length} in progress`} />
          <StatCard label="Learning hours" value={hours(learningMin)} sub="focus on learning" />
          <StatCard label="Journal entries" value={s.journal.size} />
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="learning">Learning & growth</TabsTrigger>
            <TabsTrigger value="journal">Journal</TabsTrigger>
            <TabsTrigger value="timeline">Accomplishments</TabsTrigger>
          </TabsList>
          <TabsContent value="learning">
            <Learning />
          </TabsContent>
          <TabsContent value="journal">
            <Journal />
          </TabsContent>
          <TabsContent value="timeline">
            <Timeline />
          </TabsContent>
        </Tabs>
      </Page>
    </>
  );
}

function Learning() {
  const { s } = useStore();
  const [status, setStatus] = useState<LearningStatus | 'all'>('active');
  const [editing, setEditing] = useState<LearningItem | 'new' | null>(null);
  const items = s.learning.filter((l) => status === 'all' || l.status === status);
  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-3">
        <Segmented size="sm" value={status} onChange={setStatus} options={[{ value: 'active', label: 'In progress' }, { value: 'planned', label: 'Planned' }, { value: 'completed', label: 'Completed' }, { value: 'all', label: 'All' }]} />
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus size={15} /> Add
        </Button>
      </div>
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={<BookOpen size={18} />} title="Nothing here yet" body="Track books, courses, qualifications, skills, projects and experiences." action={<Button size="sm" onClick={() => setEditing('new')}>Add one</Button>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {TYPES.flatMap((t) => items.filter((l) => l.type === t.id)).map((l) => (
            <LearningCard key={l.id} l={l} onEdit={() => setEditing(l)} />
          ))}
        </div>
      )}
      {editing && <LearningEditor item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function LearningCard({ l, onEdit }: { l: LearningItem; onEdit: () => void }) {
  const { s } = useStore();
  const toast = useToast();
  const [log, setLog] = useState(false);
  const T = TYPE[l.type];
  const mins = s.focusSessions.filter((f) => f.learningId === l.id).reduce((a, f) => a + f.minutes, 0);
  const prog = l.total ? l.progress / l.total : l.status === 'completed' ? 1 : null;
  return (
    <Card className="p-4 flex flex-col">
      <button onClick={onEdit} className="text-left flex gap-3">
        <span className="h-9 w-9 rounded-lg bg-surface-2 border border-line flex items-center justify-center text-fg-2 shrink-0">
          <T.icon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium truncate">{l.title}</span>
          <span className="block text-xs text-fg-3 truncate">
            {T.label}
            {l.creator ? ` · ${l.creator}` : ''}
          </span>
        </span>
        <Badge variant={l.status === 'completed' ? 'success' : l.status === 'active' ? 'accent' : 'neutral'}>{l.status === 'active' ? 'In progress' : l.status}</Badge>
      </button>
      {prog !== null && (
        <div className="mt-3">
          <Progress value={prog} height={5} />
          {l.total && (
            <p className="text-[11px] text-fg-3 mt-1 tnum">
              {l.progress}/{l.total} {l.unit}
            </p>
          )}
        </div>
      )}
      <div className="mt-auto pt-3 flex items-center gap-2 text-[11px] text-fg-3">
        {mins > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <Clock size={11} /> {hours(mins)}
          </span>
        )}
        {l.completedDate && <span>Completed {fmtShort(l.completedDate)}</span>}
        {l.rating && <span>{'★'.repeat(l.rating)}</span>}
        {l.status === 'active' && (
          <div className="ml-auto flex gap-1">
            {l.total && l.progress < l.total && (
              <Button size="xs" variant="subtle" onClick={() => A.saveLearning({ ...l, progress: l.progress + Math.max(1, Math.round(l.total! / 20)) }).catch((e) => toast(e.message, 'error'))}>
                +{Math.max(1, Math.round(l.total / 20))} {l.unit}
              </Button>
            )}
            <Button size="xs" variant="subtle" onClick={() => setLog(true)}>
              Log time
            </Button>
          </div>
        )}
      </div>
      <LogLearning open={log} onOpenChange={setLog} item={l} />
    </Card>
  );
}

function LogLearning({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item: LearningItem }) {
  const { s } = useStore();
  const toast = useToast();
  const [m, setM] = useState(30);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Log learning time`}
      description={item.title}
      footer={
        <Button
          onClick={() =>
            A.logFocus({ date: s.today, minutes: m, taskId: null, goalId: item.goalId, categoryId: item.categoryId ?? 'education', learningId: item.id, note: '' })
              .then(() => {
                toast(`Logged ${hours(m)}`);
                onOpenChange(false);
              })
              .catch((e) => toast(e.message, 'error'))
          }
        >
          Log
        </Button>
      }
    >
      <Field label="Minutes">
        <NumberField autoFocus min={1} max={720} value={m} onChange={(e) => setM(Number(e.target.value))} />
      </Field>
    </Dialog>
  );
}

function LearningEditor({ item, onClose }: { item?: LearningItem; onClose: () => void }) {
  const { s } = useStore();
  const toast = useToast();
  const [del, setDel] = useState(false);
  const [d, setD] = useState<A.LearningDraft>(item ?? { type: 'book', title: '', creator: '', status: 'active', progress: 0, total: null, unit: 'pages', categoryId: 'education', goalId: null, startedDate: null, completedDate: null, rating: null, notes: '' });
  const set = <K extends keyof A.LearningDraft>(k: K, v: A.LearningDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <>
      <Dialog
        open
        onOpenChange={(o) => !o && onClose()}
        title={item ? 'Edit' : 'Add learning or growth'}
        footer={
          <>
            {item && (
              <Button variant="ghost" className="mr-auto text-danger" onClick={() => setDel(true)}>
                Delete
              </Button>
            )}
            <Button
              disabled={!d.title.trim()}
              onClick={() =>
                A.saveLearning(d)
                  .then(() => {
                    toast('Saved');
                    onClose();
                  })
                  .catch((e) => toast(e.message, 'error'))
              }
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Type">
            <Segmented size="sm" value={d.type} onChange={(v) => setD((x) => ({ ...x, type: v, unit: TYPE[v].unit }))} options={TYPES.map((t) => ({ value: t.id, label: t.label }))} />
          </Field>
          <Field label="Title">
            <Input autoFocus value={d.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label={d.type === 'book' ? 'Author' : d.type === 'course' || d.type === 'qualification' ? 'Provider' : 'With / where'}>
            <Input value={d.creator} onChange={(e) => set('creator', e.target.value)} />
          </Field>
          <Field label="Status">
            <Segmented size="sm" value={d.status} onChange={(v) => set('status', v)} options={[{ value: 'planned', label: 'Planned' }, { value: 'active', label: 'In progress' }, { value: 'completed', label: 'Completed' }, { value: 'dropped', label: 'Dropped' }]} />
          </Field>
          {d.type !== 'experience' && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Progress">
                <NumberField min={0} value={d.progress} onChange={(e) => set('progress', Number(e.target.value))} />
              </Field>
              <Field label="Out of">
                <NumberField min={0} value={d.total ?? ''} onChange={(e) => set('total', e.target.value ? Number(e.target.value) : null)} />
              </Field>
              <Field label="Unit">
                <Input value={d.unit} onChange={(e) => set('unit', e.target.value)} />
              </Field>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Life area">
              <Select value={d.categoryId ?? NONE} onValueChange={(v) => set('categoryId', v === NONE ? null : v)} options={[{ value: NONE, label: 'None' }, ...s.categories.filter((c) => !c.archived).map((c) => ({ value: c.id, label: c.name }))]} />
            </Field>
            <Field label="Supports goal">
              <Select value={d.goalId ?? NONE} onValueChange={(v) => set('goalId', v === NONE ? null : v)} options={[{ value: NONE, label: 'None' }, ...liveGoals(s).map((g) => ({ value: g.id, label: g.title }))]} />
            </Field>
          </div>
          {d.status === 'completed' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Completed on">
                <Input type="date" max={s.today} value={d.completedDate ?? s.today} onChange={(e) => set('completedDate', e.target.value || null)} />
              </Field>
              <Field label="Rating">
                <Segmented size="sm" value={d.rating} onChange={(v) => set('rating', v)} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}★` }))} />
              </Field>
            </div>
          )}
          <Field label="Notes & key takeaways">
            <Textarea rows={4} value={d.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
      </Dialog>
      {item && <Confirm open={del} onOpenChange={setDel} title="Delete this item?" body="Logged learning time is kept but unlinked." onConfirm={() => A.deleteLearning(item.id).then(onClose)} />}
    </>
  );
}

const JOURNAL_FIELDS = [
  { k: 'reflection', label: 'Daily reflection', ph: 'How did today go?' },
  { k: 'accomplishments', label: 'Accomplishments', ph: 'What did you get done or feel proud of?' },
  { k: 'challenges', label: 'Challenges', ph: 'What was hard or got in the way?' },
  { k: 'lessons', label: 'Lessons learned', ph: 'What would you tell yourself?' },
  { k: 'improvements', label: 'Future improvements', ph: 'What will you do differently?' },
] as const;

function Journal() {
  const { s } = useStore();
  const toast = useToast();
  const [date, setDate] = useState<DateStr>(s.today);
  const entry = s.journal.get(date);
  const [form, setForm] = useState<Record<string, string>>({});
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  useEffect(() => {
    setForm(Object.fromEntries(JOURNAL_FIELDS.map((f) => [f.k, entry?.[f.k] ?? ''])));
    setMood(entry?.mood ?? null);
    setEnergy(entry?.energy ?? null);
  }, [date, entry]);
  const past = [...s.journal.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
      <Panel title="Journal" subtitle={entry ? `Last saved ${new Date(entry.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Private, stored on this device'} action={<Input type="date" max={s.today} className="h-8 w-36 text-xs" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Journal date" />}>
        <div className="space-y-4">
          {JOURNAL_FIELDS.map((f) => (
            <Field key={f.k} label={f.label}>
              <Textarea rows={f.k === 'reflection' ? 4 : 2} value={form[f.k] ?? ''} placeholder={f.ph} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} />
            </Field>
          ))}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Mood">
              <Segmented size="sm" value={mood} onChange={setMood} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} />
            </Field>
            <Field label="Energy">
              <Segmented size="sm" value={energy} onChange={setEnergy} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} />
            </Field>
          </div>
          <Button onClick={() => A.saveJournal(date, { ...(form as Record<(typeof JOURNAL_FIELDS)[number]['k'], string>), mood, energy }).then(() => toast('Journal saved')).catch((e) => toast(e.message, 'error'))}>Save entry</Button>
        </div>
      </Panel>
      <Panel title="Past entries">
        {past.length === 0 ? (
          <p className="text-[13px] text-fg-3">No entries yet.</p>
        ) : (
          <ul className="-mx-2">
            {past.map((j) => (
              <li key={j.date}>
                <button onClick={() => setDate(j.date)} className={cn('w-full text-left rounded-lg px-2 py-2 hover:bg-surface-2', j.date === date && 'bg-surface-2')}>
                  <span className="text-xs font-medium text-fg-2">{new Date(`${j.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span className="block text-[13px] text-fg-3 truncate">{j.reflection || j.accomplishments || j.lessons || '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 && <p className="text-[11px] text-fg-3 mt-2">{[...s.journal.values()].filter((j) => j.date >= addDays(s.today, -6)).length} of the last 7 days journaled.</p>}
      </Panel>
    </div>
  );
}

function Timeline() {
  const { s } = useStore();
  const items: { date: DateStr; kind: string; title: string; sub?: string }[] = [];
  for (const g of s.goals) if (g.status === 'completed' && g.completedDate) items.push({ date: g.completedDate, kind: 'Goal achieved', title: g.title });
  for (const m of s.milestones) if (m.done && m.completedDate) items.push({ date: m.completedDate, kind: 'Milestone', title: m.title, sub: s.goalById.get(m.goalId)?.title });
  for (const l of s.learning) if (l.status === 'completed' && l.completedDate) items.push({ date: l.completedDate, kind: `${TYPE[l.type].label} completed`, title: l.title, sub: l.creator || undefined });
  for (const a of s.achievements.values()) {
    const d = ACHIEVEMENT_BY_ID[a.id];
    if (d) items.push({ date: a.date, kind: 'Achievement', title: d.name, sub: d.description });
  }
  items.sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Card className="p-4">
      {items.length === 0 ? (
        <EmptyState icon={<Trophy size={18} />} title="Your accomplishments will appear here" body="Achieved goals, milestones, completed courses and books, qualifications and achievements, all in one record." />
      ) : (
        <ol className="relative border-l border-line ml-2">
          {items.map((i, k) => (
            <li key={k} className="ml-4 pb-4 last:pb-0">
              <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-accent border-2 border-surface" />
              <p className="text-[11px] text-fg-3">
                {fmtShort(i.date)} {i.date.slice(0, 4)} · {i.kind}
              </p>
              <p className="text-[14px] font-medium">{i.title}</p>
              {i.sub && <p className="text-xs text-fg-3">{i.sub}</p>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
