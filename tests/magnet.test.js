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

// A field holds whatever is in it, and it does not wait to be asked. A room OPENS with its
// magnets already holding — a field that waited for the first action would appear to fire in
// answer to a step that had nothing to do with it.
test('the nearest metal within reach is alongside before anyone has moved', () => {
  const s = S(['@q-c---E']);
  assert.equal(toGrid(s)[0], '@qc----E', 'the can came to it as the room opened');
  assert.equal(held(s), 2, 'magnet and can are one group');
});

test('reach is exactly three, and nothing beyond it is taken', () => {
  assert.equal(MAGNET_REACH, 3);
  assert.equal(held(S(['@q--c--E'])), 2, 'three: taken');
  assert.equal(held(S(['@q---c--E'])), 0, 'four: not taken');
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
  assert.equal(held(S(['@q-s---E'])), 0, 'a sponge is not metal');
  assert.equal(held(S(['@q-d---E'])), 0, 'nor is cardboard');
  assert.equal(held(S(['@q-h---E'])), 2, 'the chair is');
});

// Nothing on this board moves unbidden: the magnet resolves on the shove it is given and never
// closes a gap of its own accord.
test('a shove into what it holds is refused, as any slider into an object is', () => {
  assert.equal(refuse(S(['@q-c---E']), 'r'), 'canRoom', 'the chain makes it no special case');
});

test('what is held drags its holder when it is pushed', () => {
  // Over the top of the can and down on it: the magnet is not touched, and comes anyway.
  let s = S(['-------', '-@qc---', '-------', 'E------']);
  for (const d of ['u', 'r', 'r']) s = push(s, d);
  assert.equal(toGrid(push(s, 'd'))[2], '--qc---', 'the magnet came along');
});

// Across the field the two travel together; along it the gap closes. A shove that carries the
// magnet sideways carries its load sideways, or the pair simply comes apart — which is the
// difference between holding something and having merely once touched it.
test('a shove across the field carries what is held along with it', () => {
  let s = S(['-------', '-@qw---', '-------', '-------', 'E------']);
  assert.equal(held(s), 2, 'holding from the off');
  for (const d of ['u', 'r']) s = push(s, d);
  const after = push(s, 'd');
  assert.equal(toGrid(after)[2], '--qw---', 'both went down, still side by side');
  assert.equal(held(after), 2, 'and it is still held');
});

test('what cannot keep pace is let go, and the magnet goes on alone', () => {
  let s = S(['-------', '-@qw---', '---#---', '-------', 'E------']);
  for (const d of ['u', 'r']) s = push(s, d);
  const after = push(s, 'd');
  assert.equal(toGrid(after)[1], '--@w---', 'the bin stayed where the wall left it');
  assert.equal(toGrid(after)[2], '--q#---', 'and the magnet carried on down');
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
  // Sideways, which is the only way a magnet ever leaves its load: shoved along its own facing
  // it would be shoved into what it holds, and that is refused like any slider into an object.
  const s = S(['--@----', '--qc---', '-------', 'E------'],
              ['-------', '-------', '--O----', '-------']);
  const r = explain(s, 'd');
  assert.ok(r.ok, `refused: ${r.reason}`);
  assert.deepEqual(toGrid(r.next), ['-------', '--@c---', '-------', 'E------'],
    'the magnet went down the grate and the can stayed');
  assert.equal(held(r.next), 0, 'and what it held is let go');
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

// A tow moves the magnet and its load in one beat, and the account has to name both. Shoving the
// magnet is the well-worn path; shoving the HELD thing is the one that reaches `towMove`, and a
// link made of plain occupants has neither a cart id nor a piece id to be named by. Nothing
// downstream can read the board, so a step that names nothing is a beat where nothing moves.
test('a tow of plain occupants says what moved', () => {
  let s = S(['@----', '-q-c-', '-----', '----E']);
  for (const d of ['r', 'r']) s = push(s, d);
  assert.deepEqual(toGrid(s), ['--@--', '-qc--', '-----', '----E'], 'held, and he is above the can');
  const r = explain(s, 'd', { trace: true });
  assert.ok(r.ok, `refused: ${r.reason}`);
  const moved = r.steps.flatMap(st => st.moved);
  assert.deepEqual(moved.map(m => [m.from, m.to]).sort(),
    [[[1, 1], [1, 2]], [[2, 1], [2, 2]]].sort(), 'the magnet and the can both travelled');
});

// A hold is not a weld. If the group cannot travel, what the raccoon is pushing goes on without
// its holder and the field lets go — a magnet pinned by a wall keeps nothing it cannot follow.
test('a hold breaks when the group cannot travel, and what is pushed goes on alone', () => {
  const s = S(['#####', '##l-#', '#-c@#', '#E--#', '#####']);
  assert.equal(held(s), 2, 'the magnet holds the can below it from the off');
  const after = push(s, 'l');
  assert.equal(toGrid(after)[2], '#c@-#', 'the can went on');
  assert.equal(toGrid(after)[1], '##l-#', 'the magnet is walled in and could not follow');
  assert.equal(held(after), 0, 'so the hold broke');
});

test('a hold that CAN travel still travels, and is not broken by the chance to break', () => {
  const s = S(['#####', '#-l-#', '#-c@#', '#E--#', '#####']);
  const after = push(s, 'l');
  assert.equal(toGrid(after)[1], '#l--#', 'the magnet came along');
  assert.equal(toGrid(after)[2], '#c@-#', 'above what it holds');
  assert.equal(held(after), 2, 'still one group');
});
