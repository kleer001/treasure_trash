#!/usr/bin/env node
// Treasure Trash — differential conformance. Does a second implementation of the rules agree
// with `src/rules.js`, everywhere anyone can tell the difference?
//
//   node tools/conform.mjs                          # against the reference: proves the harness
//   node tools/conform.mjs --engine './my-solver'   # against a port
//   node tools/conform.mjs --engine '...' --steps 4000 --random 300 --seed 12
//
// This is what **One engine** in CLAUDE.md means by proof. A port is not sanctioned because
// somebody read it carefully; it is sanctioned because this runs every build and fails on the
// first disagreement. `tools/conform-ref.mjs` is the protocol, written out.
//
// TWO GRAINS, and the coarse one exists to be diagnosed by the fine one.
//
//   ANSWER  a whole room: par, distinct shortest solves, traps, reachable states, exit
//           refusals. What the pack is verified on, so a port that gets these right is a port
//           the level pipeline can use. Useless when it fails — it says a room came out wrong
//           and nothing about which rule did it.
//   STEP    one board, one direction: legal or not, which refusal, which action class, and the
//           exact board it lands on. What actually pins the rules. A disagreement here IS the
//           bug report: the board, the direction, and the two answers.
//
// So an ANSWER disagreement is not reported as itself. The room is re-run at STEP grain over
// every state it can reach, and what comes out is the shallowest board where the two engines
// first part company.
//
// The corpus is not written by hand. Every state of every shipped room is a legal board that
// somebody's rules produced, which is a better fuzzing corpus than anything invented, and the
// generator supplies the piece combinations the shipped acts happen not to contain.

import { toState } from '../src/format.js';
import { analyze, TooManyStates } from '../src/solver.js';
import { DIR_ORDER } from '../src/rules.js';
import { mulberry32 } from '../src/rng.js';
import { outline, placeOn } from './harvest.mjs';
import { MAX_STATES } from './metrics.mjs';
import { actLevels } from './packs.mjs';
import { connect } from './engine.mjs';
import { respond, shapeOf, answerOf, measureOf } from './conform-ref.mjs';

// ---------------------------------------------------------------- what agreement means

const norm = v => (v === undefined || v === null ? null : v);
const sameRows = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

/** The first field the two disagree on, or null. Field order is the order it reads best in. */
export function disagreement(mine, theirs) {
  if (!theirs) return 'no reply';
  if (theirs.unsupported) return null;                       // counted as a skip, not a pass
  if (theirs.error) return `error: ${theirs.error}`;
  for (const k of ['ok', 'reason', 'kind', 'par', 'solves', 'traps', 'reachable', 'exitRefusals',
                   'silentTraps', 'onPath', 'bitten', 'firstOnPath', 'lead', 'tail']) {
    if (!(k in mine)) continue;
    if (norm(mine[k]) !== norm(theirs[k])) return `${k}: ${norm(mine[k])} vs ${norm(theirs[k])}`;
  }
  for (const k of ['grid', 'cart', 'water']) {
    if (!(k in mine)) continue;
    if (!sameRows(mine[k], theirs[k])) return `${k} differs`;
  }
  return null;
}

// ---------------------------------------------------------------- the corpus

/**
 * Rooms the shipped acts do not contain. Seeded, so a failure is reproducible from the seed
 * printed in the report rather than from a corpus file nobody kept.
 */
/**
 * Lay terrain over a drawn room. Every lane the `:water` mask carries, not only the canal —
 * a corpus that cannot express grease or a one-way cannot catch an engine that gets them wrong.
 *
 * Walls and the exit refuse terrain and the raccoon may not start in water or on glass, so the
 * draw simply avoids his cell and theirs. An OCCUPIED cell is fair game and is the point: a can
 * standing on grease and a rug lying over a grate are where the two engines part company.
 */
function sprinkleTerrain(room, rnd, n) {
  const LANES = [...'~=%T*_O^v<>'];
  const rows = room.grid.map(r => [...r].map(() => '-'));
  const spots = [];
  room.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '#' && ch !== 'E' && ch !== '@' && ch !== '+') spots.push([x, y]);
  }));
  for (let i = 0; i < n && spots.length; i++) {
    const [x, y] = spots.splice(Math.floor(rnd() * spots.length), 1)[0];
    rows[y][x] = LANES[Math.floor(rnd() * LANES.length)];
  }
  return { ...room, water: rows.map(r => r.join('')) };
}

export function generatedRooms(count, seed) {
  const rnd = mulberry32(seed);
  // Every piece the rules know, in combinations the shipped acts do not contain. A group left
  // out here is a piece the gate cannot see, and a gate that cannot see a piece reports
  // agreement about it either way.
  const GROUPS = ['$', '$b', '$C', '$W', 'xB', '$P', 'CP', '$j', 'Fb', '$$b', 'BW', 'jb',
                  '$Bw', 'xPC', 'F$', 'S$', '$bw',
                  // the roster added since
                  '$s', 'Cd', '$g', 'oO', '$o', 'UC', 'Y$', 'Uo', 'hC', '$h', 'r$', 'rC',
                  // No lone drawer: it is half of an open cabinet and never stands by itself.
                  'a$', 'mC', 'eo', 'kU', 'qC', 'f$', 'pU', 'lo', 'q$C', 'yF', 'nU',
                  'y$', 'zC', 'uF', 'rh$', 'dg', 'sC', 'YU', 'Pq', 'Fy', '$qb'];
  const out = [];
  for (let i = 0; out.length < count && i < count * 40; i++) {
    const [w, h] = [[8, 4], [8, 5], [7, 5], [9, 5]][Math.floor(rnd() * 4)];
    const plan = outline(w, h, rnd);
    if (!plan) continue;
    let room = placeOn(GROUPS[Math.floor(rnd() * GROUPS.length)], plan, w, h, rnd);
    if (!room) continue;
    // Half the corpus carries terrain. The other half keeps the bare-floor cases, which is
    // where a piece's own rule shows without a lane on top of it.
    if (rnd() < 0.5) room = sprinkleTerrain(room, rnd, 1 + Math.floor(rnd() * 4));
    try { toState(room); } catch { continue; }
    out.push({ name: `generated#${out.length}`, level: { id: 'gen', ...room } });
  }
  return out;
}

/**
 * Boards from a room, and every direction from each. Sampled evenly through BFS discovery order
 * rather than from the front, because the first hundred states of any room are the raccoon
 * walking about and the interesting boards are the ones several shoves deep.
 */
function boardsOf(a, want) {
  const keys = [...a.states.keys()];
  const stride = Math.max(1, Math.floor(keys.length / want));
  const out = [];
  for (let i = 0; i < keys.length && out.length < want; i += stride) {
    try { out.push(shapeOf(a.states.get(keys[i]).state)); } catch { /* unserialisable, skip */ }
  }
  return out;
}

// ---------------------------------------------------------------- the run

// How many requests ride together. One at a time makes the process hop the whole run; the
// window is only bounded so a slow engine is not handed the corpus at once.
const WINDOW = 256;

export async function conform(command, { rooms = null, steps = 120, random = 40, seed = 7,
                                         log = console.log } = {}) {
  const engine = connect(command);
  const corpus = rooms ?? [...actLevels(), ...generatedRooms(random, seed)];
  const tally = { rooms: 0, answers: 0, measures: 0, steps: 0, skipped: 0 };
  const failures = [];

  for (const { name, level } of corpus) {
    let start, a;
    try { start = toState(level); a = analyze(start, { maxStates: MAX_STATES }); }
    catch (e) { if (e instanceof TooManyStates) continue; throw e; }
    tally.rooms++;

    // Coarse first: one round trip says whether this room is worth taking apart. `measure` is
    // asked in the same breath because it is the same enumeration — an engine the pipeline can
    // use has to get the numbers the pipeline DECIDES on right, not only the ones a pack
    // declares, and an unchecked metric is exactly the sort of thing that would be discovered
    // by a re-sited act coming out different.
    const board = shapeOf(start);
    const [theirs, theirMeasure] = await Promise.all([
      engine.ask({ op: 'answer', ...board, maxStates: MAX_STATES }),
      engine.ask({ op: 'measure', ...board, maxStates: MAX_STATES }),
    ]);
    const roomBad = disagreement(answerOf(a), theirs)
      ?? disagreement(measureOf(a), theirMeasure);
    if (theirs.unsupported) tally.skipped++; else tally.answers++;
    if (theirMeasure.unsupported) tally.skipped++; else tally.measures++;

    // Then fine: a sample of the room's boards, or EVERY one of them once the room is known to
    // be wrong, because that is what turns "this room" into "this rule". Compared in the order
    // they were asked, so the one reported is still the shallowest.
    const sample = boardsOf(a, roomBad ? a.states.size : steps);
    const asks = sample.flatMap(b => DIR_ORDER.map(dir => ({ b, dir })));
    let first = null;
    for (let i = 0; i < asks.length && !first; i += WINDOW) {
      const window = asks.slice(i, i + WINDOW);
      const replies = await Promise.all(window.map(q => engine.ask({ op: 'step', ...q.b, dir: q.dir })));
      for (let j = 0; j < window.length; j++) {
        if (replies[j]?.unsupported) { tally.skipped++; continue; }
        tally.steps++;
        const { b: board, dir } = window[j];
        const ourStep = respond({ op: 'step', ...board, dir });
        const bad = disagreement(ourStep, replies[j]);
        if (bad) { first = { board, dir, bad, mine: ourStep, theirs: replies[j] }; break; }
      }
    }

    if (first) {
      failures.push({ name, ...first });
      log(`  ✗ ${name} — ${first.bad}`);
      log(`      ${first.dir} on`);
      for (const row of first.board.grid) log(`        ${row}`);
      if (roomBad) log(`      the room reads ${roomBad}`);
    } else if (roomBad) {
      // The aggregate is wrong and no single step is: the port's own SEARCH is what differs.
      failures.push({ name, bad: roomBad });
      log(`  ✗ ${name} — ${roomBad}, and every step of it agrees. The search differs, not the rules.`);
    }
  }

  engine.close();
  log(`\n${tally.rooms} rooms, ${tally.answers} answers, ${tally.measures} measures,`
    + ` ${tally.steps} steps`
    + (tally.skipped ? `, ${tally.skipped} SKIPPED as unsupported` : ''));
  return { failures, tally, seed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const str = (f, d) => { const i = process.argv.indexOf(f); return i === -1 ? d : process.argv[i + 1]; };
  const num = (f, d) => { const i = process.argv.indexOf(f); return i === -1 ? d : Number(process.argv[i + 1]); };
  const command = str('--engine', 'node tools/conform-ref.mjs');
  const seed = num('--seed', 7);
  console.log(`conformance: ${command}\n  against src/rules.js, seed ${seed}\n`);
  const { failures, tally } = await conform(command, {
    steps: num('--steps', 120), random: num('--random', 40), seed,
  });
  if (tally.skipped) console.log(`  ${tally.skipped} request(s) unsupported — that is not agreement`);
  console.log(failures.length ? `\nFAIL — ${failures.length} room(s) disagree` : '\nALL AGREE');
  process.exit(failures.length ? 1 : 0);
}
