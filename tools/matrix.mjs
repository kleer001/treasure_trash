#!/usr/bin/env node
// Treasure Trash — the interaction matrix. Does every piece behave when it MEETS something?
//
//   node tools/matrix.mjs               # run the whole matrix, report what disagrees
//   node tools/matrix.mjs --pack        # also write levels/matrix.tt, playable in the browser
//   node tools/matrix.mjs --list        # what the matrix covers, and what it could not build
//
// A room proves a piece works when the piece is FORCED to meet the thing under test. A room's
// declared `:solve` is its SHORTEST path, and the shortest path usually walks straight past the
// piece — so a pack of one-piece rooms replayed to a win says the exit still opens and nothing
// about the piece. What is left uncovered by that is every pairing: a piece against a terrain
// lane, and a piece against another piece.
//
// WHAT EACH CASE CHECKS, and why it is this and not a board comparison. `tools/conform.mjs`
// already compares boards, and a board is only half of an action: the rules also report what
// MOVED, and the stage animates from that report. A step that lands the right board while
// naming the wrong thing leaves a sprite behind, drops one, or asks for one that does not
// exist — none of which a board comparison can see. So the invariant here is:
//
//   landing an action on the stage the room started from must leave the same sprites as
//   building a stage from the board the action produced.
//
// That is one sentence and it catches the whole class: a body named as an occupant (the stage
// throws), a container that sheds without saying what it becomes (the sprite keeps its old
// kind), a piece consumed by a name that finds nothing (the sprite is never removed).

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  explain, cell, terrainOf, DIR_ORDER, NONE,
} from '../src/rules.js';
import { toState, toGrid, toWater, toCart } from '../src/format.js';
import { analyze } from '../src/solver.js';
import { MAX_STATES } from './metrics.mjs';
import { stageFrom, applyStep, settle, timeline, census, spriteHandle } from '../src/stage.js';
import { handlesOf, handleAt, anchorOf, spanOf, RAC_LANE } from '../src/handles.js';
import { root } from './packs.mjs';

// ---------------------------------------------------------------- what there is to meet

/** Every loose piece, by the glyph a grid writes it with. */
export const PIECES = {
  bag: '$', canFull: 'C', canEmpty: 'c', wheelie: 'W', wheelieEmpty: 'w',
  bin: 'B', binEmpty: 'b', jug: 'j', jugEmpty: 'i',
  sponge: 's', cardboard: 'd', pane: 'g', tyreH: 'o', tyreV: 'O', chair: 'h', broom: 'r',
  cabinetU: 'a', cabinetD: 'e', cabinetL: 'k', cabinetR: 'm',
  magnetU: 'f', magnetD: 'l', magnetL: 'p', magnetR: 'q',
};

/** The multi-cell pieces, written as a run of one letter — and the letter a SECOND one of the
 *  same kind is written with. A 4-connected run of one letter is one piece, so two of a kind
 *  standing flush merge into a single illegal blob unless they are spelled apart. */
export const BODIES = { couch: 'F', bicycle: 'Y', rug: 'U',
                        cabinetOpenR: 'J', cabinetOpenD: 'D' };
const SECOND = { F: 'G', Y: 'Z', U: 'V', J: 'Q', D: 'T' };
// A body free to lie either way is built along whichever axis the case wants. An open cabinet is
// not: its two cells lie along its facing, so the right-facing one is only buildable head-on and
// the down-facing one only broadside. The other two facings are those two mirrored, and the
// engine reads a facing off the code, so nothing is left uncovered by leaving them out.
const BODY_AXIS = { J: 'h', D: 'v' };

/**
 * The wheeled pieces. These do not live in the grid at all — a cart cell holds its CARGO in the
 * grid, so which cells are cart cells is only ever said by the `:cart` mask, and a matrix built
 * out of grid glyphs alone could not put one on the board.
 *
 * `cargo` is what is riding in it, written in the grid cell underneath; `hold` is what THAT is
 * holding, which only a carried barrow can have and which no grid cell can say.
 */
export const CARTS = {
  cart: { mask: 'PP' },
  barrowU: { mask: 'u' }, barrowD: { mask: 'd' },
  barrowL: { mask: 'l' }, barrowR: { mask: 'r' },
  // A barrow with something in it, and a barrow with a loaded barrow in it. The stack is the
  // case nothing else on this board can make: it is only reachable by playing, so a matrix that
  // could not write one down could not put it in front of anything.
  barrowFull: { mask: 'r', cargo: 'C' },
  barrowStacked: { mask: 'r', cargo: '>', hold: 'C' },
};
const isCart = g => typeof g === 'object' && g !== null;
// The cart mask is its own alphabet, so its second-of-a-kind letters are their own map. Put
// them in with the grid's and `isBody` starts reading `m` — a filing cabinet — as half a couch.
const SECOND_CART = { P: 'Q', u: 'v', d: 'e', l: 'm', r: 's' };

/** Every lane the `:water` mask carries. `-` is the control: the same case on bare floor. */
export const LANES = {
  dry: '-', canal: '~', filled: '=', grease: '%', tar: 'T', glass: '*', covered: '_',
  grate: 'O', onewayU: '^', onewayD: 'v', onewayL: '<', onewayR: '>',
};

// ---------------------------------------------------------------- the handle invariant
//
// The census below compares a sorted SET of sprite shapes, so two things that draw alike and are
// told apart wrongly leave it untouched — and the account and the stage now name a participant
// the same way, which is what a swap would have to defeat. These three questions are put to the
// account against the BOARDS instead, so they hold however the stage reaches its answer:
//
//   TOTAL       every sprite on a stage answers to a handle the board it came from has;
//   INJECTIVE   no two sprites on one stage answer to the same handle;
//   CONTINUOUS  every handle a step names is on the board the step ran on and holds what the
//               step says it holds, and every handle on the board the step produced either
//               traces back through the step or is announced by an arrival entry.

/** TOTAL and INJECTIVE, of a settled stage against the board it should be holding. */
export function unresolvedSprites(stage, state) {
  const roll = handlesOf(state), bad = [], seen = new Map();
  for (const sp of stage.sprites) {
    const h = spriteHandle(sp);
    if (!roll.has(h)) bad.push(`the ${sp.kind} sprite answers to ${h}, which the board has not got`);
    if (seen.has(h)) bad.push(`the ${sp.kind} and ${seen.get(h)} sprites both answer to ${h}`);
    seen.set(h, sp.kind);
  }
  return bad;
}

// An entry says which thing it is about, and the questions below put that CLAIM to the boards
// either side of the step. Nothing here takes the stamp as the answer: a stamped handle earns
// its keep by matching what the board holds at it. Where a thing comes TO is derived instead,
// off the cells and offsets the entry declares, so the two ends of a move are two statements
// rather than one restated.
const shift = ([x, y], e) => [x + e.dx, y + e.dy];
const movedTo = m => handleAt(shift(anchorOf(m.cells), m), m.becomes.lane);

/**
 * What the board holds at the handle an entry stamped, against what the entry says stands there:
 * the same span of cells, the same occupant code, the same piece or cart id. Every entry answers
 * it the same way, however many cells it covers.
 */
const named = (roll, e) => {
  const d = roll.get(e.handle);
  if (!d) return `nothing answers to ${e.handle}`;
  if (spanOf(d.cells) !== spanOf(e.cells))
    return `the step names ${e.handle} over ${spanOf(e.cells)},`
      + ` where the ${d.what} there stands on ${spanOf(d.cells)}`;
  for (const k of ['o', 'ref'])
    if (d[k] !== e[k])
      return `the step names ${k} ${e[k]} at ${e.handle}, which holds ${d.what} ${k} ${d[k]}`;
  return null;
};

/** An arrival is stamped where it comes to rest, which the span and lane it declares also say. */
const anchorFault = e => (e.handle === handleAt(anchorOf(e.cells), e.lane) ? null
  : `the step names ${e.handle}, whose cells and lane anchor at`
    + ` ${handleAt(anchorOf(e.cells), e.lane)}`);

/**
 * CONTINUOUS, of a traced action. Every fault it can report is the account describing a board
 * that is not the one either side of the step it ran on.
 */
export function handleFaults(r) {
  const bad = [];
  r.steps.forEach((step, i) => {
    const before = handlesOf(r.frames[i]), after = handlesOf(r.frames[i + 1]);
    const say = (what, why) => { if (why) bad.push(`step ${i} ${what}: ${why}`); };

    for (const m of step.moved) say('moved', named(before, m));
    // An arrival the board did not receive is both facts: it arrives, and it is then gone. Such
    // a removal answers to a handle on the board the step PRODUCED rather than the one it ran
    // on, so it is asked of the entry that announced it instead. The before board still gets
    // the first word: a handle it holds is a thing that was already there, and pairing a spawn
    // onto that handle cannot excuse the removal from saying what it took.
    const arrivals = new Map(step.spawned.map(sp => [sp.handle, sp]));
    const fromTheBoard = g => before.has(g.handle) || !arrivals.has(g.handle);
    const asArrived = g => {
      const { o } = arrivals.get(g.handle);
      return o === g.o ? null : `the step takes occupant ${g.o} at ${g.handle}, where ${o} arrived`;
    };

    for (const g of step.gone) say('gone', fromTheBoard(g) ? named(before, g) : asArrived(g));
    for (const sp of step.spawned) say('spawned', anchorFault(sp));

    // Where each thing on the before board ends up. Standing still is the default; a cart
    // carries whatever is riding in it; the thing's own entry overrides both; a removal takes
    // it off.
    const went = new Map([...before.keys()].map(h => [h, h]));
    const rac = st => handleAt([st.rac.x, st.rac.y], RAC_LANE);
    went.set(rac(r.frames[i]), rac(r.frames[i + 1]));
    for (const m of step.moved) {
      if (before.get(m.handle)?.what !== 'cart') continue;
      for (const d of before.values())
        if (d.what === 'occupant' && m.cells.some(([cx, cy]) => cx === d.at[0] && cy === d.at[1]))
          went.set(d.handle, handleAt(shift(d.at, m), d.lane));
    }
    for (const m of step.moved) went.set(m.handle, movedTo(m));
    for (const g of step.gone) if (fromTheBoard(g)) went.delete(g.handle);

    // An arrival entry with no occupant code is an effect playing itself out — a splash, a
    // shattering — and the board never receives it, so it announces nothing. Neither does one
    // a removal takes off in the same step.
    const announced = step.spawned
      .filter(sp => sp.o !== NONE
        && !step.gone.some(g => !fromTheBoard(g) && g.handle === sp.handle))
      .map(sp => sp.handle);
    const covered = new Set([...went.values(), ...announced]);
    for (const [h, d] of after)
      if (!covered.has(h)) say('after', `${d.what} ${h} traces to nothing on the board the step`
        + ' ran on, and no entry announces it');

    const landed = new Map();
    for (const [from, to] of [...went, ...announced.map(h => ['an arrival entry', h])]) {
      if (!after.has(to)) continue;                 // it did not survive; nothing rests there
      if (landed.has(to)) say('after', `${landed.get(to)} and ${from} both come to rest at ${to}`);
      landed.set(to, from);
    }
  });
  return bad;
}

// ---------------------------------------------------------------- the invariant

/**
 * Land one action on a stage the way the game lands it, and say whether the sprites agree with
 * the board it produced.
 *
 * Returns null when the action is refused — a refusal is a legal answer and moves no sprite.
 */
export function landsWhereTheBoardSays(s, dir, bend = null) {
  const traced = explain(s, dir, { trace: true });
  if (!traced.ok) return null;
  // `bend` is how this check is itself checked: a gate nobody has watched fail is a gate nobody
  // knows the shape of. It takes a step and hands back a wrong one, so a test can put the exact
  // mistake this is here to catch in front of it. See `tests/matrix.test.js`. It is applied to
  // the account rather than at the point of use, so the census and the handle questions are
  // asked of the same bent step.
  const r = bend ? { ...traced, steps: traced.steps.map(bend) } : traced;
  const stage = stageFrom(s);
  let threw = null;
  try {
    // The same sequence `landMv` uses when an input cuts an animation short: every step
    // applied in order, each one settled before the next names anything.
    for (const seg of timeline(r, 1))
      for (const it of seg.items) {
        applyStep(stage, it.step, it.racTo);
        settle(stage);
      }
  } catch (e) { threw = e.message; }
  // Asked before the throw is reported, because these questions are put to the account against
  // the boards and a stage that could not resolve a name is downstream of whatever went wrong.
  // A stage that threw has no settled sprites to ask, and is the one thing skipped.
  const adrift = [];
  try {
    adrift.push(...handleFaults(r), ...unresolvedSprites(stageFrom(r.next), r.next),
                ...(threw ? [] : unresolvedSprites(stage, r.next)));
  } catch (e) { adrift.push(`the handles do not resolve: ${e.message}`); }
  if (adrift.length) return { ok: false, why: adrift.join('; '), r };
  if (threw) return { ok: false, why: `the stage threw: ${threw}`, r };
  const mine = census(stage), theirs = census(stageFrom(r.next));
  if (JSON.stringify(mine) === JSON.stringify(theirs)) return { ok: true, r };
  const extra = mine.filter(k => !theirs.includes(k));
  const missing = theirs.filter(k => !mine.includes(k));
  return {
    ok: false, r,
    why: [extra.length ? `left over: ${extra.join(' ')}` : null,
          missing.length ? `never arrived: ${missing.join(' ')}` : null]
      .filter(Boolean).join('; '),
  };
}

/**
 * Did the thing under test take any part in what happened?
 *
 * A case only proves something when the piece actually MEETS what it was put there to meet, and
 * a harness that cannot tell a meeting from an empty corridor reports the corridor as a pass.
 * Three ways it can have mattered, and it needs one of them:
 *
 *   it CHANGED — the lane was filled in, covered, dried; the other piece moved or became
 *     something else; the subject came to rest on the cell;
 *   it REFUSED — the action was blocked, and the cell under test is among the cells to blame;
 *   it MATTERED ELSEWHERE — take it away and the rest of the board comes out differently, which
 *     is how a thing that only STOPS something shows up. That last one is asked the way
 *     `inertPieces` asks whether a piece earns its cell.
 *
 * The third comparison ignores the cells the thing occupied, since those necessarily differ
 * once it is gone — which is also why it cannot be the only question asked.
 */
export function meeting(room, at, dir = 'r') {
  const holes = at.map(([x, y]) => `${x},${y}`);
  let s, a;
  try { s = toState({ ...room, id: 'm' }); a = explain(s, dir, { trace: false }); }
  catch { return { reached: true, mattered: true }; }   // unreadable is a finding, not an empty case

  // Reached: refused with the cell to blame, or the cell is not what it was afterwards.
  const same = (p, q) => JSON.stringify(p) === JSON.stringify(q);
  const blamed = !a.ok && (a.blame ?? []).some(([x, y]) => holes.includes(`${x},${y}`));
  const changed = a.ok && at.some(([x, y]) => !same(cell(s, x, y), cell(a.next, x, y)));
  // Or it was CROSSED. A roller travels until something stops it, so it passes over the cell
  // under test and comes to rest well beyond — and a cell that is empty before and empty after
  // shows nothing of the thing that went through it.
  const crossed = a.ok && crossesTest(s, dir, holes);
  // What the lane's own terrain DID, as a change rather than a value. The value is masked out
  // of the whole-board comparison below — a lane is different from bare floor by definition, and
  // saying so proves nothing — but masking it also hides how it changed, which is the only thing
  // that ever proves a lane took part. So the change is asked for separately, in both runs.
  // Whether it changed, not what it is. What it is differs between the two runs by definition —
  // that is the whole of what removing it did — and comparing values would call every lane a
  // participant.
  const terrainDelta = (from, to) =>
    at.map(([x, y]) =>
      same(terrainOf(cell(from, x, y)), terrainOf(cell(to, x, y))) ? 'kept' : 'changed').join(',');
  const usedUp = a.ok && at.some(([x, y]) =>
    !same(terrainOf(cell(s, x, y)), terrainOf(cell(a.next, x, y))));

  // Mattered elsewhere: without it, does the rest of the board come out the same? This is how a
  // thing that only STOPS something shows up, and it is asked the way `inertPieces` asks
  // whether a piece earns its cell. The cells it occupied are ignored, since those necessarily
  // differ once it is gone — which is why it cannot be the only question.
  const bare = {
    ...room,
    grid: room.grid.map((row, y) =>
      [...row].map((ch, x) => (holes.includes(`${x},${y}`) ? '-' : ch)).join('')),
    ...(room.water && { water: room.water.map((row, y) =>
      [...row].map((ch, x) => (holes.includes(`${x},${y}`) ? '-' : ch)).join('')) }),
    // A cart lives in its own mask and what it is holding lives in a third block, so taking the
    // thing under test off the board means taking it off all three. Leave the mask and the room
    // has a cart cell with nothing in it; leave the hold and it names a cell that is now floor.
    ...(room.cart && { cart: room.cart.map((row, y) =>
      [...row].map((ch, x) => (holes.includes(`${x},${y}`) ? '-' : ch)).join('')) }),
    ...(room.hold && { hold: room.hold.filter(h => !holes.includes(h.split(' ')[0])) }),
  };
  let b;
  try { b = explain(toState({ ...bare, id: 'm' }), dir); }
  catch { return { reached: true, mattered: true }; }
  if (a.ok !== b.ok) return { reached: true, mattered: true };
  if (!a.ok) return { reached: blamed, mattered: a.reason !== b.reason };
  if (a.kind !== b.kind) return { reached: true, mattered: true };
  // Two kinds of mask, and conflating them is what hides a grate. A removed PIECE leaves a hole
  // in the grid, so its cells have to be ignored outright. A removed LANE takes nothing off the
  // grid — only the terrain mask — so the grid there is compared in full, which is the only
  // place "the grate ate it" and "the can landed on it" can be told apart.
  const pieceHoles = [], laneHoles = [];
  room.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!holes.includes(`${x},${y}`)) return;
    (ch === bare.grid[y][x] ? laneHoles : pieceHoles).push([x, y]);
  }));
  const blank = st => {
    const rows = toGrid(st).map(r => [...r]);
    const wet = (toWater(st) ?? rows.map(r => r.map(() => '-'))).map(r => [...r]);
    const cart = (toCart(st) ?? rows.map(r => r.map(() => '-'))).map(r => [...r]);
    for (const [x, y] of pieceHoles) { rows[y][x] = '?'; wet[y][x] = '?'; cart[y][x] = '?'; }
    for (const [x, y] of laneHoles) wet[y][x] = '?';
    return JSON.stringify([rows, wet, cart, st.rac]);
  };
  const bareState = toState({ ...bare, id: 'm' });
  const mattered = terrainDelta(s, a.next) !== terrainDelta(bareState, b.next)
    || blank(a.next) !== blank(b.next);
  return { reached: blamed || changed || crossed || mattered, mattered };
}

/** Every cell a straight run from `from` to `to` passes through, both ends included. */
const along = ([fx, fy], [tx, ty]) => {
  const [dx, dy] = [Math.sign(tx - fx), Math.sign(ty - fy)];
  const out = [`${fx},${fy}`];
  for (let [x, y] = [fx, fy]; x !== tx || y !== ty; x += dx, y += dy) out.push(`${x + dx},${y + dy}`);
  return out;
};

/** Did anything the action moved travel THROUGH one of these cells? */
function crossesTest(s, dir, holes) {
  const r = explain(s, dir, { trace: true });
  if (!r.ok) return false;
  for (const step of r.steps) {
    // One translation per entry, however many cells it covers, so a body's path is every cell
    // of it swept by that translation and a can's is the one cell it crossed.
    for (const m of step.moved)
      for (const [x, y] of m.cells)
        if (along([x, y], [x + m.dx, y + m.dy]).some(k => holes.includes(k))) return true;
  }
  return false;
}

/**
 * The whole invariant, asked of rooms rather than of corridors: every board each one reaches,
 * every direction. The forced meetings above are one shove each from a board built to stage a
 * pairing; this is what boards a room actually walks through do with the same questions.
 */
export function sweepRooms(rooms, { cap = 200 } = {}) {
  const bad = [];
  for (const room of rooms) {
    let s0;
    try { s0 = toState({ ...room, id: room.id ?? 'sweep' }); } catch (e) {
      bad.push(`${room.id}: unreadable — ${e.message}`); continue;
    }
    for (const st of reachable(s0, cap))
      for (const d of DIR_ORDER) {
        const got = landsWhereTheBoardSays(st, d);
        if (got && !got.ok) bad.push(`${room.id} ${d}: ${got.why}`);
      }
  }
  return bad;
}

/** Every board a room can reach, bounded — the invariants are asked of all of them. */
export function reachable(s0, cap = 4000) {
  const seen = new Map(), stack = [s0];
  // Piece, cart and link ids are relabelled by first appearance, the way `stateKey` does. Raw,
  // a board reached by opening two cabinets in the other order keys as a board never seen, and
  // the walk spends its cap on the same positions written with different numbers.
  const key = st => {
    const label = new Map();
    const tag = (v, kind) => {
      if (v === undefined) return -1;
      const k = `${kind}:${v}`;
      if (!label.has(k)) label.set(k, label.size);
      return label.get(k);
    };
    return JSON.stringify([st.cells.map(r => r.map(c =>
      [c.o, c.hold ?? null, tag(c.pid, 'p'), tag(c.cart, 'c'), c.ck ?? -1, tag(c.grip, 'g'),
       c.water, c.bridge, c.ter ?? 0])), st.rac]);
  };
  seen.set(key(s0), s0);
  while (stack.length && seen.size < cap) {
    const st = stack.pop();
    for (const d of DIR_ORDER) {
      const r = explain(st, d);
      if (!r.ok) continue;
      const k = key(r.next);
      if (seen.has(k)) continue;
      seen.set(k, r.next);
      stack.push(r.next);
    }
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------- building a forced meeting

// Room shape. The raccoon stands at the left of a corridor with the piece in front of him, so
// one shove drives it into whatever is placed further along. Wide enough that a roller has room
// to travel and a container has room to shed.
const W = 11, H = 5, ROW = 2, AT = 2;

/**
 * A corridor: the raccoon at x=1, `left` starting at x=`AT`, and the thing under test in the
 * cell `left`'s LEADING EDGE moves into — one past its own far side, which is x=3 for a single
 * cell and x=4 for a body lying along the shove.
 *
 * That cell is the whole point. Put the lane a cell further out and a piece that travels one
 * cell never reaches it, the case passes having staged nothing, and the harness reports an
 * empty corridor as a meeting. `right` may be null — that is the piece meeting bare lane.
 *
 * Returns the room and `at`: the cells the thing under test occupies, which is what `meets`
 * takes away to find out whether any of this mattered.
 */
export function corridor({ left, right = null, lane = '-', vertical = false }) {
  const grid = Array.from({ length: H }, () => Array.from({ length: W }, () => '-'));
  const water = Array.from({ length: H }, () => Array.from({ length: W }, () => '-'));
  const cart = Array.from({ length: H }, () => Array.from({ length: W }, () => '-'));
  const hold = [];
  for (let x = 0; x < W; x++) { grid[0][x] = '#'; grid[H - 1][x] = '#'; }
  for (let y = 0; y < H; y++) { grid[y][0] = '#'; grid[y][W - 1] = '#'; }
  grid[ROW][1] = '@';
  grid[ROW][W - 2] = 'E';

  const isBody = g => Object.values(BODIES).includes(g) || Object.values(SECOND).includes(g);
  // Where a piece put down at column x reaches to, along the shove.
  const put = (glyph, x) => {
    if (isCart(glyph)) {
      const cells = [...glyph.mask].map((ch, i) => (vertical ? [x, ROW - i] : [x + i, ROW]));
      if (cells.some(([cx, cy]) => cx > W - 3 || cy < 1)) return null;
      cells.forEach(([cx, cy], i) => { cart[cy][cx] = glyph.mask[i]; });
      if (glyph.cargo) grid[ROW][x] = glyph.cargo;
      if (glyph.hold) hold.push(`${x},${ROW} ${glyph.hold}`);
      return cells;
    }
    if (!isBody(glyph)) { grid[ROW][x] = glyph; return [[x, ROW]]; }
    const axis = BODY_AXIS[glyph] ?? BODY_AXIS[Object.keys(SECOND).find(k => SECOND[k] === glyph)];
    if (axis && axis !== (vertical ? 'v' : 'h')) return null;
    if (vertical) {
      if (ROW - 1 < 1) return null;
      grid[ROW][x] = glyph; grid[ROW - 1][x] = glyph;
      return [[x, ROW], [x, ROW - 1]];
    }
    if (x + 1 > W - 3) return null;
    grid[ROW][x] = glyph; grid[ROW][x + 1] = glyph;
    return [[x, ROW], [x + 1, ROW]];
  };

  const own = put(left, AT);
  if (!own) return null;
  const front = Math.max(...own.map(([x]) => x)) + 1;   // the cell it moves into

  let at = [[front, ROW]];
  if (right !== null) {
    const theirs = put(clashes(left, right) ? secondOf(right) : right, front);
    if (!theirs) return null;
    at = theirs;
  }
  if (lane !== '-') water[ROW][front] = lane;

  const room = { id: 'm', grid: grid.map(r => r.join('')) };
  if (water.some(r => r.some(c => c !== '-'))) room.water = water.map(r => r.join(''));
  if (cart.some(r => r.some(c => c !== '-'))) room.cart = cart.map(r => r.join(''));
  if (hold.length) room.hold = hold;
  return { room, at };
}

/** Whether these two would be written with the same letters. Two carts differing only in what
 *  they are carrying share a mask glyph, so identity is not the question — the letters are. */
const clashes = (a, b) => (isCart(a) && isCart(b)
  ? [...a.mask].some(ch => b.mask.includes(ch))
  : a === b);

/** The same piece again, spelled apart from the first — a second of a kind standing flush would
 *  otherwise read as one illegal blob, in the cart mask exactly as in the grid. */
const secondOf = g => (isCart(g)
  ? { ...g, mask: [...g.mask].map(ch => SECOND_CART[ch] ?? ch).join('') }
  : SECOND[g] ?? g);

/** Every case the matrix runs: a piece meeting a lane, and a piece meeting a piece. */
export function cases() {
  const out = [];
  const all = { ...PIECES, ...BODIES, ...CARTS };
  const add = (id, what, built) => { if (built) out.push({ id, what, ...built }); };
  for (const [pn, pg] of Object.entries(all)) {
    for (const [ln, lg] of Object.entries(LANES))
      add(`${pn}-on-${ln}`, `${pn} shoved onto ${ln}`, corridor({ left: pg, lane: lg }));
    for (const [qn, qg] of Object.entries(all))
      add(`${pn}-into-${qn}`, `${pn} shoved into ${qn}`, corridor({ left: pg, right: qg }));
    // The same piece broadside: a rug or a bicycle lying across the shove is a different rule
    // from one lying along it, and the two share every other field.
    if (Object.values(BODIES).includes(pg) || (isCart(pg) && pg.mask.length > 1))
      for (const [qn, qg] of Object.entries(all))
        add(`${pn}-broadside-into-${qn}`, `${pn} lying across, shoved into ${qn}`,
            corridor({ left: pg, right: qg, vertical: true }));
  }
  return out;
}

// ---------------------------------------------------------------- the run

/**
 * Run every case. Two ways a case can fail to be a case, and both are REPORTED rather than
 * counted as passes: a board that will not build, and a board where the piece never met what it
 * was put there to meet. The second is the one that matters — it looks exactly like a pass.
 */
export function run(only = null) {
  const rows = [];
  for (const c of cases()) {
    if (only && !c.id.includes(only)) continue;
    let s;
    try { s = toState({ ...c.room, id: c.id }); }
    catch (e) { rows.push({ ...c, verdict: 'unbuildable', why: e.message }); continue; }
    const met = meeting(c.room, c.at);
    if (!met.reached) { rows.push({ ...c, verdict: 'NO-MEETING', state: s }); continue; }
    const got = landsWhereTheBoardSays(s, 'r');
    if (got === null) { rows.push({ ...c, verdict: 'refused', ...met, state: s }); continue; }
    rows.push({ ...c, verdict: got.ok ? 'ok' : 'DISAGREES', why: got.why, ...met, state: s });
  }
  return rows;
}

/**
 * The cases as a playable pack, so any one of them can be poked by hand in the real game:
 * serve the root and open `index.html?acts=matrix.tt`.
 *
 * A room needs a solve to load, and computing it also settles whether the case is playable at
 * all. One that cannot be finished is dropped and COUNTED — a pack that quietly shrank would
 * read as a pack that passed.
 */
export function pack(rows) {
  const out = [':pack   Treasure Trash — the interaction matrix (bench, never shipped)', ''];
  let dropped = 0;
  for (const r of rows) {
    if (r.verdict === 'unbuildable' || !r.state) { dropped++; continue; }
    let a;
    try { a = analyze(r.state, { maxStates: MAX_STATES }); } catch { dropped++; continue; }
    if (a.minMoves === null) { dropped++; continue; }
    out.push(`:level  ${r.id}`, `:name   ${r.what}`,
             `:par    ${a.minMoves}`, `:traps  ${a.traps.length}`,
             `:solves ${a.shortestCount}`, `:solve  ${a.shortestLurd}`,
             ':grid', ...r.room.grid, ':end');
    if (r.room.water) out.push(':water', ...r.room.water, ':end');
    if (r.room.cart) out.push(':cart', ...r.room.cart, ':end');
    if (r.room.hold) out.push(':hold', ...r.room.hold, ':end');
    out.push('');
  }
  return { text: out.join('\n') + '\n', dropped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
  const rows = run(only);
  const tally = rows.reduce((a, r) => ({ ...a, [r.verdict]: (a[r.verdict] ?? 0) + 1 }), {});
  if (process.argv.includes('--list'))
    for (const r of rows) console.log(`${r.verdict.padEnd(12)} ${r.id}${r.why ? ' — ' + r.why : ''}`);
  else
    for (const r of rows) if (r.verdict === 'DISAGREES' || r.verdict === 'NO-MEETING')
      console.log(`  ${r.verdict} ${r.id}${r.why ? ' — ' + r.why : ''}`);
  if (process.argv.includes('--pack')) {
    const at = resolve(root, 'levels', 'matrix.tt');
    const { text, dropped } = pack(rows);
    writeFileSync(at, text);
    console.log(`\nwrote ${at} — ${dropped} case(s) left out as unfinishable`);
  }
  // Two numbers, never one. A case where the piece reached the thing under test and the answer
  // came out the same as bare floor is real coverage — a lane that does nothing to that piece is
  // a fact worth holding — but it is not an interaction, and reporting the total alone would
  // claim more than was staged.
  const mattered = rows.filter(r => r.mattered).length;
  console.log(`\n${rows.length} cases: ` + Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(', '));
  console.log(`${mattered} of them the thing under test actually changed the answer;`
    + ` ${rows.length - mattered} came out as they would on bare floor`);
  // A case that staged nothing is a hole in the gate, not a result — same exit code as a
  // disagreement, because a matrix that cannot see a piece reports agreement about it either way.
  process.exit(rows.some(r => r.verdict === 'DISAGREES' || r.verdict === 'NO-MEETING') ? 1 : 0);
}
