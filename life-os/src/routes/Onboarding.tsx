import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import * as A from '@/lib/actions';
import { addDays, logicalDate } from '@/lib/dates';
import { BUILTIN_CATEGORIES, GOAL_TEMPLATES, HABIT_TEMPLATE_BY_ID, OBSTACLES, recommendedHabitCount } from '@/lib/defaults';
import { frequencyLabel } from '@/lib/habits';
import type { QuizAnswers } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Field, MultiChips, Segmented } from '@/components/ui/Chips';
import { Input, NumberField, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toaster';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/layout';

interface GoalPick {
  categoryId: string;
  templateId: string | null;
  title: string;
  targetDate: string;
  startValue?: number;
  targetValue?: number;
  milestones: string[];
}

const STEPS = ['Welcome', 'Focus', 'You', 'Goals', 'Vision', 'Habits', 'Ready'];

function monthsFromNow(m: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + m);
  return logicalDate(d);
}

/**
 * The opening quiz: a few questions to find the user's main life objectives, then a small starting
 * system. It deliberately suggests fewer habits for less structured routines — start small, add later.
 */
export default function Onboarding() {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [quiz, setQuiz] = useState<QuizAnswers>({ focusAreas: [], routine: 'mixed', dailyMinutes: 60, obstacles: [], horizon: '1y' });
  const [goals, setGoals] = useState<GoalPick[]>([]);
  const [vision, setVision] = useState('');
  const [habitIds, setHabitIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const recommendedHabits = useMemo(() => {
    const ids: string[] = [];
    for (const g of goals) {
      const tpl = GOAL_TEMPLATES.find((t) => t.id === g.templateId);
      for (const h of tpl?.habitIds ?? []) if (!ids.includes(h)) ids.push(h);
    }
    if (quiz.obstacles.includes('clarity') && !ids.includes('plan-tomorrow')) ids.push('plan-tomorrow');
    if (quiz.obstacles.includes('energy') && !ids.includes('sleep')) ids.unshift('sleep');
    return ids;
  }, [goals, quiz.obstacles]);
  const habitLimit = recommendedHabitCount(quiz.routine, quiz.dailyMinutes);
  const chosenHabits = habitIds ?? recommendedHabits.slice(0, habitLimit);

  function setFocus(ids: string[]) {
    setQuiz((q) => ({ ...q, focusAreas: ids }));
    setGoals((gs) => {
      const kept = gs.filter((g) => ids.includes(g.categoryId));
      for (const c of ids) {
        if (kept.some((g) => g.categoryId === c)) continue;
        const tpl = GOAL_TEMPLATES.find((t) => t.categoryId === c)!;
        kept.push(fromTemplate(tpl.id));
      }
      return ids.map((c) => kept.find((g) => g.categoryId === c)!).filter(Boolean);
    });
    setHabitIds(null);
  }

  function fromTemplate(id: string): GoalPick {
    const t = GOAL_TEMPLATES.find((x) => x.id === id)!;
    return { categoryId: t.categoryId, templateId: t.id, title: t.title, targetDate: monthsFromNow(t.months), startValue: t.startValue, targetValue: t.targetValue, milestones: [...t.milestones] };
  }

  async function finish() {
    setBusy(true);
    try {
      await A.completeOnboarding({ name, quiz, vision, goals: goals.map((g) => ({ ...g, targetDate: g.targetDate || null })), habitTemplateIds: chosenHabits });
    } catch (e) {
      toast((e as Error).message, 'error');
      setBusy(false);
    }
  }

  const canNext = [name.trim().length > 0, quiz.focusAreas.length > 0, true, goals.every((g) => g.title.trim()), true, true, true][step];

  return (
    <div className="min-h-dvh flex flex-col bg-bg">
      <header className="safe-top">
        <div className="mx-auto max-w-xl px-5 pt-5 flex items-center gap-3">
          <Logo />
          <div className="flex-1 flex gap-1" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <span key={s} className={cn('h-1 flex-1 rounded-full transition-colors', i <= step ? 'bg-accent' : 'bg-surface-3')} />
            ))}
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-xl px-5 py-8 animate-fade-in" key={step}>
        {step === 0 && (
          <Section title="Welcome to Life OS" body="Turn ambitions into objectives, objectives into systems, and systems into daily actions you can measure. A few questions to set up your starting point. It takes about two minutes.">
            <Field label="What should we call you?">
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(1)} />
            </Field>
          </Section>
        )}
        {step === 1 && (
          <Section title="Which areas matter most right now?" body="Choose up to three. You can add every other area later; starting focused works better.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {BUILTIN_CATEGORIES.map((c) => {
                const on = quiz.focusAreas.includes(c.id);
                const disabled = !on && quiz.focusAreas.length >= 3;
                return (
                  <button key={c.id} disabled={disabled} aria-pressed={on} onClick={() => setFocus(on ? quiz.focusAreas.filter((x) => x !== c.id) : [...quiz.focusAreas, c.id])} className={cn('flex items-center gap-3 h-14 px-3.5 rounded-xl border text-left transition-colors disabled:opacity-40', on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-surface-2')}>
                    <span className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${c.color}1f`, color: c.color }}>
                      <Icon name={c.icon} size={16} />
                    </span>
                    <span className="flex-1 text-[14px] font-medium text-fg">{c.name}</span>
                    {on && <Check size={16} className="text-accent" />}
                  </button>
                );
              })}
            </div>
          </Section>
        )}
        {step === 2 && (
          <Section title="A little about how you work" body="This shapes how much the app suggests at the start.">
            <div className="space-y-5">
              <Field label="How would you describe your routine right now?">
                <Segmented value={quiz.routine} onChange={(v) => setQuiz({ ...quiz, routine: v })} options={[{ value: 'structured', label: 'Structured' }, { value: 'mixed', label: 'Somewhat consistent' }, { value: 'unstructured', label: 'Unstructured' }]} />
              </Field>
              <Field label="Time you can realistically give your goals each day">
                <Segmented value={quiz.dailyMinutes} onChange={(v) => setQuiz({ ...quiz, dailyMinutes: v })} options={[[15, '15 min'], [30, '30 min'], [60, '1 hour'], [90, '1.5 hours'], [120, '2+ hours']].map(([m, l]) => ({ value: m as number, label: l }))} />
              </Field>
              <Field label="What usually gets in the way?">
                <MultiChips value={quiz.obstacles} onChange={(v) => setQuiz({ ...quiz, obstacles: v })} options={OBSTACLES.map((o) => ({ value: o.id, label: o.label }))} />
              </Field>
              <Field label="How far ahead are you planning?">
                <Segmented value={quiz.horizon} onChange={(v) => setQuiz({ ...quiz, horizon: v })} options={[{ value: '3m', label: '3 months' }, { value: '1y', label: '1 year' }, { value: '3y', label: '3 years' }, { value: '5y', label: '5+ years' }]} />
              </Field>
            </div>
          </Section>
        )}
        {step === 3 && (
          <Section title="Your main objectives" body="One goal per area to start. Pick a starting point and make it yours. Milestones break it into measurable steps.">
            <div className="space-y-4">
              {goals.map((g, i) => {
                const cat = BUILTIN_CATEGORIES.find((c) => c.id === g.categoryId)!;
                const tpl = GOAL_TEMPLATES.find((t) => t.id === g.templateId);
                const options = GOAL_TEMPLATES.filter((t) => t.categoryId === g.categoryId);
                const update = (p: Partial<GoalPick>) => setGoals((gs) => gs.map((x, j) => (j === i ? { ...x, ...p } : x)));
                return (
                  <div key={g.categoryId} className="rounded-xl border border-line bg-surface p-4 space-y-3">
                    <p className="text-xs font-medium text-fg-3 inline-flex items-center gap-1.5">
                      <Icon name={cat.icon} size={13} /> {cat.name}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {options.map((t) => (
                        <button key={t.id} onClick={() => setGoals((gs) => gs.map((x, j) => (j === i ? fromTemplate(t.id) : x)))} className={cn('h-7 px-2.5 rounded-md border text-xs font-medium', g.templateId === t.id ? 'border-accent bg-accent-soft text-accent' : 'border-line text-fg-2')}>
                          {t.title}
                        </button>
                      ))}
                      <button onClick={() => update({ templateId: null, title: '', milestones: [] })} className={cn('h-7 px-2.5 rounded-md border text-xs font-medium', g.templateId === null ? 'border-accent bg-accent-soft text-accent' : 'border-line text-fg-2')}>
                        Something else
                      </button>
                    </div>
                    <Field label="Goal">
                      <Input value={g.title} onChange={(e) => update({ title: e.target.value })} placeholder="Describe your goal" />
                    </Field>
                    {tpl?.measurement === 'numeric' && (
                      <div className="grid grid-cols-2 gap-3">
                        <Field label={`Starting ${tpl.unit}`}>
                          <NumberField value={g.startValue ?? 0} onChange={(e) => update({ startValue: Number(e.target.value) })} />
                        </Field>
                        <Field label={`Target ${tpl.unit}`}>
                          <NumberField value={g.targetValue ?? 0} onChange={(e) => update({ targetValue: Number(e.target.value) })} />
                        </Field>
                      </div>
                    )}
                    <Field label="Target date">
                      <Input type="date" min={addDays(logicalDate(new Date()), 1)} value={g.targetDate} onChange={(e) => update({ targetDate: e.target.value })} />
                    </Field>
                    {g.milestones.length > 0 && (
                      <div>
                        <p className="text-[13px] font-medium text-fg-2 mb-1.5">Milestones</p>
                        <ul className="space-y-1.5">
                          {g.milestones.map((m, k) => (
                            <li key={k} className="flex items-center gap-2">
                              <span className="h-5 w-5 rounded-full border border-line-strong text-[10px] text-fg-3 flex items-center justify-center shrink-0 tnum">{k + 1}</span>
                              <Input className="h-9" value={m} onChange={(e) => update({ milestones: g.milestones.map((x, y) => (y === k ? e.target.value : x)) })} aria-label={`Milestone ${k + 1}`} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button className="text-xs font-medium text-accent" onClick={() => update({ milestones: [...g.milestones, ''] })}>
                      + Add milestone
                    </button>
                  </div>
                );
              })}
            </div>
          </Section>
        )}
        {step === 4 && (
          <Section title="Your long-term vision" body="Optional. One sentence describing the life you're building. Your goals will sit underneath it, so you can see how today connects to it.">
            <Textarea autoFocus rows={3} value={vision} onChange={(e) => setVision(e.target.value)} placeholder="e.g. Financially independent by 45, healthy, and doing work I'm proud of" />
          </Section>
        )}
        {step === 5 && (
          <Section title="Daily systems" body={`Based on your answers we suggest starting with ${habitLimit} habit${habitLimit === 1 ? '' : 's'}. Two you keep beat six you drop. Each has a minimum version for hard days.`}>
            <div className="space-y-2">
              {[...new Set([...recommendedHabits, 'sleep', 'exercise', 'read', 'plan-tomorrow', 'journal'])].map((id) => {
                const h = HABIT_TEMPLATE_BY_ID[id];
                if (!h) return null;
                const on = chosenHabits.includes(id);
                return (
                  <button key={id} aria-pressed={on} onClick={() => setHabitIds(on ? chosenHabits.filter((x) => x !== id) : [...chosenHabits, id])} className={cn('w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-colors', on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-surface-2')}>
                    <span className={cn('mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0', on ? 'bg-accent border-accent text-accent-fg' : 'border-line-strong')}>{on && <Check size={13} strokeWidth={3} />}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-medium text-fg">
                        {h.name}
                        {recommendedHabits.includes(id) && <span className="ml-2 text-[11px] font-medium text-accent">Suggested</span>}
                      </span>
                      <span className="block text-xs text-fg-3 mt-0.5">
                        {frequencyLabel(h.frequency)} · Minimum: {h.minimumVersion}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {chosenHabits.length > habitLimit + 1 && <p className="mt-3 text-xs text-warning">That's more than we'd suggest for your routine. You can always add habits once these stick.</p>}
          </Section>
        )}
        {step === 6 && (
          <Section title={`You're set up, ${name.trim()}`} body="Here's your starting system. Your dashboard starts simple; more detail appears as you build history.">
            <div className="rounded-xl border border-line bg-surface divide-y divide-line">
              {vision.trim() && <Summary label="Vision" value={vision.trim()} />}
              {goals.map((g) => (
                <Summary key={g.categoryId} label={BUILTIN_CATEGORIES.find((c) => c.id === g.categoryId)!.name} value={g.title} sub={`${g.milestones.filter((m) => m.trim()).length} milestones${g.targetDate ? ` · by ${g.targetDate}` : ''}`} />
              ))}
              <Summary label="Habits" value={chosenHabits.map((id) => HABIT_TEMPLATE_BY_ID[id]?.name).filter(Boolean).join(', ') || 'None yet'} />
            </div>
            <p className="text-xs text-fg-3 mt-3">Everything is stored on this device and works offline. Export a backup any time from Settings.</p>
          </Section>
        )}
      </main>
      <footer className="sticky bottom-0 bg-bg/90 backdrop-blur border-t border-line safe-bottom">
        <div className="mx-auto max-w-xl px-5 py-3 flex gap-2">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16} /> Back
            </Button>
          )}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <Button disabled={!canNext} onClick={() => setStep(step + 1)}>
              {step === 4 && !vision.trim() ? 'Skip' : 'Continue'} <ArrowRight size={16} />
            </Button>
          ) : (
            <Button disabled={busy} onClick={finish}>
              {busy ? 'Setting up…' : 'Open my dashboard'}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function Section({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
      <p className="mt-2 text-[14px] text-fg-2 leading-relaxed">{body}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Summary({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-fg-3">{label}</p>
      <p className="text-[14px] text-fg mt-0.5">{value}</p>
      {sub && <p className="text-xs text-fg-3 mt-0.5">{sub}</p>}
    </div>
  );
}
