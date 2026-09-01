// Handles — which THING on a board something is about.
//
// A handle is a pure function of a board: the cell a thing rests on, plus the lane of that cell
// it rests in. A thing covering several cells takes the first of them in raster order, so the
// board settles the address rather than whoever is asking.
//
// It is not a counter and it is not stored anywhere. Two readings of the same board give the
// same handles, and there is no second copy of one that could fall out of step with the board it
// came from. The price of that is worth knowing before reaching for one: a handle is an ADDRESS
// rather than an identity, so it says nothing about the same thing on the board before or after
// the step, and nothing built on it can follow one object across a whole solution.

import { NONE, cell, chainOf, isCart, isMultiCell, cartCells, pieceCells,
         rasterOrder } from './rules.js';

// The lanes one cell holds at once. A cart, the cargo standing in it, and the load that cargo is
// itself carrying all rest on the same cell, so the lane rather than the cell is what separates
// them. An occupant's lane is how deep in the cell's chain it rides.
export const CART_LANE = 'cart', BODY_LANE = 'body', RAC_LANE = 'rac';
export const depthLane = d => String(d);

export const handleAt = ([x, y], lane) => `${x},${y}/${lane}`;
/** A thing covering several cells is addressed by the first of them. */
export const anchorOf = cells => rasterOrder(cells)[0];

/**
 * Every handle a board has, and what stands at each one — carts and bodies first, in raster
 * order, then everything standing on them, down each cell's chain.
 *
 * A collision throws. Two things sharing a handle is the lanes failing to separate what the
 * board separates, and it is the helper that is wrong, not the board.
 */
export function handlesOf(state) {
  const out = new Map();
  const put = (at, lane, what) => {
    const h = handleAt(at, lane);
    if (out.has(h)) throw new Error(`two things answer to ${h}`);
    out.set(h, { ...what, handle: h, at, lane });
  };

  put([state.rac.x, state.rac.y], RAC_LANE, { what: 'raccoon' });

  const seenCart = new Set(), seenPid = new Set();
  for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) {
    const c = cell(state, x, y);
    if (isCart(c) && !seenCart.has(c.cart)) {
      seenCart.add(c.cart);
      put(anchorOf(cartCells(state, c.cart)), CART_LANE,
          { what: 'cart', ref: c.cart, ck: c.ck });
    }
    if (c.pid !== undefined && !seenPid.has(c.pid)) {
      seenPid.add(c.pid);
      put(anchorOf(pieceCells(state, c.pid)), BODY_LANE,
          { what: 'body', ref: c.pid, o: c.o });
    }
  }
  for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) {
    const c = cell(state, x, y);
    // A multi-cell piece is one thing at its anchor, already put down above; naming its code
    // here would give it a second handle per cell it covers.
    if (c.o === NONE || isMultiCell(c.o)) continue;
    chainOf(c).forEach((o, depth) =>
      put([x, y], depthLane(depth), { what: 'occupant', o, depth }));
  }
  return out;
}
