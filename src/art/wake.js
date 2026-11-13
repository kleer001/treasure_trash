// The water a thing stirs, made from its own sprite and the path it takes: rings and spray where it
// comes into the water, and a wake and a bow wave while it moves through it.

import { mulberry32 } from '../rng.js';
import { BAYER } from './spread.js';
import { arc, onTwos } from './timing.js';
import { waterColour } from './water.js';

/**
 * `ref` is the speed, in px a frame, that stirs the water at full strength. `ringSpeed` and `spread`
 * are px a frame, `dropLife` is frames, `squash` and `throw` are percentages, and other lengths are
 * px. `drops` counts the drops for each 24 px of the thing's waterline. A colour is a key of `WATER`
 * or a `#rrggbb`. Each curve is a list of `[frame, strength]` keys, sorted by frame and zero outside
 * them: `ring` and `spray` count frames from the landing, and `wake` counts the age of the
 * stirred water. With `ringFollows`, a ring is centred on the thing in each frame; without it, a ring
 * starts where the thing stops in the water, and its `ring` frames count from there.
 */
export const WAKE = {
  ref: 2,
  ringSpeed: 0.7, squash: 55, ringColour: 'SHINE', ringFollows: true,
  drops: 12, rise: 8, throw: 50, scatter: 3, dropLife: 14, dropColour: 'SHINE',
  spread: 1.25, bow: 3, wakeColour: 'LIGHT', bowColour: 'SHINE',
  curves: {
    ring: [[0, 1], [26, 0]],
    spray: [[0, 1], [4, 0]],
    wake: [[0, 1], [20, 0]],
  },
};

/** Returns the value of curve `keys` at frame `f`, through every key and with no corner at one. */
export function curveAt(keys, f) {
  if (!keys.length || f < keys[0][0] || f > keys.at(-1)[0]) return 0;
  const i = keys.findIndex(q => q[0] >= f);
  if (keys[i][0] === f) return keys[i][1];
  const [p1, p2] = [keys[i - 1], keys[i]], p0 = keys[i - 2], p3 = keys[i + 1], span = p2[0] - p1[0];
  const m1 = p0 ? (p2[1] - p0[1]) / (p2[0] - p0[0]) * span : 0, m2 = p3 ? (p3[1] - p1[1]) / (p3[0] - p1[0]) * span : 0;
  const u = (f - p1[0]) / span, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (3 * u2 - 2 * u3) * p2[1] + (u3 - u2) * m2;
}

const on = (k, x, y) => k * 16 > BAYER[(y & 3) * 4 + (x & 3)];

/** Returns the px of a 1 px line from (x0, y0) to (x1, y1). */
function line(x0, y0, x1, y1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1), out = [];
  for (let i = 0; i <= n; i++) out.push([Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n)]);
  return out;
}

/**
 * `path(f)` returns the thing `f` frames in as `{ s, x0, y0, yw, a, fx, fy }`: its sprite `s` with its
 * top-left at (x0, y0) and its first row under water `yw`, how far into the water it has come `a`
 * from 0 to 1, and its exact place `fx, fy` in px.
 */
function reader(path, sq) {
  const memo = new Map(), at = f => {
    f = Math.max(0, f);
    if (!memo.has(f)) memo.set(f, path(f));
    return memo.get(f);
  };
  const wet = f => f >= 0 && at(f).a >= 0.5;
  const vel = f => { const p = at(f), q = at(f - 2); return [(p.fx - q.fx) / 2, (p.fy - q.fy) / 2]; };
  const contact = f => {
    const p = at(f), row = Math.min(p.yw, p.y0 + Math.max(...p.s.px.map(q => q[1])));
    const xs = [...new Set(p.s.px.filter(q => p.y0 + q[1] === row).map(q => p.x0 + q[0]))];
    const lo = Math.min(...xs), hi = Math.max(...xs), hx = (hi - lo) / 2 + 1;
    return { xs, row, lo, hi, cx: (lo + hi) / 2, cy: row - hx * sq, hx, hy: hx * sq };
  };
  const landings = (t, ref) => {
    const out = [];
    for (let f = 2; f <= onTwos(t); f += 2)
      if (wet(f) && !wet(f - 2)) out.push({ f, E: Math.min(1, Math.hypot(...vel(f)) / ref), c: contact(f), v: vel(f) });
    return out;
  };
  /** Returns the ring of the landing at frame `L`, `t` frames in, as `{ f, c }`: the frame it starts and
   *  the contact it is drawn around. Returns null when it has not started. */
  const ringOf = (L, t, follows) => {
    if (follows) return { f: L, c: contact(t) };
    for (let f = L; f <= t; f += 2) {
      if (!wet(f)) return null;
      if (!vel(f).some(Boolean)) return { f, c: contact(f) };
    }
    return null;
  };
  return { wet, vel, contact, landings, ringOf };
}

/** Returns the frames, up to `t`, at which a thing on `path` comes into the water. */
export const landingFrames = (path, t) => reader(path, 1).landings(t, 1).map(l => l.f);

/** Returns how many frames after a thing stops the water it stirred takes to go still. */
export const wakeEnd = (k = WAKE) => {
  const last = name => k.curves[name].at(-1)?.[0] ?? 0;
  return 2 + Math.max(last('ring'), last('wake'), last('spray') + k.dropLife);
};

/** Returns the frame, up to `t`, at which the ring of the first landing on `path` starts, or null. */
export function ringStart(path, t, k = WAKE) {
  const r = reader(path, 1), [first] = r.landings(t, 1);
  return first ? r.ringOf(first.f, t, k.ringFollows)?.f ?? null : null;
}

/**
 * Returns the water stirred `t` frames along `path`, as `{ under, over }`: `under` holds the rings,
 * the wake and the bow wave, and `over` holds the drops.
 * `open(x, y)` says whether a pixel is open water.
 */
export function wake({ path, t, open, seed = 0, k = WAKE }) {
  t = onTwos(t);
  const sq = k.squash / 100, { wet, vel, contact, landings: landed, ringOf } = reader(path, sq), landings = landed(t, k.ref);
  const under = [], over = [];

  const ringCol = waterColour(k.ringColour);
  for (const { f: L, E } of landings) {
    const ring = ringOf(L, t, k.ringFollows);
    if (!ring) continue;
    const { c } = ring, g = t - ring.f, r = E * Math.max(0, curveAt(k.curves.ring, g));
    if (r <= 0.02) continue;
    const R = 1 + k.ringSpeed * g, H = Math.ceil(R * sq) + 1, W = Math.ceil(R) + 1;
    const inside = (x, y) => Math.hypot(Math.min(...c.xs.map(cx => Math.abs(x - cx))), (y - c.row) / sq) <= R;
    for (let y = c.row - H; y <= c.row + H; y++) for (let x = c.lo - W; x <= c.hi + W; x++)
      if (inside(x, y) && !(inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1)) && open(x, y) && on(r, x, y))
        under.push([x, y, ringCol]);
  }

  const wakeCol = waterColour(k.wakeColour), arms = [[], []];
  const life = k.curves.wake.at(-1)?.[0] ?? 0;
  for (let f = Math.max(2, t - onTwos(life)); f <= t; f += 2) {
    if (!wet(f) || !wet(f - 2)) { arms[0].push(null); arms[1].push(null); continue; }
    const v = vel(f), s = Math.hypot(...v), w = Math.min(1, s / k.ref) * Math.max(0, curveAt(k.curves.wake, t - f));
    if (s < 0.05 || w <= 0.02) { arms[0].push(null); arms[1].push(null); continue; }
    const c = contact(f), n = [-v[1] / s, v[0] / s], drift = k.spread * (t - f);
    [1, -1].forEach((sign, i) => arms[i].push({ w,
      x: c.cx + sign * n[0] * (c.hx + drift), y: c.cy + sign * n[1] * (c.hy + drift * sq) }));
  }
  for (const arm of arms) for (let i = 1; i < arm.length; i++) {
    const a = arm[i - 1], b = arm[i];
    if (a && b) for (const [x, y] of line(a.x, a.y, b.x, b.y)) if (open(x, y) && on(b.w, x, y)) under.push([x, y, wakeCol]);
  }

  if (wet(t)) {
    const v = vel(t), s = Math.hypot(...v), b = Math.min(1, s / k.ref);
    if (b > 0.1) {
      const c = contact(t), e = k.bow * b, col = waterColour(k.bowColour), seen = new Set();
      for (let i = 0; i < 64; i++) {
        const th = i * Math.PI / 32, dx = Math.cos(th), dy = Math.sin(th);
        if ((dx * v[0] + dy * v[1]) / s < 0.5) continue;
        const x = Math.round(c.cx + dx * (c.hx + e)), y = Math.round(c.cy + dy * (c.hy + e * sq));
        if (!seen.has(`${x},${y}`) && open(x, y)) { seen.add(`${x},${y}`); under.push([x, y, col]); }
      }
    }
  }

  const spray = k.curves.spray, first = Math.ceil(spray[0]?.[0] ?? 0), end = Math.floor(spray.at(-1)?.[0] ?? 0);
  const weights = [];
  for (let g = first; g <= end; g++) weights.push(Math.max(0, curveAt(spray, g)));
  const total = weights.reduce((a, b) => a + b, 0);
  const launchAt = u => { let acc = 0; for (let i = 0; i < weights.length; i++) { acc += weights[i] / total; if (u < acc) return first + i; } return end; };
  const dropCol = waterColour(k.dropColour);
  for (const { f: L, E, c, v } of landings) {
    const n = total > 0 ? Math.round(k.drops * E * c.xs.length / 24) : 0;
    for (let i = 0; i < n; i++) {
      const rnd = mulberry32(seed * 977 + L * 31 + i), age = t - L - launchAt(rnd());
      if (age < 0 || age >= k.dropLife) continue;
      const ox = c.xs[Math.floor(rnd() * c.xs.length)], spreadX = (rnd() - 0.5) * 2 * k.scatter, spreadY = (rnd() - 0.5) * 2 * k.scatter * sq;
      const vx = v[0] * k.throw / 100 + spreadX / k.dropLife, vy = v[1] * k.throw / 100 + spreadY / k.dropLife;
      const rise = k.rise * E * (0.5 + 0.5 * rnd());
      over.push([Math.round(ox + vx * age), Math.round(c.row + vy * age - arc(age / k.dropLife, rise)), dropCol]);
    }
  }

  return { under, over };
}
