import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });

const INK = '#1a1614';
const WHITE = '#ffffff';

// ── Mark geometry ──────────────────────────────────────────────────────────
// T and W side by side on a 64-unit grid, overlapping so the W's left arm
// crosses the T's stem. Each variant is a list of paths; bounds are measured
// off the paths, so reshaping a letter can't knock the mark off-centre.
const W = 'M28 23 L35 50 L42 34 L49 50 L56 23';
const W_TALL = 'M30 16 L35 50 L42 34 L49 50 L56 23';  // left arm reaches the crossbar

const SHAPES = {
  // The current mark: plain crossbar, plain stem.
  'a-plain': ['M7 16 H37', 'M22 16 V50', W],

  // Crossbar and the W's left arm are one continuous line.
  'b-ligature': ['M7 16 H30', 'M22 16 V50', W_TALL],

  // Crossbar overhangs hard to the left.
  'c-overhang': ['M0 16 H37', 'M22 16 V50', W],

  // Crossbar tilts up to the right, against the italic lean.
  'd-angled': ['M7 19 L37 13', 'M22 16 V50', W],

  // Crossbar steps: left arm sits higher than the right.
  'e-split': ['M7 12 H22', 'M22 19 H37', 'M22 12 V50', W],

  // Stem breaks through the crossbar.
  'f-dagger': ['M7 16 H37', 'M22 9 V50', W],

  // Bracketed: short flags drop from both ends of the crossbar.
  'g-flagged': ['M7 16 H37', 'M22 16 V50', 'M7 16 V23', 'M37 16 V22', W],
};

const SLANT_DEG = 10;
const K = Math.tan((SLANT_DEG * Math.PI) / 180);

// Walk the path commands (only M/L/H/V are used) to collect every point.
const points = paths => {
  const out = [];
  for (const d of paths) {
    let x = 0, y = 0;
    for (const [, cmd, args] of d.matchAll(/([MLHV])\s*([-\d.\s]+)/g)) {
      const n = args.trim().split(/[\s,]+/).map(Number);
      if (cmd === 'M' || cmd === 'L') {
        for (let i = 0; i + 1 < n.length; i += 2) { x = n[i]; y = n[i + 1]; out.push([x, y]); }
      } else if (cmd === 'H') {
        for (const v of n) { x = v; out.push([x, y]); }
      } else {
        for (const v of n) { y = v; out.push([x, y]); }
      }
    }
  }
  return out;
};

const stroke = (paths, color, w) =>
  paths.map(d => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="6"/>`).join('');

// `width` is how wide the mark sits in the 64-unit tile, `w` the stroke weight.
// Scale and centring are derived from the measured bounds, so the two stay
// independent — change one without nudging the other back into place.
const mark = (paths, color, w, width) => {
  const pts = points(paths);
  const x0 = Math.min(...pts.map(p => p[0])) - w / 2;
  const x1 = Math.max(...pts.map(p => p[0])) + w / 2;
  const y0 = Math.min(...pts.map(p => p[1])) - w / 2;
  const y1 = Math.max(...pts.map(p => p[1])) + w / 2;
  const skewedMinX = x0 - K * y1;
  const s = width / ((x1 - x0) + K * (y1 - y0));
  const tx = (64 - width) / 2 - skewedMinX * s;
  const ty = (64 - (y1 - y0) * s) / 2 - y0 * s;
  return `<g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${s.toFixed(4)})"><g transform="skewX(-${SLANT_DEG})">${stroke(paths, color, w)}</g></g>`;
};

const wrap = (bg, body, round = 12) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
${bg === null ? '' : `<rect width="64" height="64" rx="${round}" fill="${bg}"/>`}
${body}
</svg>
`;

const WEIGHT = 5.5, WIDTH = 42;

const variants = Object.fromEntries(
  Object.entries(SHAPES).map(([name, paths]) => [name, wrap(WHITE, mark(paths, INK, WEIGHT, WIDTH))])
);

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
