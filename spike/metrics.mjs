#!/usr/bin/env node
// Treasure Trash — room metrics. Reads a pack, replays each room through the rules
// engine and reports the numbers a generator would select on.
//
//   node metrics.mjs [levels/act1.tt]
//
// `verify.mjs` asks "is this room legal?". This asks "is this room worth playing?" —
// which no checker can answer, so it answers the measurable half and leaves the taste
// to a person. Nothing here fails a build; it prints a table.
//
// Why these numbers and not Sokoban's: the standard Sokoban difficulty features are
// box-to-goal features (goal distance, congestion along a box's path to its goal).
// This game has no goals — winning is a transformation, not an assignment — so those
// features have nothing to attach to. What replaces them is below: the board is a
// monotonically shrinking floor budget, and the choices are order and orientation.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseLevelPack, parseLurd, toState } from '../src/format.mjs';
import { analyze } from '../src/solver.mjs';
import {
  DIR_ORDER, DIRS, MOVE, TEAR, BAG, TRASH, explain, cell, fan, fanBlockers, canStand, bagsLeft,
} from '../src/rules.mjs';

// A tear always spends exactly the cells its fan covers, so ask the fan rather than
// restating the number here and letting the two drift apart.
const FAN_CELLS = fan(0, 0, 1, 0).length;

/** Dry ground: the floor budget a room starts with, before anything stands on it.
 *  Water is not floor — it is floor you can buy, at five cells a bag or one a bin. */
const floorCells = s => s.cells.flat().filter(c => !c.wall && !c.water).length;

/** Everywhere the raccoon can still walk, bridges included. */
const freeCells = (s) => {
  let n = 0;
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) if (canStand(s, x, y)) n++;
  return n;
};

/**
 * Static coupling between bags: does opening bag A in some direction cost bag B one of
 * its own directions? A room where this is zero is N independent one-bag rooms sharing
 * a grid — solvable in any order, which is a checklist, not a puzzle.
 * Returns the fraction of ordered (A,dirA) choices that constrain some other bag.
 */
function coupling(s) {
  const bags = [];
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++)
    if (cell(s, x, y).o === BAG) bags.push([x, y]);
  if (bags.length < 2) return null;

  // The cells bag B needs for direction d: its fan, plus the cell you must stand on.
  const needs = (bx, by, dir) => {
    const [dx, dy] = DIRS[dir];
    return [...fan(bx, by, dx, dy), [bx - dx, by - dy]];
  };

  let choices = 0, constraining = 0;
  for (const [ax, ay] of bags) for (const dir of DIR_ORDER) {
    const [dx, dy] = DIRS[dir];
    const laid = fan(ax, ay, dx, dy);
    if (fanBlockers(s, ax, ay, dx, dy).length) continue;           // not a legal opening anyway
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
 * The Order axis (§5 of LEVEL-GENERATION.md), measured: can every bag be opened first, or
 * does some first choice lose the room outright? A bag is identified by the cell the
 * raccoon ends on, because a tear always ends on the bag's own cell.
 *
 * Returns { first, safe } — how many distinct bags can be torn first at all, and how many
 * of those leave a winnable board. `safe < first` is the room asking "which one first?";
 * `safe === first` means the order is free and the room only asks about direction.
 *
 * CAVEAT: it counts distinct *cells*, not distinct bags. In a room with loose bags only
 * those are the same thing. In a room with a can or a wheelie bin, one bag can be torn at
 * several different cells depending on where the container put it, so `first` overcounts —
 * which is why L10 and L11 read 1/4 with only two bags between them.
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
 * How far you can keep playing after the room is already lost. A trap you notice at
 * once is a lesson; a trap that lets you wander twenty moves first is a punishment
 * delivered too late to connect to its cause. Returns the worst case over all traps.
 */
function postMortem(a) {
  // Rebuild trap targets: analyze() reports the action, we want the dead state it lands in.
  const entries = new Set();
  for (const [key, node] of a.states) {
    if (a.dead.has(key)) continue;
    for (const e of node.edges) if (a.dead.has(e.to)) entries.add(e.to);
  }
  let worstDepth = 0;
  for (const start of entries) {
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
  }
  return worstDepth;
}

export function metrics(level) {
  const start = toState(level);
  const a = analyze(start);
  const actions = a.shortestLurd ? parseLurd(a.shortestLurd) : [];

  const decisions = actions.filter(x => x.kind !== MOVE).length;
  const tears = actions.filter(x => x.kind === TEAR).length;
  const walks = actions.length - decisions;

  let opening = 0;
  while (opening < actions.length && actions[opening].kind === MOVE) opening++;

  // Replay to the win to read the floor that survived it, and to count the water the
  // solution had to fill. `coupling` only ever sees bag-on-bag interference; a bag whose
  // fan bridges a canal is coupled to the room through the *terrain* instead, which is
  // the strongest coupling there is — it creates the route. Read the two together, or a
  // water room reads as uncoupled when it is the opposite.
  // Trash in water is permanent and nothing else may ever enter it, so the count only ever
  // climbs: the answer is the difference between the two ends, not a per-move board diff.
  const bridgeCells = s => s.cells.flat().filter(c => c.water && c.o === TRASH).length;
  let final = start;
  for (const act of actions) final = explain(final, act.dir).next;
  const bridges = bridgeCells(final) - bridgeCells(start);

  const floor = floorCells(start);
  const bags = bagsLeft(start);
  const cpl = coupling(start);
  const ord = orderChoices(a, start);

  return {
    id: level.id, name: level.name ?? '',
    par: a.minMoves, solves: a.shortestCount, states: a.reachable,
    traps: a.traps.length, exitRefusals: a.exitRefusals,
    bags, decisions, tears, walks,
    // The floor a room is obliged to spend: five cells per tear, over the floor it has.
    tightness: +(FAN_CELLS * bags / floor).toFixed(2),
    // What is left to stand on once the room is won. Low = the walk out was threaded.
    slack: freeCells(final),
    walkRatio: decisions ? +(walks / decisions).toFixed(2) : null,
    opening,
    coupling: cpl === null ? null : +cpl.toFixed(2),
    bridges,
    order: `${ord.safe}/${ord.first}`,
    // 'water' belongs here and 'wall'/'edge' do not: open water is the only refusal that
    // looks like ground you ought to be able to cross, which is what makes it a decoy
    // rather than a boundary.
    firstRefusal: firstRefusal(a, new Set(['exit', 'fan', 'canRoom', 'water'])),
    firstExitRefusal: firstRefusal(a, new Set(['exit'])),
    firstTrap: a.traps.length ? Math.min(...a.traps.map(t => t.depth)) : null,
    pm: postMortem(a),
  };
}

// ---------------------------------------------------------------- report
// Only when run as a script — `metrics` is imported by tools that scan candidate banks,
// and a module that prints on import is a module you cannot compose.
const COLS = [
  ['id', 4], ['par', 4], ['bags', 5], ['decisions', 10], ['walkRatio', 10], ['opening', 8],
  ['tightness', 10], ['slack', 6], ['coupling', 9], ['bridges', 8], ['order', 7], ['solves', 7],
  ['traps', 6], ['firstTrap', 10], ['pm', 4], ['firstRefusal', 13], ['firstExitRefusal', 17],
];
const val = (r, k) => r[k] ?? '·';

export function report(levels) {
  console.log(COLS.map(([k, w]) => String(k).padStart(w)).join(''));
  for (const l of levels) {
    // One analysis per level, not one per column: `metrics` runs the exhaustive solver,
    // so calling it inside the column map did the whole state-graph walk 17 times a row.
    const m = metrics(l);
    console.log(COLS.map(([k, w]) => String(val(m, k)).padStart(w)).join(''));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url));
  // An explicit path is the caller's, resolved where they typed it; the default is this
  // script's own neighbour. See the same split in verify.mjs.
  const path = process.argv[2]
    ? resolve(process.cwd(), process.argv[2])
    : resolve(here, 'levels/act1.tt');
  report(parseLevelPack(readFileSync(path, 'utf8')).levels);
}
