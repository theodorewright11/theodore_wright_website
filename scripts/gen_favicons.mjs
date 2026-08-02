import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });

const INK = '#1a1614';
const WHITE = '#ffffff';

// ── Geometry helpers ───────────────────────────────────────────────────────
// The mark is filled polygons rather than uniform strokes: a split needs two
// separate shapes, and a taper needs the width to vary along a stroke.
const poly = pts => 'M' + pts.map(p => p.map(v => +v.toFixed(2)).join(' ')).join(' L') + ' Z';

const unit = ([x, y]) => { const L = Math.hypot(x, y); return [x / L, y / L]; };

// Variable-width polyline → closed polygon, mitred at the joins. `miter` caps
// how far a join may spike: sharp Vs (the bottom of the W) would otherwise run
// away to a needle. That cap is the pointiness knob.
function ribbon(pts, widths, miter = 2.2) {
  const n = pts.length;
  const segN = [];
  for (let i = 0; i < n - 1; i++) {
    const [dx, dy] = unit([pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]]);
    segN.push([-dy, dx]);
  }
  const off = pts.map((_, i) => {
    let d;
    if (i === 0) d = segN[0];
    else if (i === n - 1) d = segN[n - 2];
    else {
      const a = segN[i - 1], b = segN[i];
      const denom = 1 + (a[0] * b[0] + a[1] * b[1]);
      d = [(a[0] + b[0]) / denom, (a[1] + b[1]) / denom];
    }
    const h = widths[i] / 2;
    const len = Math.hypot(d[0], d[1]);
    const k = len > miter ? miter / len : 1;
    return [d[0] * h * k, d[1] * h * k];
  });
  const left = pts.map((p, i) => [p[0] + off[i][0], p[1] + off[i][1]]);
  const right = pts.map((p, i) => [p[0] - off[i][0], p[1] - off[i][1]]).reverse();
  return poly([...left, ...right]);
}

// ── The W ──────────────────────────────────────────────────────────────────
// Wide at the top, narrow at the two bottom vertices, so the feet come to a
// blunt point instead of a flat cut.
const wPts = [[28, 22], [35, 50], [42, 33], [49, 50], [56, 22]];
const wShape = (feet, miter) => ribbon(wPts, [9, feet, 8.5, feet, 9], miter);

// ── The T ──────────────────────────────────────────────────────────────────
const BAR_X0 = 3, BAR_X1 = 40, BAR_Y0 = 12, BAR_Y1 = 20;
const STEM_X = 22, STEM_BOT = 50;
const STEM_TOP_HALF = 5.5;

// Stem as a tapered trapezoid; `botHalf` sets how much it narrows.
const stem = (botHalf, top = BAR_Y1) => poly([
  [STEM_X - STEM_TOP_HALF, top], [STEM_X + STEM_TOP_HALF, top],
  [STEM_X + botHalf, STEM_BOT], [STEM_X - botHalf, STEM_BOT],
]);

// Crossbar cut in two with a gap, optionally with the halves at different heights.
const barHalves = (gap, riseR = 0) => {
  const g = gap / 2;
  return [
    poly([[BAR_X0, BAR_Y0], [STEM_X - g, BAR_Y0], [STEM_X - g, BAR_Y1], [BAR_X0, BAR_Y1]]),
    poly([[STEM_X + g, BAR_Y0 - riseR], [BAR_X1, BAR_Y0 - riseR],
          [BAR_X1, BAR_Y1 - riseR], [STEM_X + g, BAR_Y1 - riseR]]),
  ];
};

// Stem cut by the same gap, so the split runs the full height of the T.
const stemHalves = (gap, botHalf) => {
  const g = gap / 2;
  return [
    poly([[STEM_X - STEM_TOP_HALF, BAR_Y1], [STEM_X - g, BAR_Y1],
          [STEM_X - g, STEM_BOT], [STEM_X - botHalf, STEM_BOT]]),
    poly([[STEM_X + g, BAR_Y1], [STEM_X + STEM_TOP_HALF, BAR_Y1],
          [STEM_X + botHalf, STEM_BOT], [STEM_X + g, STEM_BOT]]),
  ];
};

const SHAPES = {
  // Split runs the full height of the T. Moderate taper on stem and W.
  'a-split-full': [...barHalves(2.6), ...stemHalves(2.6, 3.4), wShape(5.5, 2.2)],

  // Split in the crossbar only; the stem stays one solid tapered slab.
  'b-split-bar': [...barHalves(2.6), stem(3.4), wShape(5.5, 2.2)],

  // The two crossbar halves sit at different heights — the stepped offset.
  'c-offset': [...barHalves(2.6, 2.5), stem(3.4, BAR_Y1 - 2.5), wShape(5.5, 2.2)],

  // Same split as b, pushed further: narrower feet, longer mitres.
  'd-pointier': [...barHalves(2.6), stem(2.4), wShape(3.5, 3.2)],

  // Same split as b, pulled back: wider feet, short mitres.
  'e-blunter': [...barHalves(2.6), stem(4.4), wShape(7, 1.5)],
};

// ── Layout ─────────────────────────────────────────────────────────────────
const SLANT_DEG = 10;
const K = Math.tan((SLANT_DEG * Math.PI) / 180);

const bounds = paths => {
  const nums = paths.flatMap(d => [...d.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)/g)].map(m => [+m[1], +m[2]]));
  return [
    Math.min(...nums.map(p => p[0])), Math.max(...nums.map(p => p[0])),
    Math.min(...nums.map(p => p[1])), Math.max(...nums.map(p => p[1])),
  ];
};

// `width` is how wide the mark sits in the 64-unit tile. Scale and centring are
// derived from the measured bounds, so reshaping a letter can't knock it
// off-centre.
const mark = (paths, color, width) => {
  const [x0, x1, y0, y1] = bounds(paths);
  const s = width / ((x1 - x0) + K * (y1 - y0));
  const tx = (64 - width) / 2 - (x0 - K * y1) * s;
  const ty = (64 - (y1 - y0) * s) / 2 - y0 * s;
  const body = paths.map(d => `<path d="${d}" fill="${color}"/>`).join('');
  return `<g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${s.toFixed(4)})"><g transform="skewX(-${SLANT_DEG})">${body}</g></g>`;
};

const wrap = (bg, body, round = 12) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
${bg === null ? '' : `<rect width="64" height="64" rx="${round}" fill="${bg}"/>`}
${body}
</svg>
`;

const WIDTH = 44;

const variants = Object.fromEntries(
  Object.entries(SHAPES).map(([name, paths]) => [name, wrap(WHITE, mark(paths, INK, WIDTH))])
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
