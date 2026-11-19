import { useState } from 'react';
import { Check, ChevronRight, ShieldCheck } from 'lucide-react';
import { Avatar } from '@/components/game';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Field } from '@/components/ui/Chips';
import { useToast } from '@/components/ui/Toaster';
import { AVATAR_ICONS, PALETTES } from '@/lib/avatar';
import { CATEGORY_BY_ID, HABIT_LIBRARY } from '@/lib/habits';
import { SUGGESTED_SUBJECTS } from '@/lib/academy/academy';
import { completeOnboarding } from '@/lib/actions';
import { fmtDuration, sleepMinutes } from '@/lib/dates';
import { cn } from '@/lib/cn';

const STEPS = ['welcome', 'player', 'habits', 'sleep', 'subjects'] as const;

export default function Onboarding() {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState('');
  const [icon, setIcon] = useState('Gamepad2');
  const [palette, setPalette] = useState('cyber');
  const [habits, setHabits] = useState<string[]>(HABIT_LIBRARY.filter((h) => h.starter).map((h) => h.id));
  const [wake, setWake] = useState('07:00');
  const [bed, setBed] = useState('21:45');
  const [subjects, setSubjects] = useState<string[]>(['Mathematics', 'English Language', 'Combined Science']);
  const [busy, setBusy] = useState(false);
  const starters = HABIT_LIBRARY.filter((h) => h.tier === 1);
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const name = STEPS[step];
  const win = sleepMinutes(bed, wake);

  const finish = async () => {
    setBusy(true);
    try {
      await completeOnboarding({ nickname, avatar: { icon, palette, frame: 'ring' }, templateIds: habits, wakeTarget: wake, bedTarget: bed, subjects });
    } catch (e) {
      toast((e as Error).message, 'warn');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col safe-top safe-bottom">
      <div className="mx-auto w-full max-w-lg flex-1 flex flex-col px-5 pt-6 pb-5">
        <div className="flex gap-1.5 mb-6" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i <= step ? 'bg-accent' : 'bg-base-800')} />
          ))}
        </div>

        <div className="flex-1 animate-slide-up" key={name}>
          {name === 'welcome' && (
            <div className="flex flex-col items-center text-center pt-6">
              <Avatar config={{ icon: 'Rocket', palette: 'cyber', frame: 'double' }} size={130} />
              <h1 className="text-4xl font-black tracking-tight mt-6">
                LIFE <span className="text-accent">XP</span>
              </h1>
              <p className="text-base-300 mt-2 max-w-xs">Level up your real life. Earn XP for habits, crush quests, unlock badges and build skills for your GCSEs.</p>
              <ul className="mt-6 space-y-2 text-left text-sm text-base-200">
                <li className="flex gap-2"><Check size={18} className="text-accent" /> Start small: about 6 habits</li>
                <li className="flex gap-2"><Check size={18} className="text-accent" /> Missed a day? You never lose XP</li>
                <li className="flex gap-2"><Check size={18} className="text-accent" /> New challenges unlock as you level up</li>
              </ul>
              <p className="mt-6 flex items-center gap-1.5 text-xs text-base-400"><ShieldCheck size={14} className="text-mint" /> Private: everything stays on this phone.</p>
            </div>
          )}

          {name === 'player' && (
            <div>
              <h2 className="text-2xl font-black">Create your player</h2>
              <p className="text-sm text-base-400 mt-1">No real name needed. More emblems unlock as you play.</p>
              <div className="flex justify-center my-6">
                <Avatar config={{ icon, palette, frame: 'ring' }} size={110} level={1} />
              </div>
              <Field label="Gamer tag (optional)">
                <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Nova" maxLength={20} />
              </Field>
              <p className="text-sm font-semibold text-base-200 mt-4 mb-1.5">Emblem</p>
              <div className="grid grid-cols-4 gap-2">
                {AVATAR_ICONS.filter((a) => a.level === 1).map((a) => (
                  <button key={a.id} onClick={() => setIcon(a.id)} className={cn('h-14 rounded-xl border flex flex-col items-center justify-center', icon === a.id ? 'border-accent bg-accent-bg text-accent' : 'border-base-700 bg-base-850 text-base-200')}>
                    <Icon name={a.id} size={22} />
                    <span className="text-[10px] mt-0.5">{a.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-sm font-semibold text-base-200 mt-4 mb-1.5">Colour</p>
              <div className="flex gap-2">
                {PALETTES.filter((p) => p.level === 1).map((p) => (
                  <button key={p.id} onClick={() => setPalette(p.id)} className={cn('h-10 w-16 rounded-xl border-2', palette === p.id ? 'border-base-50' : 'border-transparent')} style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }} aria-label={p.label} />
                ))}
                <span className="text-xs text-base-500 self-center">More at level 2</span>
              </div>
            </div>
          )}

          {name === 'habits' && (
            <div>
              <h2 className="text-2xl font-black">Pick your starting habits</h2>
              <p className="text-sm text-base-400 mt-1">5–7 is the sweet spot. You can add more later as they get easy.</p>
              <p className={cn('text-sm font-bold mt-3', habits.length >= 3 && habits.length <= 8 ? 'text-accent' : 'text-warn')}>
                {habits.length} selected {habits.length > 8 ? '· that might be a lot to start with' : habits.length < 3 ? '· pick at least 3' : ''}
              </p>
              <div className="mt-3 space-y-2">
                {starters.map((t) => {
                  const on = habits.includes(t.id);
                  const cat = CATEGORY_BY_ID[t.category];
                  return (
                    <button key={t.id} onClick={() => setHabits(toggle(habits, t.id))} className={cn('w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors', on ? 'border-accent/60 bg-accent-bg' : 'border-base-800 bg-base-900')}>
                      <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cat.color}22`, color: cat.color }}>
                        <Icon name={t.icon} size={18} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-base-50">{t.name}</p>
                        <p className="text-xs text-base-400">{cat.label} · +{t.xp} XP</p>
                      </div>
                      <span className={cn('h-6 w-6 rounded-full border-2 flex items-center justify-center', on ? 'bg-accent border-accent' : 'border-base-600')}>{on && <Check size={14} strokeWidth={3} className="text-base-950" />}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {name === 'sleep' && (
            <div>
              <h2 className="text-2xl font-black">Your sleep schedule</h2>
              <p className="text-sm text-base-400 mt-1">Teenagers need 8–10 hours. Sleep powers your mood, memory and sport.</p>
              <div className="grid grid-cols-2 gap-3 mt-5">
                <Field label="Wake up at">
                  <Input type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
                </Field>
                <Field label="Lights out at">
                  <Input type="time" value={bed} onChange={(e) => setBed(e.target.value)} />
                </Field>
              </div>
              <div className={cn('mt-4 rounded-2xl border p-4 text-center', win >= 8.5 * 60 ? 'border-mint/40 bg-mint/10' : 'border-warn/40 bg-warn/10')}>
                <p className="text-3xl font-black tabular-nums">{fmtDuration(win)}</p>
                <p className="text-sm text-base-300">{win >= 8.5 * 60 ? 'in bed: great, that leaves room for 8+ hours of sleep' : 'in bed: try an earlier lights-out for 8+ hours of sleep'}</p>
              </div>
            </div>
          )}

          {name === 'subjects' && (
            <div>
              <h2 className="text-2xl font-black">GCSE Academy</h2>
              <p className="text-sm text-base-400 mt-1">Which subjects do you study? Start with a few. Add topics later.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {SUGGESTED_SUBJECTS.map((sub) => {
                  const on = subjects.includes(sub.name);
                  return (
                    <button key={sub.name} onClick={() => setSubjects(toggle(subjects, sub.name))} className={cn('h-10 px-3 rounded-xl border text-sm font-semibold flex items-center gap-1.5', on ? 'text-base-950' : 'border-base-700 bg-base-850 text-base-200')} style={on ? { background: sub.color, borderColor: sub.color } : undefined}>
                      <Icon name={sub.icon} size={15} />
                      {sub.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-base-400 mt-4">Revision starts gently: about 3 short sessions of 10–15 minutes a week. It only grows if you want it to.</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          {step > 0 && (
            <Button variant="secondary" size="lg" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button size="lg" className="flex-1" onClick={() => setStep(step + 1)} disabled={name === 'habits' && habits.length < 3}>
              {step === 0 ? 'Start' : 'Next'} <ChevronRight size={18} />
            </Button>
          ) : (
            <Button size="lg" className="flex-1" onClick={finish} disabled={busy}>
              Enter LIFE XP
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
