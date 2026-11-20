// End-to-end test of the production build on Samsung Galaxy-sized Chrome viewports, plus desktop.
// Usage: npm run build && npm run e2e   (optional: SHOTS=/path/to/dir to save screenshots)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const root = path.resolve(import.meta.dirname, '..');
const PORT = 4175;
const URL = `http://localhost:${PORT}/`;
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

let failures = 0;
const results = [];
let page;
async function step(name, fn) {
  try {
    await fn();
    results.push(`  ✓ ${name}`);
  } catch (e) {
    failures++;
    results.push(`  ✗ ${name}\n      ${String(e.message).split('\n').slice(0, 6).join('\n      ')}`);
    if (SHOTS) await page?.screenshot({ path: path.join(SHOTS, `FAIL-${name.slice(0, 24).replace(/\W+/g, '-')}.png`) }).catch(() => {});
  }
}
const assert = (c, msg) => {
  if (!c) throw new Error(msg);
};

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', detached: true });
const stop = () => {
  try {
    process.kill(-server.pid);
  } catch {
    /* already stopped */
  }
};
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res());
  server.on('exit', () => rej(new Error('preview server exited')));
  setTimeout(() => rej(new Error('preview server timeout')), 20000);
});

const browser = await chromium.launch();
const errors = [];
const ctx = await browser.newContext({ ...devices['Galaxy S9+'], colorScheme: 'dark' });
page = await ctx.newPage();
page.setDefaultTimeout(6000);
ctx.setDefaultTimeout(6000);
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = (name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
const noOverflow = async (label) => {
  const w = page.viewportSize().width;
  const o = await page.evaluate(() => ({ sw: Math.max(document.documentElement.scrollWidth, window.innerWidth) }));
  o.w = w;
  assert(o.sw <= o.w + 1, `${label}: horizontal overflow ${o.sw} > ${o.w}`);
};
const go = async (hash) => {
  await page.goto(`${URL}#${hash}`);
  await page.waitForTimeout(350);
};
const dismissModals = async () => {
  for (let i = 0; i < 5; i++) {
    const d = page.getByRole('button', { name: 'Continue', exact: true });
    if (!(await d.count())) return;
    await d.first().click();
    await page.waitForTimeout(200);
  }
};

await step('loads and shows the onboarding quiz', async () => {
  await page.goto(URL);
  await page.getByText('Welcome to Life OS').waitFor({ timeout: 10000 });
  await shot('01-welcome');
});

await step('completes the quiz: focus areas, routine, goals, vision, habits', async () => {
  await page.getByPlaceholder('First name').fill('Sam');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: /Career & Professional/ }).click();
  await page.getByRole('button', { name: /Finance & Wealth/ }).click();
  await page.getByRole('button', { name: /Health & Fitness/ }).click();
  assert(await page.getByRole('button', { name: /Education & Knowledge/ }).isDisabled(), 'max 3 focus areas');
  await shot('02-focus');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('radio', { name: 'Unstructured' }).click();
  await page.getByRole('button', { name: 'Low energy' }).click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByText('Your main objectives').waitFor();
  await shot('03-goals');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByPlaceholder(/Financially independent/).fill('Qualified, financially secure and healthy');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByText('Daily systems').waitFor();
  // Unstructured routine → only 2 habits pre-selected.
  const selected = await page.locator('button[aria-pressed="true"]').count();
  assert(selected === 2, `expected 2 suggested habits, got ${selected}`);
  await shot('04-habits');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: 'Open my dashboard' }).click();
  await page.getByText(/Good (morning|afternoon|evening), Sam/).waitFor({ timeout: 8000 });
});

await step('dashboard shows overview, priorities, habits and goals', async () => {
  await page.getByText("Today's priorities").waitFor();
  await page.getByText("Today's habits").waitFor();
  await page.getByText('Goal progression').waitFor();
  await page.getByText('Complete a professional qualification').first().waitFor();
  await noOverflow('dashboard');
  await shot('05-dashboard');
});

await step('adds a Most Important Task and completes it (XP awarded, undo works)', async () => {
  await page.getByRole('button', { name: 'Add a priority' }).click();
  await page.getByLabel('Task title').fill('Draft the quarterly plan');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await page.getByText('Draft the quarterly plan').first().waitFor();
  await page.getByRole('button', { name: 'Complete Draft the quarterly plan' }).first().click();
  await page.getByText(/Completed · \+\d+ XP/).waitFor();
  await page.waitForTimeout(400);
  await dismissModals();
});

await step('logs habits: done and minimum version', async () => {
  const done = page.getByRole('button', { name: /^Mark .+ done$/ }).first();
  await done.click();
  await page.waitForTimeout(300);
  await dismissModals();
  const min = page.getByRole('button', { name: 'Min', exact: true }).first();
  if (await min.count()) await min.click();
  await page.waitForTimeout(300);
  await dismissModals();
  await shot('06-dashboard-progress');
});

await step('tasks: quick add, filters and Eisenhower matrix', async () => {
  await go('/tasks');
  await page.getByLabel('Quick add task').fill('Book dentist');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByText('Book dentist').waitFor();
  await page.getByRole('button', { name: /^Completed/ }).click();
  await page.getByText('Draft the quarterly plan').waitFor();
  await page.getByRole('button', { name: 'Eisenhower matrix' }).click();
  await page.getByText('Important & urgent').waitFor();
  await noOverflow('tasks');
  await shot('07-matrix');
});

await step('goals: create a quarterly sub-goal and achieve a milestone', async () => {
  await go('/goals');
  await page.getByText('Qualified, financially secure and healthy').waitFor();
  await shot('08-goals');
  await page.getByText('Complete a professional qualification').first().click();
  await page.getByText('Milestones').first().waitFor();
  await page.getByRole('button', { name: /^Achieve / }).first().click();
  await page.waitForTimeout(400);
  await dismissModals();
  await page.getByLabel('New milestone').fill('Book the next exam');
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  await page.getByText('Book the next exam').waitFor();
  await noOverflow('goal detail');
  await shot('09-goal-detail');
});

await step('numeric goal records a value and moves progress', async () => {
  await go('/goals');
  await page.getByText('Build £20,000 in savings').first().click();
  await page.getByRole('button', { name: 'Record new value' }).click();
  await page.getByLabel(/Value/).fill('5000');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Value recorded').waitFor();
  await page.getByText('£5,000').first().waitFor();
});

await step('habit editor creates a weekly habit', async () => {
  await go('/habits');
  await page.getByRole('button', { name: /New habit/ }).click();
  await page.getByPlaceholder('e.g. Study for 90 minutes').fill('Long run');
  await page.getByRole('radio', { name: 'N× per week' }).click();
  await page.getByRole('button', { name: 'Create habit' }).click();
  await page.getByText('Long run').first().waitFor();
  await noOverflow('habits');
  await shot('10-habits');
});

await step('schedule: time block with conflict detection', async () => {
  await go('/schedule');
  await page.getByRole('button', { name: /Block time/ }).click();
  await page.getByPlaceholder(/Deep work/).fill('Deep work');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Block time/ }).click();
  await page.getByPlaceholder(/Deep work/).fill('Team call');
  await page.getByText(/Conflicts with/).waitFor();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText(/overlaps/).first().waitFor();
  await page.getByRole('button', { name: 'week' }).click();
  await page.getByRole('button', { name: 'month' }).click();
  await noOverflow('schedule');
  await shot('11-schedule');
});

await step('focus timer starts, persists across reload and logs time', async () => {
  await go('/focus');
  await page.getByRole('button', { name: /Start focus/ }).click();
  await page.getByText(/Focusing on/).waitFor();
  await page.reload();
  await page.getByText(/Focusing on/).waitFor();
  await page.getByLabel('Close').click().catch(() => {});
  await go('/focus');
  await page.getByRole('button', { name: /Finish/ }).click();
  await page.waitForTimeout(400);
});

await step('performance: weekly, monthly and progression tabs render', async () => {
  await go('/performance');
  await page.getByText('Habit consistency').first().waitFor();
  await shot('12-performance');
  await page.getByRole('tab', { name: 'Monthly' }).click();
  await page.getByText('Month on month').waitFor();
  await page.getByRole('tab', { name: 'Progression' }).click();
  await page.getByText('Current level').waitFor();
  await page.getByText('First Milestone', { exact: true }).waitFor();
  await noOverflow('performance');
  await shot('13-progression');
});

await step('personal development: add a book and write a journal entry', async () => {
  await go('/development');
  await page.getByRole('button', { name: /^Add$/ }).first().click();
  await page.getByRole('dialog').getByRole('textbox').first().fill('Atomic Habits');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Atomic Habits').waitFor();
  await page.getByRole('tab', { name: 'Journal' }).click();
  await page.getByPlaceholder('How did today go?').fill('Solid day. Planned the quarter.');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await page.getByText('Journal saved').waitFor();
  await noOverflow('development');
});

await step('assistant is honest when not connected and shows its data brief', async () => {
  await go('/assistant');
  await page.getByText("The assistant isn't connected").waitFor();
  await page.getByRole('button', { name: 'Preview what it would see' }).click();
  await page.getByText('## 1. What they want to achieve').waitFor();
  await page.keyboard.press('Escape');
});

await step('weekly review page renders', async () => {
  await go('/performance/review');
  await page.getByText('Did your actions move your goals?').waitFor();
});

await step('settings: theme switch to light, passcode lock works', async () => {
  await go('/settings');
  await page.getByRole('radio', { name: 'Light' }).click();
  await page.waitForTimeout(200);
  assert((await page.evaluate(() => document.documentElement.dataset.theme)) === 'light', 'light theme applied');
  await go('/');
  await shot('14-dashboard-light');
  await go('/settings');
  await page.locator('input[autocomplete="new-password"]').fill('2468');
  await page.getByRole('button', { name: 'Set passcode' }).click();
  await page.getByText('Passcode set').waitFor();
  // New session (sessionStorage cleared) must be locked.
  const p2 = await ctx.newPage();
  await p2.goto(URL);
  await p2.getByText('Enter your passcode').waitFor();
  for (const d of '1111') await p2.getByRole('button', { name: d, exact: true }).click();
  await p2.getByRole('button', { name: 'Unlock' }).click();
  await p2.getByText('Incorrect passcode').waitFor();
  for (const d of '2468') await p2.getByRole('button', { name: d, exact: true }).click();
  await p2.getByRole('button', { name: 'Unlock' }).click();
  await p2.getByText(/Good (morning|afternoon|evening), Sam/).waitFor();
  await p2.close();
  await page.getByRole('button', { name: 'Turn off' }).click();
});

await step('data persists after reload', async () => {
  await page.reload();
  await go('/tasks?filter=completed');
  await page.getByText('Draft the quarterly plan').waitFor();
});

await step('desktop layout: sidebar navigation on a wide screen', async () => {
  const d = await browser.newContext({ viewport: { width: 1366, height: 860 }, colorScheme: 'dark' });
  const dp = await d.newPage();
  await dp.goto(URL);
  // Fresh context = fresh database, so onboard quickly.
  await dp.getByPlaceholder('First name').fill('Desk');
  await dp.getByRole('button', { name: /Continue/ }).click();
  await dp.getByRole('button', { name: /Education & Knowledge/ }).click();
  for (let i = 0; i < 5; i++) await dp.getByRole('button', { name: /Continue|Skip/ }).click();
  await dp.getByRole('button', { name: 'Open my dashboard' }).click();
  await dp.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: 'Performance' }).waitFor();
  if (SHOTS) await dp.screenshot({ path: path.join(SHOTS, '15-desktop.png') });
  await d.close();
});

await step('no console or page errors', async () => {
  const real = errors.filter((e) => !/favicon|manifest|Failed to load resource/.test(e));
  assert(real.length === 0, real.join('\n'));
});

await browser.close();
stop();
console.log(results.join('\n'));
console.log(failures ? `\n${failures} failed` : `\nAll ${results.length} checks passed`);
process.exit(failures ? 1 : 0);
