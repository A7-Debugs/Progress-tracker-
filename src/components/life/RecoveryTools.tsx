import { Card } from '@/components/ui/Card';

/** Huberman-style recovery prompts: physiological sigh when stress is high, NSDR on low-energy or sick days. */
export function RecoveryTools({ energy, stress, sick }: { energy: number | null; stress: number | null; sick: boolean }) {
  const nsdr = sick || (energy != null && energy <= 2);
  const sigh = stress != null && stress >= 4;
  if (!nsdr && !sigh) return null;
  return (
    <Card className="p-4 border-info/30 flex flex-col gap-3">
      {sigh && (
        <div>
          <p className="text-sm font-semibold text-base-50">Physiological sigh (1 minute)</p>
          <p className="text-xs text-base-400 mt-0.5 leading-relaxed">
            Two inhales through the nose (a full breath, then a short top-up), then one long, slow exhale through the mouth. Repeat 1–3 times, or for 5 minutes. In a 2023 Stanford study (Balban et al.) daily cyclic sighing improved mood more than mindfulness meditation.
          </p>
        </div>
      )}
      {nsdr && (
        <div>
          <p className="text-sm font-semibold text-base-50">NSDR / Yoga Nidra (10–20 minutes)</p>
          <p className="text-xs text-base-400 mt-0.5 leading-relaxed">
            Lie down and follow a guided Non-Sleep Deep Rest or Yoga Nidra recording (search “NSDR” on YouTube or Spotify). Huberman recommends it to restore energy and focus on low days without hurting night-time sleep. It counts as recovery, not as a missed habit.
          </p>
        </div>
      )}
    </Card>
  );
}
