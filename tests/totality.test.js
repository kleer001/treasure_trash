// Every table that has to know about every piece, asked whether it does.
// The reading is `tools/pieces.mjs`, which prints the same rows for a person. Asking over its
// sheet rather than probing again is the point: a gate and a report that answer separately can
// disagree about what a piece owes, which is the one thing they exist to agree on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheet } from '../tools/pieces.mjs';

const rows = sheet();
const single = rows.filter(r => !r.pooled);
const spans = rows.filter(r => r.pooled);

test('the two families are both populated, so nothing below is vacuous', () => {
  assert.ok(single.length > 20 && spans.length > 2, `${single.length} single, ${spans.length} span`);
});

test('every one-cell piece can be written back to a level file, as one character', () => {
  assert.deepEqual(single.filter(r => typeof r.glyph !== 'string' || r.glyph.length !== 1)
    .map(r => `${r.name}: writes ${JSON.stringify(r.glyph)}`), []);
});

test('every piece that covers several cells has a pool of letters to be written with', () => {
  assert.deepEqual(spans.filter(r => !r.glyph).map(r => r.name), []);
});

test('every piece has a drawing', () => {
  assert.deepEqual(rows.filter(r => r.drawing === false).map(r => r.name), []);
});

test('every piece is described in the legend a level author reads', () => {
  assert.deepEqual(single.filter(r => r.legend === false)
    .map(r => `${r.name} writes '${r.glyph}', which the legend never mentions`), []);
});

test('no two pieces are written with the same character', () => {
  // A shared glyph reads back as the wrong piece, which a round trip cannot notice on its own:
  // both boards parse, and one of them is a different room.
  const seen = new Map(), clashes = [];
  for (const r of single) {
    if (seen.has(r.glyph)) clashes.push(`${seen.get(r.glyph)} and ${r.name} both write '${r.glyph}'`);
    seen.set(r.glyph, r.name);
  }
  assert.deepEqual(clashes, []);
});
