import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAN_FULL, CAN_EMPTY, BAG, DIRS } from '../src/rules.js';
import { createStills } from '../src/art/stills.js';
import { createCanTip } from '../src/art/canTip.js';

const A = JSON.parse(readFileSync(new URL('../src/art/assets.json', import.meta.url)));
const still = createStills({ A });
const clip = createCanTip(A.bag);
const placed = s => s.px.map(([x, y, c]) => `${s.x + x},${s.y + y},${c}`).sort();
const drawn = layers => layers.flatMap(([, px]) => px.map(p => p.join())).sort();

for (const dir of 'udlr') {
  const [dx, dy] = DIRS[dir], from = [4, 4], to = [4 + dx, 4 + dy], bag = [4 + 2 * dx, 4 + 2 * dy];
  const { layers, end } = clip({ dir, from, to, bagTo: bag, moveFrames: 7 });

  test(`a can shoved ${dir} starts as the full can standing`, () => {
    assert.deepEqual(drawn(layers(0, 0)), placed(still(CAN_FULL, ...from)));
  });

  test(`a can shoved ${dir} ends as the empty can lying and its bag standing`, () => {
    assert.deepEqual(drawn(layers(end, 1)), [...placed(still(CAN_EMPTY, ...to, 1, dir)), ...placed(still(BAG, ...bag))].sort());
  });
}

test('a can left standing as a deck rolls out from under it tips where it stands', () => {
  const { layers, end } = clip({ dir: 'l', from: [4, 4], to: [4, 4], bagTo: [3, 4], moveFrames: 7 });
  assert.deepEqual(drawn(layers(0, 0)), placed(still(CAN_FULL, 4, 4)));
  assert.deepEqual(drawn(layers(end, 1)), [...placed(still(CAN_EMPTY, 4, 4, 1, 'l')), ...placed(still(BAG, 3, 4))].sort());
});

test('a bag that lands on a grate is gone down it by the end', () => {
  const { layers, end } = clip({ dir: 'r', from: [4, 4], to: [5, 4], bagTo: [6, 4], moveFrames: 7, down: true });
  assert.deepEqual(drawn(layers(end, 1)), placed(still(CAN_EMPTY, 5, 4, 1, 'r')));
});
