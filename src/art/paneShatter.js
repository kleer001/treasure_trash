// The clip of a pane of glass shoved over and breaking into the glass on the floor, in 60 Hz frames.
import { C } from './flight.js';
import { frame, restAt } from './pane.js';
import { glassShards } from './glass.js';
import { moved } from './stills.js';

/** In frames: `tip` for the pane to fall flat, `flash` white once it is down, `scatter` for the last
 *  shard to land. `burst` is how far out from the fallen pane the shards start, 0 to 1 of the way to
 *  where they land; `hop` is px. */
export const SHATTER = { tip: 8, flash: 2, scatter: 16, burst: 0.3, hop: 5 };
const onTwos = f => f - (f % 2);

/** The pane standing in cell `from`, shoved `dir` to break into the glass of cell `to`, where
 *  `has(x, y)` says whether a cell is glass once it has and `look` is the glass's look.
 *  `layers(f)` is the pane and the shards in the air `f` frames from the start of the move, as
 *  `{ kind, foot, px }` in px on the room; `ground(f)` the pixels of cell `to`'s glass down by then.
 *  `end` is the first frame drawn at rest. */
export function paneShatter({ dir, from, to, has, look, k = SHATTER }) {
  const O = restAt(...from, C), f90 = frame(dir, 90), lift = dir === 'l' || dir === 'r' ? f90.s.h / 2 : 0;
  const hit = [O[0] + f90.ox + f90.s.w / 2, O[1] + f90.oy + f90.s.h / 2], mid = [to[0] * C + C / 2, to[1] * C + C / 2];
  const down = k.tip + k.flash;
  const shards = glassShards(...to, has, look).filter(px => px.length).map(px => {
    const cx = px.reduce((n, p) => n + p[0], 0) / px.length, cy = px.reduce((n, p) => n + p[1], 0) / px.length;
    return { px, foot: Math.max(...px.map(p => p[1])) + 1, out: Math.hypot(cx - mid[0], cy - mid[1]),
      d: [hit[0] + (cx - mid[0]) * k.burst - cx, hit[1] + (cy - mid[1]) * k.burst - cy - lift] };
  });
  const far = Math.max(1, ...shards.map(s => s.out));
  for (const s of shards) s.land = k.scatter * (0.55 + 0.45 * s.out / far);
  const flown = (s, f) => Math.min(1, onTwos(f - down) / s.land);
  const own = ([x, y]) => Math.floor(x / C) === to[0] && Math.floor(y / C) === to[1];

  function layers(f) {
    if (f < down) {
      const fr = frame(dir, Math.min(90, Math.round(90 * (onTwos(f) / k.tip) ** 2))), gx = O[0] + fr.ox, gy = O[1] + fr.oy;
      const px = moved(fr.s.px, gx, gy);
      return [{ kind: 'pane', foot: gy + fr.s.h, px: f >= k.tip ? px.map(([x, y]) => [x, y, look.glare]) : px }];
    }
    return shards.flatMap(s => {
      const u = flown(s, f);
      if (u >= 1) return [];
      const e = 1 - (1 - u) ** 2, dx = Math.round(s.d[0] * (1 - e)), dy = Math.round(s.d[1] * (1 - e)), up = Math.round(k.hop * 4 * u * (1 - u));
      return [{ kind: 'air', foot: s.foot + dy, px: s.px.map(([x, y, c]) => [x + dx, y + dy - up, c]) }];
    });
  }
  const ground = f => (f < down ? [] : shards.filter(s => flown(s, f) >= 1).flatMap(s => s.px.filter(own)));
  return { layers, ground, end: down + 2 * Math.ceil(k.scatter / 2) };
}
