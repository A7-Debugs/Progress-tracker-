import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, Clock, GitMerge, Scissors, Trash2, Undo2 } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toaster';
import { deleteSession, findIssues, mergeExercises, mergeSessions, restoreOrphan, trimSession } from '@/lib/cleanup';

export default function Cleanup() {
  const toast = useToast();
  const issues = useLiveQuery(() => findIssues(), []);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('cleanup-dismissed') ?? '[]');
    } catch {
      return [];
    }
  });
  if (!issues) return null;
  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
  const dismiss = (k: string) => {
    const next = [...dismissed, k];
    setDismissed(next);
    try {
      localStorage.setItem('cleanup-dismissed', JSON.stringify(next));
    } catch {
      /* per-device convenience only */
    }
  };
  const { sessionIssues, orphans } = issues;
  const duplicates = issues.duplicates.filter((d) => !dismissed.includes(pairKey(d.a.id, d.b.id)));
  const total = sessionIssues.length + duplicates.length + orphans.length;
  const day = (d: string) => format(parseISO(d), 'EEE d MMM');

  async function run(fn: () => Promise<void>, msg: string) {
    await fn();
    toast(msg);
  }

  return (
    <div className="animate-fade-in">
      <TopBar title="Data clean-up" back />
      <div className="px-4 pt-3 pb-24 flex flex-col gap-3">
        <p className="text-xs text-base-400">
          Problems that split or distort your history. Nothing changes until you tap a fix. Export a backup first (Settings) if you want an undo.
        </p>

        {total === 0 && (
          <Card className="p-5 flex items-center gap-3">
            <CheckCircle2 className="text-accent" size={20} />
            <p className="text-sm text-base-100">All clear — no duplicate exercises, orphaned history or broken sessions.</p>
          </Card>
        )}

        {sessionIssues.length > 0 && <Section title={`Sessions (${sessionIssues.length})`} />}
        {sessionIssues.map((i) => (
          <Card key={i.kind + i.session.id + (i.other?.id ?? '')} className="p-4">
            <div className="flex items-start gap-2.5">
              {i.kind === 'long' ? <Clock size={16} className="text-warn mt-0.5" /> : i.kind === 'split' ? <GitMerge size={16} className="text-info mt-0.5" /> : <Trash2 size={16} className="text-base-400 mt-0.5" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-base-50">
                  {i.kind === 'long' ? 'Session left running' : i.kind === 'split' ? 'One workout split in two' : 'Near-empty session'} · {day(i.session.date)}
                </p>
                <p className="text-xs text-base-400">
                  {i.session.workoutName} — {i.detail}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              {i.kind === 'long' && (
                <Button size="sm" onClick={() => run(() => trimSession(i.session.id), 'End time set to last set + 5 min')}>
                  <Scissors size={14} /> End at last set
                </Button>
              )}
              {i.kind === 'split' && (
                <Button size="sm" onClick={() => run(() => mergeSessions(i.session.id, i.other!.id), 'Sessions merged')}>
                  <GitMerge size={14} /> Merge sessions
                </Button>
              )}
              {i.kind === 'nearEmpty' && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => confirm('Delete this session and its sets?') && run(() => deleteSession(i.session.id), 'Session deleted')}
                >
                  <Trash2 size={14} /> Delete
                </Button>
              )}
            </div>
          </Card>
        ))}

        {duplicates.length > 0 && <Section title={`Possible duplicate exercises (${duplicates.length})`} />}
        {duplicates.map((d) => (
          <Card key={d.a.id + d.b.id} className="p-4">
            <p className="text-sm font-semibold text-base-50">
              {d.a.name} <span className="text-base-500 font-normal">({d.aSets} sets)</span> &amp; {d.b.name} <span className="text-base-500 font-normal">({d.bSets} sets)</span>
            </p>
            <p className="text-xs text-base-400 mt-0.5">If these are the same movement, merge them so progress is tracked in one place. Different movements? Ignore this.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => confirm(`Merge "${d.b.name}" into "${d.a.name}"?`) && run(() => mergeExercises(d.b.id, d.a.id), `Merged into ${d.a.name}`)}
              >
                Keep “{d.a.name}”
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => confirm(`Merge "${d.a.name}" into "${d.b.name}"?`) && run(() => mergeExercises(d.a.id, d.b.id), `Merged into ${d.b.name}`)}
              >
                Keep “{d.b.name}”
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dismiss(pairKey(d.a.id, d.b.id))}>
                Not the same
              </Button>
            </div>
          </Card>
        ))}

        {orphans.length > 0 && <Section title={`Orphaned history (${orphans.length})`} />}
        {orphans.map((o) => (
          <Card key={o.exerciseDefId} className="p-4">
            <p className="text-sm font-semibold text-base-50">“{o.name}” — {o.sets} logged sets with no exercise</p>
            <p className="text-xs text-base-400 mt-0.5">The exercise was deleted but its history wasn't. Restore it to see these sets again (you can then merge it into another exercise).</p>
            <Button size="sm" className="mt-3" onClick={() => run(() => restoreOrphan(o), `${o.name} restored`)}>
              <Undo2 size={14} /> Restore exercise
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-base-500 mt-2">{title}</p>;
}
