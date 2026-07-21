const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// Brand colors
const BG = [10, 10, 12]; // #0a0a0c
const ACCENT = [124, 226, 129]; // #7ce281 (progress green)

function makeIcon(size, { maskable = false, radius = 0.22 } = {}) {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  const r = size * radius;

  // padding for maskable (safe zone ~ 80% center)
  const pad = maskable ? size * 0.1 : 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      let inside;
      if (maskable) {
        inside = true; // full bleed background for maskable
      } else {
        // rounded rect mask
        const dx = Math.max(0, Math.abs(x - cx) - (cx - r));
        const dy = Math.max(0, Math.abs(y - cy) - (cy - r));
        inside = dx * dx + dy * dy <= r * r;
      }
      if (!inside) {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
        continue;
      }
      png.data[idx] = BG[0];
      png.data[idx + 1] = BG[1];
      png.data[idx + 2] = BG[2];
      png.data[idx + 3] = 255;
    }
  }

  // Draw a simple upward "progress bar chart" glyph in accent color
  const barW = Math.round(size * (maskable ? 0.09 : 0.1));
  const gap = Math.round(size * (maskable ? 0.05 : 0.06));
  const baseY = Math.round(size * (maskable ? 0.72 : 0.74));
  const heights = [0.22, 0.36, 0.5].map((h) => Math.round(size * h));
  const startX = Math.round(cx - (barW * 3 + gap * 2) / 2) + (maskable ? Math.round(pad * 0.2) : 0);

  heights.forEach((h, i) => {
    const x0 = startX + i * (barW + gap);
    const y0 = baseY - h;
    for (let y = y0; y < baseY; y++) {
      for (let x = x0; x < x0 + barW; x++) {
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const idx = (size * y + x) << 2;
        png.data[idx] = ACCENT[0];
        png.data[idx + 1] = ACCENT[1];
        png.data[idx + 2] = ACCENT[2];
        png.data[idx + 3] = 255;
      }
    }
  });

  return png;
}

function write(name, png) {
  const buf = PNG.sync.write(png);
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log('wrote', name);
}

write('icon-192.png', makeIcon(192));
write('icon-512.png', makeIcon(512));
write('icon-maskable-512.png', makeIcon(512, { maskable: true }));

// apple-touch-icon (no transparency, iOS ignores alpha and rounds itself)
const apple = makeIcon(180, { maskable: true });
fs.writeFileSync(path.join(__dirname, '..', 'public', 'apple-touch-icon.png'), PNG.sync.write(apple));
console.log('wrote apple-touch-icon.png');
