import { Compass, Moon, Pause, Sprout, TrendingUp, X } from 'lucide-react';
import type { CoachAdvice } from '@/lib/coach';
import { adoptTemplate, archiveHabit, dismissCoach, updateSettings } from '@/lib/actions';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';
import { Button } from './ui/Button';
import { useToast } from './ui/Toaster';

const STYLE: Record<CoachAdvice['kind'], { color: string; icon: typeof Compass }> = {
  welcome: { color: '#3fe3ff', icon: Compass },
  grow: { color: '#3ee8a4', icon: Sprout },
  maintain: { color: '#6ea8fe', icon: TrendingUp },
  simplify: { color: '#ffb454', icon: Pause },
  sleep: { color: '#7b8cff', icon: Moon },
  'study-up': { color: '#a47bff', icon: TrendingUp },
  'study-ease': { color: '#ffb454', icon: Pause },
};

export function CoachCard({ advice, className }: { advice: CoachAdvice; className?: string }) {
  const toast = useToast();
  const st = STYLE[advice.kind];
  const Ico = st.icon;
  const done = () => dismissCoach(advice.key);
  return (
    <section className={cn('relative rounded-2xl border p-3.5', className)} style={{ borderColor: `${st.color}55`, background: `linear-gradient(135deg, ${st.color}14, transparent)` }}>
      <button onClick={done} className="absolute top-2 right-2 h-8 w-8 flex items-center justify-center rounded-lg text-base-400" aria-label="Dismiss coach tip">
        <X size={16} />
      </button>
      <div className="flex gap-3 pr-6">
        <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${st.color}22`, color: st.color }}>
          <Ico size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: st.color }}>
            Coach
          </p>
          <p className="font-bold text-base-50 text-[15px] leading-snug">{advice.headline}</p>
          <p className="text-xs text-base-300 mt-1 leading-relaxed">{advice.body}</p>
        </div>
      </div>
      {advice.habitOptions && (
        <div className="mt-3 grid gap-2">
          {advice.habitOptions.map((t) => (
            <button
              key={t.id}
              onClick={async () => {
                await adoptTemplate(t.id);
                await done();
                toast(`Added: ${t.name}`);
              }}
              className="flex items-center gap-2.5 rounded-xl bg-base-900 border border-base-700 px-3 py-2 text-left active:scale-[0.98]"
            >
              <Icon name={t.icon} size={18} className="text-mint" />
              <span className="flex-1 text-sm font-semibold text-base-100">{t.name}</span>
              <span className="text-[11px] font-bold text-xp">+{t.xp} XP</span>
            </button>
          ))}
        </div>
      )}
      {advice.pauseHabit && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={async () => {
            await archiveHabit(advice.pauseHabit!.id);
            await done();
            toast(`Paused "${advice.pauseHabit!.name}". Bring it back any time.`, 'info');
          }}
        >
          Pause "{advice.pauseHabit.name}"
        </Button>
      )}
      {advice.stepUp && (
        <Button
          size="sm"
          className="mt-3"
          onClick={async () => {
            await updateSettings({ revisionPerWeek: advice.stepUp!.perWeek, revisionMinutes: advice.stepUp!.minutes });
            await done();
            toast('New revision target set');
          }}
        >
          Try {advice.stepUp.perWeek} × {advice.stepUp.minutes} min
        </Button>
      )}
      {advice.stepDown && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={async () => {
            await updateSettings({ revisionPerWeek: advice.stepDown!.perWeek });
            await done();
            toast('Revision target lowered. Nice and sustainable.', 'info');
          }}
        >
          Lower to {advice.stepDown.perWeek} sessions a week
        </Button>
      )}
    </section>
  );
}
