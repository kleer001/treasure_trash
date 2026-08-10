#!/usr/bin/env node
// Treasure Trash — deep harvest. Sample rooms from the groups the fertility map calls fertile,
// and keep every metric each one scores, so ranking is a query over stored data rather than a
// fresh multi-hour run every time the weights change.
//
//   node tools/harvest.mjs [--samples N] [--workers N] [--groups N] [--in F] [--out F]
//
// Two things separate this from `survey.mjs`, and both come from Taylor & Parberry
// (GAMEON-NA 2011): rooms are built with an OUTLINE rather than as open rectangles, and each
// keeper is measured on box lines and box changes rather than on move count.
//
// The outline is the load-bearing change. An open rectangle has "very bushy, but not very
// deep state spaces" — expensive to enumerate, and not much harder to play. In the survey,
// which sampled open 8x4s, one placement in five blew past the state cap and returned
// nothing at all for the cost.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isMainThread, workerData } from 'node:worker_threads';
import { defaultWorkers, run, serve } from './pool.mjs';
import { engineFor, connect, measureMany, measureHere, TOO_BIG } from './engine.mjs';
import { toState, WET } from '../src/format.js';
import { analyze, TooManyStates } from '../src/solver.js';
import { bagsLeft } from '../src/rules.js';
import { mulberry32 } from '../src/rng.js';
import { staticallyDead } from './survey.mjs';
import {
  solveShape, largestOpenBlock, floorIsConnected, hasNiche, pathBite, deadTravel, inertPieces,
  shortestDag,
} from './metrics.mjs';
import { parseLurd } from '../src/format.js';

const DOMINOES = new Set(['F', 'P']);
const POOLS = { F: [...'FGHKMN'], P: [...'PQR'] };

// Shapes to draw outlines on. Walls make a bigger board affordable, so the harvest is not
// stuck at the survey's 8x4.
const SHAPES = [[8, 4], [8, 5], [7, 5], [9, 5], [7, 4]];
const MAX_STATES = 50_000;

// The open-floor reject. A clear rectangle this size or larger is what makes a state space
// bushy and shallow, so an outline that still contains one is redrawn rather than used.
const OPEN_BLOCK_MIN_SIDE = 3;
const OPEN_BLOCK_MIN_AREA = 12;

/** A random outline that passes every structural check, or null if this draw failed. */
export function outline(w, h, rnd, tries = 60) {
  const pick = n => Math.floor(rnd() * n);
  for (let t = 0; t < tries; t++) {
    const wall = Array.from({ length: h }, () => Array.from({ length: w }, () => false));
    const isFloor = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !wall[y][x];
    // Add walls until no oversized clear rectangle survives. Walling the middle of the
    // offending block breaks it in both directions at once.
    for (let guard = 0; guard < w * h; guard++) {
      const b = largestOpenBlock(isFloor, w, h);
      if (!(Math.min(b.w, b.h) >= OPEN_BLOCK_MIN_SIDE && b.area >= OPEN_BLOCK_MIN_AREA)) break;
      const spots = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isFloor(x, y)) spots.push([x, y]);
      if (!spots.length) break;
      const [wx, wy] = spots[pick(spots.length)];
      wall[wy][wx] = true;
    }
    const floor = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isFloor(x, y)) floor.push([x, y]);
    if (floor.length < 14) continue;
    const b = largestOpenBlock(isFloor, w, h);
    if (Math.min(b.w, b.h) >= OPEN_BLOCK_MIN_SIDE && b.area >= OPEN_BLOCK_MIN_AREA) continue;
    if (!floorIsConnected(isFloor, w, h)) continue;
    if (hasNiche(isFloor, w, h)) continue;
    return { wall, floor };
  }
  return null;
}

/** Drop a group's pieces, a raccoon and an exit onto an outline. Null if the draw failed. */
export function placeOn(group, plan, w, h, rnd) {
  const pick = n => Math.floor(rnd() * n);
  const grid = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => (plan.wall[y][x] ? '#' : '-')));
  const cart = Array.from({ length: h }, () => Array.from({ length: w }, () => '-'));
  const taken = new Set();
  const key = ([x, y]) => `${x},${y}`;
  const open = () => plan.floor.filter(c => !taken.has(key(c)));

  const takeOne = () => {
    const o = open();
    if (!o.length) return null;
    const c = o[pick(o.length)];
    taken.add(key(c));
    return c;
  };
  const takePair = () => {
    const o = open(), set = new Set(o.map(key)), pairs = [];
    for (const [x, y] of o) {
      if (set.has(key([x + 1, y]))) pairs.push([[x, y], [x + 1, y]]);
      if (set.has(key([x, y + 1]))) pairs.push([[x, y], [x, y + 1]]);
    }
    if (!pairs.length) return null;
    const p = pairs[pick(pairs.length)];
    p.forEach(c => taken.add(key(c)));
    return p;
  };

  const ex = takeOne(), rac = takeOne();
  if (!ex || !rac) return null;
  grid[ex[1]][ex[0]] = 'E';
  grid[rac[1]][rac[0]] = '@';

  const next = { F: [...POOLS.F], P: [...POOLS.P] };
  for (const g of group) {
    if (DOMINOES.has(g)) {
      const pair = takePair();
      if (!pair) return null;
      const letter = next[g].shift();
      if (!letter) return null;
      for (const [x, y] of pair) { if (g === 'P') cart[y][x] = letter; else grid[y][x] = letter; }
    } else {
      const c = takeOne();
      if (!c) return null;
      grid[c[1]][c[0]] = g;
    }
  }
  const room = { id: 'harvest', grid: grid.map(r => r.join('')) };
  if (group.includes('P')) room.cart = cart.map(r => r.join(''));
  // A watered plan narrows `plan.floor` to the dry cells, so every draw above already avoided
  // the canal; this only writes down where it was.
  if (plan.water) room.water = plan.water.map(r => r.map(c => (c ? WET : '-')).join(''));
  return room;
}

/** Everything a scorer could want about one keeper, so weights can change without a re-run. */
export function measure(group, room, s, a, w, h) {
  const acts = parseLurd(a.shortestLurd);
  // Three of the measures below read the shortest-solve DAG. It is the same DAG.
  const onDag = shortestDag(a);
  const shape = solveShape(s, acts);
  const trapDepths = a.traps.map(t => parseLurd(t.lurd).length - 1);
  // How far you can keep playing after the room is already lost. A trap noticed at once
  // connects to its cause; one noticed twenty moves later reads as bad luck.
  const entries = new Set();
  for (const [k, node] of a.states) {
    if (a.dead.has(k)) continue;
    for (const e of node.edges) if (a.dead.has(e.to)) entries.add(e.to);
  }
  let blind = 0;
  for (const st of entries) {
    const seen = new Set([st]);
    let frontier = [st], depth = 0;
    while (frontier.length) {
      const nx = [];
      for (const k of frontier) for (const e of a.states.get(k).edges)
        if (a.dead.has(e.to) && !seen.has(e.to)) { seen.add(e.to); nx.push(e.to); }
      if (nx.length) depth++;
      frontier = nx;
    }
    blind = Math.max(blind, depth);
  }
  return {
    group, w, h,
    par: a.minMoves, solves: a.shortestCount, states: a.reachable,
    traps: a.traps.length,
    firstTrap: trapDepths.length ? Math.min(...trapDepths) : null,
    lastTrap: trapDepths.length ? Math.max(...trapDepths) : null,
    // How much of the solution has a way to lose hanging off it.
    biteSteps: new Set(trapDepths).size,
    // Where the ways to lose sit relative to optimal play. Nearly free here — the graph is
    // already built — and it is the number a raw trap count cannot stand in for.
    ...(({ onPath, bitten, firstOnPath }) => ({ onPath: +onPath.toFixed(3), bitten, firstOnPath }))(pathBite(a, onDag)),
    // The walk in and the walk out. Placement hands the exit a random cell, so a room can be
    // sound on every other number and still march the player across it after the last decision.
    ...deadTravel(a, onDag),
    // Placement drops the other pieces just as blindly, and a piece that lands where it hinders
    // nothing is decoration. Stored per room because re-siting and walling both change it.
    inert: inertPieces(room, a, { onDag }).length,
    blind,
    lines: shape.lines, changes: shape.changes, pushes: shape.pushes, pieces: shape.pieces,
    walks: acts.length - shape.pushes,
    bags: bagsLeft(s), exitRefusals: a.exitRefusals,
    floor: s.cells.flat().filter(c => !c.wall).length,
    solve: a.shortestLurd,
    grid: room.grid, ...(room.cart && { cart: room.cart }),
  };
}

/**
 * The engine SCREENS, it does not measure.
 *
 * A full row wants the solve string, the trap depths, the box-line shape and the inert test —
 * the graph itself, none of which is on the wire. But nine placements in ten never get that far:
 * they are too big, unsolvable, or fail one of the two design rules, and deciding that needs
 * only the numbers the protocol already carries. So the engine answers every draw, and the JS
 * enumeration is paid a second time only for the few that survive.
 */
async function harvestGroup(group, samples, seed, engine = null) {
  const rnd = mulberry32(seed);
  const keep = [];
  const stat = { group, samples: 0, noOutline: 0, undrawable: 0, prefiltered: 0, tooBig: 0, inert: 0, solvable: 0 };
  const t0 = Date.now();

  // Drawn first, screened after — the draws come off the seeded stream and none of them depends
  // on how the last one scored, so the batch can go to the engine in one breath.
  const drawn = [];
  for (let i = 0; i < samples; i++) {
    stat.samples++;
    const [w, h] = SHAPES[Math.floor(rnd() * SHAPES.length)];
    const plan = outline(w, h, rnd);
    if (!plan) { stat.noOutline++; continue; }
    const room = placeOn(group, plan, w, h, rnd);
    if (!room) { stat.undrawable++; continue; }
    let s;
    try { s = toState(room); } catch { stat.undrawable++; continue; }
    if (staticallyDead(s)) { stat.prefiltered++; continue; }
    drawn.push({ room, s, w, h });
  }

  const screens = engine ? await measureMany(engine, drawn.map(d => d.s), MAX_STATES)
                         : drawn.map(d => measureHere(d.s, MAX_STATES));
  for (const [i, r] of screens.entries()) {
    if (r === TOO_BIG) { stat.tooBig++; continue; }
    if (r.par === null) continue;
    const { room, s, w, h } = drawn[i];
    if (bagsLeft(s) > 0 && r.exitRefusals === 0) continue;
    if (r.silentTraps) continue;
    const row = measure(group, room, s, analyze(s, { maxStates: MAX_STATES }), w, h);
    // A sampled placement that lands a piece where it hinders nothing is a room short one
    // piece, not a room with a spare. Rejected here rather than carried and filtered later,
    // because everything downstream would score it on a roster it does not really have.
    if (row.inert) { stat.inert++; continue; }
    stat.solvable++;
    keep.push(row);
  }
  stat.ms = Date.now() - t0;
  return { stat, keep };
}

if (!isMainThread && workerData?.tool === 'harvest') {
  const { samples, seed, engineBin } = workerData;
  const engine = engineBin ? connect(engineBin) : null;
  await serve((g, i) => harvestGroup(g, samples, seed + i, engine));
  engine?.close();
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const num = (flag, d) => { const i = process.argv.indexOf(flag); return i === -1 ? d : Number(process.argv[i + 1]); };
  const str = (flag, d) => { const i = process.argv.indexOf(flag); return i === -1 ? d : process.argv[i + 1]; };
  const samples = num('--samples', 400);
  const workers = num('--workers', defaultWorkers());
  const minInteresting = num('--min', 6);
  const inPath = str('--in', 'levels/fertility.jsonl');
  const outPath = str('--out', 'levels/harvest.jsonl');

  const engineBin = engineFor(process.argv);
  const map = readFileSync(inPath, 'utf8').trim().split('\n').map(JSON.parse);
  const list = map.filter(r => r.interesting >= minInteresting).map(r => r.group);
  console.log(`${list.length} groups from ${inPath} with >= ${minInteresting} interesting per 200`);
  console.log(`${samples} outlined placements each, ${workers} workers\n`);

  const t0 = Date.now();
  const got = await run({
    self: fileURLToPath(import.meta.url), tool: 'harvest', items: list, workers,
    extra: w => ({ samples, seed: 7 + w * 10007, engineBin }),
    onItem: ({ got: { stat }, done, total, ms }) => {
      const el = ms / 1000;
      console.log(`  ${String(done).padStart(3)}/${total}  ${stat.group.padEnd(5)}`
        + ` kept ${String(stat.solvable).padStart(4)}/${stat.samples}`
        + `  tooBig ${String(stat.tooBig).padStart(3)}  noOutline ${String(stat.noOutline).padStart(3)}`
        + `  ${(stat.ms / 1000).toFixed(0)}s   [${el.toFixed(0)}s, ~${((el / done) * (total - done) / 60).toFixed(0)}m left]`);
    },
  });
  const rooms = got.flatMap(m => m.keep), stats = got.map(m => m.stat);

  writeFileSync(outPath, rooms.map(r => JSON.stringify(r)).join('\n') + '\n');
  const S = k => stats.reduce((a, r) => a + r[k], 0);
  console.log(`\n${rooms.length} rooms kept from ${S('samples')} placements in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`  no outline ${S('noOutline')}  pre-filtered ${S('prefiltered')}  too big ${S('tooBig')}`
    + `  inert piece ${S('inert')}`);
  console.log(`  -> ${outPath}`);
}
