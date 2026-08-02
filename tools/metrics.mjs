#!/usr/bin/env node
// Room metrics: replays each room through the rules engine and prints the numbers a
// generator would select on. `node tools/metrics.mjs [levels/act1.tt]`. Never fails.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseLevelPack, parseLurd, toState } from '../src/format.mjs';
import { analyze } from '../src/solver.mjs';
import {
  DIR_ORDER, DIRS, MOVE, TEAR, BAG, explain, fan, fanBlockers, canStand, bagsLeft,
  bridged, countCells, forEachCell,
} from '../src/rules.mjs';

const FAN_CELLS = fan(0, 0, 1, 0).length;

/** Dry ground: the floor budget a room starts with. Water is not floor. */
const floorCells = s => countCells(s, c => !c.wall && !c.water);

/** Everywhere the raccoon can still walk, bridges included. */
const freeCells = s => countCells(s, (c, x, y) => canStand(s, x, y));

/** Water cells filled in with trash. */
const bridgeCells = s => countCells(s, bridged);

/**
 * Fraction of legal (bag, direction) choices whose fan costs some other bag a direction.
 * Null with fewer than two bags. Zero means the room is N independent one-bag rooms.
 */
function coupling(s) {
  const bags = [];
  forEachCell(s, (c, x, y) => { if (c.o === BAG) bags.push([x, y]); });
  if (bags.length < 2) return null;

  const needs = (bx, by, dir) => {
    const [dx, dy] = DIRS[dir];
    return [...fan(bx, by, dx, dy), [bx - dx, by - dy]];
  };

  let choices = 0, constraining = 0;
  for (const [ax, ay] of bags) for (const dir of DIR_ORDER) {
    const [dx, dy] = DIRS[dir];
    const laid = fan(ax, ay, dx, dy);
    if (fanBlockers(s, ax, ay, dx, dy).length) continue;
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
 * How free the opening order is: { first, safe } — bags that can be torn first at all,
 * and how many of those leave a winnable board. Counts distinct end cells, so a room
 * whose containers can drop a bag in several places overcounts `first`.
 */
function orderChoices(a, start) {
  const intact = bagsLeft(start);
  const safeByBag = new Map();
  for (const [, node] of a.states) {
    if (bagsLeft(node.state) !== intact) continue;
    for (const e of node.edges) {
      if (e.kind !== TEAR) continue;
      const t = a.states.get(e.to).state;
      const k = `${t.rac.x},${t.rac.y}`;
      safeByBag.set(k, (safeByBag.get(k) ?? false) || !a.dead.has(e.to));
    }
  }
  return { first: safeByBag.size, safe: [...safeByBag.values()].filter(Boolean).length };
}

/** Shallowest BFS depth at which the room refuses for one of the given reasons. */
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

/** Worst-case number of moves still playable after the room is already lost. */
function postMortem(a) {
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

function metrics(level) {
  const start = toState(level);
  const a = analyze(start);
  const actions = a.shortestLurd ? parseLurd(a.shortestLurd) : [];

  const decisions = actions.filter(x => x.kind !== MOVE).length;
  const tears = actions.filter(x => x.kind === TEAR).length;
  const walks = actions.length - decisions;

  let opening = 0;
  while (opening < actions.length && actions[opening].kind === MOVE) opening++;

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
    tightness: +(FAN_CELLS * bags / floor).toFixed(2),
    slack: freeCells(final),
    walkRatio: decisions ? +(walks / decisions).toFixed(2) : null,
    opening,
    coupling: cpl === null ? null : +cpl.toFixed(2),
    bridges,
    order: `${ord.safe}/${ord.first}`,
    firstRefusal: firstRefusal(a, new Set(['exit', 'fan', 'canRoom', 'water'])),
    firstExitRefusal: firstRefusal(a, new Set(['exit'])),
    firstTrap: a.traps.length ? Math.min(...a.traps.map(t => t.depth)) : null,
    pm: postMortem(a),
  };
}

const COLS = [
  ['id', 4], ['par', 4], ['bags', 5], ['decisions', 10], ['walkRatio', 10], ['opening', 8],
  ['tightness', 10], ['slack', 6], ['coupling', 9], ['bridges', 8], ['order', 7], ['solves', 7],
  ['traps', 6], ['firstTrap', 10], ['pm', 4], ['firstRefusal', 13], ['firstExitRefusal', 17],
];
const val = (r, k) => r[k] ?? '·';

function report(levels) {
  console.log(COLS.map(([k, w]) => String(k).padStart(w)).join(''));
  for (const l of levels) {
    const m = metrics(l);
    console.log(COLS.map(([k, w]) => String(val(m, k)).padStart(w)).join(''));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.argv[2]
    ? resolve(process.cwd(), process.argv[2])
    : resolve(dirname(fileURLToPath(import.meta.url)), '../levels/act1.tt');
  report(parseLevelPack(readFileSync(path, 'utf8')).levels);
}
