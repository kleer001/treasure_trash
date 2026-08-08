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

import { readFileSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseLevelPack, toState, toGrid, toCart, toWater } from '../src/format.js';
import { analyze, TooManyStates } from '../src/solver.js';
import { DIR_ORDER, explain } from '../src/rules.js';
import { mulberry32 } from '../src/rng.js';
import { outline, placeOn } from './harvest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_STATES = 50_000;

// ---------------------------------------------------------------- talking to an engine

/**
 * A child process that speaks the protocol. Requests go out as they are made and replies are
 * matched by id, with a ceiling on how many may be in flight: a port that answers slowly would
 * otherwise be handed the whole corpus at once and buffer it.
 */
export function connect(command) {
  const child = spawn(command, { shell: true, stdio: ['pipe', 'pipe', 'inherit'], cwd: root });
  const pending = new Map();
  let nextId = 1, drain = null;

  createInterface({ input: child.stdout }).on('line', line => {
    if (!line.trim()) return;
    const reply = JSON.parse(line);
    const settle = pending.get(reply.id);
    pending.delete(reply.id);
    settle?.(reply);
    if (drain && pending.size < 512) { const go = drain; drain = null; go(); }
  });
  const died = new Promise((_, no) =>
    child.on('exit', code => { if (pending.size) no(new Error(`engine exited (${code}) with ${pending.size} unanswered`)); }));

  return {
    async ask(req) {
      if (pending.size >= 1024) await new Promise(go => { drain = go; });
      const id = nextId++;
      const reply = new Promise(ok => pending.set(id, ok));
      child.stdin.write(JSON.stringify({ id, ...req }) + '\n');
      return Promise.race([reply, died]);
    },
    close() { child.stdin.end(); },
  };
}

// ---------------------------------------------------------------- what agreement means

const norm = v => (v === undefined || v === null ? null : v);
const sameRows = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

/** The first field the two disagree on, or null. Field order is the order it reads best in. */
export function disagreement(mine, theirs) {
  if (!theirs) return 'no reply';
  if (theirs.unsupported) return null;                       // counted as a skip, not a pass
  if (theirs.error) return `error: ${theirs.error}`;
  for (const k of ['ok', 'reason', 'kind', 'par', 'solves', 'traps', 'reachable', 'exitRefusals']) {
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

const shape = s => ({ grid: toGrid(s), cart: toCart(s), water: toWater(s) });

/** Every shipped room, as boards. */
export function shippedRooms() {
  return readdirSync(resolve(root, 'levels')).filter(f => /^act\d+\.tt$/.test(f)).sort()
    .flatMap(f => parseLevelPack(readFileSync(resolve(root, 'levels', f), 'utf8')).levels
      .map(l => ({ name: `${f}:${l.id}`, level: l })));
}

/**
 * Rooms the shipped acts do not contain. Seeded, so a failure is reproducible from the seed
 * printed in the report rather than from a corpus file nobody kept.
 */
export function generatedRooms(count, seed) {
  const rnd = mulberry32(seed);
  const GROUPS = ['$', '$b', '$C', '$W', 'xB', '$P', 'CP', '$j', 'Fb', '$$b', 'BW', 'jb',
                  '$Bw', 'xPC', 'F$', 'S$', '$bw'];
  const out = [];
  for (let i = 0; out.length < count && i < count * 40; i++) {
    const [w, h] = [[8, 4], [8, 5], [7, 5], [9, 5]][Math.floor(rnd() * 4)];
    const plan = outline(w, h, rnd);
    if (!plan) continue;
    const room = placeOn(GROUPS[Math.floor(rnd() * GROUPS.length)], plan, w, h, rnd);
    if (!room) continue;
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
    try { out.push(shape(a.states.get(keys[i]).state)); } catch { /* unserialisable, skip */ }
  }
  return out;
}

// ---------------------------------------------------------------- the run

// Our side of every comparison, in the two shapes the protocol asks for. `src/` is called
// directly here — there is no second implementation on this side of the harness either.
const ourStepAt = (b, dir) => {
  const r = explain(toState({ id: 'ours', grid: b.grid, ...(b.cart && { cart: b.cart }),
                              ...(b.water && { water: b.water }) }), dir);
  return r.ok ? { ok: true, kind: r.kind, ...shape(r.next) } : { ok: false, reason: r.reason };
};
const ourAnswer = a => ({ par: a.minMoves, solves: a.shortestCount, traps: a.traps.length,
                          reachable: a.reachable, exitRefusals: a.exitRefusals });

export async function conform(command, { rooms = null, steps = 120, random = 40, seed = 7,
                                         log = console.log } = {}) {
  const engine = connect(command);
  const corpus = rooms ?? [...shippedRooms(), ...generatedRooms(random, seed)];
  const tally = { rooms: 0, answers: 0, steps: 0, skipped: 0 };
  const failures = [];

  for (const { name, level } of corpus) {
    let start, a;
    try { start = toState(level); a = analyze(start, { maxStates: MAX_STATES }); }
    catch (e) { if (e instanceof TooManyStates) continue; throw e; }
    tally.rooms++;
    const board = shape(start);

    // Coarse first: one round trip says whether this room is worth taking apart.
    const ours = ourAnswer(a);
    const theirs = await engine.ask({ op: 'answer', ...board, maxStates: MAX_STATES });
    const roomBad = disagreement(ours, theirs);
    if (theirs?.unsupported) tally.skipped++; else tally.answers++;

    // Fine: always over a sample, and over EVERYTHING when the room came out wrong, because
    // that is the only way the report says which rule rather than which room.
    // Pipelined in windows rather than one round trip per step: a step costs a process hop, and
    // asked one at a time the hop is the whole run. Compared in order afterwards, so "first
    // disagreement" still means the shallowest one.
    const sample = boardsOf(a, roomBad ? Infinity : steps);
    const asks = sample.flatMap(b => DIR_ORDER.map(dir => ({ b, dir })));
    let first = null;
    for (let i = 0; i < asks.length && !first; i += 256) {
      const window = asks.slice(i, i + 256);
      const replies = await Promise.all(window.map(q => engine.ask({ op: 'step', ...q.b, dir: q.dir })));
      for (let j = 0; j < window.length; j++) {
        if (replies[j]?.unsupported) { tally.skipped++; continue; }
        tally.steps++;
        const ourStep = ourStepAt(window[j].b, window[j].dir);
        const bad = disagreement(ourStep, replies[j]);
        if (bad) { first = { ...window[j], board: window[j].b, bad, mine: ourStep, theirs: replies[j] }; break; }
      }
    }

    if (first) {
      failures.push({ name, ...first, room: roomBad });
      log(`  ✗ ${name} — ${first.bad}`);
      log(`      ${first.dir} on`);
      for (const row of first.board.grid) log(`        ${row}`);
      if (roomBad) log(`      the room reads ${roomBad}`);
    } else if (roomBad) {
      // The aggregate is wrong and no single step is: the port's own SEARCH is what differs.
      failures.push({ name, bad: roomBad, room: roomBad });
      log(`  ✗ ${name} — ${roomBad}, and every step of it agrees. The search differs, not the rules.`);
    }
  }

  engine.close();
  log(`\n${tally.rooms} rooms, ${tally.answers} answers, ${tally.steps} steps`
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
