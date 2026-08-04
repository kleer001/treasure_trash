// The stage — objects with positions, built from boards and driven by the motion the rules
// report. Pure: no canvas, no DOM, no timers. A renderer reads `sprites` and draws them; a
// clock decides what `u` to pass to `advance`.
//
// The engine is cell-based and has to stay that way — `stateKey` packs occupants per cell,
// and giving them identity there would make two boards differing only in WHICH can is which
// into separate states, which the solver would pay for. So identity lives out here instead:
// a sprite persists across an action, owns a fractional position, and can be riding a cart
// rather than standing on a square.
//
// That last part is what makes a cart read correctly. Cargo does not jump into a basket and
// out again; it changes who it travels with. A cart rolls ONTO what it swallows and OUT FROM
// UNDER what it sheds, so in both cases the cargo holds still and only its parent changes.

import { NONE, FURNITURE, cell, cartCells, pieceCells, isCart } from './rules.js';
import { mulberry32 } from './rng.js';

/** Multi-cell kinds are their own sprites; every other sprite is keyed by occupant code. */
export const CART = 'cart', COUCH = 'couch', RACCOON = 'raccoon', SPLASH = 'splash';

/**
 * Build a stage from a board. One sprite per loose occupant, per cart, per couch, per cargo
 * riding a cart, plus the raccoon.
 *
 * `seed` fixes the cosmetic stream, so a replay of the same room looks identical. Each sprite
 * keeps its own draw seed for life — which is what stops a pile of trash changing colour when
 * a cart carries it somewhere, since today's `drawTrash` derives its specks from the cell.
 */
export function stageFrom(state, seed = 1) {
  const rnd = mulberry32(seed);
  const stage = { sprites: [], nextId: 0 };
  const mint = (kind, x, y, extra = {}) => {
    const sp = { id: stage.nextId++, kind, x, y, ax: x, ay: y, tx: x, ty: y,
                 seed: (rnd() * 0x100000000) >>> 0, parent: null, dying: false, ...extra };
    stage.sprites.push(sp);
    return sp;
  };

  mint(RACCOON, state.rac.x, state.rac.y);

  // Pieces first, in raster order of their first cell, so ids and seeds are canonical.
  const seenCart = new Set(), seenPid = new Set();
  for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) {
    const c = cell(state, x, y);
    if (isCart(c) && !seenCart.has(c.cart)) {
      seenCart.add(c.cart);
      mint(CART, x, y, { ref: c.cart, cells: offsets(cartCells(state, c.cart), x, y) });
    }
    if (c.pid !== undefined && !seenPid.has(c.pid)) {
      seenPid.add(c.pid);
      mint(COUCH, x, y, { ref: c.pid, cells: offsets(pieceCells(state, c.pid), x, y) });
    }
  }
  // Then the things standing on it, cargo included — cargo is an ordinary occupant that
  // happens to be riding, so it is minted the same way and simply starts out parented.
  for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) {
    const c = cell(state, x, y);
    if (c.o === NONE || c.o === FURNITURE) continue;
    mint(c.o, x, y, { parent: isCart(c) ? c.cart : null });
  }
  return stage;
}

/** A rigid body's cells as offsets from its origin. Nothing rotates, so these hold for life. */
const offsets = (cells, ox, oy) => cells.map(([x, y]) => [x - ox, y - oy]);

const atCell = (sp, x, y) => sp.ax === x && sp.ay === y;
const find = (stage, kind, [x, y]) =>
  stage.sprites.find(sp => sp.kind === kind && !sp.dying && atCell(sp, x, y));

/**
 * Retarget everything for one step of an action. Positions are not applied here — `advance`
 * interpolates between each sprite's anchor and its new target.
 *
 * Order matters. The piece translation runs first and carries everything already aboard;
 * `moved` then runs over the top of it, which is what lets a shed cargo undo that carry and
 * stay where the cart left it, and lets a swallowed one take a parent without lurching a cell
 * forward — its target is the cell it is already standing on.
 */
export function applyStep(stage, step, racTo = null) {
  for (const sp of stage.sprites) { sp.ax = sp.x; sp.ay = sp.y; sp.tx = sp.x; sp.ty = sp.y; }

  if (step.piece) {
    const { kind, ref, dx, dy } = step.piece;
    const body = stage.sprites.find(sp => sp.kind === (kind === 'cart' ? CART : COUCH) && sp.ref === ref);
    if (body) {
      body.tx = body.ax + dx; body.ty = body.ay + dy;
      if (kind === 'cart')
        for (const sp of stage.sprites)
          if (sp.parent === ref) { sp.tx = sp.ax + dx; sp.ty = sp.ay + dy; }
    }
  }

  for (const m of step.moved) {
    const sp = find(stage, m.o, m.from);
    if (!sp) continue;
    [sp.tx, sp.ty] = m.to;
    if (m.parent !== undefined) sp.parent = m.parent;
    if (m.becomes !== undefined) sp.becomes = m.becomes;
    if (m.effect === 'fills') sp.spent = true;      // it goes in the canal and is spent doing it
  }

  for (const g of step.gone) {
    const sp = find(stage, g.o, g.at);
    if (sp) sp.dying = true;                        // the one thing that really does deflate
  }

  for (const sp of step.spawned) {
    const [ax, ay] = sp.from ?? sp.at;
    const born = { id: stage.nextId++, kind: sp.effect === 'pours' ? SPLASH : sp.o,
                   x: ax, y: ay, ax, ay, tx: sp.at[0], ty: sp.at[1],
                   seed: (stage.nextId * 2654435761) >>> 0, parent: null, dying: false,
                   spent: sp.effect === 'fills' || sp.effect === 'pours' };
    stage.sprites.push(born);
  }

  if (racTo) {
    const rac = stage.sprites.find(s => s.kind === RACCOON);
    if (rac) { rac.tx = racTo.x; rac.ty = racTo.y; }
  }
}

/** Place every sprite at eased progress `u` between its anchor and its target. */
export function advance(stage, u) {
  for (const sp of stage.sprites) {
    sp.x = sp.ax + (sp.tx - sp.ax) * u;
    sp.y = sp.ay + (sp.ty - sp.ay) * u;
  }
}

/** End of a beat: snap to targets, retire what the step consumed, commit code changes. */
export function settle(stage) {
  advance(stage, 1);
  stage.sprites = stage.sprites.filter(sp => !sp.dying && !sp.spent);
  for (const sp of stage.sprites) {
    if (sp.becomes !== undefined) { sp.kind = sp.becomes; delete sp.becomes; }
    sp.ax = sp.x; sp.ay = sp.y;
  }
}

// --- motion envelopes ---------------------------------------------------------------------

/** Slows into its target. What stops itself decelerates: the raccoon, a shoved can, tipped cargo. */
export const easeOut = t => 1 - Math.pow(1 - t, 3);

/**
 * Accelerate, cruise, and stop dead. A roller stops because something stopped it, and an
 * impact is instantaneous — decelerating into a wall is the one thing a collision never does.
 *
 * Velocity ramps linearly from rest over the first `r` of the duration and holds after.
 * Integrating that and normalising so the whole distance is covered by t=1 gives the cruise
 * speed `V = 1/(1 - r/2)`; with `r = 1/cells` the ramp is exactly one cell long, so a cart
 * gets up to speed over its first cell, holds it, and hits at full pelt.
 */
export function rollEase(t, cells = 1) {
  const r = Math.min(0.5, 1 / Math.max(1, cells));
  const V = 1 / (1 - r / 2);
  return t < r ? (V * t * t) / (2 * r) : V * (t - r / 2);
}
