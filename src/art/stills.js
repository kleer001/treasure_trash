// Each thing that stands upright in a cell, as one drawing: what a press page pushes along or
// pushes against. A full box shows its heap over the rim and a full can its bag.
import { BAG, CAN_FULL, CAN_EMPTY, BIN, BIN_EMPTY, JUG, JUG_EMPTY, WHEELIE, WHEELIE_EMPTY, PANE } from '../rules.js';
import { C } from './flight.js';
import * as CAN from './can.js';
import * as BOX from './box.js';
import * as JUGS from './jug.js';
import * as GLASS from './pane.js';

const at = (spr, cx, cy) => [cx * C + Math.floor((C - spr.w) / 2), cy * C + C - spr.h - 1];
const moved = (px, dx, dy) => px.map(([x, y, col]) => [x + dx, y + dy, col]);

/** `still(o, cx, cy, seed)`: thing `o` in cell (cx, cy) as `{ px, x, y, h }`, its pixels from its
 *  top-left (x, y) and its foot `h` below that; `null` for a thing with no drawing here. */
export function createStills({ T, A, O, LOOK }) {
  const heap = seed => BOX.contents(T, seed, LOOK.spread.edges, LOOK.spread.hues).sort((a, b) => b.by - a.by).flatMap(p => {
    const s = T.sprite(p.name, p.alt, p.turn), x0 = Math.round(p.bx - s.w / 2), y0 = Math.round(p.by - s.h / 2);
    return moved(s.px.filter(([x, y]) => y0 + y < 2 && x0 + x > 0 && x0 + x < BOX.BOX.W - 1), x0, y0);
  });
  const upright = (spr, P, under = []) => ({ px: [...under, ...spr.px], x: P[0], y: P[1], h: spr.h });
  return (o, cx, cy, seed = 1) => {
    switch (o) {
      case CAN_EMPTY: return upright(CAN.front, CAN.restAt(cx, cy, C));
      case CAN_FULL: { const [bx, by] = CAN.bagIn(A.bag); return upright(CAN.front, CAN.restAt(cx, cy, C), moved(A.bag.px, bx, by)); }
      case BIN_EMPTY: return upright(BOX.front, BOX.restAt(cx, cy, C));
      case BIN: return upright(BOX.front, BOX.restAt(cx, cy, C), heap(seed));
      case JUG: case JUG_EMPTY: {
        const P = JUGS.restAt(cx, cy, C), f = JUGS.frame('r', 0, o === JUG ? 1 : 0);
        return { px: moved(f.s.px, f.ox, f.oy), x: P[0], y: P[1], h: JUGS.full.h };
      }
      case PANE: return upright(GLASS.front, GLASS.restAt(cx, cy, C));
      case BAG: return upright(A.bag, at(A.bag, cx, cy));
      case WHEELIE: case WHEELIE_EMPTY: return upright(O.bin, at(O.bin, cx, cy));
      default: return null;
    }
  };
}
