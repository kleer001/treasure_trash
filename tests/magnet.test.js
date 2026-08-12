// The magnet. One facing, four orientations, and it never turns. Its field runs in a straight
// line along that facing, like a rook's: walls stop it, objects do not. Reach is three cells,
// which is also where a chain lets go — so the whole piece is one sentence long.
//
// It is the counterpart of the bag: a tear throws five cells outward, a magnet gathers inward.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, MAGNET_REACH } from '../src/rules.js';
import { toState, toGrid } from '../src/format.js';

const S = grid => toState({ id: 't', grid });
const push = (s, dir) => { const r = explain(s, dir); assert.ok(r.ok, `refused: ${r.reason}`); return r.next; };
const refuse = (s, dir) => { const r = explain(s, dir); assert.ok(!r.ok, 'expected a refusal'); return r.reason; };
const held = s => s.cells.flat().filter(c => c.lk !== undefined).length;

test('the nearest metal within reach closes to alongside, and is held', () => {
  const s = push(S(['@q-c---E']), 'r');
  assert.equal(toGrid(s)[0], '-@qc---E', 'the can came to it');
  assert.equal(held(s), 2, 'magnet and can are one group');
});

test('reach is exactly three, and nothing beyond it is taken', () => {
  assert.equal(MAGNET_REACH, 3);
  assert.equal(held(push(S(['@q--c--E']), 'r')), 2, 'three: taken');
  assert.equal(held(push(S(['@q----c-E']), 'r')), 0, 'four: not taken');
});

// Walls stop the field and objects do not, which is what lets a magnet reach past something
// and hold it at a distance rather than alongside.
test('a wall stops the field; a thing standing in the way does not', () => {
  assert.equal(held(push(S(['@q-#-c--E']), 'r')), 0, 'the wall blocks it entirely');
  const past = push(S(['@q-s-c--E']), 'r');
  assert.equal(held(past), 2, 'the sponge does not block the field');
  assert.equal(toGrid(past)[0], '-@qsc---E', 'so the can closes as far as it can and stops there');
});

test('what is not metal is never taken', () => {
  assert.equal(held(push(S(['@q-s---E']), 'r')), 0, 'a sponge is not metal');
  assert.equal(held(push(S(['@q-d---E']), 'r')), 0, 'nor is cardboard');
  assert.equal(held(push(S(['@q-h---E']), 'r')), 2, 'the chair is');
});

// Nothing on this board moves unbidden: the magnet resolves on the shove it is given and never
// closes a gap of its own accord.
test('a shove into what it holds is refused, as any slider into an object is', () => {
  const s = push(S(['@q-c---E']), 'r');
  assert.equal(refuse(s, 'r'), 'canRoom', 'the chain makes it no special case');
});

test('what is held drags its holder when it is pushed', () => {
  let s = push(S(['-------', '-@q-c--', '-------', 'E------']), 'r');
  for (const d of ['u', 'r', 'r', 'r', 'd']) s = push(s, d);
  assert.equal(toGrid(push(s, 'l'))[1], '--qc@--', 'the magnet came along');
});

// Across the field the two travel together; along it the gap closes. A shove that carries the
// magnet sideways carries its load sideways, or the pair simply comes apart — which is the
// difference between holding something and having merely once touched it.
test('a shove across the field carries what is held along with it', () => {
  let s = push(S(['-------', '-@q-w--', '-------', '-------', 'E------']), 'r');
  assert.equal(toGrid(s)[1], '--@qw--', 'captured, alongside');
  for (const d of ['u', 'r']) s = push(s, d);
  const after = push(s, 'd');
  assert.equal(toGrid(after)[2], '---qw--', 'both went down, still side by side');
  assert.equal(held(after), 2, 'and it is still held');
});

test('what cannot keep pace is let go, and the magnet goes on alone', () => {
  let s = push(S(['-------', '-@q-w--', '----#--', '-------', 'E------']), 'r');
  for (const d of ['u', 'r']) s = push(s, d);
  const after = push(s, 'd');
  assert.equal(toGrid(after)[1], '---@w--', 'the bin stayed where the wall left it');
  assert.equal(toGrid(after)[2], '---q#--', 'and the magnet carried on down');
  assert.equal(held(after), 0, 'the chain let go');
});

// One link per piece. Without this a magnet takes hold of a barrow that is already towing, the
// second hold overwrites the first, and what it was towing is orphaned — a board that is wrong
// with nothing thrown and nothing to look at.
test('a magnet will not take hold of something that is already held', () => {
  const s = S(['---------', '-@---FF--', '---------', 'E--------']);
  const cart = toState({ id: 't', grid: ['---------', '-@---FF--', '---------', 'E--------'],
                         cart: ['---------', '----y----', '---------', '---------'] });
  cart.cells[1][4].lk = 0; cart.cells[1][5].lk = 0; cart.cells[1][6].lk = 0;
  cart.cells[1][2].o = 34;                       // a magnet facing the towing barrow
  const after = push(cart, 'r');
  const groups = new Set(after.cells.flat().filter(c => c.lk !== undefined).map(c => c.lk));
  assert.equal(groups.size, 1, 'still one group: the tow, untouched');
  assert.equal(after.cells.flat().filter(c => c.lk !== undefined).length, 3, 'barrow and both couch cells');
  assert.ok(s, 'board builds');
});
