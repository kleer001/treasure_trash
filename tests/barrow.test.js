// The wheelbarrow: a cart of ONE cell with an axis it cannot turn. Shoved along that axis it
// behaves as a cart does and swallows what it meets — the scoop. Shoved across it, it tips.
// Carrying without a carry verb: the barrow carries, and you push it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, bagsLeft, NONE } from '../src/rules.js';
import { toState, toGrid, toCart } from '../src/format.js';

const S = (grid, cart) => toState({ id: 't', grid, cart });
const push = (s, dir) => { const r = explain(s, dir); assert.ok(r.ok, `refused: ${r.reason}`); return r.next; };
const refuse = (s, dir) => { const r = explain(s, dir); assert.ok(!r.ok, 'expected a refusal'); return r.reason; };

test('shoved along its axis a barrow scoops what it meets, and keeps it', () => {
  const after = push(S(['@--c-E', '------'], ['-y----', '------']), 'r');
  assert.equal(toGrid(after)[0], '-@--cE', 'the can is riding, not left behind');
  assert.equal(toCart(after)[0], '----y-', 'and it is riding in the barrow');
});

// A cart pushes its load out the back when it stops rolling. A barrow does not — what it
// scooped stays in until it is tipped, which is the whole of what scooping buys.
test('a barrow does not eject what it scooped the way a cart does', () => {
  const after = push(S(['@--C-E', '------'], ['-y----', '------']), 'r');
  assert.ok(toGrid(after)[0].includes('C'), 'still a full can, still aboard');
});

// Cargo rides cart-style, so the win condition keeps counting it without being told anything.
test('a bag in a barrow still counts against the room', () => {
  const s = S(['@--$-E', '------'], ['-y----', '------']);
  assert.equal(bagsLeft(s), 1);
  assert.equal(bagsLeft(push(s, 'r')), 1, 'scooped is not cleared');
});

test('shoved across its axis it tips, and the load carries one cell further', () => {
  //  The recycle bin's shape exactly: the dump is a shed, not a new mechanic.
  const s = S(['------', '-@----', '-c----', '------', 'E-----'], ['------', '------', '-y----', '------', '------']);
  const after = push(s, 'd');
  assert.equal(toGrid(after)[2], '-@----', 'he took the cell it left');
  assert.equal(toGrid(after)[3], '------', 'the barrow is here, empty');
  assert.equal(toGrid(after)[4], 'Ec----', 'and its load went one cell further');
});

// Same barrow, same board, two directions. Along its axis it travels the alley; across it, it
// goes one cell and tips. Nothing stores the axis but the glyph, and it never turns.
test('the axis decides which of the two things a shove is', () => {
  const along = push(S(['@----E', '------'], ['-y----', '------']), 'r');
  assert.equal(toCart(along)[0], '----y-', 'along: it travelled the alley');
  const across = push(S(['-@----', '------', '------', 'E-----'], ['------', '-y----', '------', '------']), 'd');
  assert.equal(toCart(across)[1], '------', 'across: it left this row');
  assert.equal(toCart(across)[2], '-y----', 'and went exactly one cell');
});

test('a barrow keeps its kind when it moves, or two boards would key alike', () => {
  const after = push(S(['@----E', '------'], ['-y----', '------']), 'r');
  assert.ok(toCart(after)[0].includes('y'), 'still a barrow, not an ordinary cart');
});

// --- the tow --------------------------------------------------------------------------------
// One cell cannot swallow a couch, so the barrow is the HANDLE rather than the container: it
// hooks what it cannot scoop and the pair moves as one. This is the link lane, and the magnet's
// chain rides in the same one.

import { linkCells } from '../src/rules.js';

const linked = s => s.cells.flatMap((row, y) => row.map((c, x) => [c.lk, x, y]))
  .filter(([lk]) => lk !== undefined);

test('shoved at something too big to scoop, the barrow hooks on instead of refusing', () => {
  const s = push(S(['------', '@-FF--', '------', 'E-----'], ['------', '-y----', '------', '------']), 'r');
  assert.equal(linked(s).length, 3, 'the barrow and both couch cells are one group');
  assert.deepEqual(toGrid(s)[1], '@-FF--', 'and the shove was spent taking hold');
});

test('a hooked pair moves as one rigid thing', () => {
  let s = push(S(['@--FF--E', '--------'], ['-y------', '--------']), 'r');   // rolls up and hooks
  assert.equal(linkCells(s, 0).length, 3);
  s = push(s, 'r');
  assert.equal(toGrid(s)[0], '--@-FF-E', 'the couch came along');
});

test('a tow that cannot move refuses rather than tearing itself apart', () => {
  let s = push(S(['------', '@-FF#-', '------', 'E-----'], ['------', '-y----', '------', '------']), 'r');
  assert.equal(refuse(s, 'r'), 'canRoom', 'the couch is against the wall, so nothing moves');
});

// Shoved from the far side the load drags its barrow behind it. That is the board pulling, not
// the raccoon — the one place pulling was ever allowed.
test('pushing the load drags the barrow along', () => {
  let s = push(S(['------', '@-FF--', '------', 'E-----'], ['------', '-y----', '------', '------']), 'r');
  const from = S(['------', '--FF@-', '------', 'E-----'], ['------', '-y----', '------', '------']);
  from.cells[1][1].lk = 0; from.cells[1][2].lk = 0; from.cells[1][3].lk = 0;
  const after = push(from, 'l');
  assert.equal(toGrid(after)[1], '-FF@--', 'couch moved left, and the barrow with it');
});

test('tipping lets go of what it was towing', () => {
  let s = push(S(['------', '@-FF--', '------', 'E-----'], ['------', '-y----', '------', '------']), 'r');
  for (const d of ['u', 'r']) s = push(s, d);
  s = push(s, 'd');                                   // across the axis: it tips
  assert.equal(linked(s).length, 0, 'the link is gone');
});

test('a tipping barrow is a BODY, not an occupant that moved', () => {
  // Across its axis the barrow turns over: it goes one cell and its load carries on one
  // further. The barrow has a cart sprite keyed by id — naming it in `moved` asks the stage
  // for an occupant of code NONE, which it does not hold.
  const s = S(['-----', '--@--', '--C--', '-----', '-----', 'E----'],
              ['-----', '-----', '--y--', '-----', '-----', '-----']);
  const r = explain(s, 'd', { trace: true });
  assert.ok(r.ok, `refused: ${r.reason}`);
  const step = r.steps.at(-1);
  assert.deepEqual([step.piece].flat(), [{ kind: 'cart', ref: 0, dx: 0, dy: 1 }]);
  assert.ok(!step.moved.some(m => m.o === NONE), 'nothing of code NONE is an occupant sprite');
});
