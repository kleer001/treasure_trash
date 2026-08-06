#!/usr/bin/env node
// Draft a room against every check verify.mjs will apply, before it goes in the pack — and
// search the space of rooms of a given shape for ones worth keeping.
//
// A room's :par, :solve, :solves and :traps are CLAIMS the verifier proves. Writing them by
// hand means guessing and being told off; this computes them, so a room is either rejected or
// arrives with its numbers already true.
//
//   node tools/draft-room.mjs            # demo: search a small shape and print the keepers
//
// Import it to do anything more pointed:
//   import { draft, cartMustMove, ttBlock, hunt } from './draft-room.mjs';

import { toState, toGrid, toWater, toCart } from '../src/format.js';
import { analyze } from '../src/solver.js';
import { bagsLeft } from '../src/rules.js';

/**
 * Everything verify.mjs would say about a candidate room, without putting it in the pack.
 * `ok` is false when a check that a level author can actually fail did not hold.
 */
export function draft(room) {
  const out = { id: room.id, ok: true, notes: [] };
  const no = m => { out.ok = false; out.notes.push(m); };
  let s;
  try { s = toState(room); } catch (e) { no('reader: ' + e.message); return out; }

  const exitCell = s.cells.flat().find(c => c.exit);
  if (!exitCell) { no('no exit'); return out; }
  if (exitCell.o !== 0) no('exit does not start empty');
  if (s.cells[s.rac.y][s.rac.x].exit) no('raccoon starts on the exit');
  if (toGrid(s).join('\n') !== room.grid.join('\n')) no('grid does not round-trip');
  if (room.cart && toCart(s).join('\n') !== room.cart.join('\n')) no('cart mask does not round-trip');
  if (room.water && toWater(s).join('\n') !== room.water.join('\n')) no('water mask does not round-trip');

  const t0 = Date.now();
  const a = analyze(s);
  out.ms = Date.now() - t0;
  out.reachable = a.reachable;
  if (a.minMoves === null) { no('unsolvable'); return out; }

  const bags = bagsLeft(s);
  if (a.silentTraps.length) no(`a plain move can lose the room (${a.silentTraps[0].lurd})`);
  // The one design rule a room can fail — see verify.mjs.
  if (bags > 0 && a.exitRefusals === 0) no('the exit forbids no action — it is only a destination');

  Object.assign(out, { par: a.minMoves, solve: a.shortestLurd, solves: a.shortestCount,
                       traps: a.traps.length, bags, exitRefusals: a.exitRefusals });
  return out;
}

/**
 * Must the cart actually be SHOVED? False means it is scenery the player walks around: it may
 * lengthen the route, but the room teaches nothing about the piece.
 */
export function cartMustMove(room) {
  if (!room.cart) return null;
  const grid = room.grid.map((row, y) =>
    [...row].map((ch, x) => (room.cart[y][x] !== '-' ? '#' : ch)).join(''));
  try {
    return analyze(toState({ ...room, grid, cart: undefined })).minMoves === null;
  } catch { return true; }                 // frozen board is not even legal: it has to move
}

/** A room as it goes in the pack, numbers filled from `draft`. Every block closes itself. */
export function ttBlock(room, d) {
  const L = [`:level  ${room.id}`, `:name   ${room.name}`];
  if (room.teach) L.push(`:teach  ${room.teach}`);
  if (room.arm) L.push(':arm    on');
  L.push(`:par    ${d.par}`, `:traps  ${d.traps}`, `:solves ${d.solves}`, `:solve  ${d.solve}`);
  if (room.note) L.push(`:note   ${room.note}`);
  L.push(':grid', ...room.grid, ':end');
  if (room.cart) L.push(':cart', ...room.cart, ':end');
  if (room.water) L.push(':water', ...room.water, ':end');
  return L.join('\n');
}

/** Every room of this shape: one cart, the given loose pieces, a raccoon and an exit. */
export function* rooms({ w, h, pieces = ['$'], exitAt = null, walled = false }) {
  const inside = [];
  const lo = walled ? 1 : 0, hiX = walled ? w - 1 : w, hiY = walled ? h - 1 : h;
  for (let y = lo; y < hiY; y++) for (let x = lo; x < hiX; x++) inside.push([x, y]);
  const key = ([x, y]) => `${x},${y}`;
  const at = new Set(inside.map(key));
  const carts = [];
  for (const [x, y] of inside) {
    if (at.has(key([x + 1, y]))) carts.push([[x, y], [x + 1, y]]);
    if (at.has(key([x, y + 1]))) carts.push([[x, y], [x, y + 1]]);
  }

  for (const ex of (exitAt ? [exitAt] : inside))
    for (const rac of inside) {
      if (key(rac) === key(ex)) continue;
      for (const cart of carts) {
        if (cart.some(c => key(c) === key(ex) || key(c) === key(rac))) continue;
        const taken = new Set([key(ex), key(rac), ...cart.map(key)]);
        const spots = inside.filter(c => !taken.has(key(c)));
        const place = (rest, used) => {
          if (!rest.length) return [used];
          const acc = [];
          for (const c of spots) {
            if (used.some(u => key(u[1]) === key(c))) continue;
            acc.push(...place(rest.slice(1), [...used, [rest[0], c]]));
          }
          return acc;
        };
        for (const arrangement of place(pieces, [])) {
          const grid = Array.from({ length: h }, (_, y) =>
            Array.from({ length: w }, (_, x) =>
              (walled && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) ? '#' : '-'));
          const mask = grid.map(r => r.map(() => '-'));
          grid[ex[1]][ex[0]] = 'E';
          grid[rac[1]][rac[0]] = '@';
          for (const [g, c] of arrangement) grid[c[1]][c[0]] = g;
          for (const c of cart) mask[c[1]][c[0]] = 'P';
          yield { grid: grid.map(r => r.join('')), cart: mask.map(r => r.join('')) };
        }
      }
    }
}

/** Search a shape, keep the rooms `want` likes and that genuinely need their cart. */
export function hunt(shape, want, limit = 12) {
  const hits = [];
  let seen = 0;
  for (const room of rooms(shape)) {
    seen++;
    const d = draft({ id: 'draft', ...room });
    if (!d.ok || !want(d) || !cartMustMove(room)) continue;
    hits.push({ ...room, ...d });
    if (hits.length >= limit) break;
  }
  return { hits, seen };
}

// Run directly: a worked example of the shape a teaching room wants — short, few solutions,
// and impossible without shoving the cart.
if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const { hits, seen } = hunt({ w: 5, h: 3, pieces: ['$'] },
    d => d.par >= 5 && d.par <= 9 && d.solves <= 2 && d.traps <= 1, 5);
  console.log(`${seen} boards in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${hits.length} keepers\n`);
  for (const h of hits) {
    console.log(`par=${h.par} solves=${h.solves} traps=${h.traps} solve=${h.solve}`);
    h.grid.forEach((g, i) => console.log(`   ${g}   ${h.cart[i]}`));
    console.log();
  }
}
