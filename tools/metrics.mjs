#!/usr/bin/env node
// Treasure Trash — room metrics. Reads a pack, replays each room through the rules
// engine and reports the numbers a generator would select on.
//
//   node metrics.mjs [levels/act1.tt]
//
// `verify.mjs` checks a room is legal; this measures what it costs the player. Nothing
// here fails a build — it prints a table.
//
// Why not Sokoban's box-to-goal features: goal distance and congestion-along-a-box's-path
// need goals, and this game has none, so they have nothing to attach to. What replaces them
// is below.
//
// Two of Sokoban's features DO carry over, because they measure the shape of the solution
// rather than its relation to a goal — see `solveShape`. Taylor & Parberry (GAMEON-NA 2011,
// "Procedural Generation of Sokoban Levels") report box LINES as the metric that "corresponds
// fairly well with the difficulty of the resulting level" and box CHANGES as one that "may be
// an even better measure", and warn that raw push and move counts are not difficulty at all:
// a solution that shoves one thing down a long corridor scores high and plays tedious.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseLevelPack, parseLurd, toState, toGrid, toCart } from '../src/format.js';
import { analyze, TooManyStates } from '../src/solver.js';
import {
  DIR_ORDER, DIRS, MOVE, PUSH, TEAR, BAG, NONE, explain, cell, fan, canStand, isOccupiable, bagsLeft,
  isWon,
} from '../src/rules.js';

const FAN_CELLS = fan(0, 0, 1, 0).length;

/**
 * The enumeration budget the offline pipeline works to. One number, because a predicate answered
 * under one budget in one tool and a larger one in the next is a pipeline that rejects what it
 * just produced, for a reason visible in neither file.
 */
export const MAX_STATES = 50_000;

/** Dry ground: the floor budget a room starts with, before anything stands on it. */
const floorCells = s => s.cells.flat().filter(c => !c.wall && !c.water).length;

const freeCells = (s) => {
  let n = 0;
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) if (canStand(s, x, y)) n++;
  return n;
};

/**
 * Static coupling between bags: does opening bag A in some direction cost bag B one of
 * its own directions? Zero means the room is N independent one-bag rooms sharing a grid.
 * Returns the fraction of ordered (A,dirA) choices that constrain some other bag.
 */
function coupling(s) {
  const bags = [];
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++)
    if (cell(s, x, y).o === BAG) bags.push([x, y]);
  if (bags.length < 2) return null;

  const needs = (bx, by, dir) => {
    const [dx, dy] = DIRS[dir];
    return [...fan(bx, by, dx, dy), [bx - dx, by - dy]];
  };

  let choices = 0, constraining = 0;
  for (const [ax, ay] of bags) for (const dir of DIR_ORDER) {
    const [dx, dy] = DIRS[dir];
    const laid = fan(ax, ay, dx, dy);
    if (laid.some(([x, y]) => !isOccupiable(s, x, y))) continue;   // not a legal opening anyway
    choices++;
    const hits = bags.some(([bx, by]) =>
      (bx !== ax || by !== ay) &&
      DIR_ORDER.some(d2 => needs(bx, by, d2).some(([nx, ny]) =>
        laid.some(([lx, ly]) => lx === nx && ly === ny))));
    if (hits) constraining++;
  }
  return choices ? constraining / choices : 0;
}

/**
 * Can every bag be opened first, or does some first choice lose the room outright? A bag is
 * identified by the cell the raccoon ends on, because a tear always ends on the bag's cell.
 *
 * Returns { first, safe } — how many distinct bags can be torn first at all, and how many
 * of those leave a winnable board. `safe < first` is the room asking "which one first?";
 * `safe === first` means the order is free and the room only asks about direction.
 *
 * CAVEAT: it counts distinct *cells*, not distinct bags, so any room where one bag can be
 * torn from more than one cell reads high.
 */
function orderChoices(a, start) {
  const intact = bagsLeft(start);
  const safeByBag = new Map();
  for (const [, node] of a.states) {
    if (bagsLeft(node.state) !== intact) continue;      // nothing torn yet
    for (const e of node.edges) {
      if (e.kind !== TEAR) continue;
      const t = a.states.get(e.to).state;
      const k = `${t.rac.x},${t.rac.y}`;
      safeByBag.set(k, (safeByBag.get(k) ?? false) || !a.dead.has(e.to));
    }
  }
  return { first: safeByBag.size, safe: [...safeByBag.values()].filter(Boolean).length };
}

/** Shallowest BFS depth at which the room says "no" for the given refusal reason. */
function firstRefusal(a, reasons) {
  let best = Infinity;
  for (const node of a.states.values()) {
    if (node.depth >= best) continue;
    for (const dir of DIR_ORDER) {
      const r = explain(node.state, dir);
      if (!r.ok && reasons.has(r.reason)) { best = node.depth; break; }
    }
  }
  return Number.isFinite(best) ? best : null;
}

/**
 * How far you can keep playing after the room is already lost — the worst case over all
 * traps. A trap noticed at once connects to its cause; one noticed twenty moves later does not.
 */
function postMortem(a) {
  // Rebuild trap targets: analyze() reports the action, we want the dead state it lands in.
  const entries = [];
  for (const [key, node] of a.states) {
    if (a.dead.has(key)) continue;
    for (const e of node.edges) if (a.dead.has(e.to)) entries.push(e.to);
  }
  let worstDepth = 0, worstStates = 0;
  for (const start of new Set(entries)) {
    const seen = new Set([start]);
    let frontier = [start], depth = 0;
    while (frontier.length) {
      const next = [];
      for (const k of frontier) for (const e of a.states.get(k).edges)
        if (a.dead.has(e.to) && !seen.has(e.to)) { seen.add(e.to); next.push(e.to); }
      if (next.length) depth++;
      frontier = next;
    }
    worstDepth = Math.max(worstDepth, depth);
    worstStates = Math.max(worstStates, seen.size);
  }
  return { depth: worstDepth, states: worstStates };
}

/**
 * The shape of a solution, in Sokoban's terms adapted to a roster of pieces.
 *
 *   lines    a maximal run of consecutive actions on the SAME piece in the SAME direction
 *            counts once. Walking between two shoves of one piece does not break the run.
 *   changes  how many times the solution stops working one piece and starts on another.
 *   pieces   how many distinct pieces the solution ever touches.
 *
 * Identity only ever has to be decided between ADJACENT actions, which is what makes this
 * exact without threading ids through the whole board: a single-cell piece is the same one
 * the previous action moved if this action's target is where that one put it, and a cart or
 * couch carries its own ref.
 */
export function solveShape(start, actions) {
  let s = start, prev = null;
  let lines = 0, changes = 0, pushes = 0;
  const touched = new Set();
  // A moving piece changes cell every shove, so counting cells would count one can four times.
  // The token follows the piece from the cell it left to the cell it landed on.
  const tokenAt = new Map();
  let nextTok = 0;

  for (const act of actions) {
    const r = explain(s, act.dir, { trace: true });
    if (!r.ok) throw new Error(`solveShape: illegal ${act.kind} ${act.dir}`);
    const [dx, dy] = DIRS[act.dir];
    const target = [s.rac.x + dx, s.rac.y + dy];
    s = r.next;
    if (act.kind === MOVE) continue;                 // walking is not work on a piece
    pushes++;

    const st = r.steps[0];
    // A tear consumes the bag, so nothing after it can be the same piece.
    const id = act.kind === TEAR ? { type: 'gone' }
      : st.piece ? { type: 'ref', kind: st.piece.kind, ref: st.piece.ref }
      : { type: 'cell', from: target, to: st.moved[0]?.to ?? target };

    if (id.type === 'ref') touched.add(`${id.kind}${id.ref}`);
    else {
      const here = `${target[0]},${target[1]}`;
      const tok = tokenAt.get(here) ?? `p${nextTok++}`;
      tokenAt.delete(here);
      touched.add(tok);
      // A torn bag is consumed; anything else carries its token to where it landed.
      if (id.type === 'cell') tokenAt.set(`${id.to[0]},${id.to[1]}`, tok);
    }

    const same = prev !== null && (
      (id.type === 'ref' && prev.id.type === 'ref'
        && id.kind === prev.id.kind && id.ref === prev.id.ref)
      || (id.type === 'cell' && prev.id.type === 'cell'
        && prev.id.to[0] === id.from[0] && prev.id.to[1] === id.from[1]));

    if (!same) changes++;
    if (!same || prev.dir !== act.dir) lines++;
    prev = { id, dir: act.dir };
  }
  // The first piece worked is not a CHANGE of piece — it is where the count starts.
  return { lines, changes: Math.max(0, changes - 1), pushes, pieces: touched.size };
}

/**
 * Where the ways to lose sit RELATIVE TO OPTIMAL PLAY, read off a finished `analyze`.
 *
 * A raw trap count says nothing about whether a player will ever meet one. L29 shipped with
 * seventeen ways to lose and every one of them hung off a branch a solver would never walk;
 * the first way to lose was eight moves down a line a player would have restarted from.
 *
 * The states considered are every state on SOME shortest solve, not one canonical line — a
 * player solving optimally may take any of them.
 *
 *   onPath      fraction of the solve's depths at which optimal play can still lose the room
 *   firstOnPath the earliest such depth, or null if optimal play can never go wrong
 */
/**
 * Every edge of the shortest-solve DAG that does work — a piece moves, tears or spills. What
 * both the dead-travel measure and the inert-piece test are actually asking about, so it is
 * defined once: two copies of this predicate would let `lead`/`tail` say a room does work at a
 * depth where `inertPieces` says nothing was touched.
 */
function* dagWork(a, onDag = shortestDag(a)) {
  for (const key of onDag) {
    const n = a.states.get(key);
    for (const e of n.edges)
      if (e.kind !== MOVE && onDag.has(e.to) && a.states.get(e.to).depth === n.depth + 1)
        yield [n, e];
  }
}

export function shortestDag(a) {
  const par = a.minMoves;
  const onDag = new Set();
  for (const [k, n] of a.states) if (n.depth === par && isWon(n.state)) onDag.add(k);
  const byDepth = [];
  for (const [k, n] of a.states) (byDepth[n.depth] ??= []).push(k);
  for (let d = par; d > 0; d--)
    for (const k of byDepth[d - 1] ?? [])
      if (a.states.get(k).edges.some(e => onDag.has(e.to) && a.states.get(e.to).depth === d))
        onDag.add(k);
  return onDag;
}

export function pathBite(a, onDag = shortestDag(a)) {
  const par = a.minMoves;
  if (par === null) return { onPath: 0, bitten: 0, firstOnPath: null };

  const bittenAt = new Array(par).fill(false);
  for (const k of onDag) {
    const n = a.states.get(k);
    if (n.depth >= par) continue;
    if (n.edges.some(e => a.dead.has(e.to))) bittenAt[n.depth] = true;
  }
  const bitten = bittenAt.filter(Boolean).length;
  const first = bittenAt.indexOf(true);
  return { onPath: bitten / par, bitten, firstOnPath: first === -1 ? null : first };
}

/**
 * How much dead travel a room may have before it has to say so.
 *
 * `verify.mjs` holds the pack to this and `chooseSets` will not pick a set that would fail it,
 * so the gate and the generator cannot disagree about what a well-sited room is. A shipped room
 * over the bound declares `:lead`/`:tail` and has the number checked exactly; nothing computes
 * a reason to write one, so a generated room is simply held to the bound.
 */
export const WALK_MAX = { lead: 4, tail: 4 };

/**
 * The two stretches of the best line on which nothing happens.
 *
 *   lead  actions before the first one that touches a piece — the walk in
 *   tail  actions after the last one — the walk to the exit
 *
 * Both are the best the player can do, taken over the whole shortest-solve DAG rather than one
 * canonical line, because a player solving optimally may take any of them. A room with nothing
 * to touch is all walk: `lead` 0 and `tail` the whole par.
 *
 * Dead travel is not difficulty and it is not measured by anything else here. Par counts it,
 * `walks` counts it wherever it falls, and `onPath` is a fraction of a par it inflates — so a
 * room can walk the player clear across itself after the last decision and read clean on
 * every other number.
 */
export function deadTravel(a, onDag) {
  const par = a.minMoves;
  if (par === null) return { lead: 0, tail: 0 };
  let firstWork = par, lastWork = 0, worked = false;
  for (const [n] of dagWork(a, onDag ?? shortestDag(a))) {
    worked = true;
    if (n.depth < firstWork) firstWork = n.depth;
    if (n.depth + 1 > lastWork) lastWork = n.depth + 1;
  }
  return { lead: worked ? firstWork : 0, tail: par - lastWork };
}

// ---------------------------------------------------------------- inert pieces
// Everything on the board is there to hinder: to block a lane, to be shoved out of one, to
// give the player a way to lose. A piece that does none of the three is furniture in the
// decorative sense — the player learns to read the board, finds it says nothing, and learns
// instead that the board may be lying. Reachability is not the question, though the two look
// alike from a sealed pocket: a piece can sit in the open, on a route, and still do nothing.

/**
 * The pieces of a built board: one entry per furniture blob, per cart, and per other occupant,
 * each carrying the cells it stands on and which block of the file writes it.
 *
 * Read off the STATE rather than off the grid text, because `toState` has already decided all
 * of this — `pid` and `cart` are the 4-connected blobs `labelBlobs` labelled, and `o` is the
 * occupant. A second reading here would be a second glyph table, and the day `rules.js` grows
 * an occupant code (which CLAUDE.md invites) the table left behind would not know it: the new
 * piece would simply stop being a piece, silently exempt from the gate below.
 */
export function roomPieces(s) {
  const grid = toGrid(s), cart = toCart(s);
  const out = [], furn = new Map(), carts = new Map();
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) {
    const c = s.cells[y][x];
    if (c.pid !== undefined) group(furn, c.pid, 'grid', grid[y][x], x, y);
    else if (c.o !== NONE) out.push({ what: grid[y][x], block: 'grid', cells: [[x, y]] });
    // A cart is its mask, and its cargo is an occupant standing in it — two pieces, one cell.
    if (c.cart !== undefined) group(carts, c.cart, 'cart', cart[y][x], x, y);
  }
  return [...out, ...furn.values(), ...carts.values()];
}

const group = (into, id, block, what, x, y) => {
  const piece = into.get(id) ?? { what, block, cells: [] };
  piece.cells.push([x, y]);
  into.set(id, piece);
};

/** Every cell any shortest solve reads or writes — what the pieces in play are standing on. */
function handledCells(a, onDag) {
  const hit = new Set();
  const add = ([x, y]) => hit.add(`${x},${y}`);
  for (const [n, e] of dagWork(a, onDag ?? shortestDag(a))) {
    const [dx, dy] = DIRS[e.dir];
    add([n.state.rac.x + dx, n.state.rac.y + dy]);         // the cell shoved or torn into
    for (const st of explain(n.state, e.dir, { trace: true }).steps ?? []) {
      for (const m of st.moved) { add(m.from); add(m.to); }
      for (const s of st.spawned) { add(s.at); add(s.from); }
      for (const g of st.gone) add(g.at);
    }
  }
  return hit;
}

/** What a room answers, in the three numbers a piece could change by being there. */
const answerKey = a => `${a.minMoves}|${a.shortestCount}|${a.traps.length}`;

// Taking a piece off the board gives its cells back, so the room MINUS a piece can enumerate
// far larger than the room with it — this is the one analyze in the toolchain whose cost is not
// bounded by the room that was asked about. Past the bound the question is unanswerable, and an
// unanswerable question is not evidence, so it reads as "not shown to be inert" — which is what
// `null` means here, and equally what a board too broken to build means.
const answerWithout = (room, maxStates) => {
  try { return answerKey(analyze(toState({ id: 'inert', ...room }), { maxStates })); }
  catch (e) { if (e instanceof TooManyStates) return null; throw e; }
};

const erase = (room, piece) => {
  const wipe = block => block.map((row, y) => [...row]
    .map((ch, x) => (piece.cells.some(([px, py]) => px === x && py === y) ? '-' : ch)).join(''));
  return piece.block === 'grid'
    ? { ...room, grid: wipe(room.grid) }
    : { ...room, cart: wipe(room.cart) };
};

/**
 * The pieces this room would play identically without.
 *
 * A piece earns its cell one of two ways, and either is enough:
 *
 *   HANDLED    some shortest solve touches it — shoves it, tears it, spills onto it, or shoves
 *              something else into it. It is part of the work.
 *   BINDING    take it away and the room answers differently: a different par, a different
 *              number of ways to solve it, or a different number of ways to lose. It never
 *              moves and it does not have to; it is the reason the lane it stands in is shut.
 *
 * Neither is reachability, and reachability is not a third way. A piece the player can walk up
 * to, look at, and ignore has failed both.
 */
export function inertPieces(room, a, { maxStates = MAX_STATES, onDag } = {}) {
  if (a.minMoves === null) return [];
  const hit = handledCells(a, onDag);
  const base = answerKey(a);
  return roomPieces(toState({ id: 'inert', ...room })).filter(p =>
    !p.cells.some(([x, y]) => hit.has(`${x},${y}`))
    && answerWithout(erase(room, p), maxStates) === base);
}

// ---------------------------------------------------------------- the teaching gate
// A teaching room holds its exit shut until its lesson is done. `inertPieces` above is a
// weaker question and cannot stand in for this one: it asks whether a piece earns its cell,
// which a room satisfies while the player walks around the lesson to the door.
//
// The claim is declared per room and proved by taking the lesson away. Three forms, because
// three kinds of thing get taught and the operation that removes each one differs:
//
//   erase   the lesson is a piece. Its cells go back to bare floor — the room keeps every
//           route it had and loses only the piece, so an unsolvable result means the piece
//           was doing work rather than blocking a corridor.
//   wall    the lesson is a lane the route has to CROSS. Its cells are taken away, because a
//           crossing is proved by there being nothing left to cross to.
//   dry     the lesson is what a lane DOES. Its cells stay and go back to bare floor, which is
//           the only cover that can fail for the right reason when a room needs a slick to
//           carry something further than a shove would.
//   kind    the lesson is an action class. Every win is unreachable using the other classes.
//
// `none` is the fourth, and it is a claim too: this room has no gate. The rooms that open the
// game gate on themselves, and a room whose lesson IS the loss cannot hold its exit shut until
// the player has lost.

const GATE_MODES = new Set(['erase', 'wall', 'dry', 'kind', 'none']);
const GATE_KINDS = { push: PUSH, tear: TEAR, move: MOVE };

/** Read a `:gate` value. Cells are `x,y` in grid indices, the way `:hold` writes them. */
export function parseGate(gate, id) {
  const [mode, ...rest] = String(gate).trim().split(/\s+/);
  if (!GATE_MODES.has(mode))
    throw new Error(`${id}: :gate wants ${[...GATE_MODES].join('|')}, got ${JSON.stringify(mode)}`);
  if (mode === 'none') {
    if (rest.length) throw new Error(`${id}: :gate none takes nothing after it`);
    return { mode, cells: [], kind: null };
  }
  if (mode === 'kind') {
    if (rest.length !== 1 || !(rest[0] in GATE_KINDS))
      throw new Error(`${id}: :gate kind wants one of ${Object.keys(GATE_KINDS).join('|')}, got ${JSON.stringify(rest.join(' '))}`);
    return { mode, cells: [], kind: GATE_KINDS[rest[0]] };
  }
  if (!rest.length) throw new Error(`${id}: :gate ${mode} names no cells`);
  return { mode, kind: null, cells: rest.map(t => {
    const m = /^(\d+),(\d+)$/.exec(t);
    if (!m) throw new Error(`${id}: :gate wants 'x,y' cells, got ${JSON.stringify(t)}`);
    return [Number(m[1]), Number(m[2])];
  }) };
}

/** The room with its lesson covered, for `erase` and `wall`. */
export function coverGate(room, { mode, cells }, id = room.id) {
  const rows = room.grid.length;
  const cols = Math.max(...room.grid.map(r => r.length));
  const hit = (x, y) => cells.some(([cx, cy]) => cx === x && cy === y);
  for (const [x, y] of cells) {
    if (x >= cols || y >= rows) throw new Error(`${id}: :gate names (${x},${y}), off a ${cols}x${rows} grid`);
    // Naming one of these covers the room rather than the lesson, and `toState` would then
    // complain about a missing raccoon instead of about the declaration that removed it.
    const ch = room.grid[y][x] ?? '-';
    if (mode !== 'dry' && '@+E'.includes(ch))
      throw new Error(`${id}: :gate names (${x},${y}), which is the ${ch === 'E' ? 'exit' : 'raccoon'}`);
  }
  const paint = (block, ch) => block.map((row, y) =>
    [...row.padEnd(cols, '-')].map((c, x) => (hit(x, y) ? ch : c)).join(''));
  // Drying touches the lane and nothing else: the cell, and whatever is standing on it, stay.
  if (mode === 'dry') {
    if (!room.water) throw new Error(`${id}: :gate dry on a room with no terrain`);
    return { ...room, water: paint(room.water, '-') };
  }
  const out = { ...room, grid: paint(room.grid, mode === 'wall' ? '#' : '-') };
  // Erasing a piece leaves the floor it stood on, terrain and all; walling takes the cell away,
  // and a wall carries neither a lane nor a cart.
  if (room.water && mode === 'wall') out.water = paint(room.water, '-');
  if (room.cart) out.cart = paint(room.cart, '-');
  return out;
}

/** Can the room still be won without ever taking an action of this kind? */
export function winnableWithoutKind(a, kind) {
  const root = [...a.states].find(([, n]) => n.depth === 0)?.[0];
  if (root === undefined) return false;
  const seen = new Set([root]);
  const stack = [root];
  while (stack.length) {
    const k = stack.pop();
    const n = a.states.get(k);
    if (isWon(n.state)) return true;
    for (const e of n.edges) {
      if (e.kind === kind || seen.has(e.to)) continue;
      seen.add(e.to); stack.push(e.to);
    }
  }
  return false;
}

// ---------------------------------------------------------------- room structure
// Structural rejects, from the same paper, applied to the EMPTY room before anything is
// placed on it. The open-floor rule is the load-bearing one: a room with a large clear
// rectangle has "very bushy, but not very deep state spaces", so it costs a great deal to
// enumerate and buys very little difficulty for the price.

/** The largest w*h all-floor axis-aligned rectangle, as {w,h}; walls are what break it up. */
export function largestOpenBlock(isFloor, cols, rows) {
  let best = { w: 0, h: 0, area: 0 };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!isFloor(x, y)) continue;
    for (let h = 1; y + h <= rows; h++) {
      let w = 0;
      while (x + w < cols) {
        let ok = true;
        for (let j = 0; j < h && ok; j++) if (!isFloor(x + w, y + j)) ok = false;
        if (!ok) break;
        w++;
      }
      if (!w) break;
      if (w * h > best.area) best = { w, h, area: w * h };
    }
  }
  return best;
}

/** One contiguous run of floor, or the room is really two rooms. */
/** The size of each connected region of floor, largest first. Empty when there is no floor. */
export function floorComponents(isFloor, cols, rows) {
  const seen = new Set();
  const sizes = [];
  for (let y0 = 0; y0 < rows; y0++) for (let x0 = 0; x0 < cols; x0++) {
    if (!isFloor(x0, y0) || seen.has(`${x0},${y0}`)) continue;
    seen.add(`${x0},${y0}`);
    const stack = [[x0, y0]];
    let n = 0;
    while (stack.length) {
      const [x, y] = stack.pop();
      n++;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || !isFloor(nx, ny)) continue;
        const k = `${nx},${ny}`;
        if (seen.has(k)) continue;
        seen.add(k); stack.push([nx, ny]);
      }
    }
    sizes.push(n);
  }
  return sizes.sort((a, b) => b - a);
}

export function floorIsConnected(isFloor, cols, rows) {
  return floorComponents(isFloor, cols, rows).length === 1;
}

/**
 * `floorIsConnected` over a built board, counting every cell that is not a wall — including
 * the ones a piece is standing on.
 *
 * Bare floor is not the question a finished room asks. A wall pass may only take bare floor,
 * so a piece it cannot take survives while everything around it goes, and what is left is a
 * cart in a sealed pocket: on screen, reachable-looking, and not.
 */
export const isOneRoom = s =>
  floorIsConnected((x, y) => !s.cells[y][x].wall, s.cols, s.rows);

/** A floor cell walled on three sides is a niche: dead space, or a trivial parking spot. */
export function hasNiche(isFloor, cols, rows) {
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!isFloor(x, y)) continue;
    const open = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
      .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < cols && ny < rows && isFloor(nx, ny));
    if (open.length <= 1) return true;
  }
  return false;
}

export function metrics(level) {
  const start = toState(level);
  const a = analyze(start);
  const actions = a.shortestLurd ? parseLurd(a.shortestLurd) : [];

  const decisions = actions.filter(x => x.kind !== MOVE).length;
  const tears = actions.filter(x => x.kind === TEAR).length;
  const walks = actions.length - decisions;

  // Replay to the win to read the surviving floor and count the water the solution filled.
  // `coupling` only sees bag-on-bag interference, so a bag whose fan bridges a canal reads
  // as uncoupled — read `bridges` alongside it.
  let final = start, bridges = 0;
  for (const act of actions) {
    const before = final;
    final = explain(final, act.dir).next;
    for (let y = 0; y < final.rows; y++) for (let x = 0; x < final.cols; x++)
      if (cell(final, x, y).bridge && !cell(before, x, y).bridge) bridges++;
  }

  const floor = floorCells(start);
  const bags = bagsLeft(start);

  return {
    id: level.id, name: level.name ?? '',
    par: a.minMoves, solves: a.shortestCount, states: a.reachable,
    traps: a.traps.length, exitRefusals: a.exitRefusals,
    bags, decisions, tears, walks, ...deadTravel(a),
    // The floor a room is obliged to spend, over the floor it has.
    tightness: +(FAN_CELLS * bags / floor).toFixed(2),
    // What is left to stand on once the room is won. Low = the walk out was threaded.
    slack: freeCells(final),
    walkRatio: decisions ? +(walks / decisions).toFixed(2) : null,
    coupling: (v => v === null ? null : +v.toFixed(2))(coupling(start)),
    bridges,
    order: (o => `${o.safe}/${o.first}`)(orderChoices(a, start)),
    // 'water' belongs here and 'wall'/'edge' do not: open water is the only refusal that
    // looks like crossable ground, so it is a decoy rather than a boundary.
    firstRefusal: firstRefusal(a, new Set(['exit', 'fan', 'canRoom', 'water'])),
    firstExitRefusal: firstRefusal(a, new Set(['exit'])),
    firstTrap: a.traps.length ? Math.min(...a.traps.map(t => parseLurd(t.lurd).length - 1)) : null,
    postMortem: postMortem(a),
  };
}

// ---------------------------------------------------------------- report
// Only when run as a script — `metrics` is imported by tools that scan candidate banks,
// and a module that prints on import is a module you cannot compose.
const COLS = [
  ['id', 4], ['par', 4], ['bags', 5], ['decisions', 10], ['walkRatio', 10], ['lead', 5], ['tail', 5],
  ['tightness', 10], ['slack', 6], ['coupling', 9], ['bridges', 8], ['order', 7], ['solves', 7],
  ['traps', 6], ['firstTrap', 10], ['pm', 4], ['firstRefusal', 13], ['firstExitRefusal', 17],
];
const val = (r, k) => k === 'pm' ? r.postMortem.depth : (r[k] ?? '·');

export function report(levels) {
  console.log(COLS.map(([k, w]) => String(k).padStart(w)).join(''));
  for (const l of levels)
    console.log(COLS.map(([k, w]) => String(val(metrics(l), k)).padStart(w)).join(''));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const path = resolve(root, process.argv[2] ?? 'levels/act1.tt');
  report(parseLevelPack(readFileSync(path, 'utf8')).levels);
}
