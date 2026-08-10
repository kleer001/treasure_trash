#!/usr/bin/env node
// Treasure Trash — outline families. A shape family is a room's silhouette, enumerated rather
// than drawn at random, so an act can be built on one.
//
//   node tools/shapes.mjs [h|ring|lake] [--all]              # draw the family
//   node tools/shapes.mjs [h|ring|lake] --water [--seed N]   # draw it wet: canals and puddle fields
//
// WHY A FAMILY AND NOT RANDOM WALLS. Sokoban sets are often organised around a formal device:
// Skinner's Sasquatch III is built on design symmetry, and his reason is mechanical rather
// than decorative — "each transformation often suggests different approaches to the solution."
// `harvest.mjs` draws walls at random, which conditions the search well but gives an act no
// identity. A family gives both.
//
// WHY H AND NOT L OR U. Every family here has to pass the same structural rules a random
// outline does, and the load-bearing one rejects a large clear rectangle: those make state
// spaces "very bushy, but not very deep" (Taylor & Parberry, GAMEON-NA 2011). An L is a
// rectangle minus a corner and a U is a rectangle minus a bite, so both leave a big open hall
// and fail at every size tried. H takes bites from two opposite edges, which leaves two
// chambers and a neck, and passes.
//
// A consequence worth knowing before designing rooms on these: every legal H has a TWO-cell
// crossbar or neck, because a wider one would be a clear rectangle again. Two rows is enough
// to walk and shove through but it constrains bursting, since a sideways tear needs a row
// above AND below the bag.
//
// WHY THE RING IS DEFINED BY MARGINS. One block in a rectangle is the obvious second family and
// the obvious version of it does not work: a fixed 2x2 block leaves a slab beside it that widens
// with the room, and past about 7x6 that slab IS the open hall. Sizing the block to leave a one
// or two cell margin instead keeps the lane narrow at every size, which is why the family is
// large where a centred square is a handful of lucky arithmetic.
//
// Most of the ring family is ASYMMETRIC, and that is the point: a one-cell squeeze down one side
// against a two-cell lane down the other is a different room from a symmetric ring. A one-cell
// margin is also a lane a shoved piece can never be got around — a commitment rather than a
// fault, and whether it is a fertile one is a question for the survey and not for this comment.

import { largestOpenBlock, floorIsConnected, floorComponents, hasNiche } from './metrics.mjs';
import { WET } from '../src/format.js';
import { fan } from '../src/rules.js';
import { mulberry32 } from '../src/rng.js';

// A clear rectangle at least this side and this area is what the family must not contain.
const OPEN_BLOCK_MIN_SIDE = 3;
const OPEN_BLOCK_MIN_AREA = 12;
const MIN_FLOOR = 16;                 // below this there is no room for four pieces and a walk

const blank = (w, h) => Array.from({ length: h }, () => Array.from({ length: w }, () => false));

/** Vertical legs, horizontal crossbar: bites out of the top and bottom edges. */
function upright(w, h, gapX0, gapW, topCut, botCut) {
  const wall = blank(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (x >= gapX0 && x < gapX0 + gapW && (y < topCut || y >= h - botCut)) wall[y][x] = true;
  return wall;
}

/** The same H turned on its side: horizontal legs, vertical neck. */
function rotated(w, h, gapY0, gapH, leftCut, rightCut) {
  const wall = blank(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (y >= gapY0 && y < gapY0 + gapH && (x < leftCut || x >= w - rightCut)) wall[y][x] = true;
  return wall;
}

/**
 * Every structural rule, applied to the empty room before anything stands in it.
 *
 * `water`, when given, is judged as NOT floor: the rules here are about where the raccoon may
 * walk and stand, and open water is neither. It is what lets terrain carry a room's structure
 * instead of walls.
 */
export function judge(wall, w, h, water = null) {
  const isFloor = (x, y) => x >= 0 && y >= 0 && x < w && y < h
    && !wall[y][x] && !(water && water[y][x]);
  const block = largestOpenBlock(isFloor, w, h);
  const floorCells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isFloor(x, y)) floorCells.push([x, y]);
  return {
    floor: floorCells,
    block,
    ok: floorCells.length >= MIN_FLOOR
      && !(Math.min(block.w, block.h) >= OPEN_BLOCK_MIN_SIDE && block.area >= OPEN_BLOCK_MIN_AREA)
      && floorIsConnected(isFloor, w, h)
      && !hasNiche(isFloor, w, h),
  };
}

const SIZES = [[7, 5], [8, 5], [9, 5], [10, 5], [8, 6], [9, 6], [10, 6], [11, 5], [11, 6]];

/**
 * The H family: every variant of both orientations that passes. Plans come out in the shape
 * `harvest.mjs`'s `outline()` returns — `{ wall, floor }` — so `placeOn` and everything
 * downstream take them unchanged.
 *
 * An ASYMMETRIC cut is a member of the family, not a defect. The variations are the point:
 * one leg deeper than the other is a different room with the same silhouette.
 */
export function hFamily() {
  const out = [];
  const add = (kind, w, h, wall, label, sym) => {
    const j = judge(wall, w, h);
    if (!j.ok) return;
    out.push({ kind, w, h, wall, floor: j.floor, block: j.block, sym, label: `${kind} ${label}` });
  };
  for (const [w, h] of SIZES) {
    for (let gapW = 2; gapW <= 4; gapW++)
      for (let gapX0 = 1; gapX0 + gapW <= w - 1; gapX0++)
        for (let topCut = 1; topCut <= 3; topCut++)
          for (let botCut = 1; botCut <= 3; botCut++) {
            if (h - topCut - botCut < 1) continue;
            add('H', w, h, upright(w, h, gapX0, gapW, topCut, botCut),
              `${w}x${h} gap@${gapX0}w${gapW} cut${topCut}/${botCut}`,
              gapX0 === w - gapX0 - gapW && topCut === botCut);
          }
    for (let gapH = 1; gapH <= 3; gapH++)
      for (let gapY0 = 1; gapY0 + gapH <= h - 1; gapY0++)
        for (let leftCut = 1; leftCut <= 3; leftCut++)
          for (let rightCut = 1; rightCut <= 3; rightCut++) {
            if (w - leftCut - rightCut < 1) continue;
            add('H-rot', w, h, rotated(w, h, gapY0, gapH, leftCut, rightCut),
              `${w}x${h} gap@${gapY0}h${gapH} cut${leftCut}/${rightCut}`,
              gapY0 === h - gapY0 - gapH && leftCut === rightCut);
          }
  }
  return out;
}

// Margins the lane may be, on each of the four sides. Two is enough to walk round a shoved
// piece; one is not, and both are members.
const MARGINS = [1, 2];
const RING_BLOCK_MIN = 2;             // a one-cell block is a pillar, and pillars make niches

// Room sizes the block families are enumerated over. Par tracks floor count and nothing else
// here — measured on a lake harvest, a room of 51+ floor cells runs a median par of 27 against
// 19 at 25-32 — while the state cap is nowhere near binding at any of these sizes. So the range
// is set by how long a solve an act wants, not by what the solver can afford.
const BLOCK_SIZES = [];
for (let h = 5; h <= 11; h++) for (let w = 6; w <= 14; w++) BLOCK_SIZES.push([w, h]);

/**
 * Every room-and-block pairing the two block families share. They are the SAME silhouettes, one
 * made of wall and one of water, and enumerating them in one place is what keeps that true
 * rather than coincidental.
 */
function* blockPlacements() {
  for (const [w, h] of BLOCK_SIZES)
    for (const l of MARGINS) for (const r of MARGINS)
      for (const t of MARGINS) for (const b of MARGINS) {
        const bw = w - l - r, bh = h - t - b;
        if (bw < RING_BLOCK_MIN || bh < RING_BLOCK_MIN) continue;
        yield { w, h, l, t, bw, bh, sym: l === r && t === b };
      }
}

const fill = (w, h, l, t, bw, bh) => {
  const m = blank(w, h);
  for (let y = t; y < t + bh; y++) for (let x = l; x < l + bw; x++) m[y][x] = true;
  return m;
};

/**
 * The ring family: one solid block in a rectangle, and the room is the lane around it.
 *
 * Enumerated over the four margins rather than over block positions, which is the same set of
 * rooms said the way that makes the bound obvious — see the header for why a fixed-size block
 * does not survive the open-block rule past about 7x6.
 */
export function ringFamily() {
  const out = [];
  for (const { w, h, l, t, bw, bh, sym } of blockPlacements()) {
    const wall = fill(w, h, l, t, bw, bh);
    const j = judge(wall, w, h);
    if (!j.ok) continue;
    out.push({
      kind: 'ring', w, h, wall, floor: j.floor, block: j.block, sym,
      label: `ring ${w}x${h} block${bw}x${bh}@${l},${t}`,
    });
  }
  return out;
}

/**
 * The lake family: the ring's silhouette with the block made of WATER instead of wall.
 *
 * The two are the same shape and opposite mechanics, and the difference is one line of the rules
 * — `isOccupiable`, which `fanBlockers` tests, refuses a wall and accepts water. So a tear aimed
 * at a wall block is refused, and the very same tear aimed at a lake lands in it and turns three
 * cells to bridge. A ring's lane cannot host the game's core verb; a lake's lane is built for it.
 *
 * That makes the water a SHORTCUT rather than a barrier: the lane always goes round, and a bag
 * spent on the pool buys a way through the middle. The same tear on dry floor lays five cells of
 * permanent trash instead, so where to spend one is the room's question rather than whether to.
 *
 * No walls at all. The pool does the structural work the ring's block was doing, which is the
 * whole claim being made, and `judge` checks it on the dry floor the same way.
 */
export function lakeFamily() {
  const out = [];
  for (const { w, h, l, t, bw, bh, sym } of blockPlacements()) {
    const wall = blank(w, h);
    const water = fill(w, h, l, t, bw, bh);
    const j = judge(wall, w, h, water);
    if (!j.ok) continue;
    out.push({
      kind: 'lake', w, h, wall, water, floor: j.floor, block: j.block,
      wet: bw * bh, sides: [j.floor.length], severs: false, sym,
      label: `lake ${w}x${h} pool${bw}x${bh}@${l},${t}`,
    });
  }
  return out;
}

export const FAMILIES = { h: hFamily, ring: ringFamily, lake: lakeFamily };

// ---------------------------------------------------------------- water
// Terrain is laid ON an outline rather than being part of one, and that split decides which
// rules get re-asked. The structural tests above run over floor AND water, because a water
// cell is floor the moment something bridges it — so a plan that passed them still passes
// them, and none of it is recomputed here. What water changes is where the raccoon may STAND,
// which is a different question and gets the two rules below instead.
//
// A CANAL is one connected run of water; a PUDDLE FIELD is water cells no two of which touch.
// The distinction is not decorative. Only a canal can cut the dry floor in two, and that is the
// one thing terrain can do that walls cannot: a wall that severs a room is a broken room, while
// a canal that severs one is a room with a crossing to build.

const CANAL_MIN = 3;        // shorter than this is a puddle field wearing a canal's name
const MIN_DRY_FLOOR = 14;   // pieces, a raccoon and an exit all want somewhere dry to start
const MIN_BANK = 6;         // a bank smaller than this is a pocket, and crossing to it is a chore

/**
 * `plan` with `cells` under water. Null when the result is not worth drawing on.
 *
 * `floor` narrows to the DRY cells, which is what makes this safe downstream: `placeOn` draws
 * the exit, the raccoon and every piece from `floor` alone, so nothing starts in the canal
 * without that rule being written anywhere but here.
 */
function flood(plan, cells, label) {
  const { w, h, wall } = plan;
  const water = blank(w, h);
  for (const [x, y] of cells) {
    if (wall[y][x]) return null;
    water[y][x] = true;
  }
  const isDry = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !wall[y][x] && !water[y][x];
  const dry = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isDry(x, y)) dry.push([x, y]);
  if (dry.length < MIN_DRY_FLOOR) return null;
  // `sides` is what tells a barrier from a nick in a corner. Severing is cheap — a canal laid
  // along a wall cuts two cells off and reads as severing — so the number a consumer wants is
  // how big the SMALLER bank is, not whether there are two of them.
  const sides = floorComponents(isDry, w, h);
  return {
    ...plan, water, floor: dry, wet: cells.length, sides,
    severs: sides.length > 1,
    label: `${plan.label} ${label}`,
  };
}

/** A canal worth building a crossing over: it severs, and the far bank is a room rather than a
 *  pocket. `min` is the smallest that bank may be. */
export const isBarrier = (plan, min = MIN_BANK) =>
  plan.severs && plan.sides.length === 2 && plan.sides[1] >= min;

// Both of the answers below are properties of a PLAN and nothing else, and a discovery run asks
// the same plan for them thousands of times — each a flood fill, `bridgeSeats` one per floor cell
// per direction. Keyed on the plan object, so a plan that goes out of scope takes its entry with it.
const BANKS = new WeakMap();
const SEATS = new WeakMap();

/** Which bank each dry cell sits on, as `"x,y" -> id`. Ids follow raster order of first sight. */
export function bankOf(plan) {
  const hit = BANKS.get(plan);
  if (hit) return hit;
  const { w, h, wall, water } = plan;
  const id = new Map();
  let n = 0;
  for (let y0 = 0; y0 < h; y0++) for (let x0 = 0; x0 < w; x0++) {
    const k0 = `${x0},${y0}`;
    if (wall[y0][x0] || water[y0][x0] || id.has(k0)) continue;
    id.set(k0, n);
    const stack = [[x0, y0]];
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (wall[ny][nx] || water[ny][nx]) continue;
        const k = `${nx},${ny}`;
        if (id.has(k)) continue;
        id.set(k, n); stack.push([nx, ny]);
      }
    }
    n++;
  }
  BANKS.set(plan, id);
  return id;
}

/**
 * Every seat a bridging tear could be made from: a dry cell to stand a bag on and the direction
 * to shove it, such that the fan lands in the canal and JOINS THE TWO BANKS. `fan` comes back
 * so placement can keep the exit and every other piece off those five cells.
 *
 * Random placement finds these at about one draw in two thousand, which is the whole reason
 * this exists: the bag has to sit in the row beside the water with its fan pointing across, and
 * uniform sampling almost never does that.
 *
 * Clear-at-the-start is SUFFICIENT for the tear to be legal, not necessary. A room where the
 * player must first shove something out of the fan is one this pass declines to find, and that
 * is the trade for finding any at all.
 */
export function bridgeSeats(plan) {
  const hit = SEATS.get(plan);
  if (hit) return hit;
  if (!plan.severs) return [];
  const { w, h, wall, water } = plan;
  const inGrid = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const bank = bankOf(plan);
  const out = [];
  for (const [bx, by] of plan.floor) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      // The raccoon has to have somewhere to shove FROM, and it has to be his own bank.
      const [hx, hy] = [bx - dx, by - dy];
      if (!inGrid(hx, hy) || wall[hy][hx] || water[hy][hx]) continue;
      const cells = fan(bx, by, dx, dy);
      if (!cells.every(([x, y]) => inGrid(x, y) && !wall[y][x])) continue;
      const wet = cells.filter(([x, y]) => water[y][x]);
      if (!wet.length) continue;
      // Laying trash on exactly these cells is what the tear does. If that does not join the
      // banks it is a splash, not a crossing.
      const filled = new Set(wet.map(([x, y]) => `${x},${y}`));
      const joined = (x, y) =>
        inGrid(x, y) && !wall[y][x] && (!water[y][x] || filled.has(`${x},${y}`));
      if (!floorIsConnected(joined, w, h)) continue;
      out.push({ at: [bx, by], dir: [dx, dy], fan: cells, near: bank.get(`${bx},${by}`) });
    }
  }
  SEATS.set(plan, out);
  return out;
}

/**
 * Every straight canal on a plan: each contiguous run of `CANAL_MIN` cells or more along a
 * wall-free row or column. Enumerated rather than sampled, for the reason the families are —
 * a canal is part of the silhouette an act is built on, and a run is three numbers.
 *
 * A line carrying a wall is not offered at all: the wall would break the run into two canals,
 * and two runs is a puddle field by the definition above.
 */
export function canals(plan) {
  const { w, h, wall } = plan;
  const lines = [];
  for (let y = 0; y < h; y++) lines.push({ axis: 'h', cells: Array.from({ length: w }, (_, x) => [x, y]) });
  for (let x = 0; x < w; x++) lines.push({ axis: 'v', cells: Array.from({ length: h }, (_, y) => [x, y]) });
  const out = [];
  for (const { axis, cells } of lines) {
    if (cells.some(([x, y]) => wall[y][x])) continue;
    for (let i = 0; i + CANAL_MIN <= cells.length; i++)
      for (let len = CANAL_MIN; i + len <= cells.length; len++) {
        const [x0, y0] = cells[i];
        const p = flood(plan, cells.slice(i, i + len), `canal ${axis}${x0},${y0}+${len}`);
        if (p) out.push(p);
      }
  }
  return out;
}

/**
 * A field of `n` puddles: single water cells, no two of them touching. Sampled rather than
 * enumerated — the choose-n space dwarfs the canal's, and unlike a run, nothing about where one
 * puddle sits is structural. `place()` in survey.mjs samples for the same reason.
 *
 * Null when `tries` draws all failed.
 */
export function puddles(plan, n, rnd, tries = 40) {
  for (let t = 0; t < tries; t++) {
    const cells = [];
    for (let k = 0; k < n; k++) {
      // Manhattan 1 is exactly the neighbourhood `floorIsConnected` walks, so two puddles left
      // touching would read as one short canal. Diagonals are free.
      const open = plan.floor.filter(([x, y]) =>
        cells.every(([cx, cy]) => Math.abs(cx - x) + Math.abs(cy - y) > 1));
      if (!open.length) break;
      cells.push(open[Math.floor(rnd() * open.length)]);
    }
    if (cells.length < n) continue;
    const p = flood(plan, cells, `puddles ${n}`);
    // A puddle field that cuts the walk in two is a canal drawn wrong, whatever it looks like.
    if (p && !p.severs) return p;
  }
  return null;
}

/** The outline as the `.tt` grid would draw it, for eyeballing and for tests. */
export const draw = plan => plan.wall.map((row, y) =>
  row.map((c, x) => (c ? '#' : plan.water?.[y][x] ? WET : '-')).join(''));

if (import.meta.url === `file://${process.argv[1]}`) {
  const name = process.argv.find(a => FAMILIES[a]) ?? 'h';
  const all = FAMILIES[name]();
  const line = v => `${v.label}   floor ${v.floor.length}`
    + `  largest open block ${v.block.w}x${v.block.h}`
    + (v.sym ? '  [symmetric]' : '') + (v.sides ? `  banks ${v.sides.join('/')}` : '');
  const show = v => console.log(line(v), '\n' + draw(v).map(r => '    ' + r).join('\n'), '\n');

  if (process.argv.includes('--water')) {
    const i = process.argv.indexOf('--seed');
    const rnd = mulberry32(i === -1 ? 7 : Number(process.argv[i + 1]));
    const wet = all.flatMap(canals);
    const cut = wet.filter(v => isBarrier(v));
    console.log(`${all.length} dry ${name.toUpperCase()} variants carry ${wet.length} canals.`
      + ` ${wet.filter(v => v.severs).length} sever the dry floor;`
      + ` ${cut.length} sever it into two banks of ${MIN_BANK}+\n`);
    console.log('— barriers: two banks, and a crossing to build —\n');
    for (const v of cut.slice(0, 4)) show(v);
    console.log('— canals that only narrow the walk —\n');
    for (const v of wet.filter(v => !v.severs).slice(0, 2)) show(v);
    console.log('— puddle fields —\n');
    for (const v of all.slice(0, 3)) {
      const p = puddles(v, 3, rnd);
      if (p) show(p);
    }
  } else {
    console.log(`${all.length} ${name.toUpperCase()} variants pass every structural rule`
      + ` (${all.filter(v => v.sym).length} symmetric)\n`);
    const pick = process.argv.includes('--all') ? all
      : [...all.filter(v => v.sym), ...all.filter(v => !v.sym)].slice(0, 12);
    for (const v of pick) show(v);
  }
}
