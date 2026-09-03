// The vocabulary a handle is written in — which lane of a cell a thing rests in, and how a cell
// and a lane are spelled as one address.
//
// This module knows nothing about boards or rules, and imports nothing, so the engine can name
// an entry's participant without depending on anything that reads a board. `handles.js` is where
// a board is actually walked for its handles.

// The lanes one cell holds at once. A cart, the cargo standing in it, and the load that cargo is
// itself carrying all rest on the same cell, so the lane rather than the cell is what separates
// them. An occupant's lane is how deep in the cell's chain it rides.
export const CART_LANE = 'cart', BODY_LANE = 'body', RAC_LANE = 'rac';
export const depthLane = d => String(d);
/** How deep in a cell's contents a lane sits. A cart and a body rest on the cell itself. */
export const laneDepth = lane => (/^\d+$/.test(lane) ? Number(lane) : 0);
/** Whether a lane is one the board gives an id to, rather than a depth in a cell's chain. */
export const isBodyLane = lane => lane === CART_LANE || lane === BODY_LANE;

export const handleAt = ([x, y], lane) => `${x},${y}/${lane}`;
/** Which lane a handle names. */
export const laneOf = h => h.slice(h.indexOf('/') + 1);

/** Board cells in the order a stage reads them, which is where a body's anchor comes from. */
export const rasterOrder = cells => [...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
/** A thing covering several cells is addressed by the first of them. */
export const anchorOf = cells => (cells.length === 1 ? cells[0] : rasterOrder(cells)[0]);
/** The same span written the one way, so two readings of it compare. */
export const spanOf = cells => rasterOrder(cells).map(([x, y]) => `${x},${y}`).join(' ');
