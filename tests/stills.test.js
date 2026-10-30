import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStills, LYING } from '../src/art/stills.js';
import { LIES } from '../src/stage.js';
import { C } from '../src/art/flight.js';

const still = createStills({});
const THINGS = Object.entries(LYING).map(([o, M]) => [Number(o), M]);

test('every kind the stage lays down has a lying drawing, and no other kind has one', () => {
  assert.deepEqual(new Set(THINGS.map(([o]) => o)), LIES);
});

test('a tipped thing lies the way it fell', () => {
  for (const [o, M] of THINGS) for (const dir of 'udlr') {
    const s = still(o, 2, 3, 1, dir), [x, y] = M.restAt(2, 3, C, dir);
    assert.deepEqual(s.px, M.rest(dir).px, `${o} fallen ${dir}`);
    assert.deepEqual([s.x, s.y], [x, y], `${o} fallen ${dir} is placed where it lies`);
  }
});

test('one that has not tipped stands upright', () => {
  for (const [o, M] of THINGS) {
    const s = still(o, 2, 3);
    assert.deepEqual([s.x, s.y], M.restAt(2, 3, C), `${o}`);
    assert.notDeepEqual(s.px, M.rest('d').px, `${o}`);
  }
});
