import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meets } from '../src/art/solid.js';

const grey = n => `#${n.toString(16).padStart(2, '0').repeat(3)}`;
/** A drawing of `rows`, each [from, to] columns filled, its rows told apart by their colour. */
const drawing = rows => ({ px: rows.flatMap(([a, b], y) => Array.from({ length: b - a + 1 }, (_, i) => [a + i, y, grey(y * 10)])) });
const LOOK = { deep: 2, rows: 6 };
const lineOf = m => [...m.line].sort((a, b) => a[0] - b[0]);

test('a thing pushed back from its drawing meets the water along one row, as deep as asked', () => {
  const s = drawing(Array(6).fill([0, 3])), m = meets(s, [{ name: 'bin' }], LOOK);
  assert.deepEqual([...new Set(s.px.filter((_, i) => m.under[i]).map(p => p[1]))], [4, 5]);
  assert.deepEqual(lineOf(m), [[0, 4], [1, 4], [2, 4], [3, 4]]);
});

test('the water mirrors the front of a box about its first row under water', () => {
  const s = drawing(Array(6).fill([0, 3])), m = meets(s, [{ name: 'bin' }], LOOK);
  assert.deepEqual(m.mirror.filter(p => p[0] === 1).sort((a, b) => a[1] - b[1]).map(([, y, col]) => [y, col]),
    [[4, grey(30)], [5, grey(20)], [6, grey(10)], [7, grey(0)]]);
});

test('a round thing seen from above meets the water lower in its middle than at its sides', () => {
  const line = lineOf(meets(drawing(Array(12).fill([0, 9])), [{ name: 'bag' }], LOOK));
  assert.ok(line[5][1] > line[0][1] && line[4][1] > line[9][1], JSON.stringify(line));
});

test('a thing lying with its narrow end clear of the water meets it only under its wide end', () => {
  const upright = drawing([...Array(5).fill([0, 9]), ...Array(5).fill([2, 7])]);
  const lying = { px: [...upright.px.map(([x, y, col]) => [y, x, col])] };
  const line = lineOf(meets(lying, [{ name: 'can', upright, lie: 'l' }], LOOK));
  assert.ok(line.length > 0 && line.every(([x]) => x < 5), JSON.stringify(line));
});

test('a part that stands clear of the water stays dry, and the water mirrors only what is near it', () => {
  const s = drawing(Array(4).fill([0, 3])), at = base => meets(s, [{ name: 'bin', base }], LOOK);
  assert.ok(at(5).under.every(u => !u));
  assert.equal(at(5).line.size, 0);
  assert.ok(at(5).mirror.length > 0 && at(5).mirror.every(([, y]) => y > 3), JSON.stringify(at(5).mirror));
  assert.deepEqual(at(LOOK.deep + LOOK.rows).mirror, []);
});

test('a thing with no solid fails', () => {
  assert.throws(() => meets(drawing([[0, 1]]), [{ name: 'nothing' }], LOOK), /no solid for 'nothing'/);
});
