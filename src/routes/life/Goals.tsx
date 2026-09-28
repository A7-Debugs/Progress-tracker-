import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { newId } from '@/lib/id';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { scoreColor } from '@/components/life/colors';
import { useLife } from '@/lib/life/useLife';
import { DOMAIN_LABELS, HABITS } from '@/lib/life/habits';
import { TIER_LABELS, TIER_ORDER } from '@/lib/life/defaults';
import { habitStreaks, scheduleOn, weekStartOf } from '@/lib/life/engine';
import type { Domain, GoalNode, GoalTier } from '@/lib/life/types';

export default function Goals() {
  const ctx = useLife();
  const [editing, setEditing] = useState<GoalNode | null>(null);
  if (!ctx) return null;
  const goals = ctx.profile.goals;
  const focus = ctx.planByWeek.get(weekStartOf(ctx.today))?.focus;

  const save = (nodes: GoalNode[]) => db.lifeProfile.update('life', { goals: nodes });

  async function upsert(node: GoalNode) {
    const exists = goals.some((g) => g.id === node.id);
    await save(exists ? goals.map((g) => (g.id === node.id ? node : g)) : [...goals, node]);
    setEditing(null);
  }

  async function remove(node: GoalNode) {
    const linked = HABITS.filter((h) => h.goalLink === node.id);
    const warn = linked.length ? `\n\n${linked.map((h) => h.name).join(', ')} will no longer be linked to a goal (the quarterly review will flag this).` : '';
    if (!confirm(`Delete "${node.title}"? Its children move up to its parent.${warn}`)) return;
    await save(goals.filter((g) => g.id !== node.id).map((g) => (g.parentId === node.id ? { ...g, parentId: node.parentId } : g)));
  }

  const parentTitle = (id: string | null) => goals.find((g) => g.id === id)?.title;

  return (
    <div className="animate-fade-in">
      <TopBar title="Goal tree" back />
      <div className="px-4 pt-3 pb-24 flex flex-col gap-1">
        <p className="text-xs text-base-400 mb-2">
          Every daily habit should connect upward. If a habit doesn't serve anything here, question whether it deserves to stay. Tap any goal to edit it.
        </p>
        {TIER_ORDER.map((tier, ti) => {
          const nodes = goals.filter((g) => g.tier === tier);
          return (
            <div key={tier} className="relative">
              {ti > 0 && <div className="flex justify-center text-base-600 text-xs -my-0.5">↓</div>}
              <div className="flex items-center justify-between mt-1 mb-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-base-500">{TIER_LABELS[tier]}</p>
                <button
                  className="text-xs text-accent flex items-center gap-0.5"
                  onClick={() => setEditing({ id: newId(), tier, title: '', parentId: defaultParent(goals, tier), domain: null })}
                >
                  <Plus size={12} /> Add
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {tier === 'week' && focus && (
                  <Card className="p-3.5 border-accent/30">
                    <p className="text-[11px] text-accent font-semibold">This week's ONE priority (from Sunday review)</p>
                    <p className="text-sm text-base-100 mt-0.5">{focus}</p>
                  </Card>
                )}
                {nodes.map((g) => {
                  const habits = HABITS.filter((h) => h.goalLink === g.id);
                  return (
                    <Card key={g.id} className="p-3.5">
                      <div className="flex items-start gap-2">
                        <button className="flex-1 text-left min-w-0" onClick={() => setEditing(g)}>
                          <p className="text-sm text-base-50 leading-snug">{g.title}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {g.domain && <Badge>{DOMAIN_LABELS[g.domain]}</Badge>}
                            {g.parentId && <span className="text-[10px] text-base-500 truncate max-w-[220px]">↑ {parentTitle(g.parentId)}</span>}
                          </div>
                        </button>
                        <button onClick={() => setEditing(g)} className="h-7 w-7 flex items-center justify-center text-base-500 hover:text-base-100 shrink-0" aria-label="Edit">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => remove(g)} className="h-7 w-7 flex items-center justify-center text-base-500 hover:text-danger shrink-0" aria-label="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {habits.length > 0 && (
                        <div className="mt-2.5 pt-2.5 border-t border-base-800 flex flex-col gap-1">
                          {habits.map((h) => {
                            const active = !!scheduleOn(ctx, h, ctx.today);
                            const c30 = active ? habitStreaks(ctx, h).c30 : null;
                            return (
                              <div key={h.id} className="flex items-center justify-between text-xs">
                                <span className={active ? 'text-base-200' : 'text-base-500'}>
                                  ↳ {h.name}
                                  {!active && ` (unlocks L${h.unlock})`}
                                </span>
                                {active && (
                                  <span className="tabular-nums font-semibold" style={{ color: scoreColor(c30 === null ? null : c30 * 100) }}>
                                    {c30 === null ? '—' : `${Math.round(c30 * 100)}%`} 30d
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="flex justify-center text-base-600 text-xs">↓</div>
        <p className="text-xs font-semibold uppercase tracking-wide text-base-500 mb-1.5">Daily habits</p>
        <Card className="p-3.5 text-xs text-base-300">
          {HABITS.filter((h) => scheduleOn(ctx, h, ctx.today))
            .map((h) => h.name)
            .join(' · ')}
        </Card>
      </div>

      {editing && <GoalDialog node={editing} goals={goals} onClose={() => setEditing(null)} onSave={upsert} />}
    </div>
  );
}

function defaultParent(goals: GoalNode[], tier: GoalTier): string | null {
  const idx = TIER_ORDER.indexOf(tier);
  if (idx === 0) return null;
  return goals.find((g) => g.tier === TIER_ORDER[idx - 1])?.id ?? null;
}

function GoalDialog({ node, goals, onClose, onSave }: { node: GoalNode; goals: GoalNode[]; onClose: () => void; onSave: (n: GoalNode) => void }) {
  const [n, setN] = useState(node);
  const idx = TIER_ORDER.indexOf(n.tier);
  const parents = goals.filter((g) => TIER_ORDER.indexOf(g.tier) < idx && g.id !== n.id);
  const domains = Object.keys(DOMAIN_LABELS) as Domain[];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={TIER_LABELS[n.tier]}>
      <div className="flex flex-col gap-3">
        <Textarea rows={3} autoFocus value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} placeholder="Specific and measurable where possible" />
        {idx > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-base-400">Serves (parent goal)</label>
            <select
              value={n.parentId ?? ''}
              onChange={(e) => setN({ ...n, parentId: e.target.value || null })}
              className="h-11 rounded-xl bg-base-850 border border-base-700 px-3 text-sm text-base-50"
            >
              <option value="">— none —</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {TIER_LABELS[p.tier].split(' ')[0]}: {p.title.slice(0, 60)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {domains.map((d) => (
            <button
              key={d}
              onClick={() => setN({ ...n, domain: n.domain === d ? null : d })}
              className={`h-7 px-2.5 rounded-lg text-xs border ${n.domain === d ? 'bg-accent text-base-950 border-accent' : 'bg-base-850 text-base-300 border-base-700'}`}
            >
              {DOMAIN_LABELS[d]}
            </button>
          ))}
        </div>
        <Button onClick={() => onSave(n)} disabled={!n.title.trim()}>
          Save
        </Button>
      </div>
    </Dialog>
  );
}
