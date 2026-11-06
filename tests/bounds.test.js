import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TooManyStates } from '../src/solver.js';
import { refine } from '../tools/score.mjs';
import { refit } from '../tools/pick.mjs';

const BIG = { group: 'ccccc', states: 1, grid: ['------', '-cc---', '---cc-', '-c----', '--@--E'] };

test('the pipeline measures stop at the state bound', () => {
  assert.throws(() => refine(BIG), TooManyStates);
  assert.equal(refit(BIG), null);
});

test('refine reads the water a row was built on', () => {
  const grid = ['-----', '-$E--', '-----', '-$@$-', '-----'];
  const water = ['-----', '-----', '~~~~~', '-----', '-----'];
  assert.notDeepEqual(refine({ grid, water }), refine({ grid }));
});
