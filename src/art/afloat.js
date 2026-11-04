// A thing afloat in the water: sunk in, murky under its waterline, and the plunge and bobs of one
// that has just come down in it, in 60 Hz frames and px on the room.
import { BAYER, soaked, WATER } from './water.js';

/** px: afloat a thing sits `drop` lower than on the floor with `depth` rows under its waterline,
 *  which glints `glint` past it; `plunge` and `amp` are how far it plunges on landing and its first
 *  bob goes, and its rings spread `ripple` past it, as deep as `squash` % of their width. `murk` is
 *  the % of it under the waterline the water covers and `decay` how much smaller each bob is than
 *  the last, %. `settle` and `splash` are frames from landing to lying still and to the splash's end. */
export const FLOAT = { drop: 3, depth: 1, murk: 55, glint: 2, plunge: 3, amp: 1, bobs: 2, decay: 50, settle: 60, splash: 26, ripple: 5, squash: 45 };

const lowest = s => s.px.reduce((m, p) => Math.max(m, p[1]), 0);
const easeOut = u => 1 - (1 - u) ** 2;
/** The first row under water of sprite `s` afloat with its top at row `y`. */
export const waterline = (s, y, k = FLOAT) => y + lowest(s) + 1 - k.depth;

/** Sprite `s` with its top-left at (x0, y0) and its first row under water `yw`, in px on the room,
 *  with the glints on the waterline either side of it. `wet(x, y)` says whether a pixel of the room
 *  is water and `open(x, y)` whether it is water clear of the rim. */
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

/** A thing `w` px wide with its left at `x0` and its waterline `yw`, `f` frames after it came down
 *  in the water, its plunge `size` px deep: `sink`, px below its rest; `under`, the rings on the open
 *  water round it; `over`, the drops in the air. `seed` picks the drops' heights. */
export function bobbing({ w, x0, yw, f, open, size = FLOAT.plunge, seed = 0, k = FLOAT }) {
  f -= f % 2;
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
    ring(easeOut(e), k.ripple * 1.5, 0);
    if (e < 0.5) for (let i = 0, u = e * 2; i < 6; i++) {
      const far = (w / 2 - 2 + (i >> 1) * 2 + k.ripple * u) * (i % 2 ? 1 : -1), up = (4 + k.ripple + ((seed + i) % 3)) * 4 * u * (1 - u);
      over.push([Math.round(cx + far), Math.round(yw - up), i < 2 ? WATER.SHINE : WATER.LIGHT]);
    }
  }
  if (v >= 1 && n < k.bobs) ring(v - 1 - n, k.ripple * shrink(n), n + 1);
  return { sink, under, over };
}
/** The first frame after landing with a thing afloat lying still. */
export const bobEnd = (k = FLOAT) => Math.max(k.settle, k.splash);
