import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });

const PAPER = '#f7f3ec';
const INK = '#1a1614';
const SIENNA = '#8a4a2b';

// ── Mark geometry ──────────────────────────────────────────────────────────
// T and W side by side on a 64-unit grid, overlapping so the W's left arm
// crosses the T's stem. Tweak these three strings to reshape the letters.
const PATHS = [
  'M7 16 H37',                          // T crossbar
  'M22 16 V50',                         // T stem
  'M28 23 L35 50 L42 34 L49 50 L56 23', // W
];

const SLANT_DEG = 10;                                   // italic lean
const K = Math.tan((SLANT_DEG * Math.PI) / 180);

// Ink bounds of the letter skeleton before any transform.
const [X0, X1, Y0, Y1] = [7, 56, 16, 50];

const stroke = (color, w) =>
  PATHS.map(d => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="6"/>`).join('');

// `width` is how wide the mark should sit in the 64-unit tile and `w` is the
// stroke weight — the scale and centring fall out of the geometry, so the two
// stay independent (change one without nudging the other back into place).
const mark = (color, w, width) => {
  const x0 = X0 - w / 2, x1 = X1 + w / 2, y0 = Y0 - w / 2, y1 = Y1 + w / 2;
  const skewedMinX = x0 - K * y1;
  const s = width / ((x1 - x0) + K * (y1 - y0));
  const tx = (64 - width) / 2 - skewedMinX * s;
  const ty = (64 - (y1 - y0) * s) / 2 - y0 * s;
  return `<g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${s.toFixed(4)})"><g transform="skewX(-${SLANT_DEG})">${stroke(color, w)}</g></g>`;
};

const wrap = (bg, body, round = 12) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
${bg === null ? '' : `<rect width="64" height="64" rx="${round}" fill="${bg}"/>`}
${body}
</svg>
`;

const WHITE = '#ffffff';

// A size/weight ladder: 1 → 3 get progressively smaller and finer.
const variants = {
  '1-slim': wrap(WHITE, mark(INK, 6.5, 44)),
  '2-slimmer': wrap(WHITE, mark(INK, 5.5, 42)),
  '3-slimmest': wrap(WHITE, mark(INK, 4.5, 40)),

  // Mid weight, alternate treatments.
  '4-inverted': wrap(INK, mark(WHITE, 5.5, 42)),
  '5-bare': wrap(null, mark(INK, 5.5, 42)),
};

const names = Object.keys(variants);
for (const [name, svg] of Object.entries(variants)) {
  writeFileSync(join(OUT, `${name}.svg`), svg);
  await sharp(Buffer.from(svg), { density: 900 }).resize(256, 256).png().toFile(join(OUT, `${name}.png`));
}

// Contact sheet: one row per variant — 128px hero, then 64 / 32 / 16.
const SIZES = [128, 64, 32, 16];
const ROW_H = 150, PAD = 24;
const width = PAD * 2 + 128 + SIZES.slice(1).reduce((a, s) => a + s + 28, 0);
const height = PAD + names.length * ROW_H;

const composites = [];
for (let r = 0; r < names.length; r++) {
  const svg = variants[names[r]];
  let x = PAD;
  for (const s of SIZES) {
    const buf = await sharp(Buffer.from(svg), { density: 900 }).resize(s, s).png().toBuffer();
    composites.push({
      input: buf,
      left: Math.round(x),
      top: Math.round(PAD + r * ROW_H + (128 - s) / 2),
    });
    x += s + 28;
  }
}

await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
  .composite(composites)
  .png()
  .toFile(join(OUT, 'contact-sheet.png'));

console.log('wrote', names.join(', '), '→', OUT);
