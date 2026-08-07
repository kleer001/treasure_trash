// The geometry-first sweep in tools/draft-room.mjs trades a smaller candidate list for the
// claim that nothing worth searching was dropped. These pin that claim on boards small enough
// to enumerate outright: every config the filters accept is reachable from exactly one yielded
// geometry, and no two yielded geometries are the same room seen from a different corner.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  geometries, countSpanning, symmetries, tearableCell, roomOf,
} from '../tools/draft-room.mjs';
import { toState } from '../src/format.js';
import { explain, cell, BAG, TRASH } from '../src/rules.js';

const SHAPES = [
  { w: 4, h: 4, k: 2 }, { w: 5, h: 4, k: 2 }, { w: 5, h: 5, k: 2 },
  { w: 4, h: 5, k: 3 }, { w: 5, h: 5, k: 3 }, { w: 6, h: 5, k: 2 },
  { w: 4, h: 4, k: 3 }, { w: 6, h: 6, k: 3 }, { w: 7, h: 5, k: 3 },
];

const key = (w, exit, bags) =>
  `${exit[1] * w + exit[0]}:${bags.map(([x, y]) => y * w + x).sort((a, b) => a - b).join(',')}`;

/**
 * Would deleting this border line leave the very same room on a board one smaller? Derived by
 * re-asking `tearableCell` on the shrunken board rather than by repeating the generator's
 * arithmetic, so the two have to agree the hard way.
 */
function deletable(w, h, exit, bags, side) {
  const [sw, sh] = side < 2 ? [w - 1, h] : [w, h - 1];
  if (sw < 1 || sh < 1) return false;
  const onLine = ([x, y]) =>
    side === 0 ? x === 0 : side === 1 ? x === w - 1 : side === 2 ? y === 0 : y === h - 1;
  if ([exit, ...bags].some(onLine)) return false;
  const shift = ([x, y]) => [x - (side === 0 ? 1 : 0), y - (side === 2 ? 1 : 0)];
  const e2 = shift(exit);
  return bags.every(b => tearableCell(sw, sh, e2, ...shift(b)));
}

const holdsEverySide = (w, h, exit, bags) =>
  [0, 1, 2, 3].every(s => !deletable(w, h, exit, bags, s));

/** Every config passing the filters, by direct enumeration — no symmetry reduction. */
function allSpanning({ w, h, k }) {
  const cells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([x, y]);
  const out = [];
  for (const exit of cells) {
    const live = cells.filter(([x, y]) =>
      !(x === exit[0] && y === exit[1]) && tearableCell(w, h, exit, x, y));
    const pick = (start, chosen) => {
      if (chosen.length === k) {
        if (holdsEverySide(w, h, exit, chosen)) out.push({ exit, bags: chosen.map(c => [...c]) });
        return;
      }
      for (let i = start; i <= live.length - (k - chosen.length); i++) {
        chosen.push(live[i]); pick(i + 1, chosen); chosen.pop();
      }
    };
    pick(0, []);
  }
  return out;
}

test('countSpanning matches direct enumeration of the filtered space', () => {
  for (const sh of SHAPES) {
    assert.equal(countSpanning(sh.w, sh.h, sh.k), allSpanning(sh).length,
      `${sh.w}x${sh.h} k=${sh.k}`);
  }
});

test('geometries yields one per orbit — complete and irredundant', () => {
  for (const sh of SHAPES) {
    const { w, h } = sh;
    const group = symmetries(w, h);
    const yielded = [...geometries({ w, h, bags: sh.k })];

    // Irredundant: no yielded geometry is a symmetry of another.
    const owner = new Map();
    for (const g of yielded) for (const t of group) {
      const k2 = key(w, t(g.exit), g.bags.map(t));
      const mine = key(w, g.exit, g.bags);
      const prev = owner.get(k2);
      assert.ok(prev === undefined || prev === mine,
        `${w}x${h} k=${sh.k}: two yielded geometries share orbit member ${k2}`);
      owner.set(k2, mine);
    }

    // Complete: every config the filters accept lies in some yielded orbit.
    for (const c of allSpanning(sh)) {
      assert.ok(owner.has(key(w, c.exit, c.bags)),
        `${w}x${h} k=${sh.k}: filtered config ${key(w, c.exit, c.bags)} is in no yielded orbit`);
    }
  }
});

test('every yielded geometry spans the board and keeps its bags tearable', () => {
  for (const sh of SHAPES) {
    const { w, h } = sh;
    for (const g of geometries({ w, h, bags: sh.k })) {
      assert.equal(g.bags.length, sh.k);
      for (const [x, y] of g.bags) {
        assert.ok(tearableCell(w, h, g.exit, x, y), `${w}x${h}: bag at ${x},${y} not tearable`);
        assert.ok(x !== g.exit[0] || y !== g.exit[1], 'bag sits on the exit');
      }
      assert.ok(holdsEverySide(w, h, g.exit, g.bags),
        `${w}x${h}: ${JSON.stringify(g)} is a padded copy of a smaller room`);
    }
  }
});

test('tearableCell agrees with the engine on an otherwise-empty board', () => {
  const w = 6, h = 6;
  for (let ey = 0; ey < h; ey++) for (let ex = 0; ex < w; ex++) {
    for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) {
      if ((bx === ex && by === ey)) continue;
      // Stand the raccoon so it can approach the bag from each side in turn; the engine's
      // verdict on the four approaches is what tearableCell claims to predict.
      let engineSaysYes = false;
      for (const [dx, dy, dir] of [[-1, 0, 'l'], [0, -1, 'u'], [1, 0, 'r'], [0, 1, 'd']]) {
        const rx = bx - dx, ry = by - dy;
        if (rx < 0 || ry < 0 || rx >= w || ry >= h) continue;
        const grid = roomOf(w, h, { exit: [ex, ey], bags: [[bx, by]] }, [rx, ry]);
        const s = toState({ id: 't', grid });
        assert.equal(cell(s, bx, by).o, BAG);
        const r = explain(s, dir);
        if (r.ok && r.kind === 'tear') engineSaysYes = true;
      }
      assert.equal(engineSaysYes, tearableCell(w, h, [ex, ey], bx, by),
        `exit ${ex},${ey} bag ${bx},${by}`);
    }
  }
});

test('roomOf round-trips through the reader with the pieces where it put them', () => {
  const w = 6, h = 6;
  const geo = { exit: [0, 0], bags: [[5, 2], [2, 5], [3, 3]] };
  const s = toState({ id: 'r', grid: roomOf(w, h, geo, [1, 1]) });
  assert.deepEqual({ x: s.rac.x, y: s.rac.y }, { x: 1, y: 1 });
  assert.ok(cell(s, 0, 0).exit);
  for (const [x, y] of geo.bags) assert.equal(cell(s, x, y).o, BAG);
  assert.notEqual(cell(s, 4, 4).o, TRASH);
});
