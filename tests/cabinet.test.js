// The filing cabinet. Open and closed are separate occupant CODES, which is what keeps
// `isMultiCell` the flat predicate on a code it has always been: an open cabinet is a multi-cell
// kind and a closed one is not, and no branch has to ask a piece what state it is in.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, isMultiCell, CABC_R, CABO_R, DRAWER } from '../src/rules.js';
import { toState, toGrid } from '../src/format.js';

const S = grid => toState({ id: 't', grid });
const push = (s, dir) => { const r = explain(s, dir); assert.ok(r.ok, `refused: ${r.reason}`); return r.next; };
const refuse = (s, dir) => { const r = explain(s, dir); assert.ok(!r.ok, 'expected a refusal'); return r.reason; };

// An open cabinet is a BODY and a DRAWER in two ordinary cells, not one piece that grew a second
// one. Both halves are things the board already holds and the stage already draws, and the pair
// is found from either end off the facing alone — no id, and no piece appearing mid-game.
test('a cabinet is never a multi-cell piece, open or closed', () => {
  assert.equal(isMultiCell(CABC_R), false);
  assert.equal(isMultiCell(CABO_R), false);
  assert.equal(isMultiCell(DRAWER), false);
});

test('the shove that moves it is the shove that opens it', () => {
  const after = toGrid(push(S(['-------', '-------', '-@m----', '-------', 'E------']), 'r'));
  assert.equal(after[2], '--@JX--', 'moved one cell, and its drawer is out beside it');
});

// The drawer opening is a PUSH, which is the whole of what makes the cabinet a second aimed
// action: the direction you shove and the direction something goes need not be the same.
test('the drawer shoves what stands in its way', () => {
  const after = toGrid(push(S(['-------', '-@m-c--', '-------', 'E------']), 'r'));
  assert.equal(after[1], '--@JXc-', 'the can went on one cell to make room');
});

test('a drawer that cannot open into the cell he is standing in refuses the whole move', () => {
  assert.equal(refuse(S(['-------', '--@----', '--a----', '-------', 'E------']), 'd'), 'canRoom');
});

test('shoved on the drawer toward the body it closes, and stays where it is', () => {
  const after = toGrid(push(S(['--------', '-JX@----', '--------', 'E-------']), 'l'));
  assert.equal(after[1], '-m@-----', 'closed, one cell, and it did not move');
});

test('shoved anywhere else an open cabinet moves as one rigid thing', () => {
  const after = toGrid(push(S(['--------', '-@JX----', '--------', 'E-------']), 'r'));
  assert.equal(after[1], '--@JX---');
});

test('a cabinet may start a level open, at any facing, and writes back as itself', () => {
  for (const grid of [
    ['--@-', '--X-', '--A-', 'E---'],        // drawer above a body facing up
    ['--@-', '--D-', '--X-', 'E---'],        // and below one facing down
    ['-@--', '-XI-', '----', 'E---'],        // to the left of one facing left
    ['-@--', '-JX-', '----', 'E---'],        // to the right of one facing right
  ]) assert.deepEqual(toGrid(S(grid)), grid);
});

test('a drawer knows which cabinet it belongs to without being told', () => {
  // Two cabinets back to back, drawers pointing opposite ways. Each drawer has exactly one
  // neighbour whose facing points at it, so neither pair can be mistaken for the other.
  const s = S(['---------', '-@XIJX---', '---------', 'E--------']);
  assert.deepEqual(toGrid(s), ['---------', '-@XIJX---', '---------', 'E--------']);
});
