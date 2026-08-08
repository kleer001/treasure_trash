#!/usr/bin/env node
// Treasure Trash — the conformance protocol, spoken by the engine of record.
//
//   node tools/conform-ref.mjs        # reads requests on stdin, writes replies on stdout
//
// Two jobs. It is the EXECUTABLE SPEC a second implementation is written against — the protocol
// is small enough to describe in a comment and easy enough to get subtly wrong that a working
// example is worth more than the description. And it is what `conform.mjs` runs when no engine
// is named, so the harness is exercised and green before there is anything to compare.
//
// It carries no rules of its own. It is a mouth on `src/`.
//
// ---------------------------------------------------------------- the protocol
// One JSON object per line in, one per line out. Every reply echoes the request's `id`, and
// that is what pairs them — replies may come back in any order, and several requests may be in
// flight. A request naming an op you do not implement gets `{id, unsupported: true}`: say so
// rather than answer wrongly, and the harness will report the skip rather than hide it.
//
//   -> {"id":1, "op":"step", "grid":[...], "cart":[...]|null, "water":[...]|null, "dir":"u"}
//   <- {"id":1, "ok":false, "reason":"wall"}
//   <- {"id":1, "ok":true, "kind":"push", "grid":[...], "cart":[...]|null, "water":[...]|null}
//
//   -> {"id":2, "op":"answer", "grid":[...], "cart":..., "water":..., "maxStates":50000}
//   <- {"id":2, "par":8, "solves":1, "traps":2, "reachable":154, "exitRefusals":9}
//   <- {"id":2, "error":"state graph exceeds 50000 states"}
//
// `par` is null for a board that cannot be won. Grids are the CANONICAL serialisation — the one
// `toGrid` writes, raccoon included, `+` where he stands on the exit — because two spellings of
// one board would fail a comparison that is about the rules.
//
// `blame` is deliberately not in the contract. It is what the UI paints red, not what the board
// does, and a solver has no reason to carry it.

import { createInterface } from 'node:readline';
import { toState, toGrid, toCart, toWater } from '../src/format.js';
import { explain } from '../src/rules.js';
import { analyze } from '../src/solver.js';

/** A request's board, read back in. */
const boardOf = req => toState({ id: 'conform', grid: req.grid,
  ...(req.cart && { cart: req.cart }), ...(req.water && { water: req.water }) });

/** A board, in the shape a reply carries one. */
export const shapeOf = s => ({ grid: toGrid(s), cart: toCart(s), water: toWater(s) });

/** The `answer` reply for an analysis already in hand. */
export const answerOf = a => ({ par: a.minMoves, solves: a.shortestCount, traps: a.traps.length,
                                reachable: a.reachable, exitRefusals: a.exitRefusals });

/**
 * One request, answered from `src/`. Exported because it is the only place the protocol meets
 * the engine: the harness compares against this, a bent engine bends what this returns, and the
 * loop below serves it down a pipe. Three callers, one answer — a harness whose own idea of the
 * rules had drifted from the reference it ships would be worse than no harness.
 */
export function respond(req) {
  if (req.op === 'step') {
    const r = explain(boardOf(req), req.dir);
    return r.ok ? { ok: true, kind: r.kind, ...shapeOf(r.next) } : { ok: false, reason: r.reason };
  }
  if (req.op === 'answer')
    return answerOf(analyze(boardOf(req), { maxStates: req.maxStates ?? Infinity }));
  return { unsupported: true };
}

/** `respond` with the two things a wire needs: the id back, and a throw turned into a reply. */
export function reply(req) {
  try { return { id: req.id, ...respond(req) }; }
  catch (e) { return { id: req.id, error: e.message }; }
}

/**
 * Serve the protocol on stdin/stdout: one reply per request, written as soon as it is ready.
 * An engine that accumulates replies before flushing deadlocks the first client that sends one
 * request and waits for it. Throughput is the CLIENT's to arrange by keeping several in flight;
 * this side must never make batching a condition of answering.
 */
export async function serve(answer = reply) {
  for await (const line of createInterface({ input: process.stdin })) {
    if (!line.trim()) continue;
    process.stdout.write(JSON.stringify(answer(JSON.parse(line))) + '\n');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await serve();
