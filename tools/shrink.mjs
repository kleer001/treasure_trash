#!/usr/bin/env node
// Treasure Trash — shrink-wrap the candidate sets.
//
//   node tools/shrink.mjs [--in F] [--out F] [--workers N]
//
// A generated room is drawn on whatever outline it was sampled on, and the solution usually
// needs a fraction of it. What is left over is not neutral: it is floor the player walks across
// for nothing, and it is where "travel a long way to reach the end, past wide open space where
// nothing happens" comes from. Walls can never lower par — they only remove options — so the
// floor a solution never touches can go, and the room gets its own shape instead of the
// rectangle it was born in.
//
// PER SET, NOT PER ROOM. The three rooms of a set share an outline; that sharing is the set.
// A wall therefore has to be affordable to all three or to none, or the set comes out as three
// rooms that merely resemble each other.
//
// The guards are stricter than `tighten`'s default because a set is nearly finished work:
// par must not move, solutions must not multiply, and the room must not go toothless ON THE
// LINE — a wall that removes the last way for good play to go wrong has removed the room.

import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { toState } from '../src/format.js';
import { analyze, TooManyStates } from '../src/solver.js';
import { bagsLeft } from '../src/rules.js';
import { measure } from './harvest.mjs';
import { pathBite, isOneRoom, deadTravel, inertPieces } from './metrics.mjs';

const MAX_STATES = 50_000;

const wallAt = (grid, x, y) =>
  grid.map((row, j) => (j === y ? row.slice(0, x) + '#' + row.slice(x + 1) : row));

/** Everything the guards need, or null if the board will not hold at all. */
function read(grid, cart) {
  let s;
  try { s = toState({ id: 's', grid, ...(cart && { cart }) }); } catch { return null; }
  // Only bare floor is ever walled, so a piece is never walled away — it is walled AROUND.
  // Seal the last route to a cart nobody visits and the cart is still drawn, still looks like
  // part of the room, and cannot be reached from anywhere in it.
  if (!isOneRoom(s)) return null;
  let a;
  try { a = analyze(s, { maxStates: MAX_STATES }); }
  catch (e) { if (e instanceof TooManyStates) return null; throw e; }
  if (a.minMoves === null) return null;
  if (a.silentTraps.length) return null;
  if (bagsLeft(s) > 0 && a.exitRefusals === 0) return null;
  const bite = pathBite(a);
  const room = { grid, ...(cart && { cart }) };
  return { s, a, par: a.minMoves, solves: a.shortestCount, traps: a.traps.length,
           onPath: bite.onPath, ...deadTravel(a),
           inert: inertPieces(room, a, { maxStates: MAX_STATES }).length };
}

/**
 * Crop to the box that still holds something. A wall pass can retire a whole side of the
 * outline, and what is left is frame: the room is drawn from the grid, so those columns are
 * blank screen the player is asked to look at.
 *
 * One box for the set, because three rooms cropped to their own contents are three rooms of
 * different sizes, and the shared outline is the set.
 */
function crop(grids, carts) {
  const h = grids[0].length, w = grids[0][0].length;
  let top = h, left = w, bottom = -1, right = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (grids.every(g => g[y][x] === '#')) continue;
    top = Math.min(top, y); bottom = Math.max(bottom, y);
    left = Math.min(left, x); right = Math.max(right, x);
  }
  const cut = rows => rows.slice(top, bottom + 1).map(r => r.slice(left, right + 1));
  return [grids.map(cut), carts.map(c => c && cut(c))];
}

/**
 * Wall off every cell all three rooms can spare, greedily to a fixed point.
 * Returns the set re-measured, or null if it could not be read to begin with.
 */
export function shrinkSet(set) {
  const carts = set.rooms.map(r => r.cart ?? null);
  let grids = set.rooms.map(r => r.grid);
  const base = grids.map((g, i) => read(g, carts[i]));
  if (base.some(b => b === null)) return null;

  const holds = cand => cand.every((g, i) => {
    const now = read(g, carts[i]);
    if (!now) return false;
    if (now.par !== base[i].par) return false;              // the room must ask the same thing
    if (now.solves > base[i].solves) return false;          // and not get looser
    if (now.traps < 1) return false;
    // A wall keeps par and may drop optimal lines, so it can take away the line that walked
    // least and leave a longer walk at the same length. `resite` chose that pair; this may
    // not undo it.
    if (now.lead > base[i].lead || now.tail > base[i].tail) return false;
    // A piece is binding because of the lane it shuts. Wall the lane and the piece is still
    // standing there, shutting nothing — this pass is the largest single source of pieces that
    // do nothing, and it makes them out of pieces that were working a moment earlier.
    if (now.inert > base[i].inert) return false;
    // Bite on the optimal line is the thing worth protecting. Off-line traps are expendable;
    // this is not.
    return now.onPath >= base[i].onPath - 1e-9;
  });

  let moved = true;
  while (moved) {
    moved = false;
    for (let y = 0; y < grids[0].length; y++) for (let x = 0; x < grids[0][y].length; x++) {
      if (grids.some(g => g[y][x] !== '-')) continue;            // bare floor only
      if (carts.some(c => c && c[y]?.[x] !== '-')) continue;     // a cart cell is not floor
      const cand = grids.map(g => wallAt(g, x, y));
      if (!holds(cand)) continue;
      grids = cand; moved = true;
    }
  }

  const [cropped, croppedCarts] = crop(grids, carts);
  const rooms = cropped.map((grid, i) => {
    const room = { grid, ...(croppedCarts[i] && { cart: croppedCarts[i] }) };
    const s = toState({ id: 'r', ...room });
    const a = analyze(s, { maxStates: MAX_STATES });
    return measure(set.rooms[i].group, room, s, a, grid[0].length, grid.length);
  });
  return { ...set, rooms, shrunk: true };
}

const floorOf = g => g.join('').split('-').length - 1;

if (!isMainThread && workerData?.tool === 'shrink') {
  // Each result carries the index it came in on: workers finish out of order, and a file whose
  // order depends on which core was quickest is a file that reorders itself every run.
  parentPort.postMessage(workerData.chunk.map(({ at, set }) => {
    try { return { at, set: shrinkSet(set) ?? set }; } catch { return { at, set }; }
  }));
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const str = (f, d) => { const i = process.argv.indexOf(f); return i === -1 ? d : process.argv[i + 1]; };
  const num = (f, d) => { const i = process.argv.indexOf(f); return i === -1 ? d : Number(process.argv[i + 1]); };
  const inPath = str('--in', 'levels/sets.jsonl');
  const outPath = str('--out', 'levels/sets.jsonl');
  const workers = num('--workers', Math.max(1, availableParallelism() - 2));

  const sets = readFileSync(inPath, 'utf8').trim().split('\n').map(JSON.parse);
  const wasFloor = sets.flatMap(s => s.rooms.map(r => floorOf(r.grid)));
  console.log(`${sets.length} sets, ${wasFloor.length} rooms, ${workers} workers\n`);

  const chunks = Array.from({ length: workers }, () => []);
  sets.forEach((set, at) => chunks[at % workers].push({ at, set }));
  const self = fileURLToPath(import.meta.url);
  const t0 = Date.now();
  const out = new Array(sets.length);
  let done = 0;
  await Promise.all(chunks.filter(c => c.length).map(chunk => new Promise((res, rej) => {
    const w = new Worker(self, { workerData: { tool: 'shrink', chunk } });
    w.on('message', got => {
      for (const { at, set } of got) out[at] = set;
      done += got.length;
      console.log(`  ${done}/${sets.length} sets  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
      res();
    });
    w.on('error', rej);
  })));

  const nowFloor = out.flatMap(s => s.rooms.map(r => floorOf(r.grid)));
  const sum = a => a.reduce((x, y) => x + y, 0);
  writeFileSync(outPath, out.map(s => JSON.stringify(s)).join('\n') + '\n');
  console.log(`\nfloor ${sum(wasFloor)} -> ${sum(nowFloor)}`
    + ` (${(100 * sum(nowFloor) / sum(wasFloor)).toFixed(0)}% of what it was)`);
  console.log(`  ${out.filter(s => s.shrunk).length} sets shrank, ${out.filter(s => !s.shrunk).length} refused`);
  console.log(`  -> ${outPath}`);
}
