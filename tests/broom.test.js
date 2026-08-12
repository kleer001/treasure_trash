// The broom. It takes the whole contiguous line ahead of it, of any kinds, one cell — and it is
// the only thing in the game that moves a bag without bursting it, which is what gives broken
// glass anything to do.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain } from '../src/rules.js';
import { toState, toGrid, toWater } from '../src/format.js';

const S = (grid, water) => toState({ id: 't', grid, water });
const push = (s, dir) => { const r = explain(s, dir); assert.ok(r.ok, `refused: ${r.reason}`); return r.next; };
const refuse = (s, dir) => { const r = explain(s, dir); assert.ok(!r.ok, 'expected a refusal'); return r.reason; };

test('a line of mixed kinds goes one cell, and only the head sheds', () => {
  // Every interior item has its neighbour in the cell beyond, so it cannot shed even if it
  // wanted to. The rule falls out of the geometry rather than being stated.
  assert.deepEqual(toGrid(push(S(['@rcbC--E']), 'r')), ['-@rcbc$E']);
});

test('a line into a wall does not move, and nothing sheds', () => {
  assert.equal(refuse(S(['-@rcC', 'E----']), 'r'), 'canRoom');
});

// Nothing else in the game moves a bag: a shove bursts it where it stands.
test('a bag travels when it is swept, and does not burst', () => {
  const after = toGrid(push(S(['@r$----E']), 'r'));
  assert.equal(after[0], '-@r$---E', 'still a bag, one cell along');
});

test('a bag swept onto broken glass bursts where it lands', () => {
  const s = push(S(['@r$----E'], ['---*----']), 'r');
  assert.ok(!toGrid(s)[0].includes('$'), 'the bag is gone');
  assert.ok(toGrid(s)[0].includes('x'), 'and it left trash behind');
});

// Only the head of a line can burst: anywhere else the fan has the rest of the line packed
// round it and nowhere to go, so the sweep is refused rather than resolved half way.
test('a bag anywhere but the head refuses to be swept onto glass', () => {
  assert.equal(refuse(S(['@r$c---E'], ['---*----']), 'r'), 'glass');
});

test('on grease the broom carries its whole train to the end of the slick', () => {
  assert.deepEqual(toGrid(push(S(['@rc----E'], ['-%%%%---']), 'r')), ['-@---rcE']);
  assert.deepEqual(toGrid(push(S(['@rc----E']), 'r')), ['-@rc---E'], 'and one cell off it');
});

test('what the line sweeps into a grate is gone', () => {
  const s = push(S(['@rC---E'], ['---O---']), 'r');
  assert.equal(toGrid(s)[0], '-@r---E');
});

test('a line holding something stuck in tar will not move at all', () => {
  const stuck = push(S(['@rc----E'], ['---T----']), 'r');   // the can slides onto the tar
  assert.equal(refuse(stuck, 'r'), 'tar');
});
