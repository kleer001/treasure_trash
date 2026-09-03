// Handles — which THING on a board something is about.
//
// A handle is a pure function of a board: the cell a thing rests on, plus the lane of that cell
// it rests in. A thing covering several cells takes the first of them in raster order, so the
// board settles the address rather than whoever is asking.
//
// It is not a counter, and every copy of one is derived the same way from the same board, so a
// stamped handle can be put back to the board it claims to name. The price is worth knowing
// before reaching for one: a handle is an ADDRESS rather than an identity, so it says nothing
// about the same thing before or after a step, and nothing built on it can follow one object
// across a whole solution.

import { NONE, cell, chainOf, isCart, isMultiCell } from './rules.js';
import { CART_LANE, BODY_LANE, RAC_LANE, depthLane, handleAt } from './lanes.js';

export * from './lanes.js';

/**
 * Every handle a board has, and what stands at each one — carts and bodies first, in raster
 * order, then everything standing on them, down each cell's chain. Each says what it is in the
 * vocabulary an account entry uses to name it: the cells it covers, its occupant code and its
 * piece id, with `null` where a thing has none.
 *
 * A collision throws. Two things sharing a handle is the lanes failing to separate what the
 * board separates, and it is the helper that is wrong, not the board.
 */
export function handlesOf(state) {
  const out = new Map();
  const put = (at, lane, cells, what) => {
    const h = handleAt(at, lane);
    if (out.has(h)) throw new Error(`two things answer to ${h}`);
    what.handle = h; what.at = at; what.lane = lane; what.cells = cells;
    what.o ??= null; what.ref ??= null; what.ck ??= null;
    out.set(h, what);
  };

  put([state.rac.x, state.rac.y], RAC_LANE, [[state.rac.x, state.rac.y]], { what: 'raccoon' });

  // One pass in raster order, gathering each multi-cell thing's span as its cells are met, so
  // the first cell collected IS the anchor and nothing has to be sorted or re-scanned. Loose
  // occupants are held back rather than put down here: a body is one thing at its anchor, and
  // naming its code per cell would give it a second handle for every cell it covers.
  const carts = new Map(), bodies = new Map(), loose = [];
  for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) {
    const c = cell(state, x, y);
    if (isCart(c)) {
      const own = carts.get(c.cart);
      if (own) own.cells.push([x, y]); else carts.set(c.cart, { cells: [[x, y]], ck: c.ck });
    }
    if (c.pid !== undefined) {
      const own = bodies.get(c.pid);
      if (own) own.cells.push([x, y]); else bodies.set(c.pid, { cells: [[x, y]], o: c.o });
    }
    if (c.o !== NONE && !isMultiCell(c.o)) loose.push([x, y, c]);
  }
  for (const [ref, { cells, ck }] of carts)
    put(cells[0], CART_LANE, cells, { what: 'cart', ref, ck });
  for (const [ref, { cells, o }] of bodies)
    put(cells[0], BODY_LANE, cells, { what: 'body', ref, o });
  for (const [x, y, c] of loose)
    chainOf(c).forEach((o, depth) =>
      put([x, y], depthLane(depth), [[x, y]], { what: 'occupant', o }));
  return out;
}
