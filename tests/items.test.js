// Each new piece, checked against the row it has in the levels.md item table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, bagsLeft } from '../spike/rules.mjs';
import { toState, toGrid } from '../spike/format.mjs';

const S = grid => toState({ id: 't', grid });
const after = (grid, dir) => {
  const r = explain(S(grid), dir);
  assert.ok(r.ok, `expected a legal action, got refused (${r.reason})`);
  return toGrid(r.next);
};
const refused = (grid, dir) => {
  const r = explain(S(grid), dir);
  assert.ok(!r.ok, 'expected a refusal');
  return r.reason;
};

test('recycle bin slides one and drops one cell of trash directly ahead', () => {
  assert.deepEqual(after(['-----', '-----', '--b--', '--@--', 'E----'], 'u'),
                          ['--x--', '--b--', '--@--', '-----', 'E----']);
});

test('recycle bin is refused when its trash would land on the exit', () => {
  assert.equal(refused(['--E--', '-----', '--b--', '--@--', '-----'], 'u'), 'exit');
});

test('bag-on-can stack launches the bag two and slides the can one, still full', () => {
  assert.deepEqual(after(['-----', '-----', '--S--', '--@--', 'E----'], 'u'),
                          ['--$--', '--C--', '--@--', '-----', 'E----']);
});

test('a stack is worth two bags — the loose one and the one still in the can', () => {
  assert.equal(bagsLeft(S(['--S--', '--@--', 'E----'])), 2);
  assert.equal(bagsLeft(S(['--$--', '--C--', '--@--', 'E----'])), 2);
});

test('wheelie bin rolls until stopped, dumps out the back, raccoon stays put', () => {
  assert.deepEqual(after(['-----', '-----', '-----', '--W--', 'E-@--'], 'u'),
                          ['--w--', '--$--', '-----', '-----', 'E-@--']);
});

test('a one-cell roll drops the bag on the cell the bin just vacated', () => {
  assert.deepEqual(after(['--#--', '-----', '--W--', '--@--', 'E----'], 'u'),
                          ['--#--', '--w--', '--$--', '--@--', 'E----']);
});

test('an emptied wheelie bin still rolls', () => {
  assert.deepEqual(after(['-----', '-----', '--w--', '--@--', 'E----'], 'u'),
                          ['--w--', '-----', '-----', '--@--', 'E----']);
});

test('a wheelie bin with nowhere to roll is refused', () => {
  assert.equal(refused(['--#--', '--W--', '--@--', 'E----'], 'u'), 'canRoom');
});

test('a rolling bin stops short of the exit rather than occupying it', () => {
  assert.deepEqual(after(['--E--', '-----', '--w--', '--@--', '-----'], 'u'),
                          ['--E--', '--w--', '-----', '--@--', '-----']);
});

test('glyphs round-trip through the serialiser', () => {
  const g = ['Sb---', '-Ww--', '--@--', 'E----'];
  assert.deepEqual(toGrid(S(g)), g);
});
