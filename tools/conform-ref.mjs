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
// One JSON object per line in, one per line out, replies in the order the requests arrived.
// Every reply echoes `id`. A request naming an op you do not implement gets `{id, unsupported:
// true}` — say so rather than answer wrongly; the harness reports skips and never hides them.
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
import { analyze, TooManyStates } from '../src/solver.js';

const board = req => toState({ id: 'conform', grid: req.grid, ...(req.cart && { cart: req.cart }),
                               ...(req.water && { water: req.water }) });
const shape = s => ({ grid: toGrid(s), cart: toCart(s), water: toWater(s) });

const handle = (req) => {
  if (req.op === 'step') {
    const r = explain(board(req), req.dir);
    return r.ok ? { ok: true, kind: r.kind, ...shape(r.next) } : { ok: false, reason: r.reason };
  }
  if (req.op === 'answer') {
    const s = board(req);
    const a = analyze(s, { maxStates: req.maxStates ?? Infinity });
    return { par: a.minMoves, solves: a.shortestCount, traps: a.traps.length,
             reachable: a.reachable, exitRefusals: a.exitRefusals };
  }
  return { unsupported: true };
};

// A reply per request, written as soon as it is ready. An engine that accumulates replies
// before flushing deadlocks the first client that sends one request and waits for it.
// Throughput is the CLIENT's to arrange, by keeping several requests in flight; this side must
// never make batching a condition of answering.
for await (const line of createInterface({ input: process.stdin })) {
  if (!line.trim()) continue;
  const req = JSON.parse(line);
  let reply;
  try { reply = handle(req); }
  catch (e) { reply = { error: e instanceof TooManyStates ? e.message : `${e.message}` }; }
  process.stdout.write(JSON.stringify({ id: req.id, ...reply }) + '\n');
}
