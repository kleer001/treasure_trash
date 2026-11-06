import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sizes } from '../src/art/pile.js';

test('a pile of no pieces has no sizes', () => {
  assert.deepEqual(sizes(0), []);
});

test('a pile of n pieces has n sizes, heroes first', () => {
  const order = { hero: 0, mid: 1, bit: 2 };
  for (let n = 1; n <= 40; n++) {
    const s = sizes(n);
    assert.equal(s.length, n);
    assert.ok(s.every((k, i) => i === 0 || order[s[i - 1]] <= order[k]), `${n}: ${s}`);
    assert.equal(s[0], 'hero');
  }
});
