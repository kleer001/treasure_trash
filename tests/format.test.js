import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toState, toCart } from '../src/format.js';

test('a cart cell with no kind writes the kind the rules give it', () => {
  const cart = ['----', '-PP-', '----'];
  const s = toState({ id: 'k', grid: ['@---', '----', '---E'], cart });
  for (const row of s.cells) for (const c of row) if (c.cart !== undefined) delete c.ck;
  assert.deepEqual(toCart(s), cart);
});
