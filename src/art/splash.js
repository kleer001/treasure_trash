// The splash is what a pour throws up where it meets the floor, in 60 Hz frames and px on the room.
import { mulberry32 } from '../rng.js';
import { SHADOW } from './pile.js';
import { WATER } from './water.js';
import { arc, evenEnd } from './timing.js';

/** Frames: `hit`, `calm`, `every` and `life`. Px: `rise`, `reach`, `firstRise`, `firstReach`, `size` and `ring`.
 *  `wide` is in degrees either side of the pour's way. `colour` is a key of `WATER`.
 *  `first` and `drops` count the drops in the first burst and in each later burst. */
export const SPLASH = { hit: 0, calm: 0, every: 4, first: 5, firstRise: 5, firstReach: 10, drops: 3, rise: 5, reach: 6,
  life: 8, wide: 90, size: 1, ring: 3, colour: 'LIGHT', rim: false, shadow: true, seed: 167 };

/** Returns the splash of a pour that lands at px `at`. `dir` is the pour's way, as `[ux, uy]`. The pour runs from frame `pour` to frame `dry`.
 *  `drops(f)` is the splash at frame `f`, as `[foot, px]` pairs in px on the room.
 *  `end` is the frame with nothing left to draw, rounded up to an even frame. */
export function pourSplash({ at: [ax, ay], dir: [ux, uy], pour, dry, k = SPLASH }) {
  const start = pour + k.hit, stop = Math.max(start, dry + k.calm);
  const base = Math.atan2(uy, ux), half = k.wide * Math.PI / 180, drops = [];
  for (let b = start, i = 0; b <= stop; b += Math.max(1, k.every), i++) {
    const r = mulberry32((Math.imul(k.seed, 2654435761) ^ Math.imul(i + 1, 40503)) >>> 0);
    const [n, rise, reach] = i ? [k.drops, k.rise, k.reach] : [k.first, k.firstRise, k.firstReach];
    for (let j = 0; j < n; j++) {
      const a = base + (r() * 2 - 1) * half, d = reach * (0.4 + 0.6 * r());
      drops.push({ b, dx: Math.cos(a) * d, dy: Math.sin(a) * d, h: rise * (0.6 + 0.6 * r()),
        life: Math.max(2, Math.round(k.life * (0.7 + 0.6 * r()))) });
    }
  }
  const colour = WATER[k.colour];
  const square = (x, y, n, c) => Array.from({ length: n * n }, (_, i) => [x + (i % n), y + Math.floor(i / n), c]);
  const blob = (x, y) => [...(k.rim ? square(x - 1, y - 1, k.size + 2, WATER.EDGE) : []), ...square(x, y, k.size, colour)];

  function at(f) {
    const out = [];
    for (const d of drops) {
      const t = f - d.b;
      if (t < 0 || t >= d.life) continue;
      const u = t / d.life, x = Math.round(ax + d.dx * u), y = Math.round(ay + d.dy * u), z = Math.round(arc(u, d.h));
      const px = blob(x, y - z);
      if (k.shadow && z > 0) px.unshift(...Array.from({ length: k.size }, (_, i) => [x + i, y + k.size - 1, SHADOW]));
      out.push([y + k.size, px]);
    }
    if (k.ring && f >= start && f < dry) {
      const px = [], n = Math.max(6, Math.round(k.ring * 6)), turn = Math.floor(f / 2) % 2;
      for (let i = turn; i < n; i += 2) {
        const a = 2 * Math.PI * i / n;
        px.push([Math.round(ax + Math.cos(a) * k.ring), Math.round(ay + Math.sin(a) * k.ring), WATER.SHINE]);
      }
      out.push([ay, px]);
    }
    return out;
  }
  const end = Math.max(dry, ...drops.map(d => d.b + d.life));
  return { drops: at, end: evenEnd(end) };
}
