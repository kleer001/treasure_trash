import { test } from 'node:test';
import assert from 'node:assert/strict';
import { P, PATTERNS, KINDS, layWall, rankWall, brickPhase, wallFrom, roomBeats } from '../src/wipe.js';

const SIZES = [[5 * 76, 4 * 76], [14 * 76, 11 * 76]];
const T = { cover: 40, hold: 50, reveal: 30, lay: 8, order: 'same' };
const centre = b => [b.x + b.w / 2, b.y + b.h / 2];

test('a wall leaves no pixel of the board showing once every brick is down', () => {
  for (const kind of Object.keys(KINDS)) for (const [w, h] of SIZES) {
    const wall = layWall(kind, w, h, 7);
    assert.equal(wall.W, Math.ceil(w / P)); assert.equal(wall.H, Math.ceil(h / P));
    const hit = new Uint8Array(wall.W * wall.H);
    for (const b of wall.bricks)
      for (let y = Math.max(0, b.y); y < Math.min(wall.H, b.y + b.h); y++)
        for (let x = Math.max(0, b.x); x < Math.min(wall.W, b.x + b.w); x++) hit[y * wall.W + x] = 1;
    assert.equal(hit.indexOf(0), -1, `${kind} ${w}x${h}: an uncovered pixel`);
  }
});

test('every pattern lays the bricks in the order it names, from the first at 0 to the last at 1', () => {
  const along = {
    right: ([x]) => x, left: ([x]) => -x, down: ([, y]) => y, up: ([, y]) => -y,
    downRight: ([x, y], W, H) => x / W + y / H, downLeft: ([x, y], W, H) => -x / W + y / H,
    upRight: ([x, y], W, H) => x / W - y / H, upLeft: ([x, y], W, H) => -x / W - y / H,
  };
  for (const kind of Object.keys(KINDS)) for (const [w, h] of SIZES) {
    const wall = layWall(kind, w, h, 7);
    for (const p of PATTERNS) {
      const r = rankWall(wall, p);
      assert.equal(Math.min(...r), 0, `${kind} ${p}`); assert.equal(Math.max(...r), 1, `${kind} ${p}`);
      if (!along[p]) continue;
      const key = wall.bricks.map(b => along[p](centre(b), wall.W, wall.H));
      for (let i = 0; i < r.length; i++) for (let j = 0; j < r.length; j++)
        if (key[i] < key[j] - 1e-9) assert.ok(r[i] <= r[j] + 1e-9, `${kind} ${p}: brick ${i} after brick ${j}`);
    }
  }
});

test('a spiral starts at the top-left corner, ends in the middle, and turns the way it is named', () => {
  for (const [w, h] of SIZES) {
    const wall = layWall('brick', w, h, 7);
    const near = (x, y) => wall.bricks.reduce((best, b, i) => {
      const [cx, cy] = centre(b), d = Math.hypot(cx - x, cy - y);
      return d < best.d ? { i, d } : best;
    }, { d: Infinity }).i;
    const topRight = near(wall.W - 6, 2), bottomLeft = near(6, wall.H - 2), middle = near(wall.W / 2, wall.H / 2);
    const cw = rankWall(wall, 'spiralCw'), ccw = rankWall(wall, 'spiralCcw');
    assert.ok(cw[topRight] < cw[bottomLeft], 'clockwise goes along the top first');
    assert.ok(ccw[bottomLeft] < ccw[topRight], 'anticlockwise goes down the left first');
    for (const r of [cw, ccw]) assert.ok(r[middle] > 0.9, 'the middle is laid last');
    for (const r of [cw, ccw]) {
      const [x, y] = centre(wall.bricks[r.indexOf(0)]);
      assert.ok(x < 12 && y < 12, `the first brick is at the top-left corner, not ${x},${y}`);
    }
  }
});

test('the cover ends with every brick down, and the reveal ends with every brick gone', () => {
  for (const order of ['same', 'back']) {
    const t = { ...T, order };
    for (const r of [0, 0.3, 1]) {
      assert.deepEqual(brickPhase(r, 0, t).laid > 0 && r > 0, false);
      assert.equal(brickPhase(r, t.cover, t).laid, 1);
      assert.equal(brickPhase(r, t.cover + t.hold, t).gone, 0);
      assert.equal(brickPhase(r, t.cover + t.hold + t.reveal, t).gone, 1);
    }
    const half = t.cover + t.hold + t.reveal / 2;
    const first = brickPhase(0, half, t).gone, last = brickPhase(1, half, t).gone;
    assert.ok(order === 'same' ? first > last : last > first, order);
  }
});

test('an open hold keeps every brick up, however long it runs', () => {
  for (const r of [0, 0.5, 1]) assert.equal(brickPhase(r, 10000, { ...T, hold: Infinity }).gone, 0);
});

test('the first brick drops only once he has gone and the room has stood empty', () => {
  assert.equal(wallFrom({ exit: 12, empty: 30 }), 42);
});

test('a wall one screen pixel to an art pixel still leaves no pixel of the board showing', () => {
  for (const kind of Object.keys(KINDS)) for (const [w, h] of [[480, 206], [480, 180]]) {
    const wall = layWall(kind, w, h, 3, 1);
    assert.equal(wall.p, 1); assert.equal(wall.W, w); assert.equal(wall.H, h);
    const hit = new Uint8Array(w * h);
    for (const b of wall.bricks)
      for (let y = Math.max(0, b.y); y < Math.min(h, b.y + b.h); y++)
        for (let x = Math.max(0, b.x); x < Math.min(w, b.x + b.w); x++) hit[y * w + x] = 1;
    assert.equal(hit.indexOf(0), -1, `${kind} ${w}x${h}: an uncovered pixel`);
  }
});

test('over the room that comes in, the wall holds and comes down so that he ends at most a tail after it', () => {
  const t = { roomHold: 60, roomHoldMax: 120, reveal: 30, revealMax: 90, tail: 60 };
  assert.deepEqual(roomBeats(0, t), { hold: 60, reveal: 30 }, 'quiet: the least of each');
  assert.deepEqual(roomBeats(100, t), { hold: 60, reveal: 30 }, 'a short line ends inside the tail');
  assert.deepEqual(roomBeats(179, t), { hold: 89, reveal: 30 }, 'the hold stretches first');
  assert.deepEqual(roomBeats(250, t), { hold: 120, reveal: 70 }, 'then the brick-in slows');
  assert.deepEqual(roomBeats(500, t), { hold: 120, reveal: 90 }, 'a long line runs on over the open room');
});
