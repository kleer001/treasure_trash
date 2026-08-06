#!/usr/bin/env node
// Treasure Trash — room metrics. Reads a pack, replays each room through the rules
// engine and reports the numbers a generator would select on.
//
//   node metrics.mjs [levels/act1.tt]
//
// `verify.mjs` checks a room is legal; this measures what it costs the player. Nothing
// here fails a build — it prints a table.
//
// Why not Sokoban's difficulty features: those are box-to-goal features (goal distance,
// congestion along a box's path to its goal), and this game has no goals, so they have
// nothing to attach to. What replaces them is below.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseLevelPack, parseLurd, toState } from '../src/format.js';
import { analyze } from '../src/solver.js';
import {
  DIR_ORDER, DIRS, MOVE, TEAR, BAG, explain, cell, fan, canStand, isOccupiable, bagsLeft,
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

export function metrics(level) {
  const start = toState(level);
  const a = analyze(start);
  const actions = a.shortestLurd ? parseLurd(a.shortestLurd) : [];

  const decisions = actions.filter(x => x.kind !== MOVE).length;
  const tears = actions.filter(x => x.kind === TEAR).length;
  const walks = actions.length - decisions;

  let opening = 0;
  while (opening < actions.length && actions[opening].kind === MOVE) opening++;

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
    bags, decisions, tears, walks,
    // The floor a room is obliged to spend, over the floor it has.
    tightness: +(FAN_CELLS * bags / floor).toFixed(2),
    // What is left to stand on once the room is won. Low = the walk out was threaded.
    slack: freeCells(final),
    walkRatio: decisions ? +(walks / decisions).toFixed(2) : null,
    opening,
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
  ['id', 4], ['par', 4], ['bags', 5], ['decisions', 10], ['walkRatio', 10], ['opening', 8],
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
