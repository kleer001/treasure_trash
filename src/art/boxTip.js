// `boxTip.js` is the clip of a full recycling box tipping over and pouring its trash out, in 60 Hz frames.
import { BIN } from '../rules.js';
import { C } from './flight.js';
import * as BOX from './box.js';
import { SHADOW } from './pile.js';
import { moved } from './stills.js';
import { createToPile } from './toPile.js';
import { degAt, evenEnd, fallKeys, onTwos } from './timing.js';

/** The keys are frames, except `arc` (px), `spin` (the % of pieces that turn) and `turns` (eighths of a turn). */
export const BOX_TIP = { tip: -3, fall: 8, pour: 4, first: 6, spread: 10, arc: 9, spin: 50, turns: 4 };

function boxKeys(moveFrames, k) {
  const { tip, flat } = fallKeys(moveFrames, k), pour = tip + Math.max(0, k.pour);
  const first = pour + Math.max(2, k.first);
  return { tip, flat, pour, first, last: first + Math.max(0, k.spread) };
}

/** Returns the clip for boxes drawn upright by `still`, their trash held as `SPREAD`, laid as `LAY` and drawn
 *  in `STYLE`, as the sprites at rest have them. */
export function createBoxTip({ T, still, LAY, STYLE, SPREAD }) {
  const toPile = createToPile({ T, LAY, STYLE });
  /** Returns the clip of the box of draw seed `seed` shoved `dir` from cell `from` to `to`, its trash landing as the pile
   *  of seed `pileSeed` on cell `pileAt`. `layers(f, along)` is the clip `f` frames from the start of
   *  the move as `[foot, px]` pairs in px on the room, where `along` is how far along its move the box
   *  is, 0 to 1. `end` is the first frame drawn at rest. */
  return ({ dir, from, to, pileAt, seed, pileSeed, moveFrames, k = BOX_TIP }) => {
    const keys = boxKeys(moveFrames, k);
    const O = BOX.restAt(...from, C), end = BOX.restAt(...to, C, dir), f90 = BOX.frame(dir, 90);
    const offset = [end[0] - (O[0] + f90.ox), end[1] - (O[1] + f90.oy)];
    const boxAt = (f, along) => { const s = f >= moveFrames ? 1 : along; return [O[0] + Math.round(offset[0] * s), O[1] + Math.round(offset[1] * s)]; };
    const full = still(BIN, ...from, seed);
    const held = BOX.contents(T, seed, SPREAD.edges, SPREAD.hues).sort((a, b) => b.by - a.by);
    const P0 = boxAt(keys.pour, 1), [mx, my] = BOX.frame(dir, degAt(keys, keys.pour)).place(BOX.BOX.W / 2, 0, BOX.BOX.D / 2);
    const fling = toPile({ piles: [{ x: pileAt[0], y: pileAt[1], seed: pileSeed }], from: [P0[0] + mx, P0[1] + my],
      go: keys.pour, first: keys.first, last: keys.last, k });

    function layers(f, along) {
      f = onTwos(f);
      const P = boxAt(f, along), out = [];
      if (f <= keys.tip) out.push([P[1] + full.h, moved(full.px, P[0], P[1])]);
      else {
        const fr = BOX.frame(dir, degAt(keys, f)), gx = P[0] + fr.ox, gy = P[1] + fr.oy, px = moved(fr.s.px, gx, gy);
        if (f < keys.pour) for (const p of held) {
          const s = T.sprite(p.name, p.alt, p.turn), [x, y] = fr.place(p.bx, p.by, p.d);
          px.push(...moved(s.px, Math.round(P[0] + x - s.w / 2), Math.round(P[1] + y - s.h / 2)).filter(([a, b]) => fr.shows(a - P[0], b - P[1])));
        }
        out.push([gy + fr.s.h, px]);
      }
      const flung = fling.at(f);
      // The pile lies on the floor, so it goes under what flies over its own cell.
      if (flung.piles[0].length) out.push([pileAt[1] * C + 1, flung.piles[0]]);
      for (const a of flung.air) {
        if (a.up) out.push([a.foot, a.px.map(([x, y]) => [a.x + x, a.y + y, SHADOW])]);
        out.push([a.foot, moved(a.px, a.x, a.y - a.up)]);
      }
      return out;
    }
    const last = Math.max(keys.flat, keys.last);
    return { layers, keys, end: evenEnd(last) };
  };
}
