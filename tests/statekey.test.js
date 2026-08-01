// The state key is the solver's identity function: two boards share a key only if they
// ARE the same board. If that ever fails, the solver silently treats an unvisited state as
// visited, and "provably minimal par" stops being proven — a wrong answer with no error.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stateKey } from '../spike/rules.mjs';

/** Minimal board carrying nothing but the occupant codes under test. */
const board = codes => ({
  cols: codes.length, rows: 1, rac: { x: 0, y: 0 },
  cells: [codes.map(o => ({ o }))],
});

test('distinct boards get distinct keys, for occupant codes past a single digit', () => {
  // The pair that breaks a delimiter-free decimal join: 1,0,10 and 10,1,0 both render
  // as "1010". Nothing in the game reaches code 10 yet — this fixes the ceiling in place
  // so the next piece added cannot quietly reintroduce the collision.
  assert.notEqual(stateKey(board([1, 0, 10])), stateKey(board([10, 1, 0])));
});

test('the key stays one character per cell, so the solver holds long keys cheaply', () => {
  const [grid] = stateKey(board([0, 1, 2, 3, 4])).split('|');
  assert.equal(grid.length, 5);
});

test('the same board always keys the same, and a moved raccoon does not', () => {
  assert.equal(stateKey(board([0, 1, 2])), stateKey(board([0, 1, 2])));
  const moved = board([0, 1, 2]);
  moved.rac = { x: 2, y: 0 };
  assert.notEqual(stateKey(board([0, 1, 2])), stateKey(moved));
});
