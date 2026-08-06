import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rooms, draft, tighten, cartMustMove } from '../tools/draft-room.mjs';

const PLAN = [
  '##--#',
  '-----',
  '#--##',
];

test('a plan puts the walls in every room the generator yields', () => {
  let n = 0;
  for (const room of rooms({ plan: PLAN, pieces: ['$'] })) {
    for (let y = 0; y < PLAN.length; y++) for (let x = 0; x < PLAN[y].length; x++) {
      if (PLAN[y][x] === '#') assert.equal(room.grid[y][x], '#', `(${x},${y}) should be wall`);
      else assert.notEqual(room.grid[y][x], '#', `(${x},${y}) should be free`);
    }
    if (++n >= 200) break;
  }
  assert.ok(n > 0, 'the plan left no room to generate');
});

test('a plan with no free cells generates nothing', () => {
  assert.equal([...rooms({ plan: ['##', '##'] })].length, 0);
});

const SLACK = {
  grid: ['-----', 'E$x-@', '-----'],
  cart: ['---P-', '---P-', '-----'],
};

// Enough ways to lose that walling some off is still allowed.
const ROOMY = {
  grid: ['Eb---', '@$---', '-----'],
  cart: ['--P--', '--P--', '-----'],
};

test('tightening walls off slack without changing what the room asks for', () => {
  const t = tighten(ROOMY);
  const before = draft({ id: 'before', ...ROOMY });
  assert.equal(t.draft.par, before.par);
  assert.ok(t.draft.solves <= before.solves);
  assert.ok(t.draft.reachable < before.reachable, 'walls should shrink the state graph');
  assert.ok(t.draft.ok);
  assert.ok(cartMustMove(t.room), 'the cart still has to be shoved');
});

test('tightening leaves a room at least one way to lose', () => {
  const before = draft({ id: 'before', ...SLACK });
  assert.ok(before.traps > 0, 'the fixture needs a trap for this to mean anything');
  assert.ok(tighten(SLACK).draft.traps >= 1, 'the last trap is not the tool\'s to remove');
});

test('tightening only ever turns floor into wall', () => {
  const t = tighten(SLACK);
  t.room.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    const was = SLACK.grid[y][x];
    assert.ok(ch === was || (was === '-' && ch === '#'), `(${x},${y}) went ${was} -> ${ch}`);
  }));
  assert.deepEqual(t.room.cart, SLACK.cart);
});
