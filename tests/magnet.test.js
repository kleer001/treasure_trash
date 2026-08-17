// The magnet. One facing, four orientations, and it never turns. Its field runs in a straight
// line along that facing, like a rook's: walls stop it, objects do not. Reach is three cells,
// which is also where a chain lets go — so the whole piece is one sentence long.
//
// It is the counterpart of the bag: a tear throws five cells outward, a magnet gathers inward.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, MAGNET_REACH } from '../src/rules.js';
import { toState, toGrid, toCart } from '../src/format.js';

const S = (grid, water, cart) => toState({ id: 't', grid, water, cart });
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
                         cart: ['---------', '----r----', '---------', '---------'] });
  cart.cells[1][4].lk = 0; cart.cells[1][5].lk = 0; cart.cells[1][6].lk = 0;
  cart.cells[1][2].o = 34;                       // a magnet facing the towing barrow
  const after = push(cart, 'r');
  const groups = new Set(after.cells.flat().filter(c => c.lk !== undefined).map(c => c.lk));
  assert.equal(groups.size, 1, 'still one group: the tow, untouched');
  assert.equal(after.cells.flat().filter(c => c.lk !== undefined).length, 3, 'barrow and both couch cells');
  assert.ok(s, 'board builds');
});

test('a grate takes a magnet, and there is no field left to resolve', () => {
  // It never lands, so nothing resolves — and whatever it was holding is let go, because the
  // thing that held it is gone.
  const s = S(['-------', '-@q-C-E', '-------'], ['-------', '---O---', '-------']);
  const r = explain(s, 'r');
  assert.ok(r.ok, `refused: ${r.reason}`);
  assert.deepEqual(toGrid(r.next), ['-------', '--@-C-E', '-------'], 'the magnet is gone, the can stayed');
});

test('a magnet shoved into a cart rides in it, and its field resolves from there', () => {
  // It is cargo like any other: the cart swallows it and the file shuffles. Placing it with a
  // plain drop instead would overwrite whatever slot it landed in.
  const s = S(['-------', '-@q----', 'E------'], null, ['-------', '---PP--', '-------']);
  const r = explain(s, 'r');
  assert.ok(r.ok, `refused: ${r.reason}`);
  assert.deepEqual(toGrid(r.next), ['-------', '--@q---', 'E------'], 'the magnet is in the near slot');
  assert.deepEqual(toCart(r.next), ['-------', '---PP--', '-------'], 'the cart has not moved');
});

test('a cart slot over a grate still holds what is shoved into it', () => {
  // The grate is under the cart, not under the cargo. A magnet is the case that found this:
  // it was placed with a drop, which a grate refuses, and then its field was resolved off an
  // empty cell.
  const s = S(['-------', '-@q----', 'E------'], ['-------', '---O---', '-------'],
              ['-------', '---PP--', '-------']);
  const r = explain(s, 'r');
  assert.ok(r.ok, `refused: ${r.reason}`);
  assert.deepEqual(toGrid(r.next), ['-------', '--@q---', 'E------'], 'the cart holds it over the grate');
});

test('a magnet cannot pull anything through the raccoon, or onto him', () => {
  // He is the one occupant `isOccupiable` cannot see, and on the pull side of the board he can be
  // anywhere at all: the field settles after every action, so the cell it wants to draw into is
  // as likely to hold him as not.
  const s = S(['#######', '#--C--#', '#--@--#', '#--f--#', '#----E#', '#######']);
  const r = explain(s, 'd');
  assert.ok(r.ok, `refused: ${r.reason}`);
  assert.deepEqual(toGrid(r.next), ['#######', '#-----#', '#--C--#', '#--@--#', '#--f-E#', '#######'],
    'it closes as far as the cell above him and stops; he is not stood on and not passed');
});
