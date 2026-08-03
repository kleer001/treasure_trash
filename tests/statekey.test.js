// The state key is the solver's identity function: two boards share a key only if they
// ARE the same board. If that ever fails, the solver silently treats an unvisited state as
// visited, and "provably minimal par" stops being proven — a wrong answer with no error.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stateKey, step } from '../src/rules.js';
import { toState, toGrid, toWater } from '../src/format.js';

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

const S = (grid, water) => toState({ id: 't', grid, water });

// Trash is the one occupant whose MEANING depends on the terrain under it: a blocker on
// floor, walkable ground on water. Same code, opposite boards.
test('trash on floor and trash on water are different boards', () => {
  assert.notEqual(stateKey(S(['x@E'])), stateKey(S(['x@E'], ['~--'])));
});

// Multi-cell pieces are the same hazard in a different coat: the occupant codes cannot say
// where one couch ends and the next begins, and the two boards below push completely
// differently. One long couch, or two short ones flush together.
test('one long couch and two short ones are different boards', () => {
  assert.notEqual(stateKey(S(['FFFF-', '--@--', 'E----'])),
                  stateKey(S(['FFGG-', '--@--', 'E----'])));
});

test('the piece lane is canonical — it keys on the partition, not on which ids are in play', () => {
  const a = S(['FFGG-', '--@--', 'E----']);
  const b = S(['HHKK-', '--@--', 'E----']);       // same partition, different letters and pids
  assert.equal(stateKey(a), stateKey(b));
});

// The failure the water jug introduced, played out. Shove the jug in a circuit and every
// occupant comes home — the jug to the cell it started on, the raccoon to his. What does
// not come home is the four cells of water spilled along the way. Key on occupants alone
// and this is the opening position; the solver would stop exploring here and call whatever
// par it had already found "provably minimal", with nothing to indicate it had been fooled.
test('a jug shoved in a circuit returns every occupant but not the board', () => {
  const start = S(['-------', '-------', '-------', '---j---', '---@---', '-------', 'E------']);
  let s = start;
  for (const dir of 'urulruullddulldd' + 'rrlddrru') {
    s = step(s, dir);
    assert.ok(s, `the circuit went illegal at '${dir}'`);
  }
  assert.deepEqual(toGrid(s), toGrid(start), 'every occupant should be home');
  assert.equal(toWater(start), null);
  assert.ok(toWater(s).join('').includes('~'), 'and the water it spilled should not be');
  assert.notEqual(stateKey(s), stateKey(start));
});
