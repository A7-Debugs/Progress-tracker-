// End-to-end test of the production build on a Samsung Galaxy-sized Chrome viewport.
// Usage: npm run build && npm run e2e   (optional: SHOTS=/path/to/dir to save screenshots)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const root = path.resolve(import.meta.dirname, '..');
const PORT = 4174;
const URL = `http://localhost:${PORT}/`;
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

let failures = 0;
const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push(`  ✓ ${name}`);
  } catch (e) {
    failures++;
    const where = String(e.message).split('\n').slice(1, 14).join('\n      ');
    results.push(`  ✗ ${name}\n      ${String(e.message).split('\n')[0]}\n      ${where}`);
    if (SHOTS) await globalThis.__page?.screenshot({ path: path.join(SHOTS, `FAIL-${name.slice(0, 20).replace(/\W+/g, '-')}.png`) }).catch(() => {});
  }
}
const assert = (c, msg) => {
  if (!c) throw new Error(msg);
};

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', detached: true });
const stopServer = () => { try { process.kill(-server.pid); } catch { /* already stopped */ } };
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res());
  server.on('exit', () => rej(new Error('preview server exited')));
  setTimeout(() => rej(new Error('preview server timeout')), 20000);
});

const browser = await chromium.launch();
// Galaxy S9+ descriptor: Android Chrome UA, touch, 320×658 CSS px. Also check a modern 412×915 Galaxy (S2x) size.
const galaxy = { ...devices['Galaxy S9+'] };
const ctx = await browser.newContext({ ...galaxy });
const page = await ctx.newPage();
globalThis.__page = page;
await page.clock.install();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const shot = async (name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const noOverflow = async (label) => {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  assert(o.sw <= o.w + 1, `${label}: horizontal overflow ${o.sw} > ${o.w}`);
};
const dismiss = async () => {
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(300);
    const d = page.locator('[role=dialog][aria-label*="Level"], [role=dialog][aria-label*="Achievement"]');
    if (!(await d.count())) return;
    await d.first().getByRole('button').last().click();
  }
};
const xpTotal = async () => Number((await page.getByText(/total XP$/).first().textContent()).replace(/[^0-9]/g, ''));

await step('loads and shows onboarding', async () => {
  await page.goto(URL);
  await page.getByRole('button', { name: 'Start' }).waitFor();
  await shot('01-welcome');
  await noOverflow('welcome');
});

await step('onboarding creates a player with starter habits', async () => {
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByPlaceholder('e.g. Nova').fill('Nova');
  await page.getByRole('button', { name: /Next/ }).click();
  await shot('02-habits');
  await page.getByRole('button', { name: /Next/ }).click();
  await page.getByRole('button', { name: /Next/ }).click();
  await page.getByRole('button', { name: 'Enter LIFE XP' }).click();
  await page.getByText('Level 1', { exact: true }).waitFor();
  await page.getByText('Nova').first().waitFor();
});

await step('dashboard answers: what to do, progress, next level, rewards', async () => {
  await page.getByText(/to level 2/).waitFor();
  await page.getByText('Daily quests').first().waitFor();
  await page.getByText(/Up next/).waitFor();
  await page.getByText('Rewards in reach').waitFor();
  await shot('03-home');
  await noOverflow('home');
});

await step('completing a habit awards XP exactly once', async () => {
  const before = await xpTotal();
  const bed = page.getByRole('button', { name: 'Make bed' });
  await bed.click();
  await page.waitForFunction((b) => Number(document.body.innerText.match(/([\d,]+) total XP/)[1].replace(/,/g, '')) > b, before);
  const after = await xpTotal();
  assert(after - before >= 5, `expected +5 XP, got ${after - before}`);
  // Rapid repeat taps on the completed habit (in the "completed" list) must not farm XP.
  await page.getByRole('button', { name: /Show completed/ }).click();
  const done = page.getByRole('button', { name: 'Make bed (done)' });
  await done.click(); // untick
  await page.getByRole('button', { name: 'Make bed' }).first().click(); // re-tick
  await page.waitForTimeout(600);
  const again = await xpTotal();
  assert(again === after, `XP changed after untick/retick: ${after} → ${again}`);
});

await step('water quick action fills the water habit', async () => {
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: /^\d+\/6$/ }).click();
  await page.getByRole('button', { name: '6/6' }).waitFor();
});

await step('completing every habit triggers the level-up celebration', async () => {
  for (;;) {
    const next = page.locator('#today-habits').locator('xpath=ancestor::div[1]/following-sibling::div[1]').getByRole('button', { name: /^(Wake up on time|Brush teeth \(morning\)|Brush teeth \(evening\)|Complete homework)$/ });
    if ((await next.count()) === 0) break;
    await next.first().click();
    await page.waitForTimeout(150);
    const dlg = page.getByRole('dialog');
    if (await dlg.count()) {
      await shot('04-celebration');
      await dlg.getByRole('button').last().click();
    }
  }
  // Physical activity is linked to the exercise log.
  await page.getByRole('button', { name: 'Physical activity' }).click();
  await page.getByRole('dialog').getByRole('radio', { name: '30', exact: true }).first().click();
  await page.getByRole('button', { name: 'Save activity' }).click();
  for (let i = 0; i < 6; i++) {
    const dlg = page.getByRole('dialog');
    await page.waitForTimeout(250);
    if (!(await dlg.count())) break;
    if (/Level/.test((await dlg.getAttribute('aria-label')) ?? '')) await shot('05-level-up');
    await dlg.getByRole('button').last().click();
  }
  await page.getByText('Perfect day!').waitFor();
  const lvl = await page.getByText(/^Level \d+$/).first().textContent();
  assert(lvl !== 'Level 1', 'expected to have levelled up');
});

await step('data persists across a reload', async () => {
  const before = await xpTotal();
  await page.reload();
  await page.getByText('Perfect day!').waitFor();
  assert((await xpTotal()) === before, 'XP changed after reload');
});

await step('PWA manifest is valid for Android install', async () => {
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const m = await (await page.request.get(new globalThis.URL(href, URL).toString())).json();
  assert(m.name === 'LIFE XP' && m.display === 'standalone', 'name/display');
  assert(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'), 'maskable icon');
  assert(m.icons.some((i) => i.sizes === '192x192'), '192 icon');
  assert(m.start_url && m.background_color && m.theme_color, 'start_url/colours');
});

await step('service worker controls the page', async () => {
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null || false, null, { timeout: 15000 }).catch(async () => {
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  });
});

await step('works offline (reload with network off)', async () => {
  await ctx.setOffline(true);
  await page.reload();
  await page.getByText('Perfect day!').waitFor({ timeout: 10000 });
  await page.getByRole('link', { name: 'Progress' }).click();
  await page.getByText('Weekly consistency').waitFor({ timeout: 10000 }); // lazily loaded chunk served from cache
  await ctx.setOffline(false);
});

for (const [label, re, wait] of [
  ['habits', 'Habits', 'Your habits'],
  ['academy', 'Academy', 'GCSE Academy'],
  ['health', 'Health', 'Fuel today'],
  ['progress', 'Progress', 'Habit trends · last 4 weeks'],
]) {
  await step(`${label} screen renders without overflow`, async () => {
    await dismiss();
    await page.getByRole('link', { name: re, exact: true }).click();
    await page.getByText(wait).first().waitFor();
    await page.waitForTimeout(400);
    await shot(`06-${label}`);
    await noOverflow(label);
  });
}

await step('academy: focus session → reflection → XP, topic scheduled for review', async () => {
  await dismiss();
  await page.getByRole('link', { name: 'Academy', exact: true }).click();
  await dismiss();
  await page.getByRole('button', { name: /Start focus session/ }).click();
  await page.getByPlaceholder('New topic name (optional)').fill('Fractions');
  await page.getByRole('radio', { name: '10 min' }).click();
  await shot('07-start-session');
  await page.getByRole('button', { name: /Start 10-minute session/ }).click();
  await page.getByText('focusing').waitFor();
  await shot('08-timer');
  // Simulate 10 minutes of focus with Playwright's fake clock.
  await page.clock.fastForward('10:05');
  await page.getByText('Session check-in').waitFor({ timeout: 10000 });
  await page.getByPlaceholder(/simultaneous/).fill('Adding and simplifying fractions');
  await page.getByRole('radio', { name: '3' }).click();
  await page.getByRole('button', { name: 'Save session' }).click();
  await page.getByText('Session complete').waitFor();
  await page.getByText('+10 XP').first().waitFor();
  await dismiss();
  await shot('09-session-done');
  await page.getByRole('button', { name: 'Back to Academy' }).click();
  await page.getByText(/1\s*\/3/).first().waitFor();
});

await step('quests, profile, achievements and settings render', async () => {
  for (const [hash, text] of [
    ['#/quests', 'Daily quests'],
    ['#/profile', 'Emblem'],
    ['#/achievements', 'In progress'],
    ['#/settings', 'Backup'],
    ['#/academy/stats', '1 · Time invested'],
    ['#/academy/planner', 'Revision planner'],
  ]) {
    await page.goto(URL + hash);
    await page.getByText(text).first().waitFor();
    await noOverflow(hash);
    await shot(`10-${hash.replace(/[#/]/g, '')}`);
  }
});

await step('modern Galaxy size (412×915) renders the dashboard', async () => {
  const p2 = await ctx.newPage();
  await p2.setViewportSize({ width: 412, height: 915 });
  await p2.goto(URL);
  await p2.getByText('Rewards in reach').waitFor();
  const o = await p2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  assert(o, 'overflow at 412px');
  if (SHOTS) await p2.screenshot({ path: path.join(SHOTS, '11-home-412.png') });
  await p2.close();
});

await step('no uncaught errors in the console', async () => {
  const real = errors.filter((e) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(e));
  assert(real.length === 0, real.join(' | '));
});

await browser.close();
stopServer();
console.log(`\nLIFE XP end-to-end (${galaxy.userAgent.match(/SM-\w+/)?.[0] ?? 'Galaxy'} viewport)\n${results.join('\n')}\n`);
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
