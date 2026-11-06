import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metrics } from '../tools/metrics.mjs';

test('a bag a cart carries is one choice, however many cells it is torn from', () => {
  const m = metrics({
    id: 'cart-bag',
    grid: ['E@---', '-$---', '-----', '-----'],
    cart: ['-----', '-PP--', '-----', '-----'],
  });
  assert.equal(m.bags, 1);
  assert.equal(m.order, '1/1');
});

// levels/act1.tt, L27.
test('a full can that drops its bag is one choice', () => {
  const m = metrics({
    id: 'can-bag',
    grid: ['-E--#', '-C-@#', '----#'],
    cart: ['-----', '--P--', '--P--'],
  });
  assert.equal(m.bags, 1);
  assert.equal(m.order, '1/1');
});

test('two bags nothing moves stay two choices, and the room can ask which one first', () => {
  assert.equal(metrics({ id: 'both-safe', grid: ['@-E--', '-$-$-', '-----'] }).order, '2/2');
  assert.equal(metrics({ id: 'one-safe', grid: ['E@---', '-$-$-', '-----'] }).order, '1/2');
});

test('a bag a carried barrow holds is one choice, and it is still one after it is set down', () => {
  const m = metrics({
    id: 'barrow-bag',
    grid: ['#######', '#--@--#', '#-v---#', '#-----#', '#-----#', '#E----#', '#######'],
    cart: ['-------', '-------', '--d----', '-------', '-------', '-------', '-------'],
    hold: ['2,2 $'],
  });
  assert.equal(m.bags, 1);
  assert.equal(m.order, '1/1');
});
