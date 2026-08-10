import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hFamily, ringFamily, lakeFamily, FAMILIES, judge, draw, canals, puddles, isBarrier, bridgeSeats,
  bankOf,
} from '../tools/shapes.mjs';
import { largestOpenBlock, floorIsConnected, floorComponents, hasNiche } from '../tools/metrics.mjs';
import { placeOn } from '../tools/harvest.mjs';
import { toState } from '../src/format.js';
import { analyze } from '../src/solver.js';
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

// --- the ring family --------------------------------------------------------
const RING = ringFamily();

test('the ring family is large, and mostly asymmetric', () => {
  assert.ok(RING.length > 200, `only ${RING.length} ring variants`);
  // The reason the family exists at this size: a centred square is a handful of lucky
  // arithmetic, and everything else in it is off-centre.
  assert.ok(RING.filter(v => !v.sym).length > RING.filter(v => v.sym).length,
    'the family should be mostly asymmetric');
  assert.ok(RING.some(v => v.sym), 'symmetric rings are members too');
});

test('every ring passes the same structural rules the H family does', () => {
  for (const v of RING) {
    const isFloor = (x, y) => x >= 0 && y >= 0 && x < v.w && y < v.h && !v.wall[y][x];
    const b = largestOpenBlock(isFloor, v.w, v.h);
    assert.ok(!(Math.min(b.w, b.h) >= 3 && b.area >= 12), `${v.label} has a ${b.w}x${b.h} block`);
    assert.ok(floorIsConnected(isFloor, v.w, v.h), `${v.label} is two rooms`);
    assert.ok(!hasNiche(isFloor, v.w, v.h), `${v.label} has a niche`);
    assert.ok(v.floor.length >= 16, `${v.label} has ${v.floor.length} floor`);
  }
});

// One block, not two, and a lane all the way round it — that is what makes it a ring rather
// than a rectangle with a bite out of it.
test('every ring is one solid block with a lane on all four sides', () => {
  for (const v of RING) {
    const wallCells = [];
    for (let y = 0; y < v.h; y++) for (let x = 0; x < v.w; x++) if (v.wall[y][x]) wallCells.push([x, y]);
    const xs = wallCells.map(c => c[0]), ys = wallCells.map(c => c[1]);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    assert.equal(wallCells.length, (x1 - x0 + 1) * (y1 - y0 + 1), `${v.label} is not one rectangle`);
    assert.ok(x0 >= 1 && y0 >= 1 && x1 <= v.w - 2 && y1 <= v.h - 2,
      `${v.label} touches the frame — that is a bite, not a ring`);
    for (const m of [x0, y0, v.w - 1 - x1, v.h - 1 - y1])
      assert.ok(m === 1 || m === 2, `${v.label} has a ${m}-cell margin`);
  }
});

test('every family is registered and answers to its CLI name', () => {
  assert.deepEqual(Object.keys(FAMILIES).sort(), ['h', 'lake', 'ring']);
  assert.equal(FAMILIES.ring().length, RING.length);
  assert.equal(FAMILIES.h().length, FAM.length);
  assert.equal(FAMILIES.lake().length, lakeFamily().length);
});

// --- the lake family --------------------------------------------------------
const LAKE = lakeFamily();

test('the lake family matches the ring silhouette for silhouette', () => {
  assert.equal(LAKE.length, RING.length);
  for (const v of LAKE) {
    assert.ok(v.floor.length >= 16, `${v.label} has ${v.floor.length} floor`);
    for (const [x, y] of v.floor) assert.ok(!v.water[y][x], `${v.label} offers a wet cell as floor`);
    assert.ok(!v.wall.flat().some(Boolean), `${v.label} has walls — the pool should be the structure`);
    // The lane always goes round, so a lake is never a barrier. It is a shortcut you may build.
    assert.equal(v.severs, false, `${v.label} severs`);
  }
});

test('a lake passes the open-block rule on its DRY floor', () => {
  for (const v of LAKE) {
    const isDry = (x, y) => x >= 0 && y >= 0 && x < v.w && y < v.h && !v.water[y][x];
    const b = largestOpenBlock(isDry, v.w, v.h);
    assert.ok(!(Math.min(b.w, b.h) >= 3 && b.area >= 12), `${v.label} has a ${b.w}x${b.h} dry block`);
    assert.ok(floorIsConnected(isDry, v.w, v.h), `${v.label} is two rooms`);
  }
});

// The whole reason the family exists. `isOccupiable` — which `fanBlockers` tests — refuses a
// wall and accepts water, so the tear a ring's block would refuse lands in a lake and bridges it.
// A ring and a lake of the same silhouette must therefore answer this differently.
test('a bag beside a pool tears into it, and the same bag beside a block cannot', async () => {
  const { explain, BAG } = await import('../src/rules.js');
  const lake = LAKE.find(v => v.label === 'lake 7x6 pool3x2@2,2');
  const ring = RING.find(v => v.label === 'ring 7x6 block3x2@2,2');
  assert.ok(lake && ring, 'the paired silhouette is missing');

  const board = (v, wet) => {
    const grid = Array.from({ length: v.h }, (_, y) =>
      Array.from({ length: v.w }, (_, x) => (v.wall[y][x] ? '#' : '-')));
    grid[4][2] = '$'; grid[5][2] = '@'; grid[5][v.w - 1] = 'E';
    const room = { id: v.kind, grid: grid.map(r => r.join('')) };
    if (wet) room.water = v.water.map(r => r.map(c => (c ? '~' : '-')).join(''));
    return toState(room);
  };

  const wet = explain(board(lake, true), 'u');
  assert.equal(wet.ok, true, `the lake refused the tear: ${wet.reason}`);
  assert.equal(wet.kind, 'tear');
  assert.ok(wet.next.cells.flat().some(c => c.bridge), 'the tear laid no bridge');
  assert.ok(wet.next.cells.flat().filter(c => c.water).length
    < board(lake, true).cells.flat().filter(c => c.water).length, 'the pool did not shrink');

  const dryRing = explain(board(ring, false), 'u');
  assert.equal(dryRing.ok, false, 'the block should refuse a fan aimed into it');
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

// --- bridging ---------------------------------------------------------------
const BARRIERS = WET_PLANS.filter(p => isBarrier(p));

test('a barrier canal offers seats, and every seat really does join the banks', () => {
  const seated = BARRIERS.filter(p => bridgeSeats(p).length);
  assert.ok(seated.length > 20, `only ${seated.length} barriers have a seat`);
  for (const p of seated.slice(0, 60)) {
    for (const seat of bridgeSeats(p)) {
      const filled = new Set(seat.fan.filter(([x, y]) => p.water[y][x]).map(([x, y]) => `${x},${y}`));
      assert.ok(filled.size, `${p.label} seat lays no trash in the canal`);
      const joined = (x, y) => x >= 0 && y >= 0 && x < p.w && y < p.h
        && !p.wall[y][x] && (!p.water[y][x] || filled.has(`${x},${y}`));
      assert.ok(floorIsConnected(joined, p.w, p.h),
        `${p.label} seat at ${seat.at} does not join the banks`);
      assert.ok(!p.water[seat.at[1]][seat.at[0]], 'the bag seat is under water');
    }
  }
});

test('a dry plan has no bridge seats', () => {
  for (const v of FAM.slice(0, 10)) assert.deepEqual(bridgeSeats({ ...v, severs: false }), []);
});

test('an across draw strands the exit and reserves the fan', () => {
  const rnd = mulberry32(5);
  let made = 0;
  for (const p of BARRIERS.slice(0, 400)) {
    const room = placeOn([...'$FCc'], p, p.w, p.h, rnd, { across: true });
    if (!room) continue;
    made++;
    const s = toState(room);
    const bank = bankOf(p);
    let ex = null;
    for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) if (s.cells[y][x].exit) ex = [x, y];
    assert.notEqual(bank.get(`${ex[0]},${ex[1]}`), bank.get(`${s.rac.x},${s.rac.y}`),
      `${p.label} put the exit on the raccoon's own bank`);
  }
  assert.ok(made > 100, `only ${made} across draws succeeded`);
});

// The point of the whole pass: the room cannot be finished without tearing a bag into the water.
test('an across draw yields rooms that solve by bridging', () => {
  const rnd = mulberry32(2);
  let solved = 0;
  for (const p of BARRIERS.slice(0, 250)) {
    const room = placeOn([...'$$Fc'], p, p.w, p.h, rnd, { across: true });
    if (!room) continue;
    let a;
    try { a = analyze(toState(room), { maxStates: 20_000 }); } catch { continue; }
    if (a.minMoves !== null) solved++;
  }
  assert.ok(solved > 0, 'no across draw produced a solvable room');
});

test('across refuses a group with no loose bag to bridge with', () => {
  const p = BARRIERS[0];
  assert.throws(() => placeOn([...'CcwF'], p, p.w, p.h, mulberry32(1), { across: true }),
    /loose bag/);
});

// A stored row is only worth storing if it rebuilds into the room it measured. Terrain is a
// separate mask from the grid, so a row that keeps only the grid has silently lost the canal.
test('a measured row carries every mask the room was built from', async () => {
  const { measure } = await import('../tools/harvest.mjs');
  const rnd = mulberry32(9);
  let room, s, a;
  for (const p of BARRIERS.slice(0, 400)) {
    const r = placeOn([...'$$Fc'], p, p.w, p.h, rnd, { across: true });
    if (!r) continue;
    const st = toState(r);
    let an;
    try { an = analyze(st, { maxStates: 20_000 }); } catch { continue; }
    if (an.minMoves === null) continue;
    room = r; s = st; a = an;
    break;
  }
  assert.ok(room?.water, 'no solvable watered room was drawn');
  const row = measure('$$Fc', room, s, a, s.cols, s.rows);
  assert.deepEqual(row.water, room.water, 'the row lost the water mask');
  assert.deepEqual(toState({ id: 'rebuilt', grid: row.grid, water: row.water }).cells
    .flat().map(c => !!c.water), s.cells.flat().map(c => !!c.water));
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
