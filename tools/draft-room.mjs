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
import {
  deadTravel, isOneRoom, inertPieces, shortestDag,
  parseGate, coverGate, winnableWithoutKind,
} from './metrics.mjs';

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
  if (!isOneRoom(s)) no('the open cells fall in more than one region');
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
  // The two design rules a room can fail — see verify.mjs.
  if (bags > 0 && a.exitRefusals === 0) no('the exit forbids no action — it is only a destination');
  // Checked after `tighten` walls, not only before: a wall can take away the lane a piece was
  // shutting, and leave the piece standing in the open shutting nothing.
  const onDag = shortestDag(a);
  const inert = inertPieces(room, a, { onDag });
  if (inert.length) no(`does nothing: ${inert.map(p => p.what).join(' ')}`);

  // The teaching gate, asked here in the words verify.mjs will ask it in, so a room is not
  // drafted against one question and shipped against another.
  if (room.gate !== undefined) {
    const g = parseGate(room.gate, room.id);
    if (g.mode === 'kind' && winnableWithoutKind(a, g.kind)) no(`the exit opens without a ${g.kind}`);
    // Every cover mode but `kind`, rather than a list of them: a mode left off a list here is a
    // room drafted against a question nobody asked.
    if (g.mode !== 'kind' && g.mode !== 'none') {
      const covered = analyze(toState({ ...coverGate(room, g), id: `${room.id}~gated` }));
      if (covered.minMoves !== null) no(`covered, the room is still solvable in ${covered.minMoves}`);
    }
  }

  // `lead` and `tail` are reported, not judged. Verify holds them to a bound because a shipped
  // room has to be sited well; a room still being drafted has not been sited yet, and rejecting
  // it here would throw away the candidate instead of moving its exit.
  Object.assign(out, { par: a.minMoves, solve: a.shortestLurd, solves: a.shortestCount,
                       traps: a.traps.length, bags, exitRefusals: a.exitRefusals,
                       ...deadTravel(a, onDag) });
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

const wallAt = (room, x, y) => ({
  ...room,
  grid: room.grid.map((row, j) =>
    (j === y ? row.slice(0, x) + '#' + row.slice(x + 1) : row)),
});

/**
 * Fill in the floor the solve never needed, so the room comes out shaped rather than
 * rectangular. Walls only ever remove options, so par cannot fall — what they buy is fewer
 * alternate solutions and a smaller graph. Greedy in raster order to a fixed point.
 *
 * `accept` sees the walled room's draft and the unwalled one's, and says whether the wall is
 * worth it. The default keeps par, refuses extra solutions, and will not wall away a room's
 * last way to lose: a wall that removes the final trap is a wall that removes the lesson.
 * Walls can only ever take traps away, so a room that arrives with none keeps none.
 */
export function tighten(room, accept = (d, base) =>
  d.par === base.par && d.solves <= base.solves && d.traps >= Math.min(base.traps, 1)) {
  let best = draft({ id: 'tighten', ...room });
  if (!best.ok) return null;
  const base = best;
  let cur = room, moved = true;
  while (moved) {
    moved = false;
    for (let y = 0; y < cur.grid.length; y++) for (let x = 0; x < cur.grid[y].length; x++) {
      if (cur.grid[y][x] !== '-') continue;
      if (cur.cart?.[y]?.[x] !== undefined && cur.cart[y][x] !== '-') continue;
      if (cur.water?.[y]?.[x] !== undefined && cur.water[y][x] !== '-') continue;
      const cand = wallAt(cur, x, y);
      const d = draft({ id: 'tighten', ...cand });
      if (!d.ok || !accept(d, base) || !cartMustMove(cand)) continue;
      cur = cand; best = d; moved = true;
    }
  }
  return { room: cur, draft: best, was: base };
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

/**
 * Every room of this shape: one cart, the given loose pieces, a raccoon and an exit.
 *
 * `plan` is a mask of strings — '#' is wall, anything else is free floor — so the outline can
 * be anything, not just a rectangle. It sets `w`/`h` when they are not given. `walled` is the
 * plain rectangle-with-a-border case.
 */
export function* rooms({ w, h, pieces = ['$'], exitAt = null, walled = false, plan = null }) {
  if (plan) { h = plan.length; w = Math.max(...plan.map(r => r.length)); }
  const isWall = (x, y) => (plan ? (plan[y]?.[x] ?? '#') === '#'
    : walled && (x === 0 || y === 0 || x === w - 1 || y === h - 1));
  const inside = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!isWall(x, y)) inside.push([x, y]);
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
        // Lazy: four pieces on a big board is millions of arrangements, and collecting them
        // first costs the memory to hold every one and a spread wide enough to blow the stack.
        function* place(rest, used) {
          if (!rest.length) { yield used; return; }
          for (const c of spots) {
            if (used.some(u => key(u[1]) === key(c))) continue;
            yield* place(rest.slice(1), [...used, [rest[0], c]]);
          }
        }
        for (const arrangement of place(pieces, [])) {
          const grid = Array.from({ length: h }, (_, y) =>
            Array.from({ length: w }, (_, x) => (isWall(x, y) ? '#' : '-')));
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
