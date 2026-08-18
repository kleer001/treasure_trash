// The broom. It takes the whole contiguous line ahead of it, of any kinds, one cell — and it is
// the only thing in the game that moves a bag without bursting it, which is what gives broken
// glass anything to do.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain , inAHold } from '../src/rules.js';
import { toState, toGrid, toWater } from '../src/format.js';

const S = (grid, water) => toState({ id: 't', grid, water });
const push = (s, dir) => { const r = explain(s, dir); assert.ok(r.ok, `refused: ${r.reason}`); return r.next; };
const refuse = (s, dir) => { const r = explain(s, dir); assert.ok(!r.ok, 'expected a refusal'); return r.reason; };

test('a line of mixed kinds goes one cell, and only the head sheds', () => {
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

// The pane keeps the rule it has under a shove: room in front is what breaks it, and something
// in front is what saves it. In a contiguous line only the head has room, so a sweep breaks the
// pane it leads with and carries every other one whole.
test('a swept pane shatters into the space in front of it', () => {
  const broken = push(S(['@rg--E']), 'r');
  assert.equal(toGrid(broken)[0], '-@r--E', 'the pane is gone');
  assert.equal(toWater(broken)[0][3], '*', 'and what it left in front of it is a hazard');
});

test('a swept pane with something in front of it rides whole', () => {
  assert.equal(toGrid(push(S(['@rgc-E']), 'r'))[0], '-@rgcE');
});

// There is no floor to leave glass on, so nothing breaks and the pane goes in intact — the same
// answer a shove gives when it is aimed at the canal.
test('a swept pane over the canal does not break', () => {
  const s = push(S(['@rg--E'], ['---~--']), 'r');
  assert.equal(toGrid(s)[0], '-@rg-E', 'still a pane');
  assert.equal(toWater(s)[0][3], '~', 'and still the canal');
});

test('what the line sweeps into a grate is gone', () => {
  const s = push(S(['@rC---E'], ['---O---']), 'r');
  assert.equal(toGrid(s)[0], '-@r---E');
});

test('a line holding something stuck in tar will not move at all', () => {
  const stuck = push(S(['@rc----E'], ['---T----']), 'r');   // the can slides onto the tar
  assert.equal(refuse(stuck, 'r'), 'tar');
});

// A cell carries more than its occupant code, and a sweep moves the cell's whole contents. A
// link left behind belongs to whatever is standing there afterwards, which is a different board
// — and nothing would have thrown.
test('a sweep carries what a cell holds, not only what is standing on it', () => {
  const s = S(['-@rq-----E']);
  s.cells[0][4].o = 7;                              // a wheelie beside the magnet
  s.cells[0][3].grip = 1;                          // already held
  const after = push(s, 'r');
  const held = after.cells[0].map((_, i) => (inAHold(after, i, 0) ? i : null)).filter(i => i !== null);
  assert.deepEqual(held, [4, 5], 'the hold moved with the pair, not stayed on the broom');
});
