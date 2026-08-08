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
import { parseLevelPack, parseLurd, toState } from '../src/format.js';
import { analyze } from '../src/solver.js';
import {
  DIR_ORDER, DIRS, MOVE, TEAR, BAG, explain, cell, fan, canStand, isOccupiable, bagsLeft,
  isWon,
} from '../src/rules.js';

const FAN_CELLS = fan(0, 0, 1, 0).length;

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
function shortestDag(a) {
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

export function pathBite(a) {
  const par = a.minMoves;
  if (par === null) return { onPath: 0, bitten: 0, firstOnPath: null };

  const onDag = shortestDag(a);
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
/**
 * How much of it a room may have before it has to say so.
 *
 * `verify.mjs` holds the pack to this and `chooseSets` will not pick a set that would fail it,
 * so the gate and the generator cannot disagree about what a well-sited room is. A shipped room
 * over the bound declares `:lead`/`:tail` and has the number checked exactly; nothing computes
 * a reason to write one, so a generated room is simply held to the bound.
 */
export const WALK_MAX = { lead: 4, tail: 4 };

export function deadTravel(a) {
  const par = a.minMoves;
  if (par === null) return { lead: 0, tail: 0 };
  const onDag = shortestDag(a);
  let firstWork = par, lastWork = 0, worked = false;
  for (const k of onDag) {
    const n = a.states.get(k);
    for (const e of n.edges) {
      if (e.kind === MOVE) continue;
      if (!onDag.has(e.to) || a.states.get(e.to).depth !== n.depth + 1) continue;
      worked = true;
      if (n.depth < firstWork) firstWork = n.depth;
      if (n.depth + 1 > lastWork) lastWork = n.depth + 1;
    }
  }
  return worked ? { lead: firstWork, tail: par - lastWork } : { lead: 0, tail: par };
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
export function floorIsConnected(isFloor, cols, rows) {
  const all = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (isFloor(x, y)) all.push([x, y]);
  if (!all.length) return false;
  const seen = new Set([`${all[0][0]},${all[0][1]}`]);
  const stack = [all[0]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || !isFloor(nx, ny)) continue;
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      seen.add(k); stack.push([nx, ny]);
    }
  }
  return seen.size === all.length;
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
