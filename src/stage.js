// The stage — objects with positions, built from boards and driven by the motion the rules
// report. Pure: no canvas, no DOM, no timers. A renderer reads `sprites` and draws them; a
// clock decides what `u` to pass to `advance`.
//
// The board carries no identity: `stateKey` packs occupants per cell, and giving them identity
// there would split two boards differing only in WHICH can is which into separate states, which
// the solver would pay for. So a sprite is matched to what an account names by its HANDLE, which
// both sides read off the board the same way (`handles.js`). A sprite persists across an action,
// owns a fractional position, and can be parented to a cart rather than standing on a square.

import { NONE, cell, cartCells, pieceCells, isCart, isMultiCell,
         carriedKind, chainOf, restsOn, CAN_EMPTY, BIN_EMPTY, JUG_EMPTY } from './rules.js';
import { handleAt, anchorOf, depthLane, laneDepth, laneOf,
         CART_LANE, BODY_LANE, RAC_LANE, isBodyLane } from './handles.js';
import { mulberry32 } from './rng.js';

export const CART = 'cart', COUCH = 'couch', RACCOON = 'raccoon', SPLASH = 'splash';

/**
 * Which thing on a board a sprite is, said the way `handles.js` says it, and read off where the
 * sprite is COMING TO REST. This side mints the sprites and the engine names the events, so the
 * two meet in `applyStep` without either of them searching for the other.
 */
export const spriteHandle = sp => handleAt([sp.tx, sp.ty],
  sp.kind === RACCOON ? RAC_LANE
    : sp.kind === CART ? CART_LANE
      : sp.kind === COUCH ? BODY_LANE : depthLane(sp.depth));

/**
 * What identifies a sprite for comparison, and the sorted roll of every one on a stage. Ids and
 * draw seeds are not in it: they are the stage's own bookkeeping, and a rebuilt stage hands out
 * fresh ones.
 *
 * Two censuses are the whole of the invariant every checker asks: landing an action's steps on a
 * stage must leave the same sprites as building a stage from the board that action produced. It
 * lives here, with the sprites, so no checker can hold its own idea of what a sprite is.
 */
export const shapeOf = sp => JSON.stringify([
  sp.kind, sp.tx, sp.ty, sp.parent, sp.ref ?? null, sp.o ?? null, sp.ck ?? null,
  sp.cells ?? null, sp.depth, sp.heading, sp.lie,
]);

export const census = stage => stage.sprites.map(shapeOf).sort();

/**
 * A body is ONE sprite over however many cells it covers, and every other sprite is one sprite on
 * one cell. That is a fact about drawing, and it is the stage's alone: it is asked of the sprite
 * the stage minted, never of the shape of an account entry.
 */
const isBody = sp => sp.kind === CART || sp.kind === COUCH;

const kindIn = (lane, o, effect) => (lane === CART_LANE ? CART : lane === BODY_LANE ? COUCH
  : effect === 'pours' ? SPLASH : o);

/**
 * Build a stage from a board.
 *
 * `seed` fixes the cosmetic stream, so a replay of the same room looks identical. Each sprite
 * keeps its own draw seed for life — which is what stops a pile of trash changing colour when
 * a cart carries it somewhere, since today's `drawTrash` derives its specks from the cell.
 *
 * `decor` is which way things face, from `decorOf`; null is a room as its file lays it out. The
 * board cannot say: facing is no rule's business, so it lives in what came before rather than in
 * the board, and whoever holds the history hands it over.
 */
export function stageFrom(state, seed = 1, decor = null) {
  const rnd = mulberry32(seed);
  const stage = { sprites: [], nextId: 0 };
  const mint = (kind, x, y, extra = {}) => {
    const sp = { id: stage.nextId++, kind, x, y, ax: x, ay: y, tx: x, ty: y, depth: 0,
                 seed: (rnd() * 0x100000000) >>> 0, parent: null, dying: false, ...extra };
    sp.handle = spriteHandle(sp);
    const worn = decor?.get(sp.handle);
    sp.heading = worn?.heading ?? (kind === RACCOON ? 'd' : null);
    sp.lie = worn?.lie ?? null;
    stage.sprites.push(sp);
    return sp;
  };

  mint(RACCOON, state.rac.x, state.rac.y);

  // So ids and seeds are canonical.
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
    const extra = { parent: isCart(c) ? c.cart : null };
    // `depth` is how far down the stack it is, and it is also what tells two sprites of the
    // same code on the same cell apart.
    chainOf(c).forEach((o, depth) => mint(o, x, y, { ...extra, depth }));
  }
  return stage;
}

/** A body's parts keep their places relative to its anchor, so its offsets hold for life. */
const offsets = (cells, ox, oy) => cells.map(([x, y]) => [x - ox, y - oy]);

// --- which way things face ----------------------------------------------------------------

export const LIES = new Set([CAN_EMPTY, BIN_EMPTY, JUG_EMPTY]);
/** The way a move of (dx, dy) went. */
const wayOf = (dx, dy) => (!dx && !dy ? null
  : Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u'));

/** What a container that moved as `m` in step `step` threw out, if anything. */
export function shedOf(step, m) {
  const [x, y] = anchorOf(m.cells), [lx, ly] = restsOn(m);
  return step.spawned.find(({ from: f }) => f && ((f[0] === x && f[1] === y) || (f[0] === lx && f[1] === ly)));
}

/** The way a container that emptied in step `step` as movement `m` fell. */
function spilled(step, m) {
  const [lx, ly] = restsOn(m), out = shedOf(step, m);
  if (!out) {
    if (step.gone.some(g => g.handle === m.handle)) return null;
    // Anything else that empties and spills nothing is the rules and the stage disagreeing about
    // where its contents are.
    throw new Error(`${m.handle} emptied and nothing came out of it`);
  }
  const [cx, cy] = anchorOf(out.cells);
  return wayOf(cx - lx, cy - ly);
}

export function face(stage, dir) {
  stage.sprites.find(sp => sp.kind === RACCOON).heading = dir;
}

/** Which way everything on a settled stage faces, by handle: what `stageFrom` takes back. */
export function decorOf(stage) {
  const out = new Map();
  for (const sp of stage.sprites)
    if (!sp.dying && !sp.spent && (sp.heading || sp.lie)) out.set(sp.handle, { heading: sp.heading, lie: sp.lie });
  return out;
}

/** Which way things face after the raccoon is pressed `dir` on `state`, wearing `decor`, where `r`
 *  is `explain`'s traced answer. Landed on a stage of its own, so it is the stage's bookkeeping of
 *  who went where that decides it, and nothing else. */
export function decorAfter(state, decor, dir, r) {
  const stage = stageFrom(state, 1, decor);
  face(stage, dir);
  if (r.ok) r.steps.forEach((step, k) => { applyStep(stage, step, r.frames[k + 1].rac); settle(stage); });
  return decorOf(stage);
}

/**
 * Every sprite the stage is holding, by the handle it answers to. Spent and dying ones are out:
 * they are drawn until the beat ends and the board has already let go of them, so the handle
 * they still carry belongs to whatever arrives there next.
 *
 * Two live sprites answering to one handle is the stage holding a board no board could be.
 */
const holding = stage => {
  const out = new Map();
  for (const sp of stage.sprites) {
    if (sp.dying || sp.spent) continue;
    if (out.has(sp.handle)) throw new Error(`two sprites answer to ${sp.handle}`);
    out.set(sp.handle, sp);
  }
  return out;
};

/**
 * Retarget everything for one step of an action. Positions are not applied here — `advance`
 * interpolates between each sprite's anchor and its new target.
 *
 * Order matters within `moved`.
 */
export function applyStep(stage, step, racTo = null) {
  for (const sp of stage.sprites) {
    sp.ax = sp.x; sp.ay = sp.y; sp.tx = sp.x; sp.ty = sp.y; sp.nudge = null;
  }

  // A step can move several things that are alike —
  // a barrow riding in a barrow is the same code on the same cell as the barrow carrying it —
  // and it can turn one into another. A handle cares about neither.
  const held = holding(stage);
  const claim = e => {
    const sp = held.get(e.handle);
    // A step naming a handle the stage is not holding means the rules and the stage disagree
    // about the board. Nothing downstream would notice: the piece would simply not animate.
    if (!sp) throw new Error(`no sprite answers to ${e.handle}`);
    return sp;
  };

  const targets = step.moved.map(claim);
  const born = new Map(step.spawned.map(e => [e.handle, e]));
  const arrivals = new Map();
  const leaving = step.gone.map(g => {
    if (born.get(g.handle)?.o === g.o) { arrivals.set(g.handle, g); return null; }
    return claim(g);
  });

  const carriage = new Map();
  step.moved.forEach((m, i) => {
    const sp = targets[i];
    if (sp.kind !== CART) return;
    carriage.set(sp.ref, m);
    const riding = stage.sprites.filter(s => s.parent === sp.ref);
    for (const load of riding) {
      load.tx = load.ax + m.dx; load.ty = load.ay + m.dy;
      load.heading = wayOf(m.dx, m.dy) ?? load.heading;
    }
    // Pivot cargo on itself and
    // it spins in place while the cart leans out from under it.
    if (m.effect !== 'rattles') return;
    const xs = sp.cells.map(([cx]) => cx), ys = sp.cells.map(([, cy]) => cy);
    const pivot = [sp.ax + (Math.min(...xs) + Math.max(...xs)) / 2 + 0.5,
                   sp.ay + Math.max(...ys) + 1];
    for (const it of [sp, ...riding]) { it.rattle = m.blow; it.pivot = pivot; }
  });

  step.moved.forEach((m, i) => {
    const sp = targets[i], rest = m.becomes, way = wayOf(m.dx, m.dy);
    sp.tx = sp.ax + m.dx; sp.ty = sp.ay + m.dy;
    if (way) sp.heading = way;
    if (LIES.has(rest.o) && m.o !== rest.o) sp.lie = spilled(step, m);
    if (rest.lane === CART_LANE) {
      if (sp.kind !== CART) {
        sp.kind = CART; sp.ref = rest.ref; sp.ck = carriedKind(m.o); sp.cells = [[0, 0]];
      }
    } else if (rest.lane !== BODY_LANE) {
      // A sprite that is cargo and still carries a cart kind is one a rebuild of
      // the same board would not produce. The same object, so it is converted rather
      // than swapped, which keeps its draw seed and stops it popping. Immediately, too, or a bin
      // still drawn full alongside the bag it has just thrown reads as two bags.
      sp.kind = rest.o; sp.ref = undefined; sp.cells = undefined; sp.ck = undefined;
    }
    sp.depth = laneDepth(rest.lane);
    // A slot shift is a true no-op on the board and
    // would otherwise read as nothing at all. Something being scooped up is not hit by
    // anything, so it does not lurch — which is why this is asked before the entry says what
    // it is riding in now.
    const carrier = carriage.get(sp.parent);
    if (carrier && m.dx === 0 && m.dy === 0) sp.nudge = [carrier.dx, carrier.dy];
    if (m.parent !== undefined) sp.parent = m.parent;
  });

  step.gone.forEach((g, i) => {
    const sp = leaving[i];
    if (!sp) return;
    sp.spent = true;
    if (g.effect === 'falls') sp.falls = true;
    else if (g.effect === 'fills') {
      sp.soaks = true;
      // Taking that seed now
      // is what makes the swap invisible.
      sp.seed = cellSeed(Math.round(sp.tx), Math.round(sp.ty));
    }
    else if (!isBody(sp)) sp.dying = true;
  });

  // Last, because what a sprite already on the stage is coming to rest as is the question these
  // are asked against.
  for (const e of step.spawned) {
    // Loud, for the reason every other lookup here is: a handle something is still resting at is
    // the rules and the stage disagreeing about how many things the board has.
    const sitting = held.get(e.handle);
    if (sitting && !sitting.spent && spriteHandle(sitting) === e.handle)
      throw new Error(`a sprite already answers to ${e.handle}`);
    const [x, y] = anchorOf(e.cells);
    const [ax, ay] = e.from ?? [x, y];
    const took = arrivals.get(e.handle);
    const body = isBodyLane(e.lane);
    stage.sprites.push({
      id: stage.nextId++, kind: kindIn(e.lane, e.o, e.effect),
      x: ax, y: ay, ax, ay, tx: x, ty: y,
      // Where it came FROM is where a drawer's body still is.
      face: [Math.sign(x - ax), Math.sign(y - ay)],
      heading: wayOf(x - ax, y - ay), lie: null,
      depth: laneDepth(e.lane), handle: e.handle,
      seed: (stage.nextId * 2654435761) >>> 0, parent: e.parent ?? null, dying: false,
      ref: body ? e.ref : undefined, o: e.lane === BODY_LANE ? e.o : undefined,
      cells: body ? offsets(e.cells, x, y) : undefined,
      spent: e.o === NONE || took !== undefined, falls: took?.effect === 'falls' });
  }

  if (racTo) {
    const rac = stage.sprites.find(s => s.kind === RACCOON);
    if (rac) { rac.tx = racTo.x; rac.ty = racTo.y; }
  }

  // Where each sprite is coming to rest is where the next step will name it, so the handles are
  // re-read here rather than at the end of the beat: an input that cuts an animation short still
  // has the rest of the action to land.
  for (const sp of stage.sprites) sp.handle = spriteHandle(sp);
}

/**
 * Place every sprite at eased progress `u` between its anchor and its target.
 *
 * `cells` is how many cells of travel that `u` buys — the pace of the beat. Duration belongs to
 * the beat and distance belongs to the sprite, so one `u` for everybody stretches whatever
 * crossed a single cell over however long the FURTHEST traveller took.
 *
 * `cells = 0` is the beat that has no pace. A nudge and a
 * deflate always keep the beat's own time — a nudged sprite has no distance to normalise by,
 * and a deflating one is timed by the beat that consumed it rather than by how far it drifted.
 */
/** When something dropping through a grate has finished travelling and starts going down. It is the thing being looked at. */
const FALL_AT = 1 / 3;

/** When trash that is filling a canal has finished crossing into it and the water starts
 *  becoming ground. The ground is answering it. */
const FILL_AT = 0.6;

export function advance(stage, u, cells = 0) {
  for (const sp of stage.sprites) {
    const d = Math.abs(sp.tx - sp.ax) + Math.abs(sp.ty - sp.ay);
    const su = cells && d ? Math.min(1, (u * cells) / d) : u;
    sp.x = sp.ax + (sp.tx - sp.ax) * su;
    sp.y = sp.ay + (sp.ty - sp.ay) * su;
    sp.along = su;
    if (sp.nudge) { sp.x += sp.nudge[0] * NUDGE * bump(u); sp.y += sp.nudge[1] * NUDGE * bump(u); }
    if (sp.rattle) sp.tilt = wobble(u) * (sp.rattle[0] || sp.rattle[1]);
    if (sp.dying) sp.deflate = 1 - u;
    // Filling while it is still in flight has the cell answer before the thing that answers it has arrived.
    if (sp.soaks) {
      const fly = Math.min(1, u / FILL_AT);
      sp.x = sp.ax + (sp.tx - sp.ax) * fly;
      sp.y = sp.ay + (sp.ty - sp.ay) * fly;
      sp.soak = fly;
      sp.fill = Math.max(0, Math.min(1, (u - FILL_AT) / (1 - FILL_AT)));
    }
    // Shrinking on the way would say it
    // was disappearing rather than falling, and the cell it fell into would not be legible.
    if (sp.falls) {
      const fly = Math.min(1, u / FALL_AT);
      sp.x = sp.ax + (sp.tx - sp.ax) * fly;
      sp.y = sp.ay + (sp.ty - sp.ay) * fly;
      sp.deflate = Math.max(0, Math.min(1, (1 - u) / (1 - FALL_AT)));
    }
  }
}

/**
 * The wobble of a thing too heavy to shift, in degrees, over one beat.
 */
export const wobble = u =>
  (u < 0.35 ? 10 * (u / 0.35)
    : u < 0.7 ? 10 - 15 * ((u - 0.35) / 0.35)
      : -5 * (1 - (u - 0.7) / 0.3));

/** How far a nudged sprite gets before it is stopped, as a fraction of a cell. */
export const NUDGE = 0.25;
const HIT = 0.62;
/** Zero at both ends, so it lands on the cell the
 *  board says it is on. */
export const bump = u => (u < HIT ? u / HIT : Math.pow(1 - (u - HIT) / (1 - HIT), 2));

export function settle(stage) {
  advance(stage, 1);
  stage.sprites = stage.sprites.filter(sp => !sp.dying && !sp.spent);
  for (const sp of stage.sprites) {
    sp.nudge = null;                       // it landed; the next beat starts from the board
    sp.rattle = null; sp.tilt = 0; sp.pivot = null;
    sp.x = sp.tx; sp.y = sp.ty;
    sp.ax = sp.x; sp.ay = sp.y;
  }
}

// --- what a pile looks like ---------------------------------------------------------------

/** Silhouettes a scrap of rubbish can take. Indices, so a renderer picks its own drawing. */
export const PILE_SHAPES = ['ball', 'box', 'wedge', 'tube'];
export const PILE_TONES = 5;

/**
 * The three pieces one pile is made of, derived from its seed and nothing else.
 * Six dots picked freely
 * from five colours have no dominant anything and every pile reads as the same confetti.
 *
 * Returns palette INDICES and cell fractions, never colours or pixels: the game and the bench
 * have different palettes and cell sizes and must draw the same piles. Largest first, so a
 * renderer drawing in order gets the small pieces on top.
 */
export const cellSeed = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

export function pileLook(seed) {
  const rnd = mulberry32(seed >>> 0);
  const tone = Math.floor(rnd() * PILE_TONES);
  const accent = (tone + 1 + Math.floor(rnd() * (PILE_TONES - 1))) % PILE_TONES;
  const hero = Math.floor(rnd() * PILE_SHAPES.length);
  const R = [0.19, 0.13, 0.09];
  return R.map((r, i) => {
    const a = i * 2.094 + rnd() * 0.9;
    const d = 0.13 + rnd() * 0.12;
    return {
      shape: i === 0 ? hero : Math.floor(rnd() * PILE_SHAPES.length),
      tone: i === 2 ? accent : tone,
      r, ox: Math.cos(a) * d, oy: Math.sin(a) * d * 0.85, rot: rnd() * Math.PI,
    };
  });
}

// --- the timeline -------------------------------------------------------------------------

/** The furthest any one thing travels in a step, in cells. */
const dist = st => Math.max(1, ...st.moved.map(m => Math.abs(m.dx) + Math.abs(m.dy)));

const rolls = st => st.moved.some(m =>
  laneOf(m.handle) === CART_LANE && m.becomes.lane === CART_LANE);

/**
 * Crammed into the same beat, it reads as the sprite
 *  being cut rather than as something dropping through. */
const drops = st => st.gone.some(g => g.effect === 'falls');

export const CELL_MS = 7 * 1000 / 60;

/**
 * A traced action, cut into the segments a clock can play.
 *
 * `cellTime` is milliseconds per cell of travel.
 */
export function timeline(r, cellTime) {
  const segs = [];
  let i = 0;
  const entry = k => ({ step: r.steps[k], racTo: r.frames[k + 1].rac, board: r.frames[k] });
  while (i < r.steps.length) {
    if (rolls(r.steps[i])) {
      const run = [];
      while (i < r.steps.length && rolls(r.steps[i])) run.push(entry(i++));
      // `pace` is cells per item — what one beat's worth of `u` buys.
      segs.push({ items: run, cells: run.length, dur: run.length * cellTime, roll: true, pace: 1 });
    } else {
      const it = entry(i++);
      const roll = it.step.impact === true;
      const beats = (roll ? dist(it.step) : 1) + (drops(it.step) ? 2 : 0);
      segs.push({ items: [it], cells: dist(it.step), dur: beats * cellTime,
                  roll, pace: roll ? dist(it.step) : 0 });
    }
  }
  return segs;
}

// --- motion envelopes ---------------------------------------------------------------------

/** Slows into its target — for whatever stops itself. */
export const easeOut = t => 1 - Math.pow(1 - t, 3);

/**
 * For whatever is stopped by something else, where decelerating into the obstacle would be wrong.
 */
export function rollEase(t, cells = 1) {
  const r = Math.min(0.5, 1 / Math.max(1, cells));
  const V = 1 / (1 - r / 2);
  return t < r ? (V * t * t) / (2 * r) : V * (t - r / 2);
}
