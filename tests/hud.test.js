import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toState } from '../src/format.js';
import { explain } from '../src/rules.js';
import { whyText, pad } from '../src/hud.js';

const refused = (grid, dir) => {
  const s = toState({ id: 'why', grid }), r = explain(s, dir);
  assert.equal(r.ok, false);
  return whyText(s, { cells: r.blame, reason: r.reason, dir });
};

test('a refused shove names the thing in the way', () => {
  assert.match(refused(['@c#E'], 'r'), / — the wall is in the way$/);
  assert.match(refused(['@cc-E'], 'r'), / — a can is in the way$/);
});

test('a refused tear whose fan leaves the grid says the wall is in the way', () => {
  assert.match(refused(['@$-E', '----', '----'], 'r'), / — the wall's in the way$/);
});

test('a room id pads to three digits', () => {
  assert.equal(pad('L7'), '007');
  assert.equal(pad('L33'), '033');
});
