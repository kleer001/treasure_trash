// The bench packs — the rooms that exist to be played by hand rather than put in an act.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseLevelPack, parseLurd, toState } from '../src/format.js';
import { applyAction, isWon } from '../src/rules.js';
import { root } from '../tools/packs.mjs';

// The matrix and the gallery are pictures of one press each, not rooms to win.
const benches = readdirSync(resolve(root, 'levels'))
  .filter(f => f.endsWith('.tt') && !/^act\d+\.tt$/.test(f) && !['matrix.tt', 'gallery.tt'].includes(f));

test('every bench pack still plays the solution it declares', () => {
  assert.ok(benches.length, 'no bench packs found');
  for (const file of benches) {
    const pack = parseLevelPack(readFileSync(resolve(root, 'levels', file), 'utf8'));
    for (const level of pack.levels) {
      let s = toState(level);
      const acts = parseLurd(level.solve, `${file}:${level.id}`);
      for (const a of acts) s = applyAction(s, a);
      assert.ok(isWon(s), `${file}:${level.id} — its solve no longer wins`);
      assert.equal(acts.length, level.par, `${file}:${level.id} — :par is not the solve's length`);
    }
  }
});
