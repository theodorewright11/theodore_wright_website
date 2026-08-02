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

const SLANT = 'skewX(-10)';   // italic lean
const SCALE = 0.92;
const TX = 5.5, TY = 1;       // re-centre after slant + scale

const OUTER = 9;    // silhouette weight
const INNER = 3.6;  // hollow interior weight

const stroke = (color, w) =>
  PATHS.map(d => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="6"/>`).join('');

const mark = (color, w) =>
  `<g transform="translate(${TX},${TY}) scale(${SCALE})"><g transform="${SLANT}">${stroke(color, w)}</g></g>`;

const wrap = (bg, body, round = 12) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
${bg === null ? '' : `<rect width="64" height="64" rx="${round}" fill="${bg}"/>`}
${body}
</svg>
`;

const WHITE = '#ffffff';

const variants = {
  // Solid black letters, white tile. Heaviest and most legible at 16px.
  '1-solid': wrap(WHITE, mark(INK, OUTER)),

  // Hollow outline — black silhouette, white interior.
  '2-hollow': wrap(WHITE, mark(INK, OUTER) + mark(WHITE, INNER)),

  // Lighter solid: thinner strokes, more air.
  '3-light': wrap(WHITE, mark(INK, 6.5)),

  // Inverted — black tile, white letters.
  '4-inverted': wrap(INK, mark(WHITE, OUTER), 12),

  // No tile: letters float on the page background, square-cropped.
  '5-bare': wrap(null, mark(INK, OUTER)),
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
