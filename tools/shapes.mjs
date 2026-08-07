#!/usr/bin/env node
// Treasure Trash — outline families. A shape family is a room's silhouette, enumerated rather
// than drawn at random, so an act can be built on one.
//
//   node tools/shapes.mjs [h] [--all]     # draw the family
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

import { largestOpenBlock, floorIsConnected, hasNiche } from './metrics.mjs';

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

/** Every structural rule, applied to the empty room before anything stands in it. */
export function judge(wall, w, h) {
  const isFloor = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !wall[y][x];
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

export const FAMILIES = { h: hFamily };

/** The outline as the `.tt` grid would draw it, for eyeballing and for tests. */
export const draw = plan => plan.wall.map(r => r.map(c => (c ? '#' : '-')).join(''));

if (import.meta.url === `file://${process.argv[1]}`) {
  const name = process.argv.find(a => FAMILIES[a]) ?? 'h';
  const all = FAMILIES[name]();
  console.log(`${all.length} ${name.toUpperCase()} variants pass every structural rule`
    + ` (${all.filter(v => v.sym).length} symmetric)\n`);
  const show = process.argv.includes('--all') ? all
    : [...all.filter(v => v.sym), ...all.filter(v => !v.sym)].slice(0, 12);
  for (const v of show) {
    console.log(`${v.label}   floor ${v.floor.length}  largest open block ${v.block.w}x${v.block.h}`
      + (v.sym ? '  [symmetric]' : ''));
    console.log(draw(v).map(r => '    ' + r).join('\n'), '\n');
  }
}
