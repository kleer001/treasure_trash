import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLOAT, afloat, bobbing, bobEnd, waterline } from '../src/art/afloat.js';

const S = { px: [[0, 0, '#ffffff'], [1, 0, '#ffffff'], [0, 1, '#808080'], [1, 1, '#808080'], [0, 2, '#000000'], [1, 2, '#000000']], h: 3 };
const dry = { wet: () => false, open: () => false };
const pool = { wet: () => true, open: () => true };
const thing = { w: 2, x0: 10, yw: waterline(S, 10), open: pool.open };

test('a thing over dry floor is drawn as it is', () => {
  assert.deepEqual(afloat(S, 10, 10, waterline(S, 10), dry), S.px.map(([x, y, c]) => [10 + x, 10 + y, c]));
});

test('a thing afloat draws nothing of itself under its waterline where it is not water', () => {
  const only = { wet: (x, y) => y <= waterline(S, 10), open: () => false };
  assert.ok(afloat(S, 10, 10, waterline(S, 10), only).every(([, y]) => y <= waterline(S, 10)));
});

test('a thing come down in the water starts at its rest and ends there with the water still', () => {
  assert.equal(bobbing({ ...thing, f: 0 }).sink, 0);
  assert.deepEqual(bobbing({ ...thing, f: bobEnd() }), { sink: 0, under: [], over: [] });
});

test('a thing come down in the water goes under its rest before it comes up', () => {
  const sinks = Array.from({ length: bobEnd() }, (_, f) => bobbing({ ...thing, f }).sink);
  assert.ok(sinks.indexOf(Math.max(...sinks)) < sinks.indexOf(Math.min(...sinks)));
  assert.equal(Math.max(...sinks), FLOAT.plunge);
});
