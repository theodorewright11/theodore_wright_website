import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });

const PAPER = '#f7f3ec';
const INK = '#1a1614';
const SIENNA = '#8a4a2b';

// Letter skeletons on a 64-unit grid: T and W side by side, overlapping so the
// W's left arm crosses the T's stem (the interlock in the reference mark).
const T_BAR = 'M7 16 H37';
const T_STEM = 'M22 16 V50';
const W = 'M28 23 L35 50 L42 34 L49 50 L56 23';
const ALL = [T_BAR, T_STEM, W];

// skewX(-10) leans the letterforms; translate re-centres the result.
const SLANT = 'translate(4.5,0) skewX(-10)';

const strokes = (color, w, extra = '') =>
  ALL.map(d => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="6"${extra}/>`).join('\n    ');

const wrap = (bg, body, round = 12) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${round}" fill="${bg}"/>
  <g transform="${SLANT}">
    ${body}
  </g>
</svg>
`;

const variants = {
  // 1 — hollow ink outline. Closest to the reference: thick silhouette, white interior.
  '1-outline-ink': wrap(PAPER, [strokes(INK, 9), strokes(PAPER, 3.6)].join('\n    ')),

  // 2 — same construction in sienna.
  '2-outline-sienna': wrap(PAPER, [strokes(SIENNA, 9), strokes(PAPER, 3.6)].join('\n    ')),

  // 3 — sienna extrusion offset behind an ink outline: actual 3D depth.
  '3-extruded': wrap(PAPER, [
    `<g transform="translate(3.2,3.2)">${strokes(SIENNA, 9)}</g>`,
    strokes(INK, 9),
    strokes(PAPER, 3.6),
  ].join('\n    ')),

  // 4 — inverted: solid sienna tile, hollow cream outline.
  '4-inverted': wrap(SIENNA, [strokes(PAPER, 9), strokes(SIENNA, 3.6)].join('\n    ')),

  // 5 — solid slanted mark, no hollow. Heaviest / most legible at 16px.
  '5-solid': wrap(PAPER, strokes(SIENNA, 8.5)),
};

const names = Object.keys(variants);
for (const [name, svg] of Object.entries(variants)) {
  writeFileSync(join(OUT, `${name}.svg`), svg);
  await sharp(Buffer.from(svg), { density: 900 }).resize(256, 256).png().toFile(join(OUT, `${name}.png`));
}

// Contact sheet: one row per variant — 128px hero, then 64 / 32 / 16 to check legibility.
const SIZES = [128, 64, 32, 16];
const ROW_H = 150, PAD = 24, LABEL = 0;
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

await sharp({
  create: { width, height, channels: 3, background: '#ffffff' },
})
  .composite(composites)
  .png()
  .toFile(join(OUT, 'contact-sheet.png'));

console.log('wrote', names.join(', '), '→', OUT);
