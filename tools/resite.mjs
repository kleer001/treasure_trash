#!/usr/bin/env node
// Treasure Trash — re-site the exit and the raccoon.
//
//   node tools/resite.mjs [--in F] [--out F] [--workers N]
//
// `placeOn` hands the exit and the raccoon two random free cells and never looks at them
// again. Nothing downstream looks either: par counts the walk, `walks` counts it wherever it
// falls, and every score is a rate over a par the walk inflated. So a room can be sound on
// every number in the harvest and still open with a march to the first piece and close with a
// longer one to the door, and the numbers will call it a long room rather than an empty one.
//
// This searches the two cells the generator threw away, and keeps the best pair by
// `deadTravel`. Walls cannot fix it — `shrink` may only take floor no solution touches, and
// the floor between the last decision and a distant door is floor every solution crosses.
//
// PER SET, like `shrink`: the three rooms share an outline, a raccoon and an exit, and that
// sharing is the set. A pair has to be affordable to all three or to none.
//
// RUN IT BEFORE `shrink`. Moving the raccoon off the end of a corridor is what makes the
// corridor unused, and `shrink` is what then walls it away.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defaultWorkers, run, servePass } from './pool.mjs';
import { isMainThread, workerData } from 'node:worker_threads';
import { toState } from '../src/format.js';
import { analyze, reroot, TooManyStates } from '../src/solver.js';
import { bagsLeft } from '../src/rules.js';
import { measure } from './harvest.mjs';
import { deadTravel, pathBite, isOneRoom, shortestDag, MAX_STATES } from './metrics.mjs';
import { PAR_MIN, PAR_MAX } from './sets.mjs';

// The pair is searched one cell at a time — the exit against wherever the raccoon stands, then
// the raccoon against wherever the exit landed — because searching both at once is the square
// of a per-candidate full solve. One pass can therefore stop one step short of the best pair,
// and a second pass is what finds it.
const ROUNDS = 2;

const put = (grid, [x, y], ch) =>
  grid.map((row, j) => (j === y ? row.slice(0, x) + ch + row.slice(x + 1) : row));

const find = (grid, ch) => {
  for (let y = 0; y < grid.length; y++) {
    const x = grid[y].indexOf(ch);
    if (x !== -1) return [x, y];
  }
  return null;
};

const same = pts => pts.every(p => p && p[0] === pts[0][0] && p[1] === pts[0][1]);

// The floor a re-sited ROOM still has to clear — `sets.mjs`'s, as an argument rather than a
// constant so an act with a different band can say so.
//
// `SET_TOP_MIN` is deliberately NOT here. A set whose top rung only reaches Act 2 because of
// the walk is not an Act 2 set, and holding the top rung up would keep exactly the padding
// this exists to remove. Re-siting reports the par the room actually asks for; whether that is
// still enough is `chooseSets`' question, and it asks it.
const FLOOR = { parMin: PAR_MIN, parMax: PAR_MAX };

/**
 * Everything the guards need about one room, or null if it will not hold.
 *
 * `cache` is a box holding a graph built for this same board and exit with the raccoon somewhere
 * else; when it fits, the room is re-rooted instead of enumerated, and a fresh enumeration is
 * left in the box — so the first candidate of a sweep pays for it and the rest do not.
 */
function read(grid, cart, { parMin, parMax }, cache = null) {
  let s;
  try { s = toState({ id: 'r', grid, ...(cart && { cart }) }); } catch { return null; }
  if (!isOneRoom(s)) return null;
  let a = cache?.graph ? reroot(cache.graph, s) : null;
  if (!a) {
    try { a = analyze(s, { maxStates: MAX_STATES }); }
    catch (e) { if (e instanceof TooManyStates) return null; throw e; }
    if (cache) cache.graph = a;
  }
  if (a.minMoves === null) return null;
  if (a.minMoves < parMin || a.minMoves > parMax) return null;
  if (a.silentTraps.length) return null;
  if (bagsLeft(s) > 0 && a.exitRefusals === 0) return null;   // a door that refuses nothing
  if (a.traps.length < 1) return null;                        // nothing to get wrong
  const onDag = shortestDag(a);
  return { par: a.minMoves, solves: a.shortestCount,
           onPath: pathBite(a, onDag).onPath, ...deadTravel(a, onDag) };
}

/**
 * What a placement costs the set, smallest is best, or null if the set will not take it.
 *
 * The worst room leads, because the bound a pack is held to is per room: a set that fixes two
 * rooms and leaves the third marching is a set with a bad room in it. Sums break the ties, and
 * bite breaks those — of two placements that walk the player the same distance, the one that
 * can still be lost is the better room.
 */
export function cost(reads) {
  if (!reads || reads.some(r => r === null)) return null;
  const pars = reads.map(r => r.par);
  if (!(pars[0] < pars[1] && pars[1] < pars[2])) return null;   // the ladder is the set
  const sum = k => reads.reduce((a, r) => a + r[k], 0);
  return [
    Math.max(...reads.map(r => r.tail)),
    Math.max(...reads.map(r => r.lead)),
    sum('tail') + sum('lead'),
    -sum('onPath'),
    sum('solves'),
  ];
}

/** Lexicographic, and a placement the set will not take never beats one it will. */
const beats = (candidate, best) => {
  if (candidate === null) return false;
  if (best === null) return true;
  for (let i = 0; i < best.length; i++) if (candidate[i] !== best[i]) return candidate[i] < best[i];
  return false;
};

/**
 * Move the set's exit and raccoon to the pair that walks the player least.
 *
 * Returns the set re-measured, or null if it could not be read where it stands — a set whose
 * rooms disagree about where the raccoon starts is not one this can speak for.
 */
export function resiteSet(set, floor = FLOOR) {
  const carts = set.rooms.map(r => r.cart ?? null);
  const grids = set.rooms.map(r => r.grid);
  const exit = find(grids[0], 'E'), rac = find(grids[0], '@');
  if (!same(grids.map(g => find(g, 'E'))) || !same(grids.map(g => find(g, '@')))) return null;

  // Every cell the pair could stand on: bare floor in all three rooms, plus the two cells the
  // pair is vacating. A cart cell is not floor, and neither is the cargo standing in one.
  const spots = [];
  for (let y = 0; y < grids[0].length; y++) for (let x = 0; x < grids[0][y].length; x++) {
    const here = (x === exit[0] && y === exit[1]) || (x === rac[0] && y === rac[1]);
    if (!here && grids.some(g => g[y][x] !== '-')) continue;
    if (carts.some(c => c && c[y]?.[x] !== '-')) continue;
    spots.push([x, y]);
  }

  const at = (ex, rc) => grids.map(g =>
    put(put(put(put(g, exit, '-'), rac, '-'), ex, 'E'), rc, '@'));
  // Stops at the first room that will not hold: `cost` sinks the whole set on one null, and the
  // rooms after it are a full enumeration each for an answer already decided.
  const readsAt = (ex, rc, caches = null) => {
    const out = [];
    for (const [i, g] of at(ex, rc).entries()) {
      const r = read(g, carts[i], floor, caches?.[i]);
      if (!r) return null;
      out.push(r);
    }
    return out;
  };
  const costAt = (ex, rc, caches) =>
    (ex[0] === rc[0] && ex[1] === rc[1]) ? null : cost(readsAt(ex, rc, caches));

  const base = readsAt(exit, rac);
  let best = cost(base);
  if (best === null) return null;
  let bestExit = exit, bestRac = rac;

  // A sweep is a function of the cell it pivots on, so re-running one whose pivot has not moved
  // since re-asks every candidate the question it already answered. This is what makes the
  // second round nearly free on a set that settled in the first.
  let sweptExitAt = null, sweptRacAt = null;

  for (let round = 0; round < ROUNDS; round++) {
    // Moving the EXIT rebuilds the room: the exit refuses what may be shoved onto it, and it
    // decides which boards are won. Every candidate is a different graph and has to be built.
    if (!same([sweptExitAt, bestRac])) {
      sweptExitAt = bestRac;
      for (const s of spots) {
        const c = costAt(s, bestRac, null);
        if (beats(c, best)) { best = c; bestExit = s; }
      }
    }
    // Moving the RACCOON does not. One graph per room serves the whole sweep, and each
    // candidate is a walk of it rather than a rebuild of it.
    if (!same([sweptRacAt, bestExit])) {
      sweptRacAt = bestExit;
      const caches = grids.map(() => ({ graph: null }));
      for (const s of spots) {
        const c = costAt(bestExit, s, caches);
        if (beats(c, best)) { best = c; bestRac = s; }
      }
    }
  }

  const rooms = at(bestExit, bestRac).map((grid, i) => {
    const room = { grid, ...(carts[i] && { cart: carts[i] }) };
    const s = toState({ id: 'r', ...room });
    const a = analyze(s, { maxStates: MAX_STATES });
    return measure(set.rooms[i].group, room, s, a, grid[0].length, grid.length);
  });
  return {
    ...set, rooms,
    resited: !same([bestExit, exit]) || !same([bestRac, rac]),
    // How far the set walked the player before this ran. A diff against a state the file no
    // longer holds, so it is for the run's report and is stripped before writing.
    walkWas: base.reduce((a, r) => a + r.lead + r.tail, 0),
  };
}

if (!isMainThread && workerData?.tool === 'resite') servePass(resiteSet);
else if (import.meta.url === `file://${process.argv[1]}`) {
  const str = (f, d) => { const i = process.argv.indexOf(f); return i === -1 ? d : process.argv[i + 1]; };
  const num = (f, d) => { const i = process.argv.indexOf(f); return i === -1 ? d : Number(process.argv[i + 1]); };
  const inPath = str('--in', 'levels/sets.jsonl');
  const outPath = str('--out', 'levels/sets.jsonl');
  const workers = num('--workers', defaultWorkers());

  const sets = readFileSync(inPath, 'utf8').trim().split('\n').map(JSON.parse);
  console.log(`${sets.length} sets, ${sets.length * 3} rooms, ${workers} workers\n`);

  const out = await run({ self: fileURLToPath(import.meta.url), tool: 'resite', items: sets, workers });

  const wasWalk = out.reduce((a, s) => a + (s.walkWas ?? 0), 0);
  const nowWalk = out.reduce((a, s) =>
    a + s.rooms.reduce((b, r) => b + (r.lead ?? 0) + (r.tail ?? 0), 0), 0);
  const worst = k => Math.max(...out.flatMap(s => s.rooms.map(r => r[k] ?? 0)));
  writeFileSync(outPath, out.map(({ walkWas, ...s }) => JSON.stringify(s)).join('\n') + '\n');
  console.log(`\ndead travel ${wasWalk} -> ${nowWalk} moves`
    + (wasWalk ? ` (${(100 * nowWalk / wasWalk).toFixed(0)}% of what it was)` : ''));
  console.log(`  worst room now: lead ${worst('lead')}, tail ${worst('tail')}`);
  console.log(`  ${out.filter(s => s.resited).length} sets moved,`
    + ` ${out.filter(s => !s.resited).length} were already best placed`);
  console.log(`  -> ${outPath}`);
}
