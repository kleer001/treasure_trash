// The wheelbarrow.
// In the `:cart` mask a barrow is written as the direction it faces.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, bagsLeft, NONE, CAN_FULL, BAR_R, cell, chainOf, cartCells } from '../src/rules.js';
import { toState, toGrid, toCart, toHold } from '../src/format.js';

const S = (grid, cart) => toState({ id: 't', grid, cart });
const push = (s, dir) => { const r = explain(s, dir); assert.ok(r.ok, `refused: ${r.reason}`); return r.next; };
const refuse = (s, dir) => { const r = explain(s, dir); assert.ok(!r.ok, 'expected a refusal'); return r.reason; };

test('shoved the way it faces, a barrow scoops what it is TOUCHING', () => {
  const after = push(S(['@-c--E', '------'], ['-r----', '------']), 'r');
  assert.equal(toGrid(after)[0], '-@c--E', 'the can is riding, not left behind');
  assert.equal(toCart(after)[0], '--r---', 'and it is riding in the barrow');
});

test('a barrow does not eject what it scooped the way a cart does', () => {
  const after = push(S(['@--C-E', '------'], ['-r----', '------']), 'r');
  assert.ok(toGrid(after)[0].includes('C'), 'still a full can, still aboard');
});

test('a bag in a barrow still counts against the room', () => {
  const s = S(['@--$-E', '------'], ['-r----', '------']);
  assert.equal(bagsLeft(s), 1);
  assert.equal(bagsLeft(push(s, 'r')), 1, 'scooped is not cleared');
});

test('shoved across its line it tips, and the load carries one cell further', () => {
  const s = S(['------', '-@----', '-c----', '------', 'E-----'], ['------', '------', '-r----', '------', '------']);
  const after = push(s, 'd');
  assert.equal(toGrid(after)[2], '-@----', 'he took the cell it left');
  assert.equal(toGrid(after)[3], '------', 'the barrow is here, empty');
  assert.equal(toGrid(after)[4], 'Ec----', 'and its load went one cell further');
});

test('the facing decides which of the three things a shove is', () => {
  const along = push(S(['@----E', '------'], ['-r----', '------']), 'r');
  assert.equal(toCart(along)[0], '----r-', 'along: it travelled the alley');
  const across = push(S(['-@----', '------', '------', 'E-----'], ['------', '-r----', '------', '------']), 'd');
  assert.equal(toCart(across)[1], '------', 'across: it left this row');
  assert.equal(toCart(across)[2], '-r----', 'and went exactly one cell');
});

test('shoved against its facing it rolls, and picks nothing up', () => {
  const after = push(S(['E@---c', '------'], ['--l---', '------']), 'r');
  assert.equal(toCart(after)[0], '----l-', 'it rolled up to the can and stopped');
  assert.equal(toGrid(after)[0], 'E-@--c', 'the can is still on the floor, not aboard');
});

test('backwards down a clear alley it rolls to the end, still empty', () => {
  const after = push(S(['E@----', '------'], ['--l---', '------']), 'r');
  assert.equal(toCart(after)[0], '-----l', 'it ran to the wall');
  assert.equal(toGrid(after)[0], 'E-@---', 'and he took the cell it left');
});

test('the same barrow turned round, the other way: it scoops', () => {
  const after = push(S(['c-@--E', '------'], ['-l----', '------']), 'l');
  assert.equal(toCart(after)[0], 'l-----', 'it took the cell the can was in');
  assert.equal(toGrid(after)[0], 'c@---E', 'and the can went with it, aboard');
});

test('a barrow keeps its kind when it moves, or two boards would key alike', () => {
  const after = push(S(['@----E', '------'], ['-r----', '------']), 'r');
  assert.ok(toCart(after)[0].includes('r'), 'still a barrow, and still facing the same way');
});

// --- the tow --------------------------------------------------------------------------------

import { inAHold } from '../src/rules.js';

const linked = s => s.cells.flatMap((row, y) => row.map((c, x) => [x, y]))
  .filter(([x, y]) => inAHold(s, x, y));

test('shoved at something too big to scoop, the barrow hooks on instead of refusing', () => {
  const s = push(S(['------', '@-FF--', '------', 'E-----'], ['------', '-r----', '------', '------']), 'r');
  assert.equal(linked(s).length, 3, 'the barrow and both couch cells are one group');
  assert.deepEqual(toGrid(s)[1], '@-FF--', 'and the shove was spent taking hold');
});

test('a hooked pair moves as one rigid thing', () => {
  let s = push(S(['@--FF--E', '--------'], ['-r------', '--------']), 'r');
  assert.equal(linked(s).length, 3, 'barrow and both couch cells, one complex');
  s = push(s, 'r');
  assert.equal(toGrid(s)[0], '--@-FF-E', 'the couch came along');
});

test('a blocked tow refuses; a barrow shoved again would only take the same hold back', () => {
  let s = push(S(['------', '@-FF#-', '------', 'E-----'], ['------', '-r----', '------', '------']), 'r');
  assert.equal(refuse(s, 'r'), 'canRoom', 'the couch is against the wall, so the shove has nowhere to go');
});

test('pushing the load drags the barrow along', () => {
  let s = push(S(['------', '@-FF--', '------', 'E-----'], ['------', '-r----', '------', '------']), 'r');
  const from = S(['------', '--FF@-', '------', 'E-----'], ['------', '-r----', '------', '------']);
  from.cells[1][1].grip = 1;
  const after = push(from, 'l');
  assert.equal(toGrid(after)[1], '-FF@--', 'couch moved left, and the barrow with it');
});

test('tipping lets go of what it was towing', () => {
  let s = push(S(['------', '@-FF--', '------', 'E-----'], ['------', '-r----', '------', '------']), 'r');
  for (const d of ['u', 'r']) s = push(s, d);
  s = push(s, 'd');
  assert.equal(linked(s).length, 0, 'the link is gone');
});

test('a tipping barrow is a BODY, not an occupant that moved', () => {
  const s = S(['-----', '--@--', '--C--', '-----', '-----', 'E----'],
              ['-----', '-----', '--d--', '-----', '-----', '-----']);
  const r = explain(s, 'd', { trace: true });
  assert.ok(r.ok, `refused: ${r.reason}`);
  const step = r.steps.at(-1);
  const [body] = step.moved;
  assert.deepEqual([body.handle, body.ref, body.dx, body.dy], ['2,2/cart', 0, 0, 1]);
  assert.deepEqual(body.cells, cartCells(r.frames[0], 0));
  assert.equal(body.becomes.lane, 'cart', 'it is set down as the cart it already was');
  assert.ok(!step.moved.some(m => m.o === NONE), 'nothing of code NONE is an occupant sprite');
});

// --- a barrow in a barrow -------------------------------------------------------------------

test('a barrow scoops an empty barrow and carries it off', () => {
  const after = push(S(['@----E', '------'], ['-rs---', '------']), 'r');
  assert.equal(toGrid(after)[0], '-@>--E', 'the one it took is riding, still facing right');
  assert.equal(toCart(after)[0], '--r---', 'and only one cart is left on the board');
});

test('tipped out, it is a barrow again', () => {
  const s = S(['------', '-@----', '->----', '------', 'E-----'],
              ['------', '------', '-r----', '------', '------']);
  const after = push(s, 'd');
  assert.equal(toCart(after)[3], '-r----', 'the one that carried it');
  assert.equal(toCart(after)[4], '-s----', 'and the one it tipped out, a cart once more');
  assert.equal(toGrid(after)[4], 'E-----', 'nothing riding anywhere');
});

test('a loaded barrow is picked up with its load still in it', () => {
  const s = S(['-@---E', '------'], ['--rs--', '------']);
  s.cells[0][3].o = CAN_FULL;
  const r = explain(s, 'r');
  assert.ok(r.ok, `refused: ${r.reason}`);
  assert.equal(toCart(r.next)[0], '---r--', 'one barrow left, holding the other');
  assert.deepEqual(chainOf(cell(r.next, 3, 0)), [BAR_R, CAN_FULL],
    'a barrow facing right, with the can still in it');
  assert.deepEqual(toHold(r.next), ['3,0 C'], 'and the load is written down');
});

test('a barrow carries a barrow carrying a barrow, and every load comes back', () => {
  const s = toState({ id: 't',
    grid: ['-----C--', '---@----', 'E-------'],
    cart: ['-r--st--', '--------', '--------'] });
  let at = s;
  for (const dir of [...'urdllllurrrr']) {
    const r = explain(at, dir);
    assert.ok(r.ok, `${dir} refused: ${r.reason}`);
    at = r.next;
  }
  assert.equal(toCart(at)[0], '-----r--', 'one barrow left on the board');
  assert.deepEqual(chainOf(cell(at, 5, 0)), [BAR_R, BAR_R, CAN_FULL], 'three deep');
  assert.equal(bagsLeft(at), 1, 'the can is still a can the exit is waiting on');

  const back = toState({ id: 'rt', grid: toGrid(at), cart: toCart(at), hold: toHold(at) });
  assert.deepEqual(chainOf(cell(back, 5, 0)), [BAR_R, BAR_R, CAN_FULL], 'and it round-trips');
});

test('a hooked barrow is spoken for, and cannot be picked up', () => {
  const s = S(['@---FF-E', '--------'], ['-r-r----', '--------']);
  s.cells[0][3].grip = 1;
  const r = explain(s, 'r');
  assert.ok(r.ok, `refused: ${r.reason}`);
  assert.equal(toCart(r.next)[0], '--rs----', 'it stopped against it rather than taking it');
});
