// The office chair. Burst trash knocks it exactly one cell; everything else rolls it. That
// asymmetry is the point: the precise result belongs to the AIMED action, so a tear stops being
// purely a cost and becomes something you point at a thing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain } from '../src/rules.js';
import { toState, toGrid } from '../src/format.js';

const S = grid => toState({ id: 't', grid });
const push = (s, dir) => { const r = explain(s, dir); assert.ok(r.ok, `refused: ${r.reason}`); return r.next; };

test('burst trash knocks a chair exactly one cell, and the trash lands where it stood', () => {
  const after = toGrid(push(S(['-----', '--h--', '--$--', '--@--', 'E----']), 'u'));
  assert.equal(after[0], '--h--', 'one cell, no further');
  assert.equal(after[1], '-xxx-', 'and the cell it left is filled in behind it');
});

// The tear branch stamps the bag's own cell on everything it throws, so each chair in a
// five-cell spray still has one ray. A ray that comes out diagonal takes the burst's own
// direction, because a grid has nowhere else to put it.
test('a chair on the diagonal of a fan flees the way the burst is going', () => {
  const after = toGrid(push(S(['-----', '-h---', '--$--', '--@--', 'E----']), 'u'));
  assert.equal(after[0], '-h---', 'up, not up-and-left');
});

test('a shove from the raccoon rolls it instead, all the way', () => {
  const along = toGrid(push(S(['@h-----E']), 'r'));
  assert.equal(along[0], '-@----hE', 'the length of the alley, not one cell');
  // And a chair with nowhere to roll refuses the shove, which is the roller branch's own shape:
  // the chair needed no rule of its own for this.
  const r = explain(S(['-h------', '-@------', 'E-------']), 'u');
  assert.ok(!r.ok);
  assert.equal(r.reason, 'canRoom');
});

// The fan's legality now turns on a cell BEYOND the fan, so a refusal that named only the chair
// would put a red cross on a thing with no visible reason. It names the flee cell too.
test('a cornered chair makes the burst a refusal, and blames the cell it cannot reach', () => {
  const r = explain(S(['#####', '#-h-#', '#-$-#', '#-@-#', 'E---#']), 'u');
  assert.ok(!r.ok);
  assert.equal(r.reason, 'fan');
  assert.deepEqual(r.blame, [[2, 1], [2, 0]], 'the chair, and the cell behind it');
});

test('a chair knocked into a grate goes down it', () => {
  const s = toState({ id: 't', grid: ['-----', '--h--', '--$--', '--@--', 'E----'],
                      water: ['--O--', '-----', '-----', '-----', '-----'] });
  const after = toGrid(push(s, 'u'));
  assert.ok(!after.join('').includes('h'), 'gone down the drain');
});
