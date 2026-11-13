import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WAKE, curveAt, wake, landingFrames, ringStart } from '../src/art/wake.js';

const sprite = w => ({ px: Array.from({ length: w * 4 }, (_, i) => [i % w, Math.floor(i / w), '#808080']), h: 4 });
const SHORE = 48;
const across = (s, speed, from = 0) => f => {
  const fx = from + speed * f, a = Math.min(1, Math.max(0, (fx + s.px.length / 8 - SHORE) / 24));
  return { s, x0: Math.round(fx), y0: 40, yw: 43, a, fx, fy: 40 };
};
const open = x => x >= SHORE;
const end = path => { for (let f = 2; f < 200; f += 2) if (landingFrames(path, f).length) return f + 4; return 200; };

test('a curve passes through each of its keys and is zero outside them', () => {
  const keys = [[0, 0], [10, 1], [20, -0.5], [30, 0]];
  for (const [f, v] of keys) assert.equal(curveAt(keys, f), v);
  assert.equal(curveAt(keys, -1), 0);
  assert.equal(curveAt(keys, 31), 0);
});

test('a thing that never reaches the water stirs none of it', () => {
  const path = across(sprite(12), 0.5);
  assert.deepEqual(landingFrames(path, 40), []);
  assert.deepEqual(wake({ path, t: 40, open }), { under: [], over: [] });
});

test('a thing that comes into the water rings and throws drops', () => {
  const path = across(sprite(12), 3);
  const t = end(path), b = wake({ path, t, open, seed: 1 });
  assert.ok(b.under.length > 0 && b.over.length > 0);
});

test('a wider waterline throws more drops', () => {
  const drops = w => { const path = across(sprite(w), 3); return wake({ path, t: end(path), open, seed: 1 }).over.length; };
  assert.ok(drops(20) > drops(6));
});

test('a faster thing stirs more water', () => {
  const stirred = v => { const path = across(sprite(12), v); return wake({ path, t: end(path), open, seed: 1 }).under.length; };
  assert.ok(stirred(3) > stirred(0.5));
});

const down = (s, speed, stop) => f => {
  const fy = speed * Math.min(f, stop), y0 = Math.round(fy), a = Math.min(1, Math.max(0, fy / 24));
  return { s, x0: 0, y0, yw: y0 + 3, a, fx: 0, fy };
};
const RING = { ...WAKE, ref: 0.5, ringColour: '#ff0000', curves: { ...WAKE.curves, ring: [[0, 1], [100, 1]] } };
const rings = b => b.under.filter(p => p[2] === RING.ringColour);
const middle = px => { const ys = px.map(([, y]) => y); return (Math.min(...ys) + Math.max(...ys)) / 2; };

test('a ring that follows the thing is centred on its waterline where it stops', () => {
  const path = down(sprite(12), 1, 24), b = wake({ path, t: 40, open: () => true, k: RING });
  assert.ok(landingFrames(path, 40)[0] < 24);
  assert.equal(middle(rings(b)), 24 + 3);
});

test('a ring that starts where the thing stops waits for it to stop, then is centred on its waterline', () => {
  const path = down(sprite(12), 1, 24), k = { ...RING, ringFollows: false };
  assert.deepEqual(rings(wake({ path, t: 20, open: () => true, k })), []);
  assert.equal(ringStart(path, 40, k), 26);
  assert.equal(middle(rings(wake({ path, t: 40, open: () => true, k }))), 24 + 3);
});

test('a thing that never stops in the water leaves no ring that starts where it stops', () => {
  const path = across(sprite(12), 3), k = { ...RING, ringFollows: false };
  assert.equal(ringStart(path, end(path), k), null);
  assert.deepEqual(rings(wake({ path, t: end(path), open, k })), []);
});
