// The pieces that answer a terrain lane. Each is one shove branch and one glyph; what makes
// them worth a code is that each undoes something the board could not otherwise undo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain } from '../src/rules.js';
import { toState, toGrid, toWater } from '../src/format.js';

const S = (grid, water) => toState({ id: 't', grid, water });
const push = (s, dir) => { const r = explain(s, dir); assert.ok(r.ok, `refused: ${r.reason}`); return r.next; };
const refuse = (s, dir) => { const r = explain(s, dir); assert.ok(!r.ok, 'expected a refusal'); return r.reason; };
const run = (s, dirs) => [...dirs].reduce((acc, d) => push(acc, d), s);

// --- the sponge -----------------------------------------------------------------------------

test('the sponge takes water off the cell it lands on, and is not spent doing it', () => {
  const s = run(S(['@s---E'], ['---~~-']), 'rr');
  assert.equal(toWater(s)[0][3], '-', 'the cell it landed on is dry');
  assert.ok(toGrid(s)[0].includes('s'), 'and the sponge is still a sponge');
});

// The ordering that decides the whole piece: soak resolves on landing, so there is no grease
// left underneath to slide along. A sponge is therefore grease's counter rather than its victim.
test('a sponge does not skate across grease — it stops on the first cell and dries it', () => {
  const s = push(S(['@s---E'], ['--%%%-']), 'r');
  assert.deepEqual(toGrid(s), ['-@s--E']);
  assert.equal(toWater(s)[0], '---%%-', 'only the cell it landed on');
});

// An unlimited sponge needs a bound, and the bound is that it can be lost. Tar holds it; glass
// holds it too, though a shove is refused a step earlier than that — he cannot stand on the
// shards to reach it at all, so the sponge is stranded rather than gripped.
test('the sponge is lost to tar, and stranded on glass', () => {
  const tarred = push(S(['@s---E'], ['--T---']), 'r');
  assert.equal(refuse(tarred, 'r'), 'tar');
  const shards = push(S(['@s---E'], ['--*---']), 'r');
  assert.equal(refuse(shards, 'r'), 'glass');
});

// --- flattened cardboard --------------------------------------------------------------------

test('cardboard is spent covering a hazard, and the cell becomes walkable', () => {
  for (const mask of ['--T---', '--*---', '--~---']) {
    const s = push(S(['@d---E'], [mask]), 'r');
    assert.ok(!toGrid(s)[0].includes('d'), `${mask}: the sheet is spent`);
    assert.equal(toWater(s)[0][2], '_', `${mask}: and the cell is covered`);
    assert.ok(explain(s, 'r').ok, 'and he can now walk onto it');
  }
});

test('on ordinary floor cardboard is just a sheet on the floor, and slides on grease', () => {
  const plain = push(S(['@d---E']), 'r');
  assert.deepEqual(toGrid(plain), ['-@d--E'], 'one cell, still a sheet');
  const slick = push(S(['@d---E'], ['--%%--']), 'r');
  assert.deepEqual(toGrid(slick), ['-@--dE'], 'and it is not a sponge — grease carries it');
});

test('cardboard falls into a grate rather than covering it', () => {
  const s = push(S(['@d---E'], ['--O---']), 'r');
  assert.ok(!toGrid(s)[0].includes('d'), 'gone');
  assert.equal(toWater(s)[0][2], 'O', 'and the grate is still a grate');
});

// --- the pane of glass ----------------------------------------------------------------------

test('a pane shatters into the next cell and leaves broken glass there', () => {
  const s = push(S(['@g---E']), 'r');
  assert.ok(!toGrid(s)[0].includes('g'), 'the pane is gone');
  assert.equal(toWater(s)[0][2], '*', 'and what it left is a hazard, not trash');
});

// The inversion worth having: room is what breaks it, so boxing it in is how you keep it.
test('a pane with nowhere to break rides intact, and against water it will not break at all', () => {
  assert.equal(refuse(S(['@gc--E']), 'r'), 'canRoom', 'boxed in behind a can');
  assert.equal(refuse(S(['@g---E'], ['--~---']), 'r'), 'water', 'and glass does not go in the canal');
});
