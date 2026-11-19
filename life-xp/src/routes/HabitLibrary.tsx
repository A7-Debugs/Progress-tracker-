import { Check, Lock, Plus } from 'lucide-react';
import { useSnapshot } from '@/lib/hooks';
import { Loading, Page, PageHeader } from '@/components/layout';
import { SectionTitle, XpChip } from '@/components/game';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/ui/Toaster';
import { CATEGORIES, HABIT_LIBRARY, daysLabel, libraryTierForLevel, recommendedMax } from '@/lib/habits';
import { adoptTemplate } from '@/lib/actions';
import { currentLevel } from '@/lib/performance';

const TIER_LEVEL = { 1: 1, 2: 4, 3: 7 } as const;

export default function HabitLibrary() {
  const s = useSnapshot();
  const toast = useToast();
  if (!s) return <Loading />;
  const level = currentLevel(s).level;
  const tier = libraryTierForLevel(level);
  const active = new Set(s.habits.filter((h) => h.active).map((h) => h.templateId));
  const count = s.habits.filter((h) => h.active).length;
  const max = recommendedMax(level);
  return (
    <>
      <PageHeader title="Habit library" subtitle="New habits are your choice: add one at a time" back />
      <Page className="pb-8">
        <div className="rounded-2xl bg-base-900 border border-base-800 p-3 text-sm text-base-300">
          You have <b className="text-base-50">{count}</b> habits. Recommended at level {level}: up to <b className="text-base-50">{max}</b>. Add a new one when the current ones feel easy (around 80%+).
        </div>
        {CATEGORIES.map((c) => {
          const list = HABIT_LIBRARY.filter((t) => t.category === c.id);
          if (!list.length) return null;
          return (
            <div key={c.id}>
              <SectionTitle>{c.label}</SectionTitle>
              <div className="space-y-2">
                {list.map((t) => {
                  const locked = t.tier > tier;
                  const have = active.has(t.id);
                  return (
                    <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-base-900 border border-base-800 p-3">
                      <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${c.color}1f`, color: c.color }}>
                        <Icon name={t.icon} size={19} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-base-50">{t.name}</p>
                        <p className="text-xs text-base-400">{t.why}</p>
                        <p className="text-[11px] text-base-500 mt-0.5">
                          {daysLabel(t.days)}
                          {t.unit ? ` · ${t.target} ${t.unit}` : ''}
                        </p>
                      </div>
                      {locked ? (
                        <span className="flex flex-col items-center text-[10px] font-bold text-base-500 w-14 text-center">
                          <Lock size={16} /> Level {TIER_LEVEL[t.tier]}
                        </span>
                      ) : have ? (
                        <span className="h-9 w-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center" aria-label="Already added">
                          <Check size={18} />
                        </span>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <XpChip xp={t.xp} />
                          <button
                            onClick={async () => {
                              await adoptTemplate(t.id);
                              toast(`Added: ${t.name}`);
                            }}
                            className="h-8 px-3 rounded-lg bg-accent text-base-950 text-xs font-bold flex items-center gap-1"
                          >
                            <Plus size={14} /> Add
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Page>
    </>
  );
}
