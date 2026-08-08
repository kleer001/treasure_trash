#!/usr/bin/env node
// A conformance engine with one rule bent, so the harness can be caught failing to catch it.
//
//   node tests/fixtures/bent-engine.mjs <bend>
//
// It defines no rules — it asks `src/` and then lies about the answer, which is the point: the
// bend is a one-line difference of exactly the kind a port would have, and every other reply is
// right, so the harness has to find it rather than notice the engine is nonsense.
//
//   refuse-up   the first legal `u` on a board with a bag on it comes back refused
//   miscall     a tear is reported as a push, and lands the board it really lands
//   par-off-by  every room's par is one higher; every step of every room agrees
//   silent      nothing bent. The control: the harness must pass this one.

import { createInterface } from 'node:readline';
import { toState, toGrid, toCart, toWater } from '../../src/format.js';
import { explain, TEAR, PUSH } from '../../src/rules.js';
import { analyze } from '../../src/solver.js';

const bend = process.argv[2] ?? 'silent';
const board = req => toState({ id: 'bent', grid: req.grid, ...(req.cart && { cart: req.cart }),
                               ...(req.water && { water: req.water }) });
const shape = s => ({ grid: toGrid(s), cart: toCart(s), water: toWater(s) });

const handle = (req) => {
  if (req.op === 'step') {
    const r = explain(board(req), req.dir);
    if (bend === 'refuse-up' && r.ok && req.dir === 'u' && req.grid.some(row => row.includes('$')))
      return { ok: false, reason: 'wall' };
    if (!r.ok) return { ok: false, reason: r.reason };
    const kind = bend === 'miscall' && r.kind === TEAR ? PUSH : r.kind;
    return { ok: true, kind, ...shape(r.next) };
  }
  if (req.op === 'answer') {
    const a = analyze(board(req), { maxStates: req.maxStates ?? Infinity });
    const par = bend === 'par-off-by' && a.minMoves !== null ? a.minMoves + 1 : a.minMoves;
    return { par, solves: a.shortestCount, traps: a.traps.length,
             reachable: a.reachable, exitRefusals: a.exitRefusals };
  }
  return { unsupported: true };
};

for await (const line of createInterface({ input: process.stdin })) {
  if (!line.trim()) continue;
  const req = JSON.parse(line);
  let reply;
  try { reply = handle(req); } catch (e) { reply = { error: `${e.message}` }; }
  process.stdout.write(JSON.stringify({ id: req.id, ...reply }) + '\n');
}
