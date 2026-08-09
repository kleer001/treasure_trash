#!/usr/bin/env node
// Treasure Trash — build SETS of three rooms that share an outline.
//
//   node tools/sets.mjs [--tries N] [--workers N] [--in F] [--out F]
//
// A set is three rooms on one outline that get harder in a stated way. Three ways are built
// here, because an act that runs one device ten times is one idea told ten times:
//
//   UPGRADE   same outline AND the same piece positions; each rung swaps an empty container
//             for a full one. `BAGS_IN` counts an empty can, wheelie or bin as nothing and a
//             full one as a bag, so a rung adds work without adding a body. The room looks
//             almost unchanged and is quietly heavier. Aymeric du Peloux's Minicosmos pairs a
//             layout with itself plus a stone "as a nice way of providing hints"; this is that
//             device in a game whose mess is permanent, where an extra body would choke the
//             board instead of deepening it.
//   ADDITION  same outline, three then four then five pieces, earlier pieces left where they
//             stand. Measured cost: yield falls from 18.5% to 6.8% at five pieces and the par
//             ceiling drops, so this one is used sparingly.
//   PAR       same outline, three independent rooms at ascending par. Loosest and easiest to
//             find; weakest as a set, which is what makes it right for the opening.
//
// Every room is measured with the same `measure` the harvest uses, so a set can be ranked
// against a harvested room without translating anything.

import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { toState } from '../src/format.js';
import { analyze, TooManyStates } from '../src/solver.js';
import { bagsLeft } from '../src/rules.js';
import { mulberry32 } from '../src/rng.js';
import { staticallyDead } from './survey.mjs';
import { placeOn, measure } from './harvest.mjs';
import { hFamily } from './shapes.mjs';

const MAX_STATES = 50_000;

// The three containers that carry a bag when full and nothing when empty. Upgrading one is the
// only way to add work to a board without adding a body to it.
export const UPGRADE = { c: 'C', w: 'W', b: 'B' };
export const DOWNGRADE = { C: 'c', W: 'w', B: 'b' };

// Two different floors, because they answer different questions. A ROOM must not be trivial:
// something to clear, an exit that refuses, a way to lose, and long enough to be a room. A SET
// must reach Act 2 — its top rung is where the set actually lands, and a set opening easy is
// the point of a ramp rather than a fault in it.
export const PAR_MIN = 8;
export const PAR_MAX = 40;
export const SET_TOP_MIN = 18;

/** A room is worth keeping if it is winnable, has something to clear, teeth, and a real exit. */
function keep(s, a, parMin) {
  if (a.minMoves === null) return false;
  if (a.minMoves < parMin || a.minMoves > PAR_MAX) return false;
  if (bagsLeft(s) < 1) return false;             // nothing to clear is not a puzzle
  if (a.silentTraps.length) return false;
  if (a.exitRefusals === 0) return false;        // an exit that refuses nothing is a destination
  return a.traps.length >= 1;
}

function look(room, group, w, h, parMin = PAR_MIN) {
  let s;
  try { s = toState({ id: 'set', ...room }); } catch { return null; }
  if (staticallyDead(s)) return null;
  let a;
  try { a = analyze(s, { maxStates: MAX_STATES }); }
  catch (e) { if (e instanceof TooManyStates) return null; throw e; }
  if (!keep(s, a, parMin)) return null;
  const row = measure(group, room, s, a, w, h);
  // A rung is the group it draws, and a piece that hinders nothing is not in the room in any
  // sense the player can act on. Rejecting the rung rejects the set: three rooms cannot share
  // a cast when one of them is short a member.
  if (row.inert) return null;
  return row;
}

/** Pars ascend, and the set finishes somewhere an Act 2 room belongs. */
const ladderOk = rungs =>
  rungs[0].par < rungs[1].par && rungs[1].par < rungs[2].par
  && rungs[2].par >= SET_TOP_MIN;

const swapAt = (grid, [x, y], ch) =>
  grid.map((row, j) => (j === y ? row.slice(0, x) + ch + row.slice(x + 1) : row));

const cellsOf = (grid, pred) => {
  const out = [];
  grid.forEach((row, y) => [...row].forEach((ch, x) => { if (pred(ch)) out.push([x, y]); }));
  return out;
};

/**
 * Three rooms, one board, one piece added to the bag count per rung — by filling a container
 * that was already standing there rather than by putting anything new down.
 *
 * The joint constraint is what makes this the hardest ramp to find: ONE placement has to hold
 * up at all three weights.
 */
export function upgradeSet(plan, group, rnd) {
  const room = placeOn(group, plan, plan.w, plan.h, rnd);
  if (!room) return null;
  const empties = cellsOf(room.grid, ch => UPGRADE[ch] !== undefined);
  if (empties.length < 2) return null;
  // Two of them, in a fixed order, give the three rungs.
  const pick = [...empties].sort(() => (rnd() < 0.5 ? -1 : 1)).slice(0, 2);

  const rungs = [];
  let grid = room.grid;
  for (let i = 0; i <= 2; i++) {
    if (i > 0) {
      const [x, y] = pick[i - 1];
      grid = swapAt(grid, [x, y], UPGRADE[grid[y][x]]);
    }
    const g = [...group].map(c => c).join('');   // the group label stays the base mixture
    const m = look({ grid, ...(room.cart && { cart: room.cart }) }, g, plan.w, plan.h);
    if (!m) return null;
    rungs.push(m);
  }
  if (!ladderOk(rungs)) return null;
  if (!(rungs[0].bags < rungs[1].bags && rungs[1].bags < rungs[2].bags)) return null;
  return { ramp: 'upgrade', shape: plan.label, group, rooms: rungs };
}

/** Three rooms, one board, a piece added each rung and the earlier ones left where they are. */
export function additionSet(plan, group, extras, rnd) {
  const room = placeOn(group, plan, plan.w, plan.h, rnd);
  if (!room) return null;
  const rungs = [];
  let grid = room.grid;
  const taken = new Set(cellsOf(grid, ch => ch !== '-').map(([x, y]) => `${x},${y}`));
  if (room.cart) cellsOf(room.cart, ch => ch !== '-').forEach(([x, y]) => taken.add(`${x},${y}`));

  for (let i = 0; i <= 2; i++) {
    if (i > 0) {
      const free = plan.floor.filter(([x, y]) => !taken.has(`${x},${y}`));
      if (!free.length) return null;
      const [x, y] = free[Math.floor(rnd() * free.length)];
      taken.add(`${x},${y}`);
      grid = swapAt(grid, [x, y], extras[i - 1]);
    }
    const m = look({ grid, ...(room.cart && { cart: room.cart }) },
      group + extras.slice(0, i).join(''), plan.w, plan.h);
    if (!m) return null;
    rungs.push(m);
  }
  if (!ladderOk(rungs)) return null;
  return { ramp: 'addition', shape: plan.label, group, rooms: rungs };
}

/**
 * Three independent rooms on one outline at ascending par, all drawing the SAME piece mixture.
 * Fixing the mixture is what makes this a set rather than three rooms that happen to share a
 * silhouette: the player meets the same cast three times, arranged three ways.
 */
export function parSet(plan, groups, rnd, tries = 40, gap = 3) {
  const g = groups[Math.floor(rnd() * groups.length)];
  const found = [];
  for (let i = 0; i < tries && found.length < 24; i++) {
    const room = placeOn(g, plan, plan.w, plan.h, rnd);
    if (!room) continue;
    const m = look(room, g, plan.w, plan.h);
    if (m) found.push(m);
  }
  found.sort((a, b) => a.par - b.par);
  // Spread rather than adjacent: three rooms one move apart is not a ramp.
  for (let i = 0; i < found.length; i++)
    for (let j = i + 1; j < found.length; j++) {
      if (found[j].par - found[i].par < gap) continue;
      for (let k = j + 1; k < found.length; k++) {
        if (found[k].par - found[j].par < gap) continue;
        const rungs = [found[i], found[j], found[k]];
        if (!ladderOk(rungs)) continue;
        return { ramp: 'par', shape: plan.label, group: g, rooms: rungs };
      }
    }
  return null;
}

// ---------------------------------------------------------------- groups
/**
 * What each ramp draws from, derived from the fertility map rather than surveyed again.
 *
 * An UPGRADE base is a fertile group with its full containers emptied: the top rung is then a
 * mixture already known to make rooms, and the rungs below it are the same board carrying less.
 * An ADDITION base is a fertile group with a piece removed, and the pieces added back are the
 * ones that were in it. Both are better aimed than a fresh survey and cost nothing.
 */
export function rampGroups(fertile) {
  const upgrade = [], addition = [];
  for (const g of fertile) {
    const fulls = [...g].map((c, i) => (DOWNGRADE[c] ? i : -1)).filter(i => i >= 0);
    if (fulls.length >= 2) {
      const base = [...g];
      for (const i of fulls.slice(0, 2)) base[i] = DOWNGRADE[base[i]];
      upgrade.push(base.join(''));
    }
    for (let i = 0; i < g.length; i++) {
      const cut = [...g]; const gone = cut.splice(i, 1)[0];
      // First put back what was taken out, so rung 2 is the fertile mixture again. The last
      // rung then adds a CARRIER: a piece that brings a bag with it, so the step is more work
      // and not just more furniture.
      const carrier = [...g].find(c => '$CWB'.includes(c)) ?? '$';
      addition.push({ base: cut.join(''), extras: [gone, carrier] });
    }
  }
  return { upgrade: [...new Set(upgrade)], addition, par: fertile };
}

// ---------------------------------------------------------------- search
function search(plans, groups, tries, seed) {
  const rnd = mulberry32(seed);
  const out = [];
  for (const plan of plans) {
    for (let t = 0; t < tries; t++) {
      const g = groups.upgrade[Math.floor(rnd() * groups.upgrade.length)];
      const s = upgradeSet(plan, g, rnd);
      if (s) { out.push(s); break; }
    }
    for (let t = 0; t < tries; t++) {
      const a = groups.addition[Math.floor(rnd() * groups.addition.length)];
      const s = additionSet(plan, a.base, a.extras, rnd);
      if (s) { out.push(s); break; }
    }
    const p = parSet(plan, groups.par, rnd);
    if (p) out.push(p);
  }
  return out;
}

if (!isMainThread && workerData?.tool === 'sets') {
  const { plans, groups, tries, seed } = workerData;
  parentPort.postMessage(search(plans, groups, tries, seed));
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const str = (f, d) => { const i = process.argv.indexOf(f); return i === -1 ? d : process.argv[i + 1]; };
  const num = (f, d) => { const i = process.argv.indexOf(f); return i === -1 ? d : Number(process.argv[i + 1]); };
  const tries = num('--tries', 120);
  const workers = num('--workers', Math.max(1, availableParallelism() - 2));
  const minInteresting = num('--min', 6);
  const inPath = str('--in', 'levels/fertility.jsonl');
  const outPath = str('--out', 'levels/sets.jsonl');

  // `--without` drops mixtures containing a piece. The map is honest that the recycle bin is
  // the most fertile piece in the roster, which means an unfiltered pool puts it in almost
  // every set — good rooms, one-note act. Excluding it deliberately is how the rest get found.
  const without = str('--without', '');
  const fertile = readFileSync(inPath, 'utf8').trim().split('\n').map(JSON.parse)
    .filter(r => r.interesting >= minInteresting).map(r => r.group)
    .filter(g => ![...without].some(p => g.includes(p)));
  const groups = rampGroups(fertile);
  const plans = hFamily();
  console.log(`${plans.length} H variants, ${fertile.length} fertile groups`
    + (without ? ` (excluding ${[...without].join(', ')})` : ''));
  console.log(`  upgrade bases ${groups.upgrade.length}, addition bases ${groups.addition.length}`);
  console.log(`${tries} tries per ramp per shape on ${workers} workers\n`);

  const chunks = Array.from({ length: workers }, () => []);
  plans.forEach((p, i) => chunks[i % workers].push(p));
  const live = chunks.filter(c => c.length);
  const self = fileURLToPath(import.meta.url);
  const t0 = Date.now();
  // Not `pool.mjs`: this is the one pass whose worker is not one function per item. `search`
  // draws every plan in its chunk from ONE seeded stream, so splitting the chunk up would move
  // the draws and find different sets — a different file, not a differently ordered one. What
  // it takes from the pool is the point of it: results land at the index they were dealt.
  const byWorker = new Array(live.length);
  let done = 0, found = 0;
  await Promise.all(live.map((chunk, w) => new Promise((ok, no) => {
    const worker = new Worker(self, { workerData: { tool: 'sets', plans: chunk, groups, tries, seed: 11 + w * 7919 } });
    worker.on('message', got => {
      byWorker[w] = got; done++; found += got.length;
      console.log(`  worker ${done}/${live.length} — ${found} sets so far`
        + ` (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
      ok();
    });
    worker.on('error', no);
  })));
  const sets = byWorker.flat();

  writeFileSync(outPath, sets.map(s => JSON.stringify(s)).join('\n') + '\n');
  const byRamp = {};
  for (const s of sets) byRamp[s.ramp] = (byRamp[s.ramp] ?? 0) + 1;
  console.log(`\n${sets.length} sets in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`  by ramp: ${Object.entries(byRamp).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`  shapes covered: ${new Set(sets.map(s => s.shape)).size} of ${plans.length}`);
  console.log(`  -> ${outPath}`);
}
