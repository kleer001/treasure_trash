// The clip of a full water jug tipping over and pouring out, in 60 Hz frames.
import { DIRS } from '../rules.js';
import { C } from './flight.js';
import { PUDDLE, WATER } from './water.js';
import { slickCell } from './slick.js';
import { pourSplash, SPLASH } from './splash.js';

/** Keys in frames: `tip` from the end of the slide, `fall` to lying, `settle` to the end of the rock
 *  back, `pour` from the tip, `drain` to empty, `reach` from the pour to the puddle's start, `still`
 *  from the puddle's full size to the ripples' rest. `ease` is the fall's power, `bounce` the rock
 *  back in degrees, `glide` the % of the slide moved into the fall, `ldy` px down lying, `sheen0` the
 *  ripples' width while they flow and `flow` their speed in px a frame. */
export const JUG_TIP = { tip: -3, fall: 7, settle: 6, pour: 7, drain: 17, reach: 4, still: 4, ease: 2, bounce: 0, glide: 0,
  ldy: -1, sheen0: 0.4, flow: 1 };

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const easeOut = u => 1 - (1 - u) ** 2;
const onTwos = f => f - (f % 2);
const clamp01 = u => Math.min(1, Math.max(0, u));

/** The clip's keys, in frames from the start of a move that takes `moveFrames`. */
export function jugKeys(moveFrames, k) {
  const tip = Math.max(0, moveFrames + k.tip), flat = tip + Math.max(2, k.fall), pour = tip + Math.max(0, k.pour);
  const dry = pour + Math.max(1, k.drain), wet = pour + Math.max(0, k.reach), grown = dry + wet - pour;
  return { tip, flat, settle: flat + Math.max(2, k.settle), pour, dry, wet, grown, still: grown + Math.max(1, k.still) };
}

/** Where drawing `d` goes in cell (cx, cy), its foot `down` px below the cell's floor line: its top-left in px. */
const jugAt = (d, cx, cy, down) => [cx * C + Math.floor((C - d.w) / 2), (cy + 1) * C - d.h - 1 + down];

/** The square jug baked into `J`, src/art/jug.json: its `drawing(dir, deg, F)`, the jug lying after
 *  falling `dir` as `rest(dir)`, and `restAt(cx, cy, C, fell)`, where it goes standing or lying, as
 *  src/art/can.js has them. Each pixel of a baked drawing is two hex digits into `J.palette`, '..' for none. */
export function bakedJug(J) {
  const memo = new Map();
  const drawing = (dir, deg, F) => {
    const key = `${dir},${deg},${F.toFixed(3)}`;
    if (!memo.has(key)) {
      const d = J.drawings[key];
      if (!d) throw new Error(`jug.json has no drawing ${key}`);
      memo.set(key, { ...d, px: d.rows.flatMap((r, y) => Array.from({ length: d.w }, (_, x) => r.slice(2 * x, 2 * x + 2))
        .flatMap((h, x) => (h === '..' ? [] : [[x, y, J.palette[parseInt(h, 16)]]]))) });
    }
    return memo.get(key);
  };
  const rest = dir => drawing(dir, 90, 0);
  const restAt = (cx, cy, _, fell = null) => (fell ? jugAt(rest(fell), cx, cy, JUG_TIP.ldy) : jugAt(drawing('r', 0, 0), cx, cy, J.dy));
  return { drawing, rest, restAt };
}

/** The clip for the jug `{ drawing, full, dy }`: `drawing(dir, deg, F)` is the jug `deg` over toward
 *  `dir` holding a fraction `F` of water, as `{ x, y, w, h, px, mouth }`, its px from its top-left
 *  (x, y) in a picture whose middle is the middle of the edge it goes over, and its mouth's middle
 *  from that top-left; `full` is the F of a full jug and `dy` px how far down it stands. */
export function createJugTip({ drawing, full, dy }) {
  /** The jug pushed `dir` from cell `from` to `to`, pouring onto cell `wetAt`; `wet(x, y)` says which
   *  cells hold water once it has, and `look` is the puddle's. `layers(f, along)` is the clip `f`
   *  frames from the start of the move as `[foot, px]` pairs in px on the room, where `along` is how
   *  far along its slide the jug is, 0 to 1; `ground(f)` is the puddle on `wetAt`, or null before it
   *  starts. `keys` are the clip's keys, `down` among them the frame the splash is over. `end` is the
   *  first frame drawn at rest. */
  return ({ dir, from, to, wetAt, moveFrames, wet = (x, y) => x === wetAt[0] && y === wetAt[1], k = JUG_TIP, look = PUDDLE,
    splash = SPLASH }) => {
    const keys = jugKeys(moveFrames, k), [ux, uy] = DIRS[dir];
    // Standing, it is drawn the same whichever way it is about to fall, so that it is its still.
    const stand = drawing('r', 0, full), up = drawing(dir, 0, full), flat = drawing(dir, 90, 0);
    const O = jugAt(stand, ...from, dy), end = jugAt(flat, ...to, k.ldy);
    const offset = [end[0] - O[0] - (flat.x - up.x), end[1] - O[1] - (flat.y - up.y)];
    const [wx, wy] = wetAt, lands = [wx * C + C / 2 - ux * (C / 2 - 5), wy * C + C / 2 - uy * (C / 2 - 5)];
    const spray = pourSplash({ at: lands, dir: [ux, uy], pour: keys.pour, dry: keys.dry, k: splash });

    function jug(f, along) {
      const u = clamp01((f - keys.tip) / (keys.flat - keys.tip));
      const deg = f <= keys.tip ? 0 : f < keys.flat ? Math.round(90 * u ** k.ease)
        : f < keys.settle ? Math.round(90 - k.bounce * Math.sin(Math.PI * (f - keys.flat) / (keys.settle - keys.flat))) : 90;
      const F = f <= keys.pour ? full : f >= keys.dry ? 0 : full * (1 - (f - keys.pour) / (keys.dry - keys.pour));
      const d = deg ? drawing(dir, deg, F) : stand, q = k.glide / 100, s = (1 - q) * (f >= moveFrames ? 1 : along) + q * u;
      const x = O[0] + Math.round(offset[0] * s) + (deg && d.x - up.x), y = O[1] + Math.round(offset[1] * s) + (deg && d.y - up.y);
      return { px: d.px.map(([a, b, c]) => [x + a, y + b, c]), foot: y + d.h, mouth: [x + d.mouth[0], y + d.mouth[1]] };
    }

    function stream([mx, my], f) {
      const [lx, ly] = lands, n = Math.ceil(Math.hypot(lx - mx, ly - my)), px = [];
      for (let i = 0; i <= n; i++) {
        const u = i / Math.max(1, n), sag = 4 * u * (1 - u) * 3;
        const x = Math.round(mx + (lx - mx) * u + ux * sag), y = Math.round(my + (ly - my) * u - (ux ? sag * 0.5 : 0));
        if ((i + Math.floor(f / 2)) % 5 === 0) { px.push([x, y, WATER.LIGHT]); continue; }
        px.push([x, y, WATER.LIGHT], [x + 1, y, WATER.LIGHT], [x, y + 1, WATER.LIGHT], [x + 1, y + 1, WATER.LIGHT], [x, y, WATER.SHINE]);
      }
      return px;
    }

    /** How far the ripples are from where they come to rest, px along the pour: they flow until the
     *  puddle has grown, then slow to a stop at the still key, so the last frame is the still puddle. */
    const slowed = f => clamp01((f - keys.grown) / (keys.still - keys.grown));
    const flowed = f => { const u = slowed(f); return Math.max(0, Math.min(f, keys.grown) - keys.wet) + (keys.still - keys.grown) * (u - u * u / 2); };

    function puddle(f) {
      if (f < keys.wet) return null;
      const d = k.flow * (flowed(f) - flowed(keys.still));
      const all = slickCell(wx, wy, wet, { ...look, sheen: k.sheen0 + (look.sheen - k.sheen0) * slowed(f) }, [ux * d, uy * d])
        .map(([x, y, c]) => [wx * C + x, wy * C + y, c]);
      const reach = Math.max(...all.map(([x, y]) => Math.hypot(x + 0.5 - lands[0], y + 0.5 - lands[1])));
      const r = reach * easeOut(Math.min(1, (f - keys.wet) / Math.max(1, keys.grown - keys.wet))) + 0.01;
      const grown = all.filter(([x, y]) => Math.hypot(x + 0.5 - lands[0], y + 0.5 - lands[1]) <= r);
      // Its rim where it has not yet reached; across the cell's edge, the water's own drawing says.
      const inside = new Set(grown.map(([x, y]) => `${x},${y}`)), mine = (x, y) => Math.floor(x / C) === wx && Math.floor(y / C) === wy;
      return grown.map(([x, y, c]) => [x, y, N4.some(([a, b]) => mine(x + a, y + b) && !inside.has(`${x + a},${y + b}`)) ? look.edge : c]);
    }

    function layers(f, along) {
      f = onTwos(f);
      const j = jug(f, along), out = [[j.foot, j.px]];
      if (f >= keys.pour && f < keys.dry) out.push([dir === 'u' ? lands[1] : Math.max(lands[1], j.foot + 1), stream(j.mouth, f)]);
      return [...out, ...spray.drops(f)];
    }
    const last = Math.max(keys.settle, keys.dry, keys.still, spray.end);
    return { layers, ground: f => puddle(onTwos(f)), keys: { ...keys, down: spray.end }, end: last + (last % 2) };
  };
}
