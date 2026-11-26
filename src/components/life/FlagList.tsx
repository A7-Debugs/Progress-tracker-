import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toaster';
import { HABIT_BY_ID, HABITS, habitCap, habitState, isUnlocked, statusPatch } from '@/lib/life/habits';
import type { LifeContext } from '@/lib/life/engine';
import type { Flag } from '@/lib/life/insights';

/** System-check flags with a one-tap fix (e.g. turn a switched-off habit back on). */
export function FlagList({ ctx, flags }: { ctx: LifeContext; flags: Flag[] }) {
  const toast = useToast();
  const navigate = useNavigate();
  async function act(f: Flag) {
    const a = f.action!;
    if (a.to) return navigate(a.to);
    if (!a.restore) return;
    const { profile, today } = ctx;
    const scored = HABITS.filter((h) => (h.custom || isUnlocked(h, profile.level, profile)) && ['active', 'upcoming'].includes(habitState(profile, h, today))).length;
    if (scored >= habitCap(profile.level)) {
      toast(`You're at ${habitCap(profile.level)} scored habits — swap one out under Edit habits first`, 'warn');
      return navigate('/system');
    }
    await db.lifeProfile.update('life', statusPatch(profile, a.restore, 'active', today));
    toast(`${HABIT_BY_ID.get(a.restore)?.name ?? 'Habit'} is back on from today`);
  }
  return (
    <div className="flex flex-col gap-2.5">
      {flags.map((f) => (
        <div key={f.title}>
          <p className="text-sm font-semibold text-base-50">{f.title}</p>
          <p className="text-xs text-base-400 leading-relaxed">{f.body}</p>
          {f.action && (
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => act(f)}>
              {f.action.label}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
