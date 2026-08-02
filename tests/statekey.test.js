// The state key is the solver's identity function: distinct boards must key distinctly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stateKey } from '../src/rules.mjs';

const board = codes => ({
  cols: codes.length, rows: 1, rac: { x: 0, y: 0 },
  cells: [codes.map(o => ({ o }))],
});

test('distinct boards get distinct keys, for occupant codes past a single digit', () => {
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
