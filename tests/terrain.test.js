// The terrain lanes. Each is a value a cell carries alongside its occupant, which is what lets
// one lane multiply against every mechanic at once — and what makes each of these specs a
// statement about the whole roster rather than about one piece.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, step, bagsLeft } from '../src/rules.js';
import { toState, toGrid, toWater } from '../src/format.js';

const S = (grid, water) => toState({ id: 't', grid, water });
const push = (s, dir) => { const r = explain(s, dir); assert.ok(r.ok, `refused: ${r.reason}`); return r.next; };
const refuse = (s, dir) => { const r = explain(s, dir); assert.ok(!r.ok, 'expected a refusal'); return r.reason; };

// --- grease ---------------------------------------------------------------------------------

test('a slider shoved onto grease carries on to the end of the slick', () => {
  const s = S(['@c----E'], ['--%%%--']);
  assert.deepEqual(toGrid(push(s, 'r')), ['-@---cE']);
});

test('grease changes nothing for a roller, which already travelled', () => {
  const dry = S(['@w----E']);
  const slick = S(['@w----E'], ['--%%%--']);
  assert.deepEqual(toGrid(step(dry, 'r')), toGrid(step(slick, 'r')));
});

test('a container settles its bill where it stops, not where it was shoved', () => {
  // The can sheds one cell past its resting place — off the end of the slick, not at its head.
  const s = S(['@C-----', 'E------'], ['--%%%--', '-------']);
  assert.deepEqual(toGrid(push(s, 'r')), ['-@---c$', 'E------']);
});

// --- tar ------------------------------------------------------------------------------------

test('tar keeps what enters it, and the raccoon walks over it freely', () => {
  const s = S(['@c---E'], ['--T---']);
  const stuck = push(s, 'r');                    // can slides onto the tar
  assert.deepEqual(toGrid(stuck), ['-@c--E']);
  assert.equal(refuse(stuck, 'r'), 'tar');       // and never comes off again
  assert.ok(explain(S(['@--E'], ['-T--']), 'r').ok, 'he crosses tar himself');
});

test('a single foot in the tar holds a whole couch', () => {
  const s = S(['@FF--', 'E----'], ['---T-', '-----']);
  const moved = push(s, 'r');
  assert.equal(refuse(moved, 'r'), 'tar');
});

// --- one-way --------------------------------------------------------------------------------

test('a one-way cell admits its own direction and no other', () => {
  assert.ok(explain(S(['@--E'], ['->--']), 'r').ok, 'rightward, through a rightward cell');
  assert.equal(refuse(S(['@--E'], ['-<--']), 'r'), 'oneway', 'and not against it');
});

test('a one-way binds what is pushed as well as who pushes', () => {
  assert.equal(refuse(S(['@c--E'], ['--<--']), 'r'), 'oneway');
});

// --- sewer grate ----------------------------------------------------------------------------

test('a grate swallows what is shoved into it, bags and all', () => {
  const s = S(['@C--E'], ['--O--']);
  assert.equal(bagsLeft(s), 1);
  const after = push(s, 'r');
  assert.deepEqual(toGrid(after), ['-@--E']);
  assert.equal(bagsLeft(after), 0, 'the can took its bag down with it');
});

test('a bin rolled into a grate goes down holding its bag, and sheds nothing', () => {
  const s = S(['@W--E'], ['---O-']);
  const after = push(s, 'r');
  assert.equal(bagsLeft(after), 0);
  assert.ok(!toGrid(after).join('').includes('$'), 'nothing was shed on the way down');
});

test('the raccoon crosses a grate that swallows objects', () => {
  assert.ok(explain(S(['@--E'], ['-O--']), 'r').ok);
});

test('trash laid on a grate falls straight through', () => {
  const bare = S(['------', '-@$---', 'E-----']);
  const drained = S(['------', '-@$---', 'E-----'], ['------', '---O--', '------']);
  const count = st => (toGrid(push(st, 'r')).join('').match(/x/g) ?? []).length;
  assert.equal(count(bare), 5, 'a fan is five cells');
  assert.equal(count(drained), 4, 'and one of them went down the drain');
});

// --- broken glass ---------------------------------------------------------------------------

test('the raccoon may not step on broken glass', () => {
  assert.equal(refuse(S(['@--E'], ['-*--']), 'r'), 'glass');
});

test('objects rest on broken glass, and he cannot shove one that does', () => {
  const s = S(['@c--E'], ['--*--']);
  const on = push(s, 'r');
  assert.deepEqual(toGrid(on), ['-@c-E'], 'the can sits on the glass');
  assert.equal(refuse(on, 'r'), 'glass', 'and he cannot follow it in to push it again');
});

// --- water, unchanged -----------------------------------------------------------------------

test('poured water washes grease and tar off the cell it lands on', () => {
  const s = S(['@j--E'], ['---%-']);
  const after = push(s, 'r');
  assert.equal(toWater(after)[0][3], '~', 'the grease is gone, and the cell is water');
});

test('water poured into a grate drains away', () => {
  const s = S(['@j--E'], ['---O-']);
  const after = push(s, 'r');
  assert.equal(toWater(after)[0][3], 'O', 'still a grate, and dry');
});
