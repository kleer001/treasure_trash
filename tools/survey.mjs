#!/usr/bin/env node
// Treasure Trash — the fertility survey. Which MIXED groups of pieces make rooms at all?
//
//   node tools/survey.mjs [--samples N] [--workers N] [--out FILE] [--groups N]
//
// This game has a roster, and the roster is the game. This samples random placements of every
// legal group of four and reports how often each group yields a solvable room and how often it
// yields an interesting one.
//
// The output is a MAP, not levels: one JSONL row per group. Harvesting rooms from the fertile
// groups is a separate, deeper pass.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isMainThread, workerData } from 'node:worker_threads';
import { defaultWorkers, run, serve } from './pool.mjs';
import { engineFor, connect, measureMany, measureHere, TOO_BIG } from './engine.mjs';
import { toState } from '../src/format.js';
import { bagsLeft } from '../src/rules.js';
import { mulberry32 } from '../src/rng.js';

// ---------------------------------------------------------------- the alphabet
const POINTS = ['$', 'C', 'c', 'x', 'S', 'W', 'w', 'B', 'j'];
const DOMINOES = ['F', 'P'];                       // couch (occupant grid), cart (its own mask)
const ALPHABET = [...POINTS, ...DOMINOES];

// Mirrors BAGS_IN in the rules.
const BAGS = { $: 1, C: 1, W: 1, S: 2, B: 1 };
const CARRIERS = new Set(Object.keys(BAGS));

const POOL_CAP = { F: 6, P: 3 };

const W = 8, H = 4;
const SIZE = 4;

/** Every multiset of SIZE glyphs that could make a room. */
export function groups() {
  const out = [];
  const walk = (start, acc) => {
    if (acc.length === SIZE) {
      if (!acc.some(g => CARRIERS.has(g))) return;
      // The par runs away from the band we are aiming at.
      const bags = acc.reduce((n, g) => n + (BAGS[g] ?? 0), 0);
      if (bags < 2 || bags > 4) return;
      for (const [g, cap] of Object.entries(POOL_CAP))
        if (acc.filter(c => c === g).length > cap) return;
      out.push(acc.join(''));
      return;
    }
    for (let i = start; i < ALPHABET.length; i++) walk(i, [...acc, ALPHABET[i]]);
  };
  walk(0, []);
  return out;
}

// ---------------------------------------------------------------- placement
/**
 * One random board: an exit, a raccoon and the group's pieces dropped on free cells. The
 * space is far too large to enumerate — `rooms()` in draft-room.mjs walks it exhaustively and
 * would never finish here — so placements are sampled.
 *
 * Returns null when the draw could not be completed (a domino with no free pair left).
 */
export function place(group, rnd) {
  const pick = n => Math.floor(rnd() * n);
  const grid = Array.from({ length: H }, () => Array.from({ length: W }, () => '-'));
  const cart = Array.from({ length: H }, () => Array.from({ length: W }, () => '-'));
  const free = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) free.push([x, y]);
  const taken = new Set();
  const key = ([x, y]) => `${x},${y}`;
  const open = () => free.filter(c => !taken.has(key(c)));

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

  const nextLetter = { F: [...'FGHKMN'], P: [...'PQR'] };
  for (const g of group) {
    if (DOMINOES.includes(g)) {
      const pair = takePair();
      if (!pair) return null;
      const letter = nextLetter[g].shift();
      if (!letter) return null;
      for (const [x, y] of pair) {
        if (g === 'P') cart[y][x] = letter; else grid[y][x] = letter;
      }
    } else {
      const c = takeOne();
      if (!c) return null;
      grid[c[1]][c[0]] = g;
    }
  }
  const room = { id: 'survey', grid: grid.map(r => r.join('')) };
  if (group.includes('P')) room.cart = cart.map(r => r.join(''));
  return room;
}

// ---------------------------------------------------------------- static pre-filter
const FAN = (bx, by, dx, dy) => {
  const px = -dy, py = dx;
  return [[bx + px, by + py], [bx - px, by - py], [bx + dx, by + dy],
          [bx + dx + px, by + dy + py], [bx + dx - px, by + dy - py]];
};

/** True when the board can be discarded without enumerating anything. */
export function staticallyDead(s) {
  const bags = [];
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++)
    if (s.cells[y][x].o === 1) bags.push([x, y]);            // BAG
  if (!bags.length) return false;
  // The fan is measured against walls, the exit and the grid edge only — those never move.
  for (const [bx, by] of bags) {
    const anyDir = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) =>
      FAN(bx, by, dx, dy).every(([x, y]) =>
        x >= 0 && y >= 0 && x < s.cols && y < s.rows
        && !s.cells[y][x].wall && !s.cells[y][x].exit));
    if (!anyDir) return true;
  }
  return false;
}

// ---------------------------------------------------------------- one group
// It is a design bound as much as a memory one: `analyze` holds every state as a cloned board, so a fleet of workers each chasing a million-state graph exhausts the machine before it finds anything worth keeping.
const MAX_STATES = 50_000;

// Deliberately loose: this pass ranks GROUPS against each other, and a group that only ever yields par-6 rooms is a finding, not a failure.
const isInteresting = d => d.par >= 12 && d.solves <= 2 && d.traps >= 1;

/**
 * `engine` is the sanctioned port, or null to enumerate here. This is where the pipeline's hours are, so it is the first thing the port was pointed at.
 */
async function surveyGroup(group, samples, seed, engine = null) {
  const rnd = mulberry32(seed);
  const out = {
    group, samples: 0, undrawable: 0, prefiltered: 0, illegal: 0,
    solvable: 0, interesting: 0, tooBig: 0, pars: [], ms: 0,
  };
  const t0 = Date.now();

  // DRAWN FIRST, JUDGED AFTER. Every placement comes off the seeded stream and nothing about a
  // draw depends on how the last one scored, so the whole batch can be drawn and then asked at
  // once — which is what lets the engine be handed two hundred boards instead of two hundred
  // round trips. The counters are totals and `pars` is filled in draw order either way, so the
  // row this writes is the row the one-at-a-time loop wrote.
  const boards = [];
  for (let i = 0; i < samples; i++) {
    out.samples++;
    const room = place(group, rnd);
    if (!room) { out.undrawable++; continue; }
    let s;
    try { s = toState(room); } catch { out.illegal++; continue; }
    if (staticallyDead(s)) { out.prefiltered++; continue; }
    boards.push(s);
  }

  const reads = engine ? await measureMany(engine, boards, MAX_STATES)
                       : boards.map(s => measureHere(s, MAX_STATES));
  for (const [i, r] of reads.entries()) {
    if (r === TOO_BIG) { out.tooBig++; continue; }
    if (r.par === null) continue;
    if (bagsLeft(boards[i]) > 0 && r.exitRefusals === 0) continue;
    if (r.silentTraps) continue;
    out.solvable++;
    out.pars.push(r.par);
    if (isInteresting(r)) out.interesting++;
  }
  out.ms = Date.now() - t0;
  return out;
}

// ---------------------------------------------------------------- workers
// `groups`, `place` and `staticallyDead` are imported by the harvest pass, so neither branch
// may run on import — a module that surveys when you require it is a module you cannot compose.
// The tag matters: this module is imported by other tools, and their workers would
// otherwise run this branch against workerData meant for them.
if (!isMainThread && workerData?.tool === 'survey') {
  const { samples, seed, engineBin } = workerData;
  // One engine per worker. They are separate processes with separate graphs, so nothing is
  // shared and nothing needs locking.
  const engine = engineBin ? connect(engineBin) : null;
  await serve((g, i) => surveyGroup(g, samples, seed + i, engine));
  engine?.close();
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (flag, dflt) => {
    const i = process.argv.indexOf(flag);
    return i === -1 ? dflt : Number(process.argv[i + 1]);
  };
  const outPath = (() => {
    const i = process.argv.indexOf('--out');
    return i === -1 ? 'levels/fertility.jsonl' : process.argv[i + 1];
  })();
  const samples = arg('--samples', 200);
  const workers = arg('--workers', defaultWorkers());
  const limit = arg('--groups', Infinity);

  const engineBin = engineFor(process.argv);

  const all = groups();
  const list = Number.isFinite(limit) ? all.slice(0, limit) : all;
  console.log(`${all.length} legal groups of ${SIZE} from ${ALPHABET.length} piece types`);
  console.log(`surveying ${list.length} of them, ${samples} placements each on ${W}x${H}, ${workers} workers\n`);

  const t0 = Date.now();
  const rows = await run({
    self: fileURLToPath(import.meta.url), tool: 'survey', items: list, workers,
    extra: w => ({ samples, seed: 1 + w * 10007, engineBin }),
    onItem: ({ got: row, done, total, ms }) => {
      const el = ms / 1000;
      const eta = ((el / done) * (total - done)) / 60;
      console.log(`  ${String(done).padStart(3)}/${total}  ${row.group.padEnd(5)}`
        + ` solvable ${String(row.solvable).padStart(3)}  interesting ${String(row.interesting).padStart(3)}`
        + `  tooBig ${String(row.tooBig).padStart(3)}  ${(row.ms / 1000).toFixed(0)}s`
        + `   [${el.toFixed(0)}s elapsed, ~${eta.toFixed(0)}m left]`);
    },
  });

  // Stable, and the pool hands the rows back in input order, so groups that tie on both keys
  // keep the order `groups()` enumerates them in.
  rows.sort((a, b) => b.interesting - a.interesting || b.solvable - a.solvable);
  writeFileSync(outPath, rows.map(r => JSON.stringify(r)).join('\n') + '\n');

  const sum = k => rows.reduce((n, r) => n + r[k], 0);
  console.log(`\n${rows.length} groups, ${sum('samples')} placements in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`  pre-filtered ${sum('prefiltered')}  too big to enumerate ${sum('tooBig')}  undrawable ${sum('undrawable')}`);
  console.log(`  solvable ${sum('solvable')}  interesting ${sum('interesting')}`);
  console.log(`\nfertility map -> ${outPath}\n`);
  console.log('most fertile groups:');
  for (const r of rows.slice(0, 20)) {
    const pars = r.pars.length ? `par ${Math.min(...r.pars)}-${Math.max(...r.pars)}` : 'no solves';
    console.log(`  ${r.group.padEnd(6)} interesting ${String(r.interesting).padStart(4)}/${r.samples}   solvable ${String(r.solvable).padStart(4)}   ${pars}`);
  }
}
