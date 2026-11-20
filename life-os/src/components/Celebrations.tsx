import { useEffect, useRef, useState } from 'react';
import { Award, TrendingUp } from 'lucide-react';
import { onCelebrate, vibrate, type Celebration } from '@/lib/celebrate';
import { Button } from './ui/Button';
import { Icon } from './Icon';

type Modal = Extract<Celebration, { kind: 'level' } | { kind: 'achievement' }>;

/** Subtle reward feedback: a small XP float, and a restrained card for level-ups and achievements. */
export function Celebrations() {
  const [floats, setFloats] = useState<{ id: number; amount: number }[]>([]);
  const [queue, setQueue] = useState<Modal[]>([]);
  const idRef = useRef(0);
  useEffect(
    () =>
      onCelebrate((c) => {
        if (c.kind === 'xp') {
          const id = ++idRef.current;
          setFloats((f) => [...f.slice(-2), { id, amount: c.amount }]);
          setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1300);
          vibrate(8);
        } else {
          setQueue((q) => (c.kind === 'level' ? [c, ...q] : [...q, c]));
          vibrate([20, 40, 20]);
        }
      }),
    [],
  );
  const current = queue[0];
  const close = () => setQueue((q) => q.slice(1));
  return (
    <>
      <div className="fixed left-1/2 top-16 z-[90] pointer-events-none" aria-live="polite">
        {floats.map((f) => (
          <div key={f.id} className="absolute left-0 animate-float-up whitespace-nowrap rounded-full bg-surface border border-line px-2.5 py-1 text-[13px] font-semibold text-xp tnum shadow-[var(--shadow-lg)]">
            +{f.amount} XP
          </div>
        ))}
      </div>
      {current && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in px-6" role="dialog" aria-label={current.kind === 'level' ? `Level ${current.level} reached` : `Achievement unlocked: ${current.def.name}`}>
          <div className="w-full max-w-xs rounded-2xl bg-surface border border-line p-6 text-center shadow-[var(--shadow-lg)] animate-pop">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
              {current.kind === 'level' ? <TrendingUp size={26} /> : <Icon name={current.def.icon} size={26} />}
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-fg-3">{current.kind === 'level' ? 'Level up' : 'Achievement unlocked'}</p>
            <h2 className="mt-1 text-xl font-semibold text-fg">{current.kind === 'level' ? `Level ${current.level}` : current.def.name}</h2>
            <p className="mt-1 text-[13px] text-fg-2">{current.kind === 'level' ? `Stage: ${current.stage}. Consistency compounds.` : current.def.description}</p>
            {current.kind === 'achievement' && current.def.xp > 0 && (
              <p className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-xp">
                <Award size={14} /> +{current.def.xp} XP
              </p>
            )}
            <Button className="w-full mt-5" onClick={close} autoFocus>
              Continue
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
