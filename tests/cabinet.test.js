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

// A cabinet opens when it is struck on the BACK, and the blow is spent doing it: the cabinet
// does not slide, because it is not a thing that rolls.
test('struck on the back, the drawer comes out and the cabinet stays put', () => {
  const after = toGrid(push(S(['-------', '-------', '-@m----', '-------', 'E------']), 'r'));
  assert.equal(after[2], '-@JX---', 'it did not move; the drawer is out in front of it');
});

test('struck on any other face it is an ordinary shove, and stays shut', () => {
  // From the side.
  assert.equal(toGrid(push(S(['-------', '--@----', '--m----', '-------', 'E------']), 'd'))[2],
    '--@----', 'he took its cell');
  assert.equal(toGrid(push(S(['-------', '--@----', '--m----', '-------', 'E------']), 'd'))[3],
    '--m----', 'and it went one cell, still shut');
  // From the front, where the drawer would have come out: he stands on that side and pushes
  // back into it.
  assert.equal(toGrid(push(S(['-------', '--m@---', '-------', 'E------']), 'l'))[1],
    '-m@----', 'shoved back onto itself, still shut');
});

// The drawer comes out along the line the blow travelled, so it is an ordinary push.
test('the drawer shoves what stands in its way', () => {
  const after = toGrid(push(S(['-------', '-@m-c--', '-------', 'E------']), 'r'));
  assert.equal(after[1], '-@JXc--', 'the can went on one cell to make room');
});

test('a drawer with nowhere to go refuses the blow', () => {
  assert.equal(refuse(S(['------', '-@m#--', '------', 'E-----']), 'r'), 'canRoom');
});

// Driven drawer-first into something, the drawer folds home and the body carries on into the
// cell the drawer was filling — so it ends up shut, standing against whatever stopped it.
test('run drawer-first into something, it shuts and comes to rest against it', () => {
  const after = toGrid(push(S(['-------', '-@JX#--', '-------', 'E------']), 'r'));
  assert.equal(after[1], '--@m#--', 'the drawer is in and the body is against the wall');
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

// Opening is a blow, not a privilege of the raccoon's own shove: anything that comes to rest
// against the back of a shut cabinet knocks its drawer out.
test('a rolling thing that stops against its back knocks it open', () => {
  const after = toGrid(push(S(['--------', '-@w--m--', '--------', 'E-------']), 'r'));
  assert.equal(after[1], '--@-wJX-', 'the bin rolled up to it and the drawer came out');
});

test('a blow on any other face just stops the thing that struck it', () => {
  const after = toGrid(push(S(['--------', '-@w--k--', '--------', 'E-------']), 'r'));
  assert.equal(after[1], '--@-wk--', 'facing away from the blow, so it stays shut');
});

test('a blow with no room for the drawer leaves it shut', () => {
  const after = toGrid(push(S(['-------', '-@w-m#-', '-------', 'E------']), 'r'));
  assert.equal(after[1], '--@wm#-', 'nowhere for the drawer to go');
});

test('a swept line knocks it open, and the sweep is spent doing it', () => {
  const after = toGrid(push(S(['--------', '-@rcm---', '--------', 'E-------']), 'r'));
  assert.equal(after[1], '-@rcJX--', 'nothing swept; the drawer came out');
});

test('a cart that rolls up against its back knocks it open and stops there', () => {
  // Not cargo: a cart meets a cabinet and strikes it, wherever along the run it came to rest.
  const s = toState({ id: 't', grid: ['---------', '-@---m--E', '---------'],
                      cart: ['---------', '--PP-----', '---------'] });
  const r = explain(s, 'r');
  assert.ok(r.ok, `refused: ${r.reason}`);
  assert.deepEqual(toGrid(r.next), ['---------', '--@--JX-E', '---------']);
});
