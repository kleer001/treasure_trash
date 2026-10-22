// The water jug seen straight from the side, standing free: full of water, or clear and empty once
// a shove has tipped it and it has poured itself out. Fallen toward the viewer or away it lies
// along the floor, its neck pointing the way it fell. Part-way through a pour the water has drawn
// back from the neck.
import { paint, tipper, INK } from './tip.js';

export const JUG = { W: 16, H: 22, D: 16 };   // px: width, height, diameter seen end on
const FOLD = 9;                               // px the jug's foot moves as it falls toward the viewer or away
const LEVELS = 8;                             // water levels drawn between full and empty
const DEEP = '#244287', MID = '#3169b0', LIGHT = '#7dafb3', SHINE = '#f1eccb', PLASTIC = '#67819e', CAP = '#2b2d55';

const SPAN = [[5, 10], [5, 10], [6, 9], [6, 9], [4, 11], [2, 13], [1, 14]];   // rows 0-6: cap, neck, shoulder
const span = r => r < SPAN.length ? SPAN[r] : r === JUG.H - 2 ? [1, 14] : r === JUG.H - 1 ? [2, 13] : [0, 15];
const RIDGES = [10, 14, 18];
const inJug = (c, r) => r >= 0 && r < JUG.H && c >= span(r)[0] && c <= span(r)[1] && !(r === 0 && (c === 5 || c === 10));
/** The water's top row in the upright jug, at `level` from 1 full to 0 empty: it draws back from the neck. */
const waterTop = level => 4 + Math.round((1 - level) * (JUG.H - 4));

/** The colour of the upright jug's front at column `c`, row `r`, holding water up to `level`. Clear
 *  plastic shows the floor through it. */
const side = level => (c, r) => {
  if (r < 2) return MID;                                                // the cap
  const [a, b] = span(r), f = (c - a) / Math.max(1, b - a), ridge = RIDGES.includes(r);
  if (r >= waterTop(level)) return ridge ? LIGHT : f > 0.12 && f < 0.24 ? (r % 3 ? LIGHT : SHINE) : f > 0.8 ? DEEP : MID;
  return ridge ? PLASTIC : f > 0.12 && f < 0.24 && r % 2 ? SHINE : null;
};
/** Ink where the cap's edge is ink: the cap is outlined in its own dark blue. */
const capped = (r, col) => r < 2 && col !== MID ? CAP : col;

/** Upright, from the front, holding water up to `level`. */
function front(level) {
  const s = paint(JUG.W, JUG.H, inJug, side(level));
  return { ...s, px: s.px.filter(p => p[2]).map(([c, r, col]) => [c, r, capped(r, col)]) };
}

const { W, H, D } = JUG, R = D / 2, MC = (W - 1) / 2, MR = (D - 1) / 2;
/** The colour of an end of the jug `dx` px right of its axis and `dy` px below it as it shows, water
 *  filling it while it is more than half full. */
const endColour = (level, neck) => (dx, dy) => {
  const d = Math.hypot(dx, dy), k = R - d;
  if (neck && d < 2.2) return d < 1.2 && dx < 0 && dy < 0 ? MID : CAP; // the cap, a glint on it
  if (!neck && Math.abs(k - 3) < 0.6) return PLASTIC;                   // the base's pressed ring
  if (level > 0.5) return k < 1 && dy < 0 ? LIGHT : MID;
  return k < 1 && dy < 0 && dx < 0 ? SHINE : null;
};
/** An end of the jug seen end on. */
function end(level, neck) {
  const s = paint(W, D, (c, r) => Math.hypot(c - MC, r - MR) <= R - 0.2, (c, r) => endColour(level, neck)(c - MC, r - MR));
  return { ...s, px: s.px.filter(p => p[2]) };
}

/** Each row of the front as a slice of the round jug: its radius about the axis. */
const RADII = Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => inJug(c, r)).filter(Boolean).length / 2);
/** The `lo`–`hi` stretch of `t` where `a·t + b` lies between `lo` and `hi`. */
const between = (a, b, lo, hi) => Math.abs(a) < 1e-9 ? (b >= lo && b <= hi ? [-Infinity, Infinity] : null)
  : a > 0 ? [(lo - b) / a, (hi - b) / a] : [(hi - b) / a, (lo - b) / a];

/** The jug `deg` degrees into a fall toward the viewer ('d') or away ('u'), holding water up to
 *  `level`: its rows turned into the round solid they are slices of, tipped about the edge of its
 *  foot, and traced pixel by pixel. Upright it is seen straight from the front; the eye rises with
 *  the fall until the jug lies seen from in front and 45° above, which draws it about as long as it
 *  stood. The front edge of its foot stays where it stood, so a jug falling away rises as the floor
 *  behind that edge comes into view. */
function rolled(dir, deg, level) {
  const s = dir === 'u' ? 1 : -1, pv = s * R, t = deg * Math.PI / 180;
  const cos = deg === 90 ? 0 : Math.cos(t), sin = deg === 90 ? 1 : Math.sin(t);
  // The eye `atan(k)` above level: depth draws at `k` px per px of height, the whole at `scale`.
  const k = sin, scale = 1 / Math.hypot(1, k), lift = k * (pv + R);
  // A point `v` px behind the axis and `h` px up it, as px up the picture from the foot.
  const seen = (v, h) => scale * (-s * (v - pv) * sin + h * cos + k * ((v - pv) * cos + s * h * sin) + lift);
  const down = -s * sin + k * cos > 0 ? -1 : 1;                         // which way a step back across an end shows
  const sideAt = side(level), neckAt = endColour(level, true), baseAt = endColour(level, false), wet = side(1);
  const shallow = H - waterTop(level);                                  // px up the jug the water stands
  const hits = new Map(), reach = H + D + 2;
  for (let y = Math.floor(H - lift - reach); y < H - lift + reach; y++) for (let x = 0; x < W; x++) {
    // The line of sight through this pixel, `t` px deeper: the jug's own v = A·t + B, h = E·t + F.
    const u = x - MC, up = (H - y - 0.5) / scale - lift;
    const A = cos + s * k * sin, B = pv - s * up * sin, E = s * sin - k * cos, F = up * cos;
    let best = null, water = false;
    RADII.forEach((r, row) => {
      if (Math.abs(u) >= r) return;
      const w = Math.sqrt(r * r - u * u), across = between(A, B, -w, w), along = between(E, F, H - 1 - row, H - row);
      if (!across || !along) return;
      const t0 = Math.max(across[0], along[0]);
      if (t0 >= Math.min(across[1], along[1])) return;
      if (H - row <= shallow) water = true;
      if (!best || t0 < best.t) best = { t: t0, row, v: A * t0 + B, face: across[0] >= along[0] ? 'side' : E > 0 ? 'base' : 'neck' };
    });
    if (best) hits.set(`${x},${y}`, { ...best, water });
  }
  const px = [];
  for (const [key, { row, v, face, water }] of hits) {
    const [x, y] = key.split(',').map(Number);
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !hits.has(`${x + a},${y + b}`));
    const col = edge ? (face === 'side' ? capped(row, INK) : INK)
      : (face === 'side' ? sideAt(x, row) : (face === 'neck' ? neckAt : baseAt)(x - MC, down * v)) ?? (water ? wet(x, 8) : null);
    if (col) px.push([x, y, col]);
  }
  return { px, place: (bx, by, d) => [bx, H - seen(d - R, H - by)] };
}

const JUGS = Array.from({ length: LEVELS + 1 }, (_, i) => {
  const level = i / LEVELS;
  return tipper(front(level), end(level, true), end(level, false), FOLD, (dir, deg) => rolled(dir, deg, level));
});
const at = level => JUGS[Math.round(Math.max(0, Math.min(1, level)) * LEVELS)];

/** The empty jug lying where it fell toward `dir`. */
export const rest = dir => JUGS[0].rest(dir);
/** The top-left of the jug in cell (cx, cy), upright, or lying where it fell toward `fell`. */
export const restAt = (cx, cy, C, fell = null) => JUGS[0].restAt(cx, cy, C, fell);
/** The jug `deg` degrees into a fall toward `dir`, holding water up to `level`. See `tipper`. */
export const frame = (dir, deg, level) => at(level).frame(dir, deg);
/** The jug upright and full. */
export const full = front(1);
/** Where the jug's mouth is in the upright jug: the top of its neck, half way back. */
export const MOUTH = [W / 2, 0, R];
