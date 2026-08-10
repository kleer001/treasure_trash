import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hFamily, judge, draw, canals, puddles, isBarrier } from '../tools/shapes.mjs';
import { largestOpenBlock, floorIsConnected, floorComponents, hasNiche } from '../tools/metrics.mjs';
import { placeOn } from '../tools/harvest.mjs';
import { toState } from '../src/format.js';
import { mulberry32 } from '../src/rng.js';

const FAM = hFamily();

test('the family is not empty and every member is an H of one orientation or the other', () => {
  assert.ok(FAM.length > 20, `only ${FAM.length} variants`);
  for (const v of FAM) assert.ok(v.kind === 'H' || v.kind === 'H-rot', v.kind);
  assert.ok(FAM.some(v => v.kind === 'H') && FAM.some(v => v.kind === 'H-rot'),
    'both orientations should be represented');
});

// The rule the whole family exists to satisfy. A large clear rectangle is what makes a state
// space bushy and shallow, and it is why L and U were not used.
test('no variant contains a clear rectangle big enough to flatten the search', () => {
  for (const v of FAM) {
    const isFloor = (x, y) => x >= 0 && y >= 0 && x < v.w && y < v.h && !v.wall[y][x];
    const b = largestOpenBlock(isFloor, v.w, v.h);
    assert.ok(!(Math.min(b.w, b.h) >= 3 && b.area >= 12),
      `${v.label} has a ${b.w}x${b.h} open block`);
  }
});

test('every variant is one connected room with no three-sided niches', () => {
  for (const v of FAM) {
    const isFloor = (x, y) => x >= 0 && y >= 0 && x < v.w && y < v.h && !v.wall[y][x];
    assert.ok(floorIsConnected(isFloor, v.w, v.h), `${v.label} is two rooms`);
    assert.ok(!hasNiche(isFloor, v.w, v.h), `${v.label} has a niche`);
  }
});

test('every variant has floor enough for four pieces and a walk', () => {
  for (const v of FAM) assert.ok(v.floor.length >= 16, `${v.label} has ${v.floor.length} floor`);
});

// A consequence of the open-block rule worth pinning: it forces the waist narrow. Anything
// wider would be a clear rectangle again, and rooms designed on these have to expect it.
test('the crossbar or neck is never wider than two cells', () => {
  for (const v of FAM) {
    const isFloor = (x, y) => x >= 0 && y >= 0 && x < v.w && y < v.h && !v.wall[y][x];
    const b = largestOpenBlock(isFloor, v.w, v.h);
    assert.ok(Math.min(b.w, b.h) <= 2, `${v.label} widest clear run is ${b.w}x${b.h}`);
  }
});

test('a variant claiming symmetry actually is symmetric', () => {
  for (const v of FAM.filter(x => x.sym)) {
    const rows = draw(v);
    if (v.kind === 'H') {
      for (const row of rows)
        assert.equal(row, [...row].reverse().join(''), `${v.label} is not left-right symmetric`);
    } else {
      assert.deepEqual(rows, [...rows].reverse(), `${v.label} is not top-bottom symmetric`);
    }
  }
  assert.ok(FAM.some(v => v.sym), 'the family should contain symmetric variants');
});

test('a variant drawn as a grid reads back as a legal board', () => {
  const v = FAM[0];
  const rows = draw(v);
  // Drop a raccoon and an exit on the first two floor cells and the reader should accept it.
  const [[ax, ay], [bx, by]] = v.floor;
  const grid = rows.map((row, y) => [...row].map((ch, x) => {
    if (x === ax && y === ay) return '@';
    if (x === bx && y === by) return 'E';
    return ch;
  }).join(''));
  const s = toState({ id: 'shape', grid });
  assert.equal(s.cols, v.w);
  assert.equal(s.rows, v.h);
});

test('judge refuses a board that is one open hall — the L and U case', () => {
  const w = 6, h = 5;
  const wall = Array.from({ length: h }, () => Array.from({ length: w }, () => false));
  assert.equal(judge(wall, w, h).ok, false, 'a bare rectangle must not pass');
});

// --- water ------------------------------------------------------------------
const WET_PLANS = FAM.flatMap(canals);
const wetCells = p => {
  const out = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.water[y][x]) out.push([x, y]);
  return out;
};

test('the family carries canals, and some of them are barriers', () => {
  assert.ok(WET_PLANS.length > 100, `only ${WET_PLANS.length} canals`);
  assert.ok(WET_PLANS.some(p => isBarrier(p)), 'no canal severs into two usable banks');
  assert.ok(WET_PLANS.some(p => !p.severs), 'every canal severs — none merely narrows the walk');
});

test('a canal is one connected run, and never lies on a wall', () => {
  for (const p of WET_PLANS) {
    const cells = wetCells(p);
    assert.ok(cells.length >= 3, `${p.label} floods only ${cells.length}`);
    for (const [x, y] of cells) assert.ok(!p.wall[y][x], `${p.label} floods a wall at ${x},${y}`);
    const isWet = (x, y) => x >= 0 && y >= 0 && x < p.w && y < p.h && p.water[y][x];
    assert.ok(floorIsConnected(isWet, p.w, p.h), `${p.label} is two canals`);
  }
});

// The load-bearing safety property: `placeOn` draws every piece, the exit and the raccoon from
// `floor`, so narrowing it here is the only thing stopping a room opening with a can in the drink.
test('a watered plan offers only DRY cells as floor', () => {
  for (const p of WET_PLANS) {
    for (const [x, y] of p.floor)
      assert.ok(!p.water[y][x] && !p.wall[y][x], `${p.label} offers ${x},${y} and it is not dry`);
    assert.equal(p.floor.length + wetCells(p).length,
      p.wall.flat().filter(c => !c).length, `${p.label} lost cells between dry and wet`);
  }
});

test('severs and sides agree with a walk over the dry floor', () => {
  for (const p of WET_PLANS) {
    const isDry = (x, y) => x >= 0 && y >= 0 && x < p.w && y < p.h && !p.wall[y][x] && !p.water[y][x];
    assert.deepEqual(p.sides, floorComponents(isDry, p.w, p.h), p.label);
    assert.equal(p.severs, !floorIsConnected(isDry, p.w, p.h), p.label);
  }
});

// Severing is cheap — a canal laid along a wall cuts two cells off and reads as severing — so
// the barrier test has to ask how big the FAR bank is, not whether there are two of them.
test('isBarrier refuses a canal that only nicks a pocket off the room', () => {
  const nicked = WET_PLANS.find(p => p.severs && p.sides[1] < 6);
  assert.ok(nicked, 'expected at least one canal that severs a pocket');
  assert.equal(isBarrier(nicked), false, `${nicked.label} banks ${nicked.sides.join('/')}`);
  for (const p of WET_PLANS.filter(x => isBarrier(x))) {
    assert.equal(p.sides.length, 2, `${p.label} makes ${p.sides.length} banks`);
    assert.ok(p.sides[1] >= 6, `${p.label} far bank is ${p.sides[1]}`);
  }
});

test('a puddle field is water no two cells of which touch, and it never severs', () => {
  const rnd = mulberry32(11);
  let made = 0;
  for (const v of FAM.slice(0, 12)) {
    const p = puddles(v, 3, rnd);
    if (!p) continue;
    made++;
    const cells = wetCells(p);
    assert.equal(cells.length, 3, p.label);
    for (const [ax, ay] of cells) for (const [bx, by] of cells) {
      if (ax === bx && ay === by) continue;
      assert.ok(Math.abs(ax - bx) + Math.abs(ay - by) > 1,
        `${p.label} leaves ${ax},${ay} touching ${bx},${by}`);
    }
    assert.equal(p.severs, false, `${p.label} cut the walk in two`);
  }
  assert.ok(made >= 6, `only ${made} puddle fields drawn`);
});

test('a watered plan places and reads back as a board with a canal in it', () => {
  const rnd = mulberry32(3);
  const plan = WET_PLANS.find(p => isBarrier(p));
  const room = placeOn([...'$FCc'], plan, plan.w, plan.h, rnd);
  assert.ok(room, 'the draw failed');
  assert.ok(room.water, 'placeOn dropped the water mask');
  const s = toState(room);
  const wet = [];
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) if (s.cells[y][x].water) wet.push([x, y]);
  assert.deepEqual(wet, wetCells(plan), 'the board disagrees with the plan about where the water is');
  assert.equal(s.cells[s.rac.y][s.rac.x].water, false, 'the raccoon started in the drink');
  for (const [x, y] of wet) assert.equal(s.cells[y][x].exit, false, 'the exit is under water');
});

// The dry pipeline reads connectivity through this, so the two have to answer together.
test('floorIsConnected is floorComponents with one region', () => {
  for (const v of FAM) {
    const isFloor = (x, y) => x >= 0 && y >= 0 && x < v.w && y < v.h && !v.wall[y][x];
    assert.equal(floorIsConnected(isFloor, v.w, v.h),
      floorComponents(isFloor, v.w, v.h).length === 1, v.label);
  }
  const none = () => false;
  assert.deepEqual(floorComponents(none, 3, 3), []);
  assert.equal(floorIsConnected(none, 3, 3), false, 'no floor at all is not one room');
});
