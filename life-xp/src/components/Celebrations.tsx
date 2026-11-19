import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Swords } from 'lucide-react';
import { onCelebrate, vibrate, type Celebration } from '@/lib/celebrate';
import { Medal } from './game';
import { Button } from './ui/Button';
import { useToast } from './ui/Toaster';

type Modal = Extract<Celebration, { kind: 'level' } | { kind: 'achievement' }>;

/** Listens to the engine's reward events and turns them into feedback the player can feel. */
export function Celebrations() {
  const toast = useToast();
  const [floats, setFloats] = useState<{ id: number; amount: number }[]>([]);
  const [queue, setQueue] = useState<Modal[]>([]);
  const idRef = useRef(0);

  useEffect(
    () =>
      onCelebrate((c) => {
        if (c.kind === 'xp') {
          const id = ++idRef.current;
          setFloats((f) => [...f.slice(-3), { id, amount: c.amount }]);
          setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1200);
          vibrate(12);
        } else if (c.kind === 'quest') {
          toast(`Quest complete: ${c.quest.title} · +${c.quest.xp} XP`, 'xp');
          vibrate([20, 40, 20]);
        } else if (c.kind === 'combo') {
          toast(`${c.label} · +${c.xp} XP`, 'xp');
        } else {
          setQueue((q) => (c.kind === 'level' ? [c, ...q] : [...q, c]));
          vibrate(c.kind === 'level' ? [40, 60, 40, 60, 120] : [30, 50, 30]);
        }
      }),
    [toast],
  );

  const current = queue[0];
  const close = () => setQueue((q) => q.slice(1));

  return (
    <>
      <div className="fixed left-1/2 bottom-28 z-[90] pointer-events-none" aria-live="polite">
        {floats.map((f) => (
          <div key={f.id} className="absolute left-0 animate-float-up whitespace-nowrap text-2xl font-black text-gradient-xp drop-shadow-[0_0_12px_rgba(255,200,69,0.6)]">
            +{f.amount} XP
          </div>
        ))}
      </div>
      {current?.kind === 'level' && <LevelUp c={current} onClose={close} />}
      {current?.kind === 'achievement' && <AchievementUnlocked c={current} onClose={close} />}
    </>
  );
}

function Confetti({ count = 36 }: { count?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 1.6 + Math.random() * 1.4,
        color: ['#3fe3ff', '#a47bff', '#ffc845', '#ff5fa2', '#3ee8a4'][i % 5],
        rot: Math.random() * 360,
        w: 6 + Math.random() * 6,
      })),
    [count],
  );
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <style>{`@keyframes confetti-fall { 0% { transform: translateY(-20vh) rotate(0deg); opacity: 1 } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0.6 } }`}</style>
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-sm"
          style={{ left: `${b.left}%`, width: b.w, height: b.w * 0.45, background: b.color, transform: `rotate(${b.rot}deg)`, animation: `confetti-fall ${b.dur}s ${b.delay}s cubic-bezier(0.3, 0.6, 0.5, 1) forwards` }}
        />
      ))}
    </div>
  );
}

function LevelUp({ c, onClose }: { c: Extract<Celebration, { kind: 'level' }>; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-base-950/90 backdrop-blur-md animate-fade-in px-6" role="dialog" aria-label={`Level ${c.level} reached`}>
      <Confetti />
      <div className="relative w-full max-w-sm text-center">
        <div className="relative mx-auto h-44 w-44 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full border-4 border-accent/60 animate-burst" />
          <span className="absolute inset-0 rounded-full border-2 border-violet/60 animate-burst" style={{ animationDelay: '0.25s' }} />
          <div className="absolute inset-3 rounded-full animate-spin-slow" style={{ background: 'conic-gradient(from 0deg, #3fe3ff, #a47bff, #ff5fa2, #ffc845, #3fe3ff)', filter: 'blur(18px)', opacity: 0.55 }} />
          <div className="relative h-32 w-32 rounded-full bg-base-900 border border-base-700 flex flex-col items-center justify-center animate-pop">
            <span className="text-[11px] font-bold tracking-[0.25em] text-base-300">LEVEL</span>
            <span className="text-6xl font-black tabular-nums text-base-50 leading-none">{c.level}</span>
          </div>
        </div>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-base-50 animate-slide-up">LEVEL UP!</h2>
        <p className="text-accent font-bold mt-1">Rank: {c.title}</p>
        {c.unlocks.length > 0 && (
          <div className="mt-5 rounded-2xl bg-base-900/80 border border-base-700 p-4 text-left animate-slide-up">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-xp mb-2">Unlocked</p>
            <ul className="space-y-1.5">
              {c.unlocks.flatMap((u) => u.lines).map((l) => (
                <li key={l} className="flex gap-2 text-sm text-base-100">
                  <Sparkles size={15} className="text-xp shrink-0 mt-0.5" />
                  {l}
                </li>
              ))}
            </ul>
            <p className="text-xs text-base-400 mt-3">New habits are offered, never added. You choose what to take on.</p>
          </div>
        )}
        <Button size="lg" className="w-full mt-6" onClick={onClose} autoFocus>
          Let's go
        </Button>
      </div>
    </div>
  );
}

function AchievementUnlocked({ c, onClose }: { c: Extract<Celebration, { kind: 'achievement' }>; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-base-950/85 backdrop-blur-md animate-fade-in px-6" role="dialog" aria-label={`Achievement unlocked: ${c.def.name}`}>
      <Confetti count={20} />
      <div className="relative w-full max-w-sm text-center rounded-3xl bg-base-900 border border-base-700 p-6 animate-pop">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-xp">Achievement unlocked</p>
        <div className="my-5 flex justify-center">
          <Medal def={c.def} unlocked size={96} />
        </div>
        <h2 className="text-2xl font-black text-base-50">{c.def.name}</h2>
        <p className="text-sm text-base-300 mt-1">{c.def.description}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {c.def.xp > 0 && <span className="rounded-full bg-xp/15 text-xp px-3 py-1 text-sm font-extrabold">+{c.def.xp} XP</span>}
          {c.def.title && (
            <span className="rounded-full bg-violet/15 text-violet px-3 py-1 text-sm font-bold inline-flex items-center gap-1">
              <Swords size={14} /> Title: {c.def.title}
            </span>
          )}
        </div>
        <Button className="w-full mt-6" onClick={onClose} autoFocus>
          Awesome
        </Button>
      </div>
    </div>
  );
}
