# Life OS — Version 1.0

A habit, progression and financial-readiness system built into this app. Everything is stored locally in IndexedDB (export it from Settings → Backup). Nothing is estimated: if there isn't enough data, the app says **"Insufficient data"**.

**Where things live**

| Screen | Route | Purpose |
|---|---|---|
| Today | `/` | Dashboard: weekly score, rings, today's habits, the ONE priority, goal progress bars, GT3 RS readiness, trend, progression, streaks |
| Check-in | `/checkin` | The 60-second daily log |
| Food log | `/food` | Tap-to-add protein (and later calorie) logging |
| Review | `/review` | Weekly (Sunday) / Monthly / Quarterly reviews, insights, correlations, friction, next-week plan |
| Money | `/finance` | Monthly snapshots, FI progress, GT3 RS readiness |
| Trends | `/trends` | All graphs |
| Goal tree | `/goals` | Vision → 10y → 5y → 1y → 90d → month → week → daily habits |
| The system | `/system` | Habit specs, levels, modes, scoring rules, settings |
| Train | `/train` | The existing workout logger (completed sessions count toward "Train" automatically) |

Code: `src/lib/life/` (engine, habits, progression, insights, finance) and `src/routes/life/`.

---

## 1. The Minimum Viable Routine (Level 1)

| Habit | Minimum (counts as success) | Ideal | Frequency | Time | Difficulty | Impact | Trigger | Tracking |
|---|---|---|---|---|---|---|---|---|
| **Sleep 7h+** | 7h | 8h | Daily | none extra | 3/5 | 5/5 | Phone on charge outside the bedroom at a fixed time | Hours in the check-in |
| **Train** | 30 min | Full planned workout | 3x/week | 30–75 min | 2/5 | 5/5 | Bag packed the night before, fixed slot | Automatic from the Train tab, or minutes in the check-in |
| **Steps** | 6,000 | 10,000 | Daily | 20–60 min | 1/5 | 4/5 | Morning walk before work (15–20 min ≈ 2,000+ steps) + a walk after lunch | Step count in the check-in |
| **Protein target** | 1.6 g/kg bodyweight | 2.0 g/kg | 5x/week | 5–10 min | 2/5 | 4/5 | Log it the moment you finish eating | Food log (tap to add); one-tap fallback in the check-in |
| **Deep work / study** | 25 min | 60 min | 5x/week | 25–60 min | 3/5 | 5/5 | Same slot daily, materials left open the night before | Focused minutes in the check-in |
| **Plan tomorrow** | Write tomorrow's top 3 | Top 3 + time-blocked calendar | 5x/week | 2–10 min | 1/5 | 4/5 | Straight after dinner / closing the laptop | One tap |
| **Weekly money check** | Check balances + last week's spending | …and update the snapshot | 1x/week | 5–15 min | 1/5 | 4/5 | Sunday review | Toggle, or ticks itself when a snapshot is saved |

Protein targets follow your latest weigh-in (1.6 / 2.0 g/kg, rounded to 5 g). With no weigh-in, or with auto turned off in The System → Nutrition, the manual values (default 140 / 180 g) are used.

**Why these seven:** they cover every long-term goal with the least friction. Sleep multiplies everything else. Training and protein are the whole physique goal at this stage. Steps are cheap health. Deep work is the engine of earning power (ACCA, Excel, modelling, AI) and so of financial freedom. Planning takes two minutes and removes tomorrow's decisions. The money check makes finances something you look at every week. Relationships are **tracked** from day one (a toggle in the check-in, feeding the Relationships score) but only become a scheduled habit at Level 4.

Each habit links to a 90-day objective in the goal tree. The quarterly review flags any goal that no habit serves, and any habit that serves no goal.

---

## 2. Daily check-in

Sleep · Training (auto if logged in the app) · Steps · Deep work · Protein · Planned tomorrow · Connection / money-check toggles · Energy · Mood · Stress (1–5). Optional: work hours, bodyweight (saved to Bodyweight), commitments.

Everything else is calculated. Unlogged past days count as misses, because missed days are data, and the Consistency score shows the logging rate separately.

---

## 3. Scoring

**Habit adherence** = successful days ÷ scheduled days (frequency × days ÷ 7), capped at 100%. A 1x/week habit is "pending" until the week can no longer be failed.

**Area scores (0–100)**, each a weighted average of the parts that have data:

| Area | Formula |
|---|---|
| Health | 40% sleep adherence + 30% steps + 30% protein (+ 20% calories, + 10% vitamins once unlocked; re-weighted) |
| Fitness | 60% training adherence + 25% share of lifts at/above the previous 28-day best e1RM + 15% mobility (once unlocked) |
| Career | 60% deep-work day adherence + 40% planning |
| Learning | 70% deep-work minutes vs ideal volume + 30% reading (once unlocked) |
| Finance | 40% money-check adherence + 60% latest savings rate ÷ target |
| Personal dev | Planning 50 + reading 20 + journal 15 + shutdown 15 (unlocked habits only) |
| Relationships | Connection days ÷ 3 per week |
| Recovery | 40% avg sleep ÷ 7.5h + 20% (1 − sleep SD ÷ 1.5h) + 20% energy + 20% inverted stress |
| Consistency | 30% days logged + 70% mean habit adherence |

**Weekly score** = weighted average of the areas (Health 15, Fitness 15, the rest 10 each). Needs 3 logged days. The review explains what improved or declined (±5 points), what caused it (habit drops, sleep, stress, work hours, logging gaps) and which habit had the most impact.

**Goal progress bars**

| Bar | Calculation |
|---|---|
| Fitness / Career / Consistency | 30-day area score (needs 7 logged days) |
| Financial independence | (investments + pension + investment-property equity) ÷ (annual spending ÷ 4%) |
| GT3 RS readiness | See §7 |

**Streaks** are shown (current and longest, in days or weeks) but the headline metric is 7/30/90-day consistency.

---

## 4. Progression (progressive overload for life)

| Level | Name | Changes |
|---|---|---|
| 1 | Foundation | The 7 habits above |
| 2 | Consistency | Train 4x/week, 30-min study minimum, 7k steps, protein 6x, **+ Read** (2 pages), **+ Vitamins** (with breakfast, 6x/week) |
| 3 | Momentum | 45-min study minimum, 8k steps, **+ Mobility/prehab** (5 min, 3x) |
| 4 | Expansion | 60-min study minimum, **+ Meaningful connection** (3x), **+ Screen shutdown** |
| 5 | High Performance | Train 5x, study 6x, protein daily, **+ Journal** |
| 6 | Elite Lifestyle | Nothing new added. Sustained standards; elite means durable |

**Level up** only when all of these are true, and only after you confirm it in the Sunday review:
- at least 3 full weeks at the current level
- mean adherence ≥ 85% over the last 3 weeks, with no week below 80%
- Recovery score ≥ 60 in every one of those weeks

**Deload → stabilise → rebuild** when adherence is below 60% two weeks running, below 45% in one week, or Recovery is below 45 two weeks running:
1. **Deload:** 1 week in Minimum Mode.
2. **Stabilise:** Normal Mode, same level, until 2 weeks at ≥ 75%.
3. **Rebuild:** level-up rules apply again.
If adherence is still below 50% during the deload week, drop one level. That means the system is too heavy for your life, not that you lack discipline.

A week only counts as evidence if 4 or more of its days were logged. Past weeks are always scored against the level that was active at the time (`levelHistory`).

## 5. Modes (set weekly in the Sunday review)

- **Minimum:** reduced frequencies and thresholds (e.g. train 2x at 20 min, study 3x at 15 min, 5k steps); habits unlocked after Level 1 pause. Recommended when you expect 55h+ of work, stress ≥ 4/5, or last week's sleep averaged under 6.5h, or when two softer signals appear (financial pressure, 4+ evenings committed, 50h+ work, a major event).
- **Normal:** your level's standard targets.
- **High-Performance:** one extra scheduled day for training, study, protein, planning, reading and mobility. Recommended only after an 85%+ week with ≥ 7.3h sleep, energy ≥ 3.8, low stress and a light week ahead. Never recommended more than 2 weeks in a row.

---

## 6. Insights, correlations and anti-gaming

**Weekly insights:** Biggest win · Biggest bottleneck · Hidden problem (weekend leak, energy slide, borrowed sleep, logging gaps, late-week fade) · Highest-ROI habit (the gap in energy + mood between days you do it and days you don't, divided by minutes of effort; needs 4+ of each) · Friction point · Opportunity · **the ONE recommendation**. A due deload always takes priority.

**Correlations** (Pearson r over the last 90 days, minimum 14 paired days): sleep→energy, sleep→training, stress→adherence, planning the night before→deep work, training→mood, work hours→adherence. They are worded as "the data suggests a relationship", never as causation.

**Anti-gaming flags:**
- coasting on minimums despite high energy and low stress
- a score padded by easy habits while high-impact ones fall behind
- deep work rising while sleep or training falls
- diminishing returns above ~50 work hours a week
- too many active habits for your current adherence
- High-Performance Mode becoming the default

**Friction reduction:** for any habit below 60% over 30 days, the app asks whether this is a discipline problem or a system design problem. It diagnoses the cause as *tracking* (misses are unlogged days), *system* (misses cluster on certain weekdays), *capacity* (misses fall on high-stress days) or *difficulty* (misses are spread evenly). It then walks through time, location, preparation, difficulty, environment, triggers, convenience and mental effort, and proposes a smaller version of the habit.

---

## 7. Financial freedom and GT3 RS readiness

Monthly snapshot: net income, spending, essential spending, housing cost, invested, cash, emergency fund, **ring-fenced GT3 RS fund**, investments, pension, home value, mortgage, investment-property equity, other debt. Balances carry forward from the previous month, so an update takes minutes.

**FI number** = annual spending (your setting, or the 3-month average × 12) ÷ 4%. **FI progress** = FI assets ÷ FI number.

The GT3 RS is treated as a symbol of financial independence, not a purchase target. The app separates two questions:
- **"I can afford it":** the ring-fenced car fund covers the price.
- **"I can comfortably afford it while still progressing":** all 10 conditions below are met.

| # | Condition | Requirement (defaults: price £230k, running £12k/yr, 5% depreciation, 5% real return) |
|---|---|---|
| 1 | Purchase affordability | Car fund ≥ price, without touching the emergency fund or investments |
| 2 | Emergency fund | ≥ 6 months of essential spending, left intact after the purchase |
| 3 | Stable income | 12 consecutive months of income ≥ 85% of your typical month |
| 4 | Investment contributions | Investing ≥ 15% of take-home pay (3-month average) |
| 5 | Debt position | Zero non-mortgage debt |
| 6 | Housing obligations | Rent or mortgage ≤ 30% of take-home pay |
| 7 | Insurance & running costs | Running costs + depreciation ≤ 10% of take-home pay |
| 8 | Opportunity cost | Buying delays FI by ≤ 12 months (simulated with and without the purchase) |
| 9 | Post-purchase net worth | Price ≤ 10% of net worth |
| 10 | Ability to keep investing | The monthly surplus after investing covers running costs, so contributions don't change |

**Readiness %** = weighted average of each condition's progress. Conditions 1, 7, 8 and 9 (the scale conditions) count double; the others count once. The verdict is "comfortable" only when all 10 are met. Price and assumptions are editable on the Money screen.

---

## 8. Nutrition: food log and calorie unlock

**Food log (`/food`, "Log food" on Today).** Log food as you eat instead of reconstructing the day at night.
- **My foods:** a starter list of 27 common UK foods with approximate protein and calories per serving. Edit them to match your brands, and save regular meals (e.g. "Overnight oats + whey") as one food.
- **Tap a food to add one serving.** Tapping again adds another; the ± buttons adjust in half servings.
- **Quick add:** type grams (and kcal) or use the portion guides: palm of meat/fish ≈ 30 g, fist of beans ≈ 10 g, glass of milk ≈ 8 g, handful of nuts ≈ 6 g.
- **Copy yesterday** fills a new day with yesterday's items in one tap.
- **The check-in fills itself in.** If a day has food entries, protein is graded from the total (≥ minimum = min, ≥ ideal = ideal). The manual missed / min / ideal choice only applies on days with no food logged, so days logged before this update keep their values.
- Each entry stores the values it was logged with, so editing a food never rewrites past days.

**Calorie awareness unlocks through consistency, not by level.**
- **Unlock rule:** 30-day protein adherence ≥ 85% at 4 weekly checkpoints in a row (today, −7, −14, −21 days). It can't be unlocked during a deload or a Minimum Mode week. You confirm the unlock yourself (Today card or The System → Nutrition).
- **Awareness phase (first 14 days):** logging calories is the habit and there's no target. Success = calories logged that day.
- **Target:** after 14 days, with 10+ days of calories and 4+ weigh-ins spanning 10+ days, maintenance is estimated as average intake − (weight change per day × 7,700 kcal/kg). You then choose:
  - **Cut:** maintenance − 400
  - **Maintain:** maintenance
  - **Lean bulk:** maintenance + 250
- **Grading:** within ±100 kcal of target = ideal; within ±250 = success (minimum); further away = miss. Scheduled 5x/week, never required in Minimum Mode.
- **Health score:** once unlocked, calories add a 20-weight part (the other parts are re-weighted).

**New flags**
- **Calorie totals are incomplete:** at least 20% of food entries in 3 weeks have no calories.
- **Calories and weight disagree:** you're on target but weight moves the wrong way for your goal. This usually means food isn't being logged, or maintenance has shifted; re-estimate in The System.
