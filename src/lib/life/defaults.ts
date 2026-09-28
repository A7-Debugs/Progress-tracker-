import { db } from '@/lib/db';
import { todayStr } from '@/lib/id';
import type { GoalNode, GoalTier, LifeProfile } from './types';

export const TIER_LABELS: Record<GoalTier, string> = {
  vision: '20–30 year vision',
  y10: '10 year goals',
  y5: '5 year goals',
  y1: '1 year goals',
  d90: '90 day objectives',
  month: 'Monthly targets',
  week: 'Weekly targets',
};

export const TIER_ORDER: GoalTier[] = ['vision', 'y10', 'y5', 'y1', 'd90', 'month', 'week'];

const g = (id: string, parentId: string | null, tier: GoalTier, title: string, domain: GoalNode['domain'] = null): GoalNode => ({
  id,
  parentId,
  tier,
  title,
  domain,
});

/** Starter goal tree. Every node is editable; it exists so every habit has something to connect to on day 1. */
export const DEFAULT_GOALS: GoalNode[] = [
  g('vision', null, 'vision', 'Freedom to work because I want to, not because I have to — with a strong body, strong relationships, valuable skills and financial independence.'),

  g('y10-fin', 'vision', 'y10', 'Financially independent: investment assets ≥ FI number. GT3 RS owned comfortably (if I still want it).', 'finance'),
  g('y10-career', 'vision', 'y10', 'Senior finance role or own advisory — skills that command a premium and give me options.', 'career'),
  g('y10-health', 'vision', 'y10', 'Strongest, leanest, pain-free version of myself — training is part of my identity.', 'fitness'),
  g('y10-rel', 'vision', 'y10', 'Deep, reliable relationships and time for the people who matter.', 'relationships'),

  g('y5-fin', 'y10-fin', 'y5', 'Investment assets ≥ 30% of FI number, zero consumer debt, 6+ month emergency fund.', 'finance'),
  g('y5-career', 'y10-career', 'y5', 'ACCA qualified; recognised for financial modelling and AI-enabled finance.', 'career'),
  g('y5-health', 'y10-health', 'y5', '5 years at ≥ 80% training consistency; key lifts at advanced standards.', 'fitness'),
  g('y5-rel', 'y10-rel', 'y5', 'A close circle I see every week; relationships never sacrificed for work.', 'relationships'),

  g('y1-fin', 'y5-fin', 'y1', 'Savings rate ≥ 20% every month; emergency fund complete; investing monthly on autopilot.', 'finance'),
  g('y1-career', 'y5-career', 'y1', 'Pass the next ACCA exams; ~200 deep-work hours; 3 portfolio-grade models.', 'career'),
  g('y1-health', 'y5-health', 'y1', 'Train ≥ 3x/week for 40+ weeks; average sleep ≥ 7h; protein 5+ days/week.', 'fitness'),
  g('y1-personal', 'vision', 'y1', 'Plan every working day and complete a weekly review every Sunday.', 'personal'),
  g('y1-rel', 'y5-rel', 'y1', 'Regular, scheduled time with family, partner and close friends.', 'relationships'),

  g('d90-fin', 'y1-fin', 'd90', 'Log 3 monthly snapshots; automate transfers to emergency fund and investments.', 'finance'),
  g('d90-career', 'y1-career', 'd90', '~40 focused study hours toward the next ACCA exam.', 'career'),
  g('d90-health', 'y1-health', 'd90', 'Reach Level 2: ≥ 85% adherence for 3 straight weeks.', 'fitness'),
  g('d90-personal', 'y1-personal', 'd90', '12 weekly reviews completed.', 'personal'),
  g('d90-rel', 'y1-rel', 'd90', 'See close friends/family at least once a week.', 'relationships'),

  g('month-1', 'd90-career', 'month', 'This month: ~13 study hours; 12+ training sessions; 1 finance snapshot.', null),
  g('week-1', 'month-1', 'week', 'This week: set in the Sunday review (your ONE focus).', null),
];

export function defaultProfile(): LifeProfile {
  const today = todayStr();
  return {
    id: 'life',
    level: 1,
    levelSince: today,
    levelHistory: [{ level: 1, from: today }],
    phase: 'build',
    phaseSince: today,
    startDate: today,
    currency: '£',
    proteinMinG: 140,
    proteinIdealG: 180,
    pausedHabits: [],
    fiAnnualSpend: null,
    withdrawalRate: 0.04,
    emergencyMonths: 6,
    savingsRateTarget: 0.2,
    investRateTarget: 0.15,
    gt3rs: {
      price: 230000,
      annualRunningCost: 12000,
      annualDepreciationPct: 0.05,
      expectedRealReturnPct: 0.05,
    },
    goals: DEFAULT_GOALS,
  };
}

export async function ensureLifeProfile(): Promise<void> {
  const existing = await db.lifeProfile.get('life');
  if (!existing) await db.lifeProfile.put(defaultProfile());
}
