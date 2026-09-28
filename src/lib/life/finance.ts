import type { FinanceSnapshot, LifeProfile } from './types';

const n = (x: number | null | undefined) => x ?? 0;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export interface FinanceDerived {
  month: string;
  netWorth: number;
  liquid: number; // cash + emergency fund + car fund
  fiAssets: number; // investments + pension + investment property equity
  savings: number | null; // net income − spending
  savingsRate: number | null;
  investRate: number | null;
  surplus: number | null; // after investing
}

export function derive(s: FinanceSnapshot): FinanceDerived {
  const liquid = n(s.cash) + n(s.emergencyFund) + n(s.carFund);
  const fiAssets = n(s.investments) + n(s.pension) + n(s.investmentPropertyEquity);
  const homeEquity = n(s.homeValue) - n(s.mortgage);
  const netWorth = liquid + fiAssets + homeEquity - n(s.otherDebt);
  const savings = s.netIncome != null && s.spending != null ? s.netIncome - s.spending : null;
  const savingsRate = savings !== null && s.netIncome ? savings / s.netIncome : null;
  const investRate = s.invested != null && s.netIncome ? s.invested / s.netIncome : null;
  const surplus = savings !== null ? savings - n(s.invested) : null;
  return { month: s.month, netWorth, liquid, fiAssets, savings, savingsRate, investRate, surplus };
}

export interface FiStatus {
  annualSpend: number | null;
  fiNumber: number | null;
  fiAssets: number;
  progress: number | null; // 0..1+
  spendSource: 'profile' | 'snapshots' | 'none';
}

export function fiStatus(profile: LifeProfile, snaps: FinanceSnapshot[]): FiStatus {
  const latest = snaps[snaps.length - 1];
  const recentSpend = snaps.slice(-3).map((s) => s.spending).filter((x): x is number => x != null);
  const annualSpend = profile.fiAnnualSpend ?? (recentSpend.length ? avg(recentSpend)! * 12 : null);
  const spendSource = profile.fiAnnualSpend != null ? 'profile' : recentSpend.length ? 'snapshots' : 'none';
  const fiNumber = annualSpend ? annualSpend / profile.withdrawalRate : null;
  const fiAssets = latest ? derive(latest).fiAssets : 0;
  return { annualSpend, fiNumber, fiAssets, progress: latest && fiNumber ? fiAssets / fiNumber : null, spendSource };
}

/** Months until `start` reaches `target` with monthly contribution `c` at annual real return `r`. Infinity if > 60 years. */
export function monthsToTarget(start: number, c: number, r: number, target: number): number {
  if (start >= target) return 0;
  const mr = r / 12;
  let v = start;
  for (let m = 1; m <= 720; m++) {
    v = v * (1 + mr) + c;
    if (v >= target) return m;
  }
  return Infinity;
}

export interface ReadinessCondition {
  key: string;
  /** Scale conditions (price vs wealth and income) weigh 2; foundation conditions weigh 1. */
  weight: number;
  label: string;
  /** What must be true for the purchase to be sensible. */
  requirement: string;
  current: string;
  progress: number; // 0..1
  met: boolean;
  formula: string;
}

export interface Gt3rsReadiness {
  status: 'insufficient' | 'not-yet' | 'can-afford' | 'comfortable';
  headline: string;
  readiness: number | null; // 0..100
  canAfford: boolean;
  comfortable: boolean;
  conditions: ReadinessCondition[];
  fiDelayMonths: number | null;
  missing: string[];
}

export function gt3rsReadiness(profile: LifeProfile, snaps: FinanceSnapshot[]): Gt3rsReadiness {
  const cur = profile.currency;
  const money = (x: number) => `${cur}${Math.round(x).toLocaleString()}`;
  const latest = snaps[snaps.length - 1];
  const empty: Gt3rsReadiness = {
    status: 'insufficient',
    headline: 'Insufficient data — add a monthly finance snapshot',
    readiness: null,
    canAfford: false,
    comfortable: false,
    conditions: [],
    fiDelayMonths: null,
    missing: ['At least one monthly snapshot'],
  };
  if (!latest) return empty;

  const { price, annualRunningCost, annualDepreciationPct, expectedRealReturnPct } = profile.gt3rs;
  const last3 = snaps.slice(-3);
  const last6 = snaps.slice(-6);
  const d = derive(latest);
  const fi = fiStatus(profile, snaps);
  const missing: string[] = [];
  const need = (label: string, ok: boolean) => {
    if (!ok) missing.push(label);
    return ok;
  };

  const incomes = last3.map((s) => s.netIncome).filter((x): x is number => x != null && x > 0);
  const monthlyIncome = avg(incomes);
  const essentials = last3.map((s) => s.essentialSpending).filter((x): x is number => x != null);
  const essentialAvg = avg(essentials);
  const investedAvg = avg(last3.map((s) => s.invested).filter((x): x is number => x != null));
  const surplusAvg = avg(last3.map((s) => derive(s).surplus).filter((x): x is number => x !== null));
  const runningMonthly = annualRunningCost / 12;
  const ownershipCost = annualRunningCost + price * annualDepreciationPct;

  need('Net income', monthlyIncome !== null);
  need('Essential spending', essentialAvg !== null);
  need('Monthly invested amount', investedAvg !== null);
  need('Spending (for surplus)', surplusAvg !== null);

  const conds: ReadinessCondition[] = [];
  const SCALE = new Set(['afford', 'running', 'opportunity', 'networth']);
  const push = (c: Omit<ReadinessCondition, 'met' | 'progress' | 'weight'> & { progress: number }) =>
    conds.push({ ...c, weight: SCALE.has(c.key) ? 2 : 1, progress: Math.max(0, Math.min(1, c.progress)), met: c.progress >= 1 - 1e-9 });

  // 1. Purchase affordability — ring-fenced car fund covers the price.
  push({
    key: 'afford',
    label: 'Purchase affordability',
    requirement: `Ring-fenced car fund ≥ price (${money(price)}) — not from emergency fund or investments`,
    current: money(n(latest.carFund)),
    progress: n(latest.carFund) / price,
    formula: 'car fund ÷ price',
  });

  // 2. Emergency fund.
  const efTarget = essentialAvg !== null ? essentialAvg * profile.emergencyMonths : null;
  push({
    key: 'ef',
    label: 'Emergency fund',
    requirement: `≥ ${profile.emergencyMonths} months of essential spending${efTarget !== null ? ` (${money(efTarget)})` : ''}, untouched by the purchase`,
    current: efTarget ? `${money(n(latest.emergencyFund))} (${(n(latest.emergencyFund) / (essentialAvg || 1)).toFixed(1)} months)` : money(n(latest.emergencyFund)),
    progress: efTarget ? n(latest.emergencyFund) / efTarget : 0,
    formula: `emergency fund ÷ (${profile.emergencyMonths} × 3-month avg essential spending)`,
  });

  // 3. Stable income — consecutive recent months within 85% of the 6-month median.
  const inc6 = last6.map((s) => s.netIncome ?? 0).sort((a, b) => a - b);
  const median = inc6.length ? inc6[Math.floor(inc6.length / 2)] : 0;
  let stableMonths = 0;
  for (let i = snaps.length - 1; i >= 0; i--) {
    const x = snaps[i].netIncome;
    if (x != null && median > 0 && x >= median * 0.85) stableMonths++;
    else break;
  }
  push({
    key: 'income',
    label: 'Stable income',
    requirement: '12 consecutive months of income ≥ 85% of your typical month',
    current: `${stableMonths} month${stableMonths === 1 ? '' : 's'}`,
    progress: stableMonths / 12,
    formula: 'consecutive recent months with income ≥ 85% of 6-month median ÷ 12',
  });

  // 4. Investment contributions.
  const investRate = investedAvg !== null && monthlyIncome ? investedAvg / monthlyIncome : null;
  push({
    key: 'invest',
    label: 'Investment contributions',
    requirement: `Investing ≥ ${Math.round(profile.investRateTarget * 100)}% of take-home pay (3-month average)`,
    current: investRate === null ? '—' : `${Math.round(investRate * 100)}%`,
    progress: investRate === null ? 0 : investRate / profile.investRateTarget,
    formula: '3-month avg invested ÷ 3-month avg net income ÷ target',
  });

  // 5. Debt position.
  const debt = n(latest.otherDebt);
  push({
    key: 'debt',
    label: 'Debt position',
    requirement: 'Zero non-mortgage debt (cards, loans, car finance)',
    current: money(debt),
    progress: debt <= 0 ? 1 : monthlyIncome ? Math.max(0, 1 - debt / (monthlyIncome * 6)) * 0.99 : 0,
    formula: 'met only at zero; partial = 1 − debt ÷ 6 months of income',
  });

  // 6. Housing obligations.
  const housingRatio = latest.housingCost != null && monthlyIncome ? latest.housingCost / monthlyIncome : null;
  push({
    key: 'housing',
    label: 'Housing obligations',
    requirement: 'Rent/mortgage ≤ 30% of take-home pay',
    current: housingRatio === null ? '—' : `${Math.round(housingRatio * 100)}%`,
    progress: housingRatio === null ? 0 : housingRatio <= 0 ? 1 : 0.3 / housingRatio,
    formula: '30% ÷ (housing cost ÷ net income)',
  });

  // 7. Insurance & running costs (incl. depreciation).
  const annualIncome = monthlyIncome !== null ? monthlyIncome * 12 : null;
  push({
    key: 'running',
    label: 'Insurance & running costs',
    requirement: `Annual running + depreciation (${money(ownershipCost)}) ≤ 10% of take-home pay → income ≥ ${money(ownershipCost * 10)}/yr`,
    current: annualIncome === null ? '—' : `${Math.round((ownershipCost / annualIncome) * 100)}% of income`,
    progress: annualIncome === null ? 0 : (annualIncome * 0.1) / ownershipCost,
    formula: '(10% × annual net income) ÷ (running cost + price × depreciation)',
  });

  // 8. Opportunity cost — delay to financial independence.
  let fiDelayMonths: number | null = null;
  if (fi.fiNumber && investedAvg !== null) {
    const r = expectedRealReturnPct;
    const without = monthsToTarget(fi.fiAssets + n(latest.carFund), investedAvg, r, fi.fiNumber);
    // Running costs come out of the post-investing surplus first; any shortfall cuts contributions.
    const extra = Math.max(0, runningMonthly - Math.max(0, surplusAvg ?? 0));
    const withCar = monthsToTarget(fi.fiAssets, Math.max(0, investedAvg - extra), r, fi.fiNumber);
    fiDelayMonths = withCar === Infinity ? Infinity : Math.max(0, withCar - without);
  }
  push({
    key: 'opportunity',
    label: 'Opportunity cost',
    requirement: 'Buying delays financial independence by ≤ 12 months (car fund not invested + running costs)',
    current: fiDelayMonths === null ? 'needs FI number' : fiDelayMonths === Infinity ? 'FI never reached' : `${fiDelayMonths} month delay`,
    progress: fiDelayMonths === null || fiDelayMonths === Infinity ? 0 : fiDelayMonths === 0 ? 1 : 12 / fiDelayMonths,
    formula: `months-to-FI with purchase − without, at ${Math.round(expectedRealReturnPct * 100)}% real return`,
  });

  // 9. Post-purchase net worth.
  push({
    key: 'networth',
    label: 'Post-purchase net worth',
    requirement: `Price ≤ 10% of net worth → net worth ≥ ${money(price * 10)}`,
    current: `${money(d.netWorth)} (car = ${d.netWorth > 0 ? Math.round((price / d.netWorth) * 100) : '∞'}%)`,
    progress: d.netWorth > 0 ? (d.netWorth * 0.1) / price : 0,
    formula: '(10% × net worth) ÷ price',
  });

  // 10. Ability to keep investing.
  push({
    key: 'continue',
    label: 'Ability to continue investing',
    requirement: `Monthly surplus after investing covers running costs (${money(runningMonthly)}/month) — contributions unchanged`,
    current: surplusAvg === null ? '—' : `${money(surplusAvg)}/month spare`,
    progress: surplusAvg === null ? 0 : surplusAvg / runningMonthly,
    formula: '3-month avg surplus after investing ÷ monthly running cost',
  });

  const readiness = Math.round((conds.reduce((a, c) => a + c.progress * c.weight, 0) / conds.reduce((a, c) => a + c.weight, 0)) * 100);
  const canAfford = conds[0].met;
  const comfortable = conds.every((c) => c.met);
  const status = comfortable ? 'comfortable' : canAfford ? 'can-afford' : 'not-yet';
  const blockers = conds.filter((c) => !c.met).length;
  const headline = comfortable
    ? 'All 10 conditions met — a sensible purchase that won\'t damage your finances'
    : canAfford
      ? `You CAN afford it — but ${blockers} condition${blockers === 1 ? '' : 's'} say you can't comfortably afford it yet. Don't buy.`
      : `Building foundations — ${blockers}/10 conditions still to meet. Keep compounding.`;

  return { status, headline, readiness, canAfford, comfortable, conditions: conds, fiDelayMonths, missing };
}
