// The filing cabinet. Shut it is one cell and an ordinary occupant; open it is one PIECE of two
// cells lying along its facing, the drawer being the end the facing points at. Opening and
// shutting are swaps: one piece is destroyed and the other put down, so nothing ever grows a cell
// and no board can hold half a cabinet.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, isMultiCell, CABC_R, CABO_R, cell, isCart } from '../src/rules.js';
import { toState, toGrid, toCart } from '../src/format.js';

const S = (grid, water, cart) => toState({ id: 't', grid, water, cart });
const push = (s, dir) => { const r = explain(s, dir); assert.ok(r.ok, `refused: ${r.reason}`); return r.next; };
const refuse = (s, dir) => { const r = explain(s, dir); assert.ok(!r.ok, 'expected a refusal'); return r.reason; };

test('open is a piece, shut is an occupant', () => {
  assert.equal(isMultiCell(CABO_R), true);
  assert.equal(isMultiCell(CABC_R), false);
});

// A cabinet opens when it is struck on the BACK, and the blow is spent doing it: the cabinet
// does not slide, because it is not a thing that rolls.
test('struck on the back, the drawer comes out and the cabinet stays put', () => {
  const after = toGrid(push(S(['-------', '-------', '-@m----', '-------', 'E------']), 'r'));
  assert.equal(after[2], '-@JJ---', 'it did not move; it is two cells now');
});

test('the step says the shut one is gone and a piece was born', () => {
  const r = explain(S(['-------', '-@m----', '-------', 'E------']), 'r', { trace: true });
  const [step] = r.steps;
  assert.equal(step.gone.length, 1, 'the shut cabinet leaves the stage');
  assert.deepEqual(step.born[0].cells, [[2, 1], [3, 1]], 'and a two-cell piece arrives');
  assert.equal(step.born[0].kind, 'furniture');
});

// A blow is a blow whoever lands it, and the account owes the same thing either way: the stage
// mints the body from `born`, so an impact that opens a cabinet and says nothing leaves a piece
// on the board that nothing on screen is drawing.
test('an impact that opens a cabinet says so too', () => {
  const r = explain(S(['--------', '-@w--m--', '--------', 'E-------']), 'r', { trace: true });
  assert.ok(r.ok, `refused: ${r.reason}`);
  const gone = r.steps.flatMap(st => st.gone), born = r.steps.flatMap(st => st.born);
  assert.equal(gone.length, 1, 'the shut cabinet leaves the stage');
  assert.deepEqual(born.map(b => b.cells), [[[5, 1], [6, 1]]], 'and the two-cell piece arrives');
});

test('struck on any other face it is an ordinary shove, and stays shut', () => {
  assert.equal(toGrid(push(S(['-------', '--@----', '--m----', '-------', 'E------']), 'd'))[3],
    '--m----', 'it went one cell, still shut');
  assert.equal(toGrid(push(S(['-------', '--m@---', '-------', 'E------']), 'l'))[1],
    '-m@----', 'shoved back onto itself, still shut');
});

// The drawer comes out along the line the blow travelled, so it is an ordinary push.
test('the drawer shoves what stands in its way', () => {
  const after = toGrid(push(S(['-------', '-@m-c--', '-------', 'E------']), 'r'));
  assert.equal(after[1], '-@JJc--', 'the can went on one cell to make room');
});

test('a drawer with nowhere to go refuses the blow', () => {
  assert.equal(refuse(S(['------', '-@m#--', '------', 'E-----']), 'r'), 'canRoom');
});

// Driven drawer-first into something, the drawer folds home and the body carries on into the
// cell the drawer was filling — so it ends up shut, standing against whatever stopped it.
test('run drawer-first into something, it shuts and comes to rest against it', () => {
  const after = toGrid(push(S(['-------', '-@JJ#--', '-------', 'E------']), 'r'));
  assert.equal(after[1], '--@m#--', 'the piece is gone and a shut one stands against the wall');
});

test('shoved on the drawer toward the body it closes, and stays where it is', () => {
  const after = toGrid(push(S(['--------', '-JJ@----', '--------', 'E-------']), 'l'));
  assert.equal(after[1], '-m@-----', 'closed, one cell, and it did not move');
});

test('shoved anywhere else an open cabinet moves as one rigid thing', () => {
  assert.equal(toGrid(push(S(['--------', '-@JJ----', '--------', 'E-------']), 'r'))[1],
    '--@JJ---');
  assert.equal(toGrid(push(S(['--------', '-@------', '-JJ-----', 'E-------']), 'd'))[2],
    '-@------', 'and across its own axis just as far');
});

test('a cabinet may start a level open, at any facing, and writes back as itself', () => {
  for (const grid of [
    ['--@-', '--A-', '--A-', 'E---'],        // drawer above the body, facing up
    ['--@-', '--D-', '--D-', 'E---'],        // and below it, facing down
    ['-@--', '-II-', '----', 'E---'],        // to the left, facing left
    ['-@--', '-JJ-', '----', 'E---'],        // to the right, facing right
  ]) assert.deepEqual(toGrid(S(grid)), grid);
});

test('two cabinets standing flush are two pieces, and keep their letters', () => {
  const grid = ['---------', '-@IIJJ---', '---------', 'E--------'];
  assert.deepEqual(toGrid(S(grid)), grid);
});

// A board with half a cabinet on it is not refused, it is unwritable: there is no glyph for a
// drawer, and a piece of one cell is not a cabinet.
test('half a cabinet cannot be written down at all', () => {
  assert.throws(() => S(['-@--', '-J--', '----', 'E---']), /an open cabinet is exactly two/);
  assert.throws(() => S(['-@--', '-J--', '-J--', 'E---']), /across its own facing/);
});

// Opening is a blow, not a privilege of the raccoon's own shove: anything that comes to rest
// against the back of a shut cabinet knocks its drawer out.
test('a rolling thing that stops against its back knocks it open', () => {
  const after = toGrid(push(S(['--------', '-@w--m--', '--------', 'E-------']), 'r'));
  assert.equal(after[1], '--@-wJJ-', 'the bin rolled up to it and it opened');
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
  assert.equal(after[1], '-@rcJJ--', 'nothing swept; it opened');
});

// Shut, it is one cell and cart-sized. A cart the raccoon pushes onto one takes it aboard; a
// cart that arrives on a knock has its mouth shut, so it strikes it instead and opens it.
test('a cart pushed onto a shut cabinet takes it aboard', () => {
  const s = S(['---------', '-@--m---E', '---------'], null, ['---------', '--PP-----', '---------']);
  const r = explain(s, 'r');
  assert.ok(r.ok, `refused: ${r.reason}`);
  // A cart cell's occupant IS its cargo, so where the cabinet is written says nothing on its
  // own: what says it went aboard is that the cell it is written in belongs to the cart.
  const at = toGrid(r.next)[1].indexOf('m');
  assert.ok(at >= 0, 'the cabinet is still on the board');
  assert.ok(isCart(cell(r.next, at, 1)), 'and it is riding in the cart rather than standing');
});

test('a cart that rolls up against its back knocks it open and stops there', () => {
  const s = S(['-@o-----m-E', '-----------'], null, ['----PP-----', '-----------']);
  const r = explain(s, 'r');
  assert.ok(r.ok, `refused: ${r.reason}`);
  assert.equal(toGrid(r.next)[0].slice(8), 'JJE', 'struck by a knocked cart, it opened');
});

// Both states are on the lanes, and neither is written for the cabinet: one cell is taken by a
// grate, and a body spans it.
test('shut it goes down a grate; open it spans one', () => {
  const shut = push(S(['-------', '--@----', '--m----', '-------', 'E------'],
                      ['-------', '-------', '-------', '--O----', '-------']), 'd');
  assert.equal(toGrid(shut)[3], '-------', 'the cabinet is gone');
  const open = push(S(['--------', '-@JJ----', '--------', 'E-------'],
                      ['--------', '--------', '--------', '--------']), 'r');
  assert.equal(toGrid(open)[1], '--@JJ---', 'and a body simply travels');
});

// A body spans a hole and one cell does not, so the moment a cabinet folds back to one cell over
// a grate it is standing on nothing. Both ways of shutting it land the same occupant on the same
// cell, so both owe the grate the same answer.
test('folded in over a grate it goes down it', () => {
  const folded = push(S(['---------', '-@JJ#----', '---------', 'E--------'],
                        ['---------', '---O-----', '---------', '---------']), 'r');
  assert.equal(toGrid(folded)[1], '--@-#----', 'the drawer went home and the cabinet fell');

  const closed = push(S(['---------', '--JJ@----', '---------', 'E--------'],
                        ['---------', '--O------', '---------', '---------']), 'l');
  assert.equal(toGrid(closed)[1], '---@-----', 'and closing in place over one is the same fall');
});

test('shut it runs a slick', () => {
  const after = push(S(['-------', '--@----', '--m----', '-------', '-------', 'E------'],
                       ['-------', '-------', '-------', '--%----', '--%----', '-------']), 'd');
  assert.equal(toGrid(after)[5], 'E-m----', 'grease carried it to the end of the slick');
});
