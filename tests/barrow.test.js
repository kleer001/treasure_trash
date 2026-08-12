// The wheelbarrow: a cart of ONE cell that FACES the way its tub points, and cannot turn.
// Three things can happen to it and the facing decides which — shoved the way it faces it
// swallows what it meets, which is the scoop; shoved back along the same line it rolls and picks
// nothing up; shoved across the line, it tips.
// Carrying without a carry verb: the barrow carries, and you push it.
//
// In the `:cart` mask a barrow is written as the direction it faces.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, bagsLeft, NONE } from '../src/rules.js';
import { toState, toGrid, toCart } from '../src/format.js';

const S = (grid, cart) => toState({ id: 't', grid, cart });
const push = (s, dir) => { const r = explain(s, dir); assert.ok(r.ok, `refused: ${r.reason}`); return r.next; };
const refuse = (s, dir) => { const r = explain(s, dir); assert.ok(!r.ok, 'expected a refusal'); return r.reason; };

test('shoved the way it faces, a barrow scoops what it meets and keeps it', () => {
  const after = push(S(['@--c-E', '------'], ['-r----', '------']), 'r');
  assert.equal(toGrid(after)[0], '-@--cE', 'the can is riding, not left behind');
  assert.equal(toCart(after)[0], '----r-', 'and it is riding in the barrow');
});

// A cart pushes its load out the back when it stops rolling. A barrow does not — what it
// scooped stays in until it is tipped, which is the whole of what scooping buys.
test('a barrow does not eject what it scooped the way a cart does', () => {
  const after = push(S(['@--C-E', '------'], ['-r----', '------']), 'r');
  assert.ok(toGrid(after)[0].includes('C'), 'still a full can, still aboard');
});

// Cargo rides cart-style, so the win condition keeps counting it without being told anything.
test('a bag in a barrow still counts against the room', () => {
  const s = S(['@--$-E', '------'], ['-r----', '------']);
  assert.equal(bagsLeft(s), 1);
  assert.equal(bagsLeft(push(s, 'r')), 1, 'scooped is not cleared');
});

test('shoved across its line it tips, and the load carries one cell further', () => {
  //  The recycle bin's shape exactly: the dump is a shed, not a new mechanic.
  const s = S(['------', '-@----', '-c----', '------', 'E-----'], ['------', '------', '-r----', '------', '------']);
  const after = push(s, 'd');
  assert.equal(toGrid(after)[2], '-@----', 'he took the cell it left');
  assert.equal(toGrid(after)[3], '------', 'the barrow is here, empty');
  assert.equal(toGrid(after)[4], 'Ec----', 'and its load went one cell further');
});

// Same barrow, same board, two directions. Along its line it travels the alley; across it, it
// goes one cell and tips. Nothing stores the facing but the glyph, and it never turns.
test('the facing decides which of the three things a shove is', () => {
  const along = push(S(['@----E', '------'], ['-r----', '------']), 'r');
  assert.equal(toCart(along)[0], '----r-', 'along: it travelled the alley');
  const across = push(S(['-@----', '------', '------', 'E-----'], ['------', '-r----', '------', '------']), 'd');
  assert.equal(toCart(across)[1], '------', 'across: it left this row');
  assert.equal(toCart(across)[2], '-r----', 'and went exactly one cell');
});

// The whole of what the facing buys. Backwards it is a cart with no mouth: it rolls the same
// alley and takes nothing off it.
test('shoved against its facing it rolls, and picks nothing up', () => {
  // It faces LEFT and is shoved RIGHT, so it is going backwards: no mouth that way.
  const after = push(S(['E@---c', '------'], ['--l---', '------']), 'r');
  assert.equal(toCart(after)[0], '----l-', 'it rolled up to the can and stopped');
  assert.equal(toGrid(after)[0], 'E-@--c', 'the can is still on the floor, not aboard');
});

test('backwards down a clear alley it rolls to the end, still empty', () => {
  const after = push(S(['E@----', '------'], ['--l---', '------']), 'r');
  assert.equal(toCart(after)[0], '-----l', 'it ran to the wall');
  assert.equal(toGrid(after)[0], 'E-@---', 'and he took the cell it left');
});

test('the same barrow, the same alley, the other way: it scoops', () => {
  // The one difference the facing makes, put beside itself.
  const after = push(S(['c---@E', '------'], ['---l--', '------']), 'l');
  assert.equal(toCart(after)[0], 'l-----', 'it ran the same alley to the same wall');
  assert.equal(toGrid(after)[0], 'c--@-E', 'and the can went with it, aboard');
});

test('a barrow keeps its kind when it moves, or two boards would key alike', () => {
  const after = push(S(['@----E', '------'], ['-r----', '------']), 'r');
  assert.ok(toCart(after)[0].includes('r'), 'still a barrow, and still facing the same way');
});

// --- the tow --------------------------------------------------------------------------------
// One cell cannot swallow a couch, so the barrow is the HANDLE rather than the container: it
// hooks what it cannot scoop and the pair moves as one. This is the link lane, and the magnet's
// chain rides in the same one.

import { linkCells } from '../src/rules.js';

const linked = s => s.cells.flatMap((row, y) => row.map((c, x) => [c.lk, x, y]))
  .filter(([lk]) => lk !== undefined);

test('shoved at something too big to scoop, the barrow hooks on instead of refusing', () => {
  const s = push(S(['------', '@-FF--', '------', 'E-----'], ['------', '-r----', '------', '------']), 'r');
  assert.equal(linked(s).length, 3, 'the barrow and both couch cells are one group');
  assert.deepEqual(toGrid(s)[1], '@-FF--', 'and the shove was spent taking hold');
});

test('a hooked pair moves as one rigid thing', () => {
  let s = push(S(['@--FF--E', '--------'], ['-r------', '--------']), 'r');   // rolls up and hooks
  assert.equal(linkCells(s, 0).length, 3);
  s = push(s, 'r');
  assert.equal(toGrid(s)[0], '--@-FF-E', 'the couch came along');
});

test('a tow that cannot move refuses rather than tearing itself apart', () => {
  let s = push(S(['------', '@-FF#-', '------', 'E-----'], ['------', '-r----', '------', '------']), 'r');
  assert.equal(refuse(s, 'r'), 'canRoom', 'the couch is against the wall, so nothing moves');
});

// Shoved from the far side the load drags its barrow behind it. That is the board pulling, not
// the raccoon — the one place pulling was ever allowed.
test('pushing the load drags the barrow along', () => {
  let s = push(S(['------', '@-FF--', '------', 'E-----'], ['------', '-r----', '------', '------']), 'r');
  const from = S(['------', '--FF@-', '------', 'E-----'], ['------', '-r----', '------', '------']);
  from.cells[1][1].lk = 0; from.cells[1][2].lk = 0; from.cells[1][3].lk = 0;
  const after = push(from, 'l');
  assert.equal(toGrid(after)[1], '-FF@--', 'couch moved left, and the barrow with it');
});

test('tipping lets go of what it was towing', () => {
  let s = push(S(['------', '@-FF--', '------', 'E-----'], ['------', '-r----', '------', '------']), 'r');
  for (const d of ['u', 'r']) s = push(s, d);
  s = push(s, 'd');                                   // across the axis: it tips
  assert.equal(linked(s).length, 0, 'the link is gone');
});

test('a tipping barrow is a BODY, not an occupant that moved', () => {
  // Across its axis the barrow turns over: it goes one cell and its load carries on one
  // further. The barrow has a cart sprite keyed by id — naming it in `moved` asks the stage
  // for an occupant of code NONE, which it does not hold.
  const s = S(['-----', '--@--', '--C--', '-----', '-----', 'E----'],
              ['-----', '-----', '--d--', '-----', '-----', '-----']);
  const r = explain(s, 'd', { trace: true });
  assert.ok(r.ok, `refused: ${r.reason}`);
  const step = r.steps.at(-1);
  assert.deepEqual([step.piece].flat(), [{ kind: 'cart', ref: 0, dx: 0, dy: 1 }]);
  assert.ok(!step.moved.some(m => m.o === NONE), 'nothing of code NONE is an occupant sprite');
});

// --- a barrow in a barrow -------------------------------------------------------------------
// One cell holds one cart, so a barrow riding in something cannot still BE a cart: it is cargo
// like everything else that rides, and it is a barrow again wherever cargo is put down.

test('a barrow scoops an empty barrow and carries it off', () => {
  const after = push(S(['@----E', '------'], ['-r-r--', '------']), 'r');
  assert.equal(toGrid(after)[0], '-@-->E', 'the one it took is riding, still facing right');
  assert.equal(toCart(after)[0], '----r-', 'and only one cart is left on the board');
});

test('tipped out, it is a barrow again', () => {
  const s = S(['------', '-@----', '->----', '------', 'E-----'],
              ['------', '------', '-r----', '------', '------']);
  const after = push(s, 'd');
  assert.equal(toCart(after)[3], '-r----', 'the one that carried it');
  assert.equal(toCart(after)[4], '-s----', 'and the one it tipped out, a cart once more');
  assert.equal(toGrid(after)[4], 'E-----', 'nothing riding anywhere');
});

test('a loaded barrow is too full to be picked up', () => {
  // A cell holds one occupant, so a barrow with something in it cannot bring it aboard.
  const s = S(['@--c-E', '------'], ['-r-r--', '------']);
  const loaded = push(s, 'r');                       // the far barrow now holds the can
  assert.ok(toGrid(loaded)[0].includes('c'), 'it scooped the can');
  const again = S(['-@---E', '------'], ['--r-r-', '------']);
  again.cells[0][4].o = 2;                           // a full can riding in the far barrow
  const r = explain(again, 'r');
  assert.ok(r.ok, `refused: ${r.reason}`);
  assert.equal(toCart(r.next)[0], '---rs-', 'it rolled up and stopped against it');
});

test('a hooked barrow is spoken for, and cannot be picked up', () => {
  const s = S(['@---FF-E', '--------'], ['-r-r----', '--------']);
  s.cells[0][3].lk = 0; s.cells[0][4].lk = 0; s.cells[0][5].lk = 0;   // the far one is towing
  const r = explain(s, 'r');
  assert.ok(r.ok, `refused: ${r.reason}`);
  assert.equal(toCart(r.next)[0], '--rs----', 'it stopped against it rather than taking it');
});
