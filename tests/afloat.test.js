import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REST, afloat } from '../src/art/afloat.js';

const S = { px: [[0, 0, '#ffffff'], [1, 0, '#ffffff'], [0, 1, '#808080'], [1, 1, '#808080'], [0, 2, '#000000'], [1, 2, '#000000'], [0, 3, '#000000'], [1, 3, '#000000']] };
const MET = { under: [false, false, false, false, true, true, true, true], line: new Map([[0, 2], [1, 2]]),
  mirror: [[0, 4, '#808080'], [1, 4, '#808080'], [0, 5, '#ffffff'], [1, 5, '#ffffff']] };
const dry = { wet: () => false, open: () => false };
const pool = { wet: () => true, open: () => true };
const BARE = { ...REST, murk: 100, reflect: 0, contact: 0, glint: 0 };

test('a thing over dry floor is drawn as it is', () => {
  assert.deepEqual(afloat(S, 10, 10, MET, dry), S.px.map(([x, y, c]) => [10 + x, 10 + y, c]));
});

test('a thing afloat draws nothing of itself under water where it is not water', () => {
  const got = afloat(S, 10, 10, MET, { wet: (x, y) => y <= 12, open: () => false }, BARE);
  assert.deepEqual(got.filter(([, y]) => y < 12), S.px.slice(0, 4).map(([x, y, c]) => [10 + x, 10 + y, c]));
  assert.deepEqual(got.filter(([, y]) => y > 12), []);
});

test('a thing afloat draws its reflection on open water only', () => {
  const shore = { wet: () => true, open: x => x !== 10 };
  const got = afloat(S, 10, 10, MET, shore, { ...BARE, reflect: 100 }).filter(([, y]) => y > 13);
  assert.deepEqual(got.map(([x, y]) => [x, y]), [[11, 14], [11, 15]]);
});

test('the contact line runs along the first row under water and past each end', () => {
  const got = afloat(S, 10, 10, MET, pool, { ...BARE, murk: 0, contact: 1, contactRows: 1, contactColour: '#ff0000' });
  assert.deepEqual(got.filter(p => p[2] === '#ff0000').map(([x, y]) => [x, y]), [[9, 12], [10, 12], [11, 12], [12, 12]]);
});
