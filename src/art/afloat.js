// `afloat.js` draws things afloat in the water, and the plunge and bobs of one that has just come down in it.
// Times are 60 Hz frames; positions are px on the room.
import { BAYER } from './spread.js';
import { onTwos, quadOut, arc } from './timing.js';
import { soaked, WATER } from './water.js';

/** Lengths are px, except `murk`, `decay` and `squash`, which are percentages, and `settle` and `splash`, which are frames. */
export const FLOAT = { drop: 3, depth: 1, murk: 55, glint: 2, plunge: 3, amp: 1, bobs: 2, decay: 50, settle: 60, splash: 26, ripple: 5, squash: 45 };

const lowest = s => s.px.reduce((m, p) => Math.max(m, p[1]), 0);
/** Returns the first row under water of sprite `s` afloat with its top at row `y`. */
export const waterline = (s, y, k = FLOAT) => y + lowest(s) + 1 - k.depth;

/** Returns sprite `s` with its top-left at (x0, y0), in px on the room. Its first row under water is `yw`. The result also has the glints on the waterline, either side of it. `wet(x, y)` says whether a pixel is water. `open(x, y)` says whether it is water clear of the rim. */
export function afloat(s, x0, y0, yw, { wet, open }, k = FLOAT) {
  const murk = k.murk / 100 * 16, out = [], line = [];
  for (const [px, py, col] of s.px) {
    const x = x0 + px, y = y0 + py;
    if (y === yw) line.push(x);
    if (y < yw || !wet(x, yw)) out.push([x, y, col]);
    else if (wet(x, y) && murk <= BAYER[(y & 3) * 4 + (x & 3)] + 0.5) out.push([x, y, soaked(col)]);
  }
  if (!line.length) return out;
  const a = Math.min(...line), b = Math.max(...line), glints = [];
  for (let i = 1; i <= k.glint; i++) for (const x of [a - i, b + i]) if (open(x, yw)) glints.push([x, yw, WATER.LIGHT]);
  return [...glints, ...out];
}

/** Takes a thing `w` px wide, `f` frames after it came down in the water. Its waterline is `yw`, and its plunge is `size` px deep. Returns `{ sink, under, over }`. `sink` is px below its rest. `under` holds the rings on the open water. `over` holds the drops in the air. `seed` picks the drops' heights. */
export function bobbing({ w, x0, yw, f, open, size = FLOAT.plunge, seed = 0, k = FLOAT }) {
  f = onTwos(f);
  const v = f / (k.settle / (1 + k.bobs)), n = Math.floor(v - 1), shrink = i => (1 - k.decay / 100) ** i;
  const sink = v < 0 || v >= 1 + k.bobs ? 0 : v < 1 ? Math.round(size * Math.sin(Math.PI * v))
    : Math.round(-k.amp * shrink(n) * Math.sin(2 * Math.PI * (v - 1 - n)));
  const cx = x0 + w / 2, under = [], over = [];
  const ring = (e, reach, sparse) => {
    const rx = w / 2 + 1 + reach * e, ry = rx * k.squash / 100, gap = sparse + (e > 0.55 ? 1 : 0), seen = new Set();
    for (let a = 0; a < 96; a++) {
      const x = Math.round(cx + rx * Math.cos(a * Math.PI / 48) - 0.5), y = Math.round(yw + ry * Math.sin(a * Math.PI / 48) - 0.5);
      if (seen.has(`${x},${y}`) || (gap && (x + y) % (gap + 1))) continue;
      seen.add(`${x},${y}`);
      if (open(x, y)) under.push([x, y, WATER.LIGHT]);
    }
  };
  const e = f / k.splash;
  if (e < 1) {
    ring(quadOut(e), k.ripple * 1.5, 0);
    if (e < 0.5) for (let i = 0, u = e * 2; i < 6; i++) {
      const far = (w / 2 - 2 + (i >> 1) * 2 + k.ripple * u) * (i % 2 ? 1 : -1), up = arc(u, 4 + k.ripple + ((seed + i) % 3));
      over.push([Math.round(cx + far), Math.round(yw - up), i < 2 ? WATER.SHINE : WATER.LIGHT]);
    }
  }
  if (v >= 1 && n < k.bobs) ring(v - 1 - n, k.ripple * shrink(n), n + 1);
  return { sink, under, over };
}
export const bobEnd = (k = FLOAT) => Math.max(k.settle, k.splash);
