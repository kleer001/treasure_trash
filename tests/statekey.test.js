// The state key is the solver's identity function: two boards share a key only if they
// ARE the same board. If that ever fails, the solver silently treats an unvisited state as
// visited, and "provably minimal par" stops being proven — a wrong answer with no error.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stateKey, step, SKATE, CART_KINDS, TERRAINS } from '../src/rules.js';
import { toState, toGrid, toWater } from '../src/format.js';

const board = codes => ({
  cols: codes.length, rows: 1, rac: { x: 0, y: 0 },
  cells: [codes.map(o => ({ o }))],
});

test('distinct boards get distinct keys, for occupant codes past a single digit', () => {
  assert.notEqual(stateKey(board([1, 0, 10])), stateKey(board([10, 1, 0])));
});

test('the key stays one character per cell, so the solver holds long keys cheaply', () => {
  const [grid] = stateKey(board([0, 1, 2, 3, 4])).split('#');
  assert.equal(grid.length, 5);
});

test('no cell can emit the separator, at any occupant code or terrain', () => {
  const [sep] = stateKey(board([0])).slice(1);
  for (let o = 0; o <= 64; o++) for (let t = 0; t < TERRAINS; t++) for (const cart of [0, 1]) {
    const ch = String.fromCharCode(65 + (o * TERRAINS + t) * 2 + cart);
    assert.notEqual(ch, sep, `occupant ${o}, terrain ${t}, cart ${cart} emits the separator`);
  }
});

test('carts of different kinds that swap positions are different boards', () => {
  const carted = (kinds) => ({
    cols: 4, rows: 1, rac: { x: 3, y: 0 },
    cells: [[{ o: 0, cart: 0, ck: kinds[0] }, { o: 0, cart: 0, ck: kinds[0] },
             { o: 0, cart: 1, ck: kinds[1] }, { o: 0 }]],
  });
  assert.notEqual(stateKey(carted([SKATE, SKATE + 1])), stateKey(carted([SKATE + 1, SKATE])));
  assert.equal(stateKey(carted([SKATE, SKATE])), stateKey(carted([SKATE, SKATE])));
});

test('a cart kind never overruns into the next label', () => {
  const one = k => ({ cols: 3, rows: 1, rac: { x: 2, y: 0 },
    cells: [[{ o: 0, cart: 0, ck: k }, { o: 0, cart: 0, ck: k }, { o: 0 }]] });
  const seen = new Set();
  for (let k = 0; k < CART_KINDS; k++) seen.add(stateKey(one(k)));
  assert.equal(seen.size, CART_KINDS, 'each cart kind should key distinctly');
});

test('the same board always keys the same, and a moved raccoon does not', () => {
  assert.equal(stateKey(board([0, 1, 2])), stateKey(board([0, 1, 2])));
  const moved = board([0, 1, 2]);
  moved.rac = { x: 2, y: 0 };
  assert.notEqual(stateKey(board([0, 1, 2])), stateKey(moved));
});

const S = (grid, water) => toState({ id: 't', grid, water });

test('trash on floor and trash on water are different boards', () => {
  assert.notEqual(stateKey(S(['x@E'])), stateKey(S(['x@E'], ['~--'])));
});

test('one long couch and two short ones are different boards', () => {
  assert.notEqual(stateKey(S(['FFFF-', '--@--', 'E----'])),
                  stateKey(S(['FFGG-', '--@--', 'E----'])));
});

test('the piece lane is canonical — it keys on the partition, not on which ids are in play', () => {
  const a = S(['FFGG-', '--@--', 'E----']);
  const b = S(['HHKK-', '--@--', 'E----']);
  assert.equal(stateKey(a), stateKey(b));
});

test('a jug shoved in a circuit returns every occupant but not the board', () => {
  const start = S(['-------', '-------', '-------', '---i---', '---@---', '-------', 'E------'],
                  ['-------', '-------', '-------', '-------', '-------', '-------', '-------']);
  let s = start;
  for (const dir of 'urulruullddulldd' + 'rrlddrru') {
    s = step(s, dir);
    assert.ok(s, `the circuit went illegal at '${dir}'`);
  }
  assert.deepEqual(toGrid(s), toGrid(start), 'every occupant should be home');
  assert.equal(stateKey(s), stateKey(start));

  const wet = S(['-------', '-------', '-------', '---j---', '---@---', '-------', 'E------']);
  const poured = step(wet, 'u');
  assert.ok(toWater(poured).join('').includes('~'));
  assert.notEqual(stateKey(poured), stateKey(wet));
});
