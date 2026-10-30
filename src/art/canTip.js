// The clip of a full can tipping over, in 60 Hz frames.
import { DIRS } from '../rules.js';
import { C } from './flight.js';
import { frame, restAt, bagIn, spun, CAN } from './can.js';
import { at, moved } from './stills.js';
import { stretch } from './stretch.js';

/** `hop` is how high the bag arcs and `depth` how far it squashes, in px. */
export const TIP = { tip: -3, fall: 7, pour: 4, fly: 5, squash: 8, hop: 6, depth: 8, spin: true };

/** The clip's keys, in frames from the start of a move that takes `moveFrames`. */
function tipKeys(moveFrames, k) {
  const tip = Math.max(0, moveFrames + k.tip), flat = tip + Math.max(2, k.fall);
  const pour = tip + Math.max(0, k.pour), land = pour + Math.max(2, k.fly), rest = land + Math.max(1, k.squash);
  return { tip, flat, pour, land, rest };
}
/** How far over the can is at frame `f`, degrees. */
const degAt = (keys, f) => (f <= keys.tip ? 0 : f >= keys.flat ? 90
  : Math.round(90 * ((f - keys.tip) / (keys.flat - keys.tip)) ** 2));
const quadOut = u => 1 - (1 - u) ** 2;
const onTwos = f => f - (f % 2);

/** Every in-between of the fall toward the viewer and away, as calls that trace it, to run before
 *  a clip needs them. */
export function tracings() {
  const keys = tipKeys(0, TIP), out = [];
  for (let f = keys.tip + 1; f < keys.flat; f++) for (const dir of 'ud') out.push(() => frame(dir, degAt(keys, f)));
  return out;
}

/** The clip for the bag drawing `BAG`, whose last row is the shadow it stands on. */
export function createCanTip(BAG) {
  const AIR = { ...BAG, px: BAG.px.filter(p => p[1] < BAG.h - 1) };
  const [BX, BY] = bagIn(BAG), MID = [BX + BAG.w / 2, BY + BAG.h / 2];
  const GRID = Array.from({ length: BAG.h }, () => Array(BAG.w).fill(null));
  for (const [x, y, c] of BAG.px) GRID[y][x] = c;
  /** The bag resized to w × h, nearest pixel, so every pixel stays one of the sprite's own. */
  const resize = (w, h) => {
    const rows = stretch(GRID, h, 0, 0).map(r => stretch(r, w, 0, 0));
    return { w, h, px: rows.flatMap((r, y) => r.flatMap((c, x) => (c ? [[x, y, c]] : []))) };
  };

  /** `layers(f, along)` is the can and its bag `f` frames from the start of its move, as `[foot, px]` pairs
   *  in px on the room, where `along` is how far along its move the can is, 0 to 1. `end` is the first frame drawn at rest. */
  return ({ dir, from, to, bagTo, moveFrames, down = false, k = TIP }) => {
    const keys = tipKeys(moveFrames, k), [dx] = DIRS[dir];
    const O = restAt(...from, C), end = restAt(...to, C, dir), f90 = frame(dir, 90);
    const offset = [end[0] - (O[0] + f90.ox), end[1] - (O[1] + f90.oy)];
    const [lx, ly] = at(BAG, ...bagTo), landing = [lx + BAG.w / 2, ly + BAG.h / 2];
    const canAt = (f, along) => {
      const s = f >= moveFrames ? 1 : along;
      return [O[0] + Math.round(offset[0] * s), O[1] + Math.round(offset[1] * s)];
    };
    const inCan = (f, along) => {
      const P = canAt(f, along), d = degAt(keys, f), [x, y] = frame(dir, d).place(MID[0], MID[1], CAN.R);
      return { x: P[0] + x, y: P[1] + y, turn: dx * d };
    };
    const thrown = inCan(keys.pour, 1), spin = k.spin ? dx * 360 : 0;
    const leaving = f => {
      const u = Math.min(1, (f - keys.pour) / (keys.land - keys.pour)), e = quadOut(u);
      return { x: thrown.x + (landing[0] - thrown.x) * e, y: thrown.y + (landing[1] - thrown.y) * e - k.hop * 4 * u * (1 - u),
        turn: thrown.turn + (spin - thrown.turn) * e };
    };
    const air = (b, keep) => {
      const s = spun(AIR, Math.round(b.turn));
      return moved(s.px, Math.round(b.x - BAG.w / 2), Math.round(b.y - BAG.h / 2)).filter(([x, y]) => keep(x, y));
    };

    function layers(f, along) {
      f = onTwos(f);
      const P = canAt(f, along), fr = frame(dir, degAt(keys, f)), gx = P[0] + fr.ox, gy = P[1] + fr.oy;
      const can = moved(fr.s.px, gx, gy);
      if (f < keys.pour) can.push(...air(inCan(f, along), (x, y) => fr.shows(x - P[0], y - P[1])));
      const out = [[gy + fr.s.h, can]];
      if (f >= keys.pour && f < keys.land) { const b = leaving(f); out.push([b.y + BAG.h / 2, air(b, (x, y) => !fr.hides(x - P[0], y - P[1]))]); }
      if (f >= keys.land && down) {
        const u = Math.max(0, 1 - (f - keys.land) / (keys.rest - keys.land)), b = resize(Math.round(BAG.w * u), Math.round(BAG.h * u));
        out.push([(bagTo[1] + 1) * C, moved(b.px, Math.round(landing[0] - b.w / 2), Math.round(landing[1] - b.h / 2))]);
      } else if (f >= keys.land) {
        const sq = f >= keys.rest ? 0 : Math.round(k.depth * (1 - (f - keys.land) / (keys.rest - keys.land))), b = resize(BAG.w + sq, BAG.h - sq);
        out.push([(bagTo[1] + 1) * C, moved(b.px, ...at(b, ...bagTo))]);
      }
      return out;
    }
    return { layers, keys, end: keys.rest + (keys.rest % 2) };
  };
}
