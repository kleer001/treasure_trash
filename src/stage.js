// The stage — objects with positions, built from boards and driven by the motion the rules
// report. Pure: no canvas, no DOM, no timers. A renderer reads `sprites` and draws them; a
// clock decides what `u` to pass to `advance`.
//
// Identity lives here rather than in the engine: `stateKey` packs occupants per cell, and
// giving them identity there would split two boards differing only in WHICH can is which into
// separate states, which the solver would pay for. A sprite persists across an action, owns a
// fractional position, and can be parented to a cart rather than standing on a square.

import { NONE, cell, cartCells, pieceCells, isCart, isMultiCell } from './rules.js';
import { mulberry32 } from './rng.js';

/** Multi-cell kinds are their own sprites; every other sprite is keyed by occupant code. */
export const CART = 'cart', COUCH = 'couch', RACCOON = 'raccoon', SPLASH = 'splash';

/** `step.piece.kind` from the rules → the sprite that is that piece's body. */
const BODY = { cart: CART, furniture: COUCH };

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
      // The kind rides on the sprite for the same reason it rides on the cell: a barrow and a
      // cart are drawn differently and are not interchangeable.
      mint(CART, x, y, { ref: c.cart, ck: c.ck, cells: offsets(cartCells(state, c.cart), x, y) });
    }
    if (c.pid !== undefined && !seenPid.has(c.pid)) {
      seenPid.add(c.pid);
      // COUCH is the BAND — a rigid multi-cell body — and `o` is which one, so the renderer
      // picks a skin without a second sprite kind per piece.
      mint(COUCH, x, y, { ref: c.pid, o: c.o, cells: offsets(pieceCells(state, c.pid), x, y) });
    }
  }
  // Then the things standing on it, cargo included — cargo is an ordinary occupant that
  // happens to be riding, so it is minted the same way and simply starts out parented.
  for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) {
    const c = cell(state, x, y);
    // A multi-cell piece was already minted as one body above; naming its kind here would mint
    // a second sprite per cell on top of it. `isMultiCell` rather than the couch by name, so a
    // kind added later cannot be missed.
    if (c.o === NONE || isMultiCell(c.o)) continue;
    mint(c.o, x, y, { parent: isCart(c) ? c.cart : null });
  }
  return stage;
}

/** A body's parts keep their places relative to its anchor, so its offsets hold for life. */
const offsets = (cells, ox, oy) => cells.map(([x, y]) => [x - ox, y - oy]);

/** Effects that consume the sprite in the beat they happen: it plays where it arrives, and is
 *  then gone. What they have in common is that the BOARD does not hold what arrived — the water
 *  took it, the grate took it, or there was never an occupant to hold. */
const CONSUMES = new Set(['fills', 'pours', 'shatters', 'falls']);

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
  for (const sp of stage.sprites) {
    sp.ax = sp.x; sp.ay = sp.y; sp.tx = sp.x; sp.ty = sp.y; sp.nudge = null;
  }

  // `piece` is one body or several: a tow moves a barrow and what it is towing in the same
  // beat, and neither is an occupant sprite the `moved` list could name.
  for (const { kind, ref, dx, dy } of [step.piece ?? []].flat()) {
    const want = BODY[kind];
    if (!want) throw new Error(`no sprite kind for piece '${kind}'`);
    const body = stage.sprites.find(sp => sp.kind === want && sp.ref === ref);
    if (!body) throw new Error(`no ${want} sprite for piece ${ref}`);
    body.tx = body.ax + dx; body.ty = body.ay + dy;
    if (kind === 'cart')
      for (const sp of stage.sprites)
        if (sp.parent === ref) { sp.tx = sp.ax + dx; sp.ty = sp.ay + dy; }
  }

  for (const m of step.moved) {
    // A step naming a sprite the stage does not hold means the rules and the stage disagree
    // about the board. Nothing downstream would notice: the piece would simply not animate.
    const sp = find(stage, m.o, m.from);
    if (!sp) throw new Error(`no ${m.o} sprite at ${m.from} to move to ${m.to}`);
    // Only what was ALREADY riding gets nudged: a slot shift is a true no-op on the board and
    // would otherwise read as nothing at all. Something being scooped up is not hit by
    // anything, so it does not lurch.
    const aboard = step.piece && sp.parent === step.piece.ref;
    [sp.tx, sp.ty] = m.to;
    if (m.parent !== undefined) sp.parent = m.parent;
    // Immediately, not at the end of the beat, or a bin still drawn full alongside the bag it
    // has just thrown reads as two bags.
    if (m.becomes !== undefined) sp.kind = m.becomes;
    if (CONSUMES.has(m.effect)) sp.spent = true;
    if (aboard && m.from[0] === m.to[0] && m.from[1] === m.to[1])
      sp.nudge = [step.piece.dx, step.piece.dy];
  }

  for (const g of step.gone) {
    // Loud for the reason `moved` is: a step naming a sprite the stage does not hold means the
    // rules and the stage disagree about the board. Passing over it quietly leaves the sprite
    // drawn where it was consumed, which reads as a rules bug and is found only by playing.
    const sp = find(stage, g.o, g.at);
    if (!sp) throw new Error(`no ${g.o} sprite at ${g.at} to consume`);
    sp.dying = true;                                // the one thing that really does deflate
  }

  for (const sp of step.spawned) {
    const [ax, ay] = sp.from ?? sp.at;
    const born = { id: stage.nextId++, kind: sp.effect === 'pours' ? SPLASH : sp.o,
                   x: ax, y: ay, ax, ay, tx: sp.at[0], ty: sp.at[1],
                   seed: (stage.nextId * 2654435761) >>> 0, parent: null, dying: false,
                   spent: CONSUMES.has(sp.effect) };
    stage.sprites.push(born);
  }

  if (racTo) {
    const rac = stage.sprites.find(s => s.kind === RACCOON);
    if (rac) { rac.tx = racTo.x; rac.ty = racTo.y; }
  }
}

/**
 * Place every sprite at eased progress `u` between its anchor and its target.
 *
 * `cells` is how many cells of travel that `u` buys — the pace of the beat. Duration belongs to
 * the beat and distance belongs to the sprite, so one `u` for everybody stretches whatever
 * crossed a single cell over however long the FURTHEST traveller took. At `cells` to the beat,
 * a sprite crossing `d` of them is done in `d/cells` of it and then holds where it landed.
 *
 * `cells = 0` is the beat that has no pace: everything in it lands together. A nudge and a
 * deflate always keep the beat's own time — a nudged sprite has no distance to normalise by,
 * and a deflating one is timed by the beat that consumed it rather than by how far it drifted.
 */
export function advance(stage, u, cells = 0) {
  for (const sp of stage.sprites) {
    const d = Math.abs(sp.tx - sp.ax) + Math.abs(sp.ty - sp.ay);
    const su = cells && d ? Math.min(1, (u * cells) / d) : u;
    sp.x = sp.ax + (sp.tx - sp.ax) * su;
    sp.y = sp.ay + (sp.ty - sp.ay) * su;
    if (sp.nudge) { sp.x += sp.nudge[0] * NUDGE * bump(u); sp.y += sp.nudge[1] * NUDGE * bump(u); }
    if (sp.dying) sp.deflate = 1 - u;
  }
}

/** How far a nudged sprite gets before it is stopped, as a fraction of a cell. */
export const NUDGE = 0.25;
const HIT = 0.62;
/** Out, then knocked back sharper than it went. Zero at both ends, so it lands on the cell the
 *  board says it is on. */
export const bump = u => (u < HIT ? u / HIT : Math.pow(1 - (u - HIT) / (1 - HIT), 2));

export function settle(stage) {
  advance(stage, 1);
  stage.sprites = stage.sprites.filter(sp => !sp.dying && !sp.spent);
  for (const sp of stage.sprites) {
    sp.nudge = null;                       // it landed; the next beat starts from the board
    sp.x = sp.tx; sp.y = sp.ty;
    sp.ax = sp.x; sp.ay = sp.y;
  }
}

// --- what a pile looks like ---------------------------------------------------------------

/** Silhouettes a scrap of rubbish can take. Indices, so a renderer picks its own drawing. */
export const PILE_SHAPES = ['ball', 'box', 'wedge', 'tube'];
export const PILE_TONES = 5;

/**
 * The three pieces one pile is made of, derived from its seed and nothing else. Two share a
 * tone and the third is an accent, at three clearly different sizes — six dots picked freely
 * from five colours have no dominant anything and every pile reads as the same confetti.
 *
 * Returns palette INDICES and cell fractions, never colours or pixels: the game and the bench
 * have different palettes and cell sizes and must draw the same piles. Largest first, so a
 * renderer drawing in order gets the small pieces on top.
 */
export function pileLook(seed) {
  const rnd = mulberry32(seed >>> 0);
  const tone = Math.floor(rnd() * PILE_TONES);
  const accent = (tone + 1 + Math.floor(rnd() * (PILE_TONES - 1))) % PILE_TONES;
  const hero = Math.floor(rnd() * PILE_SHAPES.length);
  const R = [0.19, 0.13, 0.09];
  return R.map((r, i) => {
    const a = i * 2.094 + rnd() * 0.9;                 // three pieces, roughly 120° apart
    const d = 0.13 + rnd() * 0.12;
    return {
      shape: i === 0 ? hero : Math.floor(rnd() * PILE_SHAPES.length),
      tone: i === 2 ? accent : tone,
      r, ox: Math.cos(a) * d, oy: Math.sin(a) * d * 0.85, rot: rnd() * Math.PI,
    };
  });
}

// --- the timeline -------------------------------------------------------------------------

/** The furthest any one thing travels in a step, in cells. One is the floor, so a step that
 *  moves nothing still takes a beat. */
const dist = st => Math.max(1,
  ...st.moved.map(m => Math.abs(m.to[0] - m.from[0]) + Math.abs(m.to[1] - m.from[1])));

/**
 * A traced action, cut into the segments a clock can play. One action can be several cells of
 * travel, and the cells are not independent, so consecutive cart steps are welded into ONE
 * segment with one envelope across the whole run, rather than a string of little eased hops
 * that would read as stuttering.
 *
 * `cellTime` is milliseconds per cell of travel, so a long roll takes proportionally longer
 * than a short one instead of being crammed into the same beat.
 */
export function timeline(r, cellTime) {
  const segs = [];
  let i = 0;
  const entry = k => ({ step: r.steps[k], racTo: r.frames[k + 1].rac, board: r.frames[k] });
  while (i < r.steps.length) {
    if (r.steps[i].piece && r.steps[i].piece.kind === 'cart') {
      const run = [];
      while (i < r.steps.length && r.steps[i].piece && r.steps[i].piece.kind === 'cart') run.push(entry(i++));
      // `pace` is cells per item — what one beat's worth of `u` buys.
      segs.push({ items: run, cells: run.length, dur: run.length * cellTime, roll: true, pace: 1 });
    } else {
      const it = entry(i++);
      const roll = it.step.impact === true;
      // A step reporting `impact` is paced by how far it travelled, since it may report one
      // step for many cells. Everything else is ONE beat however far its pieces fly, so it
      // gets no pace at all.
      segs.push({ items: [it], cells: dist(it.step), dur: (roll ? dist(it.step) : 1) * cellTime,
                  roll, pace: roll ? dist(it.step) : 0 });
    }
  }
  return segs;
}

// --- motion envelopes ---------------------------------------------------------------------

/** Slows into its target — for whatever stops itself. */
export const easeOut = t => 1 - Math.pow(1 - t, 3);

/**
 * Accelerate, cruise, and stop dead — for whatever is stopped by something else, where
 * decelerating into the obstacle would be wrong.
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
