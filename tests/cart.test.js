// The shopping cart: a rigid two-cell piece that rolls, and whose two cells are cargo slots.
// Everything here is the same rule seen from different angles — cargo entering a file's lead
// slot pushes what was there one slot back, and whatever is pushed past the trail slot lands
// in the cell that slot just vacated. A file is one slot deep broadside and two deep end-on,
// which is the whole reason the same cart behaves differently along its two axes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, isWon, bagsLeft, trashHeld, stateKey } from '../src/rules.js';
import { toState, toGrid, toCart, toWater } from '../src/format.js';

// Carts ride in their own aligned block, like water: the occupant grid holds the CARGO, and
// the mask says which cells are cart cells. See FORMATS.md.
const S = (grid, cart, water) => toState({ id: 't', grid, cart, water });
const act = (grid, cart, dir, water) => {
  const r = explain(S(grid, cart, water), dir);
  assert.ok(r.ok, `expected a legal action, got refused (${r.reason})`);
  return r.next;
};
const refused = (grid, cart, dir, water) => {
  const r = explain(S(grid, cart, water), dir);
  assert.ok(!r.ok, 'expected a refusal');
  return r.reason;
};

test('end-on, a third pile pushes the first out the back: two in, the old one behind', () => {
  // The cart holds one can in its LEAD slot. The first can it swallows shoves that one to the
  // trail; the second shoves it out. A couch stops the roll, so the cargo stays aboard.
  const next = act(['@-ccc-F-', '------F-', 'E-------'],
                   ['-PP-----', '--------', '--------'], 'r');
  assert.deepEqual(toGrid(next), ['@-c-ccF-', '------F-', 'E-------']);
  assert.deepEqual(toCart(next), ['----PP--', '--------', '--------']);
});

test('broadside, the cart is one slot deep, so both new cans displace the old one at once', () => {
  // Same cart, same cargo, shoved across its length instead of along it: two lead cells, no
  // interior to shuffle into, and the old can leaves on contact.
  const next = act(['@cc-FE', '--c-F-'],
                   ['-P----', '-P----'], 'r');
  assert.deepEqual(toGrid(next), ['@c-cFE', '---cF-']);
  assert.deepEqual(toCart(next), ['---P--', '---P--']);
});

test('broadside swallows two things in one shove, and sheds nothing if it had room', () => {
  const next = act(['@-c-FE', '--c-F-'], ['-P----', '-P----'], 'r');
  assert.deepEqual(toGrid(next), ['@--cFE', '---cF-']);
  assert.deepEqual(toCart(next), ['---P--', '---P--']);
});

test('a pile shed mid-roll lands on the cell it was picked up from', () => {
  // Three piles in a row, an empty cart, and a wall four cells on. The cart is a two-slot pipe
  // moving at exactly the rate a solid line is spaced, so the pile it sheds comes down on its
  // own square. The tip then fills backward past it — nearest FREE cell, not nearest cell.
  const next = act(['@--xxx-#', 'E-------'], ['-PP-----', '--------'], 'r');
  assert.deepEqual(toGrid(next), ['@-xxx--#', 'E-------']);
  assert.deepEqual(toCart(next), ['-----PP-', '--------']);
});

test('a wall tips the cart; broadside empties on one cell of runway', () => {
  const next = act(['@c-#', '-c-#', 'E---'], ['-P--', '-P--', '----'], 'r');
  assert.deepEqual(toGrid(next), ['@c-#', '-c-#', 'E---']);
  assert.deepEqual(toCart(next), ['--P-', '--P-', '----']);
});

test('end-on with one cell of runway puts down one thing and keeps the other', () => {
  // The cart never sheds behind where it started — that cell is the raccoon's — so a one-cell
  // roll can only place the trail slot's load. A partial dump is a legal outcome.
  const next = act(['@cc-#', 'E----'], ['-PP--', '-----'], 'r');
  assert.deepEqual(toGrid(next), ['@c-c#', 'E----']);
  assert.deepEqual(toCart(next), ['--PP-', '-----']);
});

test('a couch stops the roll without tipping it — that is a parking spot', () => {
  const next = act(['@cc-F', '----F', 'E----'], ['-PP--', '-----', '-----'], 'r');
  assert.deepEqual(toGrid(next), ['@-ccF', '----F', 'E----']);
  assert.deepEqual(toCart(next), ['--PP-', '-----', '-----']);
});

test('a cart that cannot roll at all is refused, not tipped', () => {
  assert.equal(refused(['@cc#', 'E---'], ['-PP-', '----'], 'r'), 'canRoom');
});

test('a cart takes in anything single-cell — bag, can, bin, jug, wheelie, stack, trash', () => {
  for (const g of ['$', 'C', 'c', 'x', 'b', 'j', 'W', 'w', 'S']) {
    const next = act([`@-${g}-F`, '----F', 'E----'], ['-PP--', '-----', '-----'], 'r');
    assert.deepEqual(toGrid(next), [`@--${g}F`, '----F', 'E----'], `${g} should load`);
    assert.deepEqual(toCart(next), ['--PP-', '-----', '-----'], `${g} should load`);
  }
});

test('trash tipped into the canal fills it, exactly as a fan or a bin drop does', () => {
  // The cart eats a pile, rolls on, and the wall tips it back into open water: the cell stops
  // being canal and becomes a crossing, and the pile is spent doing it.
  const next = act(['@--x-#', 'E-----'], ['-PP---', '------'], 'r', ['--~---', '------']);
  assert.deepEqual(toGrid(next), ['@----#', 'E-----'], 'the pile is gone from the occupant grid');
  assert.deepEqual(toWater(next), ['--=---', '------'], 'it became a crossing');
});

test('a cart in the canal is still shovable from the bank, like a wheelie bin', () => {
  const next = act(['@---E', '-----'], ['-PP--', '-----'], 'r', ['-~~--', '-----']);
  assert.deepEqual(toCart(next), ['--PP-', '-----']);
});

test('a fan is refused into a cart: loading means rolling into cargo, not catching it', () => {
  assert.equal(refused(['-----', '--$--', '--@--', 'E----'],
                       ['-PP--', '-----', '-----', '-----'], 'u'), 'fan');
});

test('the win is the mess ON THE FLOOR: trash in a cart keeps the exit dark', () => {
  const held = S(['+-x-'], ['--PP']);
  assert.equal(bagsLeft(held), 0);
  assert.equal(trashHeld(held), 1);
  assert.equal(isWon(held), false, 'the pile is still in the cart');
});

test('junk that was never the mess rides out with him', () => {
  const junk = S(['+-c-'], ['--PP']);
  assert.equal(trashHeld(junk), 0);
  assert.equal(isWon(junk), true, 'an empty can in the cart is not unfinished business');
});

test('a bag in a cart still counts as a bag, wherever it is riding', () => {
  assert.equal(bagsLeft(S(['@-$-E'], ['--PP-'])), 1);
  assert.equal(bagsLeft(S(['@-W-E'], ['--PP-'])), 1);   // a full wheelie bin, in a cart
  assert.equal(bagsLeft(S(['@-S-E'], ['--PP-'])), 2);   // a stack is two, in a cart or out
});

test('a can riding in a cart is not the same board as a can lying on the floor', () => {
  // The regression this pins: cargo keeps its own occupant code, so without cart membership in
  // the packed character the two cells read identically and the solver merges distinct boards.
  const carted = stateKey(S(['@c--E'], ['-PP--']));
  const loose = stateKey(S(['@c--E']));
  assert.notEqual(carted, loose);
  assert.notEqual(carted.split('|')[0], loose.split('|')[0], 'the occupant lane must differ');
});

test('two carts abreast are not the same board as two carts end-on', () => {
  // Same four cart cells, two different partitions, and they roll completely differently.
  const rows = ['----', '----', '@--E'];
  const abreast = stateKey(S(rows, ['PP--', 'QQ--', '----']));
  const endOn = stateKey(S(rows, ['PQ--', 'PQ--', '----']));
  assert.notEqual(abreast, endOn);
});

test('a cart stops at another cart — it cannot take one aboard', () => {
  assert.equal(refused(['@----E', '------'], ['-PPQQ-', '------'], 'r'), 'canRoom');
});

test('the exit stops a cart without tipping it — nothing may rest there', () => {
  const next = act(['@---E', '-----'], ['-PP--', '-----'], 'r');
  assert.deepEqual(toCart(next), ['--PP-', '-----']);
});

test('the cart block round-trips, loaded and all', () => {
  const s = S(['@-cx--E', '-------'], ['-PP-QQ-', '-------']);
  assert.deepEqual(toGrid(s), ['@-cx--E', '-------']);
  assert.deepEqual(toCart(s), ['-PP-QQ-', '-------']);
});

test('a cart is exactly two cells; anything else is a file error', () => {
  assert.throws(() => S(['@--E'], ['-P--']), /covers 1 cell; a cart is exactly two/);
  assert.throws(() => S(['@---E'], ['-PPP-']), /covers 3 cells; a cart is exactly two/);
});

test('the reader refuses a cart on a wall, on the exit, holding furniture, or under him', () => {
  assert.throws(() => S(['@#-E', '----'], ['-PP-', '----']), /both wall and cart/);
  assert.throws(() => S(['@--E', '----'], ['--PP', '----']), /exit cannot hold a cart/);
  assert.throws(() => S(['@FF-E', '-FF--'], ['-PP--', '-----']), /cannot hold furniture/);
  assert.throws(() => S(['@--E'], ['PP--']), /raccoon cannot start in a cart/);
});
