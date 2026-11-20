import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, Plus, Target } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Snapshot } from '@/lib/snapshot';
import type { Goal, GoalStatus } from '@/lib/types';
import { childrenOf, goalPace, goalProgress, HORIZON_BY_ID, nextMilestone, PACE_COLOR } from '@/lib/goals';
import { cn } from '@/lib/cn';
import { Page, PageHeader } from '@/components/layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CategoryDot, EmptyState, pct, Progress } from '@/components/Visuals';
import { GoalEditor } from '@/components/editors/GoalEditor';
import { Icon } from '@/components/Icon';

type View = 'tree' | 'area';
const STATUS: { id: GoalStatus | 'all'; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'completed', label: 'Achieved' },
  { id: 'archived', label: 'Archived' },
];

export default function Goals() {
  const { s } = useStore();
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'area' ? 'area' : 'tree';
  const status = (params.get('status') as GoalStatus) || 'active';
  const [adding, setAdding] = useState(false);
  const goals = s.goals.filter((g) => g.status === status);
  const setP = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Goals"
        subtitle="Vision → annual → quarterly → monthly → weekly → daily tasks"
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={15} /> New goal
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex gap-1">
            {STATUS.map((st) => (
              <button key={st.id} onClick={() => setP('status', st.id === 'active' ? null : st.id)} className={cn('h-8 px-3 rounded-lg text-[13px] font-medium', status === st.id ? 'bg-fg text-bg' : 'text-fg-2 hover:bg-surface-2')}>
                {st.label}
                <span className="ml-1.5 text-[11px] opacity-60 tnum">{s.goals.filter((g) => g.status === st.id).length}</span>
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-lg border border-line p-0.5 bg-surface-2 text-[12px] font-medium">
            {(['tree', 'area'] as View[]).map((v) => (
              <button key={v} onClick={() => setP('view', v === 'tree' ? null : v)} className={cn('h-7 px-2.5 rounded-md', view === v ? 'bg-surface text-fg shadow-[var(--shadow)]' : 'text-fg-3')}>
                {v === 'tree' ? 'Hierarchy' : 'By life area'}
              </button>
            ))}
          </div>
        </div>
      </PageHeader>
      <Page>
        {goals.length === 0 ? (
          <Card>
            <EmptyState icon={<Target size={18} />} title={status === 'active' ? 'No active goals' : 'Nothing here'} body={status === 'active' ? 'Start with one meaningful objective and break it into milestones.' : undefined} action={status === 'active' && <Button size="sm" onClick={() => setAdding(true)}>Set a goal</Button>} />
          </Card>
        ) : view === 'tree' ? (
          <Card className="p-2">
            {roots(s, goals).map((g) => (
              <TreeNode key={g.id} g={g} depth={0} status={status} />
            ))}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {s.categories
              .filter((c) => goals.some((g) => g.categoryId === c.id))
              .map((c) => (
                <Card key={c.id} className="p-2">
                  <div className="flex items-center gap-2 px-2 pt-2 pb-1">
                    <span className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${c.color}1f`, color: c.color }}>
                      <Icon name={c.icon} size={14} />
                    </span>
                    <h2 className="text-[13px] font-semibold">{c.name}</h2>
                  </div>
                  {goals
                    .filter((g) => g.categoryId === c.id)
                    .map((g) => (
                      <GoalLine key={g.id} g={g} />
                    ))}
                </Card>
              ))}
          </div>
        )}
      </Page>
      <GoalEditor open={adding} onOpenChange={setAdding} />
    </>
  );
}

/** Top of each visible branch: goals whose parent isn't in the current list. */
function roots(s: Snapshot, goals: Goal[]) {
  const ids = new Set(goals.map((g) => g.id));
  return goals.filter((g) => !g.parentId || !ids.has(g.parentId) || !s.goalById.get(g.parentId));
}

function TreeNode({ g, depth, status }: { g: Goal; depth: number; status: GoalStatus }) {
  const { s } = useStore();
  const kids = childrenOf(s, g.id).filter((k) => k.status === status);
  return (
    <div>
      <GoalLine g={g} depth={depth} />
      {kids.length > 0 && (
        <div className="relative">
          <span className="absolute top-0 bottom-3 border-l border-line" style={{ left: 18 + depth * 20 }} aria-hidden />
          {kids.map((k) => (
            <TreeNode key={k.id} g={k} depth={depth + 1} status={status} />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalLine({ g, depth = 0 }: { g: Goal; depth?: number }) {
  const { s } = useStore();
  const p = goalProgress(s, g);
  const pace = goalPace(s, g);
  const nm = nextMilestone(s, g);
  const cat = s.categoryById.get(g.categoryId);
  return (
    <Link to={`/goals/${g.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-2" style={{ paddingLeft: 8 + depth * 20 }}>
      <CategoryDot cat={cat} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Badge>{HORIZON_BY_ID[g.horizon].short}</Badge>
          <span className={cn('text-[14px] text-fg truncate', g.horizon === 'vision' ? 'font-semibold' : 'font-medium')}>{g.title}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <Progress className="flex-1 max-w-64" height={4} value={p.value} color={cat?.color} marker={pace.expected} />
          <span className="text-xs tnum font-medium w-9 text-right">{pct(p.value)}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-fg-3">
          <span style={{ color: PACE_COLOR[pace.status] }}>{pace.label}</span>
          {g.targetDate && <span>By {new Date(`${g.targetDate}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
          {nm && <span className="truncate max-w-[240px]">Next: {nm.title}</span>}
        </div>
      </div>
      <ChevronRight size={15} className="text-fg-3 shrink-0" />
    </Link>
  );
}
