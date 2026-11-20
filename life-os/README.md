# Life OS

A personal operating system for adults: goals, habits, tasks, schedule, performance analytics,
personal development and an optional AI assistant in one installable, offline-first PWA.

> Turn ambitions into objectives, objectives into systems, systems into daily actions, and daily
> actions into measurable progress.

Life OS is built on the foundations of **LIFE XP** (`A7-Debugs/life-xp`): the same stack
(React 19, Vite, Tailwind 4, Dexie/IndexedDB, Radix UI, Recharts, vite-plugin-pwa), the same
local-first data layer and snapshot → engine → UI architecture, the deterministic progression
rules, the date handling and the Vitest + Playwright test approach. The UI primitives were carried
over and re-themed for a premium light/dark adult interface; the domain was rebuilt for adults.

It is a standalone project with its own database (`life-os` in IndexedDB). It shares no code or
data with the Overload app at the root of this repository.

## Run it

```bash
cd life-os
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests (Vitest + fake-indexeddb)
npm run build
npm run e2e        # end-to-end checks in Chromium, Galaxy S9+ viewport + desktop
```

`dist/` uses relative paths and HashRouter, so it can be hosted from any static HTTPS host or
sub-folder. On Android: open it in Chrome → ⋮ → **Install app**.

## Sections

| Section | What it does |
|---|---|
| **Onboarding quiz** | Focus areas (up to 3), routine, available time, obstacles, horizon → starter goals with milestones, an optional vision, and a deliberately small set of habits (fewer for unstructured routines). |
| **Dashboard** | Date and greeting, daily completion %, tasks done/remaining, habits done/planned, focus, productivity score (with breakdown), level/XP, streaks, today's 3 Most Important Tasks, today's habits, goal progression with pace and next milestone, today's schedule, weekly overview, insights. Cards can be hidden and reordered; advanced cards appear after a few days. |
| **Goals** | 8 built-in life categories + custom ones. Hierarchy: vision → annual → quarterly → monthly → weekly → daily tasks. Each goal: description, starting position, target outcome, measurement, target date, priority, difficulty, status. Milestones (weighted) with their own tasks. |
| **Habits** | Daily, specific weekdays, N× per week, every N days, multiple repetitions per day. Done / minimum version (half credit, keeps the streak) / missed. Streaks with grace days, weekly & monthly consistency, 12-week heatmap. |
| **Tasks** | Create/edit/delete, planned day + time, deadline, priority, important/urgent, difficulty, estimate, category, goal + milestone link, recurrence. Filters: today, tomorrow, week, upcoming, overdue, no date, completed. Eisenhower matrix and an explained priority score. |
| **Schedule** | Day (timeline), week and month views, time blocks, recurring events, timed tasks, deadlines, habit times, conflict detection, estimated vs actual time, focus timer, `.ics` export for Google/Apple Calendar. |
| **Performance** | Weekly and monthly analytics, month-on-month comparison, habit consistency, goal progression, productivity, focus hours, time allocation, XP progression, achievements, weekly review. |
| **Development** | Books, courses, qualifications, skills, projects, experiences; learning hours; daily journal (reflection, lessons, challenges, accomplishments, improvements); accomplishments timeline. |
| **Assistant** | AI architecture (see below). |
| **Settings** | Theme, dashboard, categories, XP values and level pace, passcode lock, AI key, JSON/CSV/ICS export, restore, erase. |

## Rules that keep the numbers honest

- **Goal progress comes from outcomes, never task counts.** Milestones (weighted by size),
  measured values (with dated history), sub-goal averages, or done/not-done. Tasks link to goals
  but don't move them. If you complete lots of linked tasks and the goal doesn't move, the app
  says so (dashboard insight and the goal page).
- **Pace**: progress vs. share of time elapsed → ahead / on track / behind / at risk / overdue.
- **All metrics are computed from raw records** on every read; when there isn't enough data the
  UI says so instead of estimating (e.g. best day needs 2+ samples for 4+ weekdays).
- **Productivity score** (0–100): habits 40%, tasks 40% (MITs count double), focus vs. daily
  target 20%, re-weighted over the parts that apply that day.

## Progression

- **Levels**: XP from level L to L+1 = 50 × (L+1) × pace → 0, 100, 250, 450, 700, … 2,700 (L10).
  Pace is configurable (faster / standard / slower / hardcore).
- **XP** (all editable in Settings): tasks 10 / 20 / 35 by difficulty; habits 5 / 10 / 15 (half for
  the minimum version); milestones 50 / 100 / 250 by size; goals 500 × horizon × difficulty;
  weekly review 50; consistent week (80%+ habits) 75; 5 per 25 focused minutes.
- **Anti-farming**: the XP ledger is *derived* from data on every read (never stored), so nothing
  can be double-awarded and undoing removes exactly what it earned. Daily caps on task XP (150)
  and focus XP (40); a weekly habit earns at most its target per week; milestones ticked within
  12 hours of being added and goals completed sooner than their minimum age (2–30 days by
  horizon) earn nothing.
- **Achievements** (14): First Week Completed, 30-Day Consistency, 100 Tasks, First Major Goal,
  100 Hours of Focused Work, 90-Day Habit Streak, Five Goals Completed and others. Permanent once
  unlocked.

## Architecture

```
src/lib/
  types.ts, db.ts        data model + Dexie schema (versioned)
  snapshot.ts            loads everything into memory for one consistent read
  habits.ts goals.ts tasks.ts schedule.ts   domain engines (pure functions)
  progression.ts         XP ledger, levels, achievements
  analytics.ts           day/period metrics, insights, chart series
  sync.ts                reconciler: stores unlocked achievements, celebrates level-ups once
  actions.ts             every mutation, validated, transactional
  ai/context.ts          factual brief for the assistant
  ai/provider.ts         provider interface + Anthropic implementation
  lock.ts backup.ts      passcode lock (PBKDF2), export/restore
src/routes/              one file per screen
src/components/          layout, editors, rows, charts, UI primitives
```

**Storage, authentication and sync.** Data lives in IndexedDB on the device (persistent storage
is requested), survives reloads and works offline. Authentication is an on-device passcode lock
(4–8 digits, PBKDF2-SHA256 hash, re-locks after inactivity). Moving data between devices is via
JSON backup/restore. There is no server in this version, so there are no accounts or automatic
cloud sync; `actions.ts` is the single write path, which is where a sync adapter (e.g. a hosted
database) would hook in without changing screens.

**AI assistant.** `ai/context.ts` builds a factual brief from real data, organised as *what you
want* (goals, pace), *what you're doing* (habits, tasks, focus), *what's in the way* (warnings,
overdue, workload vs. capacity, calendar conflicts, journal challenges) and *open work*. The user
can view exactly what would be sent. `ai/provider.ts` defines a provider interface with one real
implementation (Anthropic Messages API via the official SDK, streaming, user-supplied key stored
only on the device and never in backups). With no key configured the assistant states it is not
connected; there are no simulated replies.

**Calendar integration.** `.ics` export works with Google and Apple Calendar today. Two-way sync
would need OAuth and a server component and is not implemented.
