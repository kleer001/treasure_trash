// Transfer on impact. A rolling thing that strikes another rolling thing hands its motion over
// rather than simply stopping — one rule that replaces what would otherwise be a special power
// on one piece, and that every roller in the roster inherits for free.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain } from '../src/rules.js';
import { toState, toGrid } from '../src/format.js';

const S = grid => toState({ id: 't', grid });
const push = (s, dir) => { const r = explain(s, dir); assert.ok(r.ok, `refused: ${r.reason}`); return r.next; };
const refuse = (s, dir) => { const r = explain(s, dir); assert.ok(!r.ok, 'expected a refusal'); return r.reason; };

test('a roller that strikes a stationary roller hands its motion on and stays put', () => {
  //  @w--w----E : the near bin rolls into the far one, stops dead against it, and the far one
  //  carries on to the wall. Neither ends up where a simple "travels until blocked" would put it.
  const s = S(['@w--w----', 'E--------']);
  assert.deepEqual(toGrid(push(s, 'r')), ['-@-w----w', 'E--------']);
});

test('the hand-off is not a special power of one piece — it cascades', () => {
  // Each bin rolls only as far as the next one, and the last has the whole alley to itself.
  const s = S(['@w-w-w---', 'E--------']);
  const after = toGrid(push(s, 'r'))[0];
  assert.equal(after, '-@w-w---w', 'each in turn takes the roll and passes it on');
});

test('rollers already touching are shoved as one, and do not hand off between themselves', () => {
  const s = S(['@ww-----', 'E-------']);
  assert.deepEqual(toGrid(push(s, 'r')), ['-@----ww', 'E-------']);
});

test('a slider is not a roller, so it neither travels nor hands anything on', () => {
  // Shoved straight at a bin the can simply has nowhere to go: it cannot travel, and it cannot
  // hand the shove over either. Refusal is the whole of what a slider does against a roller.
  assert.equal(refuse(S(['@cw-----', 'E-------']), 'r'), 'canRoom');
  // With room it moves its one cell, and a bin further down the alley never hears about it.
  assert.deepEqual(toGrid(push(S(['@c-w----', 'E-------']), 'r')), ['-@cw----', 'E-------']);
});

test('a train with nowhere at all to go is refused, as one roller always was', () => {
  assert.equal(refuse(S(['@ww', 'E--']), 'r'), 'canRoom');
});

test('a full bin sheds from the back of the train, where the only free cell is', () => {
  // Two full bins abreast: the rear one has the cell the train vacated behind it, the front one
  // has its neighbour. So exactly one bag comes out, and it comes out of the back.
  const s = S(['@WW-----', 'E-------']);
  const after = toGrid(push(s, 'r'))[0];
  assert.equal((after.match(/\$/g) ?? []).length, 1, 'one bag, not two');
  assert.equal((after.match(/w/g) ?? []).length, 1, 'and one of the bins is now empty');
});

test('a roll that ends down a grate carries the bag down with it', () => {
  const s = toState({ id: 't', grid: ['@W--', 'E---'], water: ['---O', '----'] });
  const after = toGrid(push(s, 'r'))[0];
  assert.ok(!after.includes('W') && !after.includes('$'), 'bin and bag both gone');
});

// --- anisotropy -----------------------------------------------------------------------------
// A bin is round from every side. A tyre has an axis, and that is the whole of the difference:
// the question a shove asks is not "does this roll" but "does this roll from here".

test('a tyre rolls along its axis and is shoved one cell across it', () => {
  assert.deepEqual(toGrid(push(S(['@o----E']), 'r')), ['-@---oE'], 'along: to the far end');
  const across = toGrid(push(S(['------', '-@----', '-o----', '------', 'E-----']), 'd'));
  assert.deepEqual(across, ['------', '------', '-@----', '-o----', 'E-----'], 'across: one cell');
});

test('a tyre takes a hand-off along its axis, and refuses one across it', () => {
  // Same board twice, the tyre turned. Turned to match, it takes the roll and carries on;
  // turned across, it is simply something the bin stops against.
  assert.deepEqual(toGrid(push(S(['@w--o-E']), 'r')), ['-@-w-oE'], 'along: the roll carries on');
  assert.deepEqual(toGrid(push(S(['@w--O-E']), 'r')), ['-@-wO-E'], 'across: it blocks instead');
});

// One hand-off rule, whatever shape the receiver is: each piece asks it of its own footprint,
// so what can take a roll is whatever rolls THIS way. A rug and a bicycle roll on opposite
// axes, which is why the pair that hands off is the pair lying across each other.
test('a rolling rug hands its motion to a bicycle pointing down the lane', () => {
  const after = toGrid(push(S(['-@--------', '-UUU------', '----------', '-Y--------', '-Y--------',
                               '----------', '----------', 'E---------']), 'd'));
  assert.equal(after[2], '-UUU------', 'the rug stopped against it');
  assert.equal(after[7], 'EY--------', 'and the bicycle went on to the wall');
});

test('and stops dead against one lying across the lane', () => {
  const after = toGrid(push(S(['-@--------', '-UUU------', '----------', '-YY-------', 'E---------']), 'd'));
  assert.equal(after[2], '-UUU------', 'the rug rolled up to it');
  assert.equal(after[3], '-YY-------', 'no hand-off: the bicycle cannot roll that way');
});

test('a single-cell roller and a multi-cell one hand off to each other', () => {
  const after = toGrid(push(S(['@w--U-----', '----U-----', '----U-----', 'E---------']), 'r'));
  assert.equal(after[0], '-@-w-----U', 'the bin stopped against the rug, which rolled on');
  assert.equal(after[1], '---------U');
});
