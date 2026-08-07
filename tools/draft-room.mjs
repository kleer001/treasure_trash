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
import { bagsLeft, fan } from '../src/rules.js';

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

// --- geometry-first search ------------------------------------------------------------------
// `rooms()` walks every placement, which is fine at 5x3 and hopeless at 8x8. Three reductions
// make the bigger shapes searchable without a faster search:
//
//   symmetry      one board per orbit of the group that preserves the rectangle
//   tearability   a bag no approach can open, whatever else is on the board, is never openable
//   spanning      a config that survives deleting a border row or column is a padded copy of
//                 the smaller room, and that room's own sweep already covers it
//
// The raccoon is enumerated last because it never blocks a fan, so it barely decides whether a
// room can be won at all — `huntGeometry` screens geometries with one start and only sweeps the
// rest across survivors.
//
// `countSpanning` is the same filtered space in closed form, BEFORE the orbit reduction. It
// stops there because configs fixed by a symmetry make dividing by the group size wrong, and
// counting those exactly costs more than the generator it would be checking.

const DIRS_XY = [[-1, 0], [0, -1], [1, 0], [0, 1]];

/**
 * Could a bag here ever be torn, judging only by the board edges and the exit? Other pieces are
 * ignored, so this is a relaxation: it rejects only bags no arrangement could ever open.
 *
 * A direction costs two things — somewhere to shove the bag INTO, and somewhere to shove it
 * FROM. The second is the one that is easy to forget, and it is what confines bags to the
 * interior.
 */
export const tearableCell = (w, h, [ex, ey], x, y) => {
  const on = (px, py) => px >= 0 && py >= 0 && px < w && py < h;
  return DIRS_XY.some(([dx, dy]) =>
    on(x - dx, y - dy) &&
    fan(x, y, dx, dy).every(([fx, fy]) => on(fx, fy) && !(fx === ex && fy === ey)));
};

/** The maps carrying a w x h rectangle onto itself — eight of them when it is square. */
export function symmetries(w, h) {
  const g = [
    ([x, y]) => [x, y],
    ([x, y]) => [w - 1 - x, y],
    ([x, y]) => [x, h - 1 - y],
    ([x, y]) => [w - 1 - x, h - 1 - y],
  ];
  if (w === h) g.push(
    ([x, y]) => [y, x],
    ([x, y]) => [h - 1 - y, x],
    ([x, y]) => [y, w - 1 - x],
    ([x, y]) => [h - 1 - y, w - 1 - x],
  );
  return g;
}

// Bags are interchangeable, so a geometry is its exit plus a SET of cells; sorting the indices
// is what makes two spellings of the same set compare equal.
const encode = (w, exit, bags) =>
  `${exit[1] * w + exit[0]}:${bags.map(([x, y]) => y * w + x).sort((a, b) => a - b).join(',')}`;

const isCanonical = (w, h, exit, bags, group) => {
  const mine = encode(w, exit, bags);
  for (const g of group) if (encode(w, g(exit), bags.map(g)) < mine) return false;
  return true;
};

/**
 * One geometry per symmetry orbit: an exit and `bags` bag cells, every bag tearable, together
 * spanning the whole board. No raccoon — `huntGeometry` places that.
 */
// A side is "held" when deleting that border row or column would change the room: the exit
// sits on it, or a bag sits on the line that deletion would strand on the new border.
const SPAN = 0b1111;
const exitMask = (w, h, x, y) =>
  (x === 0 ? 1 : 0) | (x === w - 1 ? 2 : 0) | (y === 0 ? 4 : 0) | (y === h - 1 ? 8 : 0);
const bagMask = (w, h, x, y) =>
  (x === 1 ? 1 : 0) | (x === w - 2 ? 2 : 0) | (y === 1 ? 4 : 0) | (y === h - 2 ? 8 : 0);

const liveCells = (w, h, exit) => {
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (!(x === exit[0] && y === exit[1]) && tearableCell(w, h, exit, x, y)) out.push([x, y]);
  return out;
};

export function* geometries({ w, h, bags: k }) {
  const group = symmetries(w, h);

  for (let ey = 0; ey < h; ey++) for (let ex = 0; ex < w; ex++) {
    const exit = [ex, ey];
    const live = liveCells(w, h, exit);

    // Suffix union of the sides still reachable, so a branch that can no longer span dies early
    // instead of running to the bottom of the recursion.
    const suffix = new Array(live.length + 1).fill(0);
    for (let i = live.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] | bagMask(w, h, ...live[i]);

    const chosen = [];
    const walk = function* (start, seen) {
      if (chosen.length === k) {
        if (seen === SPAN && isCanonical(w, h, exit, chosen, group))
          yield { exit, bags: chosen.map(c => [...c]) };
        return;
      }
      const need = k - chosen.length;
      for (let i = start; i <= live.length - need; i++) {
        if ((seen | suffix[i]) !== SPAN) break;
        chosen.push(live[i]);
        yield* walk(i + 1, seen | bagMask(w, h, ...live[i]));
        chosen.pop();
      }
    };
    yield* walk(0, exitMask(w, h, ex, ey));
  }
}

const choose = (n, k) => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
  return Math.round(r);
};

/**
 * How many exit-and-bags configs clear the tearability and spanning filters, counted rather
 * than generated: inclusion-exclusion over the four sides the config has to touch. Symmetric
 * duplicates are still in this number — it is what `geometries` reduces, not what it yields.
 */
export function countSpanning(w, h, k) {
  let total = 0;
  for (let ey = 0; ey < h; ey++) for (let ex = 0; ex < w; ex++) {
    const exit = [ex, ey], live = liveCells(w, h, exit);
    const em = exitMask(w, h, ex, ey);
    // Inclusion-exclusion over the sides left unheld: the exit must miss every one of them,
    // and so must every bag.
    for (let s = 0; s <= SPAN; s++) {
      if (em & s) continue;
      const pool = live.filter(([x, y]) => !(bagMask(w, h, x, y) & s)).length;
      const parity = (s & 1) + ((s >> 1) & 1) + ((s >> 2) & 1) + ((s >> 3) & 1);
      total += (-1) ** parity * choose(pool, k);
    }
  }
  return total;
}

/** A geometry plus a raccoon, written as a grid the reader accepts. */
export function roomOf(w, h, { exit, bags }, rac, glyph = '$') {
  const grid = Array.from({ length: h }, () => Array(w).fill('-'));
  for (const [x, y] of bags) grid[y][x] = glyph;
  grid[exit[1]][exit[0]] = 'E';
  grid[rac[1]][rac[0]] = (rac[0] === exit[0] && rac[1] === exit[1]) ? '+' : '@';
  return grid.map(r => r.join(''));
}

/**
 * Sweep a shape geometry-first. Every geometry is screened with a single raccoon start, and
 * only the ones that survive pay for the other starts.
 *
 * The screen is a filter, not a proof: a geometry winnable from some other start can be dropped
 * when the screening start happens to lose it. `screen: false` buys back that tail at full price.
 */
export function huntGeometry({ w, h, bags: k, glyph = '$', screen = true }, want, limit = 12) {
  const hits = [];
  let geoSeen = 0, screened = 0, drafted = 0;

  for (const geo of geometries({ w, h, bags: k })) {
    geoSeen++;
    const taken = new Set([geo.exit, ...geo.bags].map(([x, y]) => `${x},${y}`));
    const spots = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      if (!taken.has(`${x},${y}`)) spots.push([x, y]);

    if (screen) {
      drafted++;
      if (analyze(toState({ id: 'screen', grid: roomOf(w, h, geo, spots[0], glyph) })).minMoves === null)
        continue;
      screened++;
    }
    for (const rac of spots) {
      const grid = roomOf(w, h, geo, rac, glyph);
      drafted++;
      const d = draft({ id: 'draft', grid });
      if (!d.ok || !want(d)) continue;
      hits.push({ grid, ...d });
      if (hits.length >= limit) return { hits, geoSeen, screened, drafted };
    }
  }
  return { hits, geoSeen, screened, drafted };
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
