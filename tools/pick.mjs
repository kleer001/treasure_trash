#!/usr/bin/env node
// Treasure Trash — choose an act from the harvest and write it out.
//
//   node tools/pick.mjs [--in F] [--want N] [--par LO-HI] [--shortlist N] [--workers N]
//                       [--first ID] [--pack NAME] [--out DIR]
//
// Three jobs the ranking alone cannot do.
//
// TIGHTEN FIRST. `tighten` walls off the floor a room's solution never needed, and it is not
// cosmetic: it routinely cuts the state graph by an order of magnitude and drops alternate
// solutions with it. Since it moves `traps`, `solves` and the graph — all scored terms — a
// score taken before it is a score of a different room. So the shortlist is tightened and
// then measured again, with the same `measure` the harvest used.
//
// PICK FOR AN ACT, NOT A TOP-N. Ranking alone hands back whatever the metric loves most: the
// bin, the wheelie and the cart generate the most work per room, so they crowd out everything
// else and the plain bag — the game's first verb — nearly vanishes. Selection is therefore
// constrained: par bands to fill, a ceiling on how much of the act any one piece may appear
// in, and one room per piece group.
//
// EMIT ALL THREE FILES. A room lands in `.tt`, `.sol` and the `levels.md` table, and a room
// present in two of the three is a broken pack.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { toState, toGrid, toCart } from '../src/format.js';
import { analyze } from '../src/solver.js';
import { tighten, ttBlock } from './draft-room.mjs';
import { measure } from './harvest.mjs';
import { score, dedupe, REQUIRE, WEIGHTS } from './score.mjs';

// The indicator now tells the player the room is lost, so a long dead tail costs far less
// than it did when the loss was silent. It is still a cost — a room that ends promptly ties
// the mistake to its cause — but it no longer outweighs a room that can be lost at all.
export const ACT_WEIGHTS = { ...WEIGHTS, blindness: -0.3 };

/** Tighten one harvested room and measure the room that comes out. Null if it will not hold. */
export function refit(row) {
  const room = { id: 'pick', grid: row.grid, ...(row.cart && { cart: row.cart }) };
  const t = tighten(room);
  if (!t) return null;
  const s = toState({ id: 'pick', ...t.room });
  const a = analyze(s);
  if (a.minMoves === null) return null;
  const w = t.room.grid[0].length, h = t.room.grid.length;
  return { ...measure(row.group, t.room, s, a, w, h), wasStates: row.states };
}

/**
 * Fill the act under constraints, best-first.
 *
 * `bands` splits the par range so the result is a curve rather than a heap at whatever par
 * the metric happens to favour. `maxPieceShare` caps how many rooms any single piece may
 * appear in — without it one piece takes the whole act on merit and the act teaches one idea.
 */
export function choose(scored, { want, lo, hi, bands = 5, maxPieceShare = 0.5, perGroup = 1 }) {
  const edges = Array.from({ length: bands + 1 }, (_, i) => lo + Math.round((hi - lo) * i / bands));
  const quota = Array.from({ length: bands }, () => Math.floor(want / bands));
  for (let i = 0; i < want - quota.reduce((a, b) => a + b, 0); i++) quota[i]++;
  const bandOf = par => {
    for (let i = bands - 1; i >= 0; i--) if (par >= edges[i]) return i;
    return 0;
  };
  const cap = Math.max(1, Math.floor(want * maxPieceShare));
  const taken = [], byBand = new Array(bands).fill(0), byGroup = {}, byPiece = {};

  const fits = r => {
    const b = bandOf(r.par);
    if (byBand[b] >= quota[b]) return false;
    if ((byGroup[r.group] ?? 0) >= perGroup) return false;
    for (const p of new Set(r.group)) if ((byPiece[p] ?? 0) >= cap) return false;
    return true;
  };
  const accept = r => {
    taken.push(r);
    byBand[bandOf(r.par)]++;
    byGroup[r.group] = (byGroup[r.group] ?? 0) + 1;
    for (const p of new Set(r.group)) byPiece[p] = (byPiece[p] ?? 0) + 1;
  };

  for (const r of scored) { if (taken.length >= want) break; if (fits(r)) accept(r); }

  // Every constraint here is HARD, and a short act is the honest outcome of failing one.
  // Topping up by dropping the piece cap would hand back exactly the act the cap exists to
  // prevent — one piece, twenty rooms — and it would do it silently, at the moment the
  // candidates were thinnest. Widen the harvest, or raise the cap on purpose.
  const short = byBand
    .map((n, i) => (n < quota[i] ? { band: [edges[i], edges[i + 1]], got: n, want: quota[i] } : null))
    .filter(Boolean);
  return { picked: taken.sort((a, b) => a.par - b.par), short, byPiece, byBand, edges };
}

/**
 * Choose an act made of SETS rather than of loose rooms. A set is three rooms sharing one
 * outline and one way of getting harder; `tools/sets.mjs` builds them.
 *
 * Ordered by `onPath` — how much of the solve optimal play can still lose from — with par as
 * the tie-break. Trap COUNT is deliberately not the axis: L29 shipped seventeen ways to lose
 * and every one of them hung off a branch a solver would never walk.
 *
 * One outline per set, so ten sets are ten different H variants rather than one drawn ten
 * times, and the ramps are spread so the act does not run a single device end to end.
 */
export function chooseSets(sets, { want = 10, maxPieceShare = 0.5, maxPerRamp = 5 } = {}) {
  const rank = s => {
    const on = s.rooms.reduce((a, r) => a + (r.onPath ?? 0), 0) / s.rooms.length;
    return { on, par: s.rooms[s.rooms.length - 1].par };
  };
  // The shape label is the last tie-break so the act does not depend on the order the
  // candidate file happened to be written in — a parallel search finishes out of order.
  const ordered = [...sets].sort((a, b) => {
    const A = rank(a), B = rank(b);
    return B.on - A.on || B.par - A.par || a.shape.localeCompare(b.shape);
  });

  const cap = Math.max(1, Math.floor(want * 3 * maxPieceShare));
  const taken = [], byShape = new Set(), byRamp = {}, byPiece = {};
  const piecesOf = s => new Set(s.rooms.flatMap(r => [...r.group]));

  for (const s of ordered) {
    if (taken.length >= want) break;
    if (byShape.has(s.shape)) continue;
    if ((byRamp[s.ramp] ?? 0) >= maxPerRamp) continue;
    let over = false;
    for (const p of piecesOf(s)) if ((byPiece[p] ?? 0) + s.rooms.length > cap) over = true;
    if (over) continue;
    taken.push(s);
    byShape.add(s.shape);
    byRamp[s.ramp] = (byRamp[s.ramp] ?? 0) + 1;
    for (const p of piecesOf(s)) byPiece[p] = (byPiece[p] ?? 0) + s.rooms.length;
  }
  // Easiest first: the act climbs in the axis it was ranked on.
  taken.reverse();
  return { sets: taken, byRamp, byPiece, short: Math.max(0, want - taken.length) };
}

/** The three files a room has to appear in, so it cannot land in two of them. */
export function emit(picked, { first = 31, pack = 'Treasure Trash — Act 2', noteFor = null }) {
  const id = i => `L${first + i}`;
  const tt = [`:pack   ${pack}`, ':format 1', ';',
    '; Names, teach lines and notes are the one part of a room that is not computed.',
    '; Every :par, :traps, :solves and :solve below is measured and will be re-proved by',
    '; tools/verify.mjs.', ';', ''];
  const sol = [`:pack   ${pack}`, ':format 1', ''];
  const md = [];
  picked.forEach((r, i) => {
    // Write the CANONICAL grid and mask, not the one the generator happened to build. The
    // pools hand out letters in placement order and the serialiser reads them back in raster
    // order, so a room with two carts can round-trip as Q-then-P and fail its own verifier.
    const s = toState({ id: id(i), grid: r.grid, ...(r.cart && { cart: r.cart }) });
    const canonCart = toCart(s);
    const room = {
      id: id(i), name: `TODO name ${id(i)}`,
      note: noteFor ? noteFor(r, i) : `TODO note — ${r.group}, ${r.lines} lines, ${r.changes} changes`,
      grid: toGrid(s), ...(canonCart && { cart: canonCart }),
    };
    tt.push(ttBlock(room, { par: r.par, traps: r.traps, solves: r.solves, solve: r.solve }), '');
    sol.push(`:solution ${id(i)}`, `:moves  ${r.solve}`, '');
    md.push(`| ${id(i)} | ${room.name} | ${r.par} | \`${r.solve}\` |`);
  });
  return { tt: tt.join('\n').replace(/\n+$/, '\n'), sol: sol.join('\n').replace(/\n+$/, '\n'), md: md.join('\n') + '\n' };
}

if (!isMainThread && workerData?.tool === 'pick') {
  parentPort.postMessage(workerData.chunk.map(r => {
    try { return refit(r); } catch { return null; }
  }));
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const str = (f, d) => { const i = process.argv.indexOf(f); return i === -1 ? d : process.argv[i + 1]; };
  const num = (f, d) => { const i = process.argv.indexOf(f); return i === -1 ? d : Number(process.argv[i + 1]); };
  const inPath = str('--in', 'levels/harvest.jsonl');
  const outDir = str('--out', 'levels');
  const want = num('--want', 20);
  const shortlist = num('--shortlist', 300);
  const workers = num('--workers', Math.max(1, availableParallelism() - 2));
  const first = num('--first', 31);
  const packName = str('--pack', 'Treasure Trash — Act 2');
  const maxPieceShare = num('--maxpiece', 0.5);
  const [lo, hi] = str('--par', '14-35').split('-').map(Number);

  const rows = readFileSync(inPath, 'utf8').trim().split('\n').map(JSON.parse);
  const eligible = rows.filter(r => REQUIRE(r) && r.par >= lo && r.par <= hi);
  const ranked = dedupe(eligible.map(r => ({ ...r, ...score(r, ACT_WEIGHTS) }))
    .sort((a, b) => b.total - a.total));
  // Shortlist PER BAND. Taken globally, the whole budget goes to whatever par the metric
  // happens to favour — longer rooms score higher on lines and changes — and the short bands
  // arrive at selection with nothing tightened to offer.
  const BANDS = 5;
  const edge = i => lo + Math.round((hi - lo) * i / BANDS);
  const rough = [];
  for (let i = 0; i < BANDS; i++) {
    const a0 = edge(i), b0 = i === BANDS - 1 ? hi : edge(i + 1) - 1;
    const inBand = ranked.filter(r => r.par >= a0 && r.par <= b0);
    rough.push(...inBand.slice(0, Math.ceil(shortlist / BANDS)));
    console.log(`  par ${a0}-${b0}: ${inBand.length} candidates, shortlisting ${Math.min(inBand.length, Math.ceil(shortlist / BANDS))}`);
  }
  console.log(`${rows.length} harvested, ${eligible.length} in par ${lo}-${hi}, shortlist ${rough.length}`);
  console.log(`tightening on ${workers} workers — this is the slow part\n`);

  const chunks = Array.from({ length: workers }, () => []);
  rough.forEach((r, i) => chunks[i % workers].push(r));
  const self = fileURLToPath(import.meta.url);
  const t0 = Date.now();
  const refitted = [];
  let done = 0;
  await Promise.all(chunks.filter(c => c.length).map(chunk => new Promise((res, rej) => {
    const w = new Worker(self, { workerData: { tool: 'pick', chunk } });
    w.on('message', got => {
      refitted.push(...got.filter(Boolean));
      done += got.length;
      console.log(`  tightened ${done}/${rough.length}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
      res();
    });
    w.on('error', rej);
  })));

  const shrank = refitted.filter(r => r.states < r.wasStates).length;
  const before = refitted.reduce((a, r) => a + r.wasStates, 0);
  const after = refitted.reduce((a, r) => a + r.states, 0);
  console.log(`\n${refitted.length} survived tightening; ${shrank} shrank`);
  console.log(`  total state graph ${before} -> ${after} (${(after / before * 100).toFixed(0)}%)`);

  const rescored = dedupe(refitted.map(r => ({ ...r, ...score(r, ACT_WEIGHTS) }))
    .sort((a, b) => b.total - a.total));
  const { picked, short, byPiece, byBand, edges } = choose(rescored, { want, lo, hi, maxPieceShare });

  console.log(`\npicked ${picked.length} of ${want}`);
  console.log(`  par bands ${edges.join('/')} -> ${byBand.join(', ')} rooms`);
  console.log(`  piece spread ${Object.entries(byPiece).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p}:${n}`).join(' ')}`);
  for (const s of short)
    console.log(`  SHORT par ${s.band[0]}-${s.band[1]}: wanted ${s.want}, found ${s.got}`
      + ` — harvest more here, or raise --maxpiece (now ${maxPieceShare})`);

  console.log('\n id   par lines chg onPath blind solves group  size');
  picked.forEach((r, i) => console.log(
    ` L${String(first + i).padEnd(3)} ${String(r.par).padStart(3)} ${String(r.lines).padStart(5)}`
    + ` ${String(r.changes).padStart(3)} ${String(Math.round(r.onPath * 100) + '%').padStart(6)}`
    + ` ${String(r.blind).padStart(5)} ${String(r.solves).padStart(6)} ${r.group.padEnd(6)} ${r.w}x${r.h}`));

  const { tt, sol, md } = emit(picked, { first, pack: packName });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/act2.tt`, tt);
  writeFileSync(`${outDir}/act2.sol`, sol);
  writeFileSync(`${outDir}/act2.md`, md);
  console.log(`\n-> ${outDir}/act2.tt, ${outDir}/act2.sol, ${outDir}/act2.md`);
  console.log('   names, teach lines and notes are placeholders: they are the part nothing can compute.');
}
