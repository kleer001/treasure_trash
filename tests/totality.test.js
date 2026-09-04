// Every table that has to know about every piece, asked whether it does.
//
// Both of the tables below already fail loudly when they meet a code they were never told about
// — the writer throws rather than shortening a row, the drawing throws rather than leaving a
// piece invisible. What neither of them can do is fail EARLY: the throw waits for a board that
// happens to hold that piece, so a code added today and drawn in no shipped room is a fault
// sitting quietly until someone builds the room that finds it.
//
// So they are asked here about every code the engine has, which is the moment the code is added
// rather than the moment it is first played.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OCCUPANTS, NONE, isMultiCell } from '../src/rules.js';
import { toState, toGrid, MULTI_POOLS } from '../src/format.js';
import { drawOccupant } from '../src/sprites.js';

/** Every occupant code the engine names, without the helpers that ride along in the same box. */
const codes = Object.entries(OCCUPANTS)
  .filter(([, v]) => typeof v === 'number' && v !== NONE)
  .map(([name, o]) => ({ name, o }));

// Two families, and each is asked its own question. A thing on one cell is written as one
// character and drawn by its code; a thing over several is written with a letter borrowed from a
// pool — two flush couches need two letters — and drawn once across its whole span. Asking
// either question of the other family gets a wrong answer that looks like a missing entry.
const single = codes.filter(c => !isMultiCell(c.o));
const spans = codes.filter(c => isMultiCell(c.o));

test('the engine names some pieces at all, so the checks below are not vacuous', () => {
  assert.ok(codes.length > 25, `only ${codes.length} occupant codes`);
});

test('the two families are both populated, so neither check is vacuous', () => {
  assert.ok(single.length > 20 && spans.length > 2, `${single.length} single, ${spans.length} span`);
});

test('every one-cell piece can be written back to a level file, as one character', () => {
  // Through a real board rather than the table directly: writing is what a level file needs and
  // the table is only how it is done, so this stays true if the how changes.
  const missing = [];
  for (const { name, o } of single) {
    const grid = ['#####', '#-@-#', '#---#', '#--E#', '#####'];
    const s = toState({ id: 'w', grid });
    s.cells[1][3].o = o;
    try {
      const ch = toGrid(s)[1][3];
      if (typeof ch !== 'string' || ch.length !== 1) missing.push(`${name}: wrote ${JSON.stringify(ch)}`);
    } catch (e) { missing.push(`${name}: ${e.message}`); }
  }
  assert.deepEqual(missing, []);
});

test('every piece that covers several cells has a pool of letters to be written with', () => {
  const missing = spans.filter(({ o }) => !MULTI_POOLS.some(m => m.o === o && m.pool.length))
    .map(({ name }) => name);
  assert.deepEqual(missing, []);
});

test('every piece has a drawing', () => {
  // A stub for the sprite sheet: this asks whether the dispatch reaches a drawing, not what the
  // drawing looks like, so the canvas is not needed and neither is a browser.
  const drawn = [];
  const sheet = new Proxy({}, { get: (_, k) => (...a) => drawn.push([k, ...a]) });
  const missing = [];
  // A body is drawn once over its whole span by the stage rather than per cell by its code, so
  // this is the one-cell family's question. The span family's drawing is checked on screen.
  for (const { name, o } of single) {
    drawn.length = 0;
    try {
      drawOccupant(sheet, OCCUPANTS, o, 0, 0);
      if (!drawn.length) missing.push(`${name}: dispatch reached no drawing`);
    } catch (e) { missing.push(`${name}: ${e.message}`); }
  }
  assert.deepEqual(missing, []);
});

test('no two pieces are written with the same character', () => {
  // A shared glyph reads back as the wrong piece, which a round trip cannot notice on its own:
  // both boards parse, and one of them is a different room.
  const seen = new Map(), clashes = [];
  for (const { name, o } of single) {
    const grid = ['#####', '#-@-#', '#---#', '#--E#', '#####'];
    const s = toState({ id: 'w', grid });
    s.cells[1][3].o = o;
    const ch = toGrid(s)[1][3];
    if (seen.has(ch)) clashes.push(`${seen.get(ch)} and ${name} both write '${ch}'`);
    seen.set(ch, name);
  }
  assert.deepEqual(clashes, []);
});
