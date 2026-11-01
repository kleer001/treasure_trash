import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reverseStep } from '../src/tape.js';
import { mulberry32 } from '../src/rng.js';

const W = 37, H = 23;
const picture = seed => {
  const rnd = mulberry32(seed), data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < data.length; i++) data[i] = rnd() * 256;
  return { width: W, height: H, data };
};
const paint = (pic, s) => {
  for (let y = 0; y < s.h; y++) pic.data.set(s.old.subarray(y * s.w * 4, (y + 1) * s.w * 4), ((s.y + y) * W + s.x) * 4);
};
const changed = (prev, cells) => {
  const next = { ...prev, data: prev.data.slice() };
  for (const [x, y, ch] of cells) next.data[(y * W + x) * 4 + ch] ^= 0x55;
  return next;
};

test('a reverse step painted onto the newer picture gives back the older one', () => {
  for (const cells of [[[0, 0, 0]], [[W - 1, H - 1, 3]], [[3, 4, 1], [20, 9, 2], [11, 17, 0]], [[0, H - 1, 2], [W - 1, 0, 1]]]) {
    const prev = picture(cells.length), next = changed(prev, cells), s = reverseStep(prev, next);
    paint(next, s);
    assert.deepEqual(next.data, prev.data, JSON.stringify(cells));
  }
});

test('the step is the smallest rectangle round what changed', () => {
  const prev = picture(9), s = reverseStep(prev, changed(prev, [[3, 4, 1], [20, 9, 2], [11, 17, 0]]));
  assert.deepEqual([s.x, s.y, s.w, s.h], [3, 4, 18, 14]);
  assert.equal(s.old.length, 18 * 14 * 4);
});

test('the same picture twice gives no step', () => {
  const prev = picture(5);
  assert.equal(reverseStep(prev, { ...prev, data: prev.data.slice() }), null);
});
