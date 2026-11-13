// Each thing that stands upright in a cell is one drawing.
import { BAG, CAN_FULL, CAN_EMPTY, BIN, BIN_EMPTY, JUG, JUG_EMPTY, WHEELIE, WHEELIE_EMPTY, PANE,
         TIRE_H, TIRE_V, CHAIR, BROOM, SPONGE, CARDBOARD, MAG_U, MAG_D, MAG_L, MAG_R,
         CABC_U, CABC_D, CABC_L, CABC_R, magnetFace, cabinetFace } from '../rules.js';
import { C } from './flight.js';
import * as CAN from './can.js';
import * as BOX from './box.js';
import * as GLASS from './pane.js';
import { bakedJug } from './jugTip.js';
import { TYRE } from './tyre.js';
import { CHAIR as CHAIR_ART } from './chair.js';
import { BROOM as BROOM_ART } from './broom.js';
import { SPONGE as SPONGE_ART } from './sponge.js';
import { CARDBOARD as CARDBOARD_ART } from './cardboard.js';
import { MAGNET } from './magnet.js';
import { CABINET } from './cabinet.js';

export const at = (spr, cx, cy) => [cx * C + Math.floor((C - spr.w) / 2), cy * C + C - spr.h - 1];
export const moved = (px, dx, dy) => px.map(([x, y, col]) => [x + dx, y + dy, col]);
/** Returns what draws each thing that can lie, with the square jug's drawings baked into `J`. */
export const lyingOf = J => ({ [CAN_EMPTY]: CAN, [BIN_EMPTY]: BOX, [JUG_EMPTY]: bakedJug(J) });

/** `still(o, cx, cy, seed, lie)` returns thing `o` in cell (cx, cy) as `{ px, x, y, h, solid, from }`, its pixels from its top-left (x, y), its foot `h` below that, the key of its solid in `SOLIDS` in solid.js, and the drawing that solid is made from where that is not this one; or `null` for a thing with no drawing here. */
export function createStills({ T, A, O, LOOK, J }) {
  const LYING = lyingOf(J), JUGS = LYING[JUG_EMPTY];
  const heap = seed => BOX.contents(T, seed, LOOK.spread.edges, LOOK.spread.hues).sort((a, b) => b.by - a.by).flatMap(p => {
    const s = T.sprite(p.name, p.alt, p.turn), x0 = Math.round(p.bx - s.w / 2), y0 = Math.round(p.by - s.h / 2);
    return moved(s.px.filter(([x, y]) => y0 + y < 2 && x0 + x > 0 && x0 + x < BOX.BOX.W - 1), x0, y0);
  });
  const upright = (solid, spr, P, under = []) => ({ px: [...under, ...spr.px], x: P[0], y: P[1], h: spr.h, solid });
  const standing = (solid, spr, cx, cy) => upright(solid, spr, at(spr, cx, cy));
  const still = (o, cx, cy, seed) => {
    switch (o) {
      case TIRE_H: return standing('tyreH', TYRE.H, cx, cy);
      case TIRE_V: return standing('tyreV', TYRE.V, cx, cy);
      case CHAIR: return standing('chair', CHAIR_ART, cx, cy);
      case BROOM: return standing('broom', BROOM_ART, cx, cy);
      case SPONGE: { const [x, y] = at(SPONGE_ART, cx, cy); return upright('sponge', SPONGE_ART, [x + SPONGE_ART.dx, y + SPONGE_ART.dy]); }
      case CARDBOARD: return upright('cardboard', CARDBOARD_ART, [cx * C, cy * C]);
      case MAG_U: case MAG_D: case MAG_L: case MAG_R: return standing('magnet', MAGNET[magnetFace(o)], cx, cy);
      case CABC_U: case CABC_D: case CABC_L: case CABC_R: {
        const s = CABINET[cabinetFace(o)];
        return upright('cabinet', s, [cx * C + Math.floor(C / 2) - s.ax, cy * C + C - s.foot - 2]);
      }
      case CAN_EMPTY: return { ...upright('can', CAN.front, CAN.restAt(cx, cy, C)), from: CAN.PROFILE };
      case CAN_FULL: {
        const [bx, by] = CAN.bagIn(A.bag), P = CAN.restAt(cx, cy, C), up = CAN.frame('r', 0);
        return { px: [...CAN.front.px, ...moved(A.bag.px, bx, by).filter(([x, y]) => up.shows(x, y))], x: P[0], y: P[1], h: CAN.front.h,
          solid: 'can', from: CAN.PROFILE };
      }
      case BIN_EMPTY: return upright('bin', BOX.front, BOX.restAt(cx, cy, C));
      case BIN: return upright('bin', BOX.front, BOX.restAt(cx, cy, C), heap(seed));
      case JUG: case JUG_EMPTY: return upright('jug', JUGS.drawing('r', 0, o === JUG ? J.full : 0), JUGS.restAt(cx, cy, C));
      case PANE: return upright('pane', GLASS.front, GLASS.restAt(cx, cy, C));
      case BAG: return upright('bag', A.bag, at(A.bag, cx, cy));
      case WHEELIE: case WHEELIE_EMPTY: return upright('wheelie', O.bin, at(O.bin, cx, cy));
      default: return null;
    }
  };
  return (o, cx, cy, seed = 1, lie = null) => {
    if (!lie) return still(o, cx, cy, seed);
    const M = LYING[o], up = still(o, cx, cy, seed);
    return { ...upright(up.solid, M.rest(lie), M.restAt(cx, cy, C, lie)), from: up.from ?? up };
  };
}
