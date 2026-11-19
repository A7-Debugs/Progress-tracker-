// Renders the LIFE XP emblem to PNG app icons with headless Chromium.
// Usage: node scripts/gen-icons.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const svg = readFileSync(path.join(root, 'public/favicon.svg'), 'utf8');
mkdirSync(path.join(root, 'public/icons'), { recursive: true });

// any: rounded dark tile with the emblem. maskable: full-bleed background, emblem inside the 80% safe zone.
const page = (size, { maskable }) => `<!doctype html><html><body style="margin:0;background:transparent">
<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
background:radial-gradient(circle at 50% 30%, #1b1640 0%, #07070d 70%);border-radius:${maskable ? 0 : size * 0.22}px">
<div style="width:${size * (maskable ? 0.56 : 0.74)}px;height:${size * (maskable ? 0.56 : 0.74)}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body></html>`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const p = await ctx.newPage();
const out = [
  ['public/icons/icon-192.png', 192, false],
  ['public/icons/icon-512.png', 512, false],
  ['public/icons/icon-maskable-512.png', 512, true],
  ['public/apple-touch-icon.png', 180, true],
];
for (const [file, size, maskable] of out) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(page(size, { maskable }));
  await p.screenshot({ path: path.join(root, file), omitBackground: !maskable, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', file);
}
await browser.close();
