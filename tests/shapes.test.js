import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hFamily, judge, draw } from '../tools/shapes.mjs';
import { largestOpenBlock, floorIsConnected, hasNiche } from '../tools/metrics.mjs';
import { toState } from '../src/format.js';

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
