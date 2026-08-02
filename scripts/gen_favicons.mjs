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
const SCALE = 0.78;           // shrink to leave room for the extrusion
const TX = 8.6, TY = 2.9;     // re-centre the letters + their extrusion in the tile

// ── Extrusion ──────────────────────────────────────────────────────────────
// Depth is built from stacked copies stepped along a 45° vector — enough
// copies that the body reads as one solid extruded mass, not a visible stack.
const STEPS = 16;
const STEP = 0.42;

const OUTER = 9;    // silhouette weight
const INNER = 3.6;  // hollow interior weight

const stroke = (color, w) =>
  PATHS.map(d => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="6"/>`).join('');

const mark = (color, w) =>
  `<g transform="translate(${TX},${TY}) scale(${SCALE})"><g transform="${SLANT}">${stroke(color, w)}</g></g>`;

// Far copy → near copy. `from` defaults to 1 so the body stops one step short
// of the front face — the front is always drawn last and whole, otherwise the
// near copies eat its edges and the mark collapses into a bare silhouette.
const layer = (color, w, from = 1) => {
  let out = '';
  for (let i = STEPS; i >= from; i--) {
    const d = (i * STEP).toFixed(2);
    out += `<g transform="translate(${d},${d})">${mark(color, w)}</g>`;
  }
  return out;
};

// A hollow extruded tube: solid body, hollow bored through it, then the front
// face redrawn on top so its outline survives.
const tube = (edge, core) =>
  layer(edge, OUTER) + layer(core, INNER) + mark(edge, OUTER) + mark(core, INNER);

const wrap = (bg, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="12" fill="${bg}"/>
${body}
</svg>
`;

const variants = {
  // Hollow extruded tube — the interior runs the full depth, as in the reference.
  '1-3d-hollow-ink': wrap(PAPER, tube(INK, PAPER)),
  '2-3d-hollow-sienna': wrap(PAPER, tube(SIENNA, PAPER)),

  // Two-tone: solid sienna extruded body, ink outlined front face on top.
  '3-3d-twotone': wrap(PAPER, layer(SIENNA, OUTER) + mark(INK, OUTER) + mark(PAPER, INNER)),

  // Inverted tile.
  '4-3d-inverted': wrap(SIENNA, tube(PAPER, SIENNA)),

  // Solid front face on a sienna body — no hollow. The only one that survives 16px.
  '5-3d-solid': wrap(PAPER, layer(SIENNA, OUTER) + mark(INK, OUTER)),
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
