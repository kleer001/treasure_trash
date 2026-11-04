import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BIN, BIN_EMPTY, DIRS } from '../src/rules.js';
import { createStills } from '../src/art/stills.js';
import { createTrash, drawPile, pileLayout } from '../src/art/pile.js';
import { createBoxTip } from '../src/art/boxTip.js';
import { C } from '../src/art/flight.js';

const read = f => JSON.parse(readFileSync(new URL(`../src/art/${f}.json`, import.meta.url)));
const [A, D, LOOK, O, J] = ['assets', 'items', 'look', 'objects', 'jug'].map(read);
const T = createTrash(D, { accents: LOOK.accents, diagonals: LOOK.diagonals });
const still = createStills({ T, A, O, LOOK, J });
const STYLE = { outline: LOOK.outline, shadow: LOOK.shadow }, LAY = { min: LOOK.min, max: LOOK.max, C, spill: LOOK.spill };
const clip = createBoxTip({ T, still, LAY, STYLE, SPREAD: LOOK.spread });
const placed = s => s.px.map(([x, y, c]) => `${s.x + x},${s.y + y},${c}`).sort();
const drawn = layers => layers.flatMap(([, px]) => px.map(p => p.join())).sort();
const pile = (x, y, seed) => {
  const out = [], rec = { fillStyle: '', fillRect(a, b) { out.push(`${a},${b},${this.fillStyle}`); } };
  drawPile(rec, T, pileLayout(T, seed, LAY), x * C, y * C, STYLE);
  return out;
};

for (const dir of 'udlr') {
  const [dx, dy] = DIRS[dir], from = [4, 4], to = [4 + dx, 4 + dy], pileAt = [4 + 2 * dx, 4 + 2 * dy];
  const { layers, end } = clip({ dir, from, to, pileAt, seed: 77, pileSeed: 1234, moveFrames: 7 });

  test(`a box shoved ${dir} starts as the full box standing`, () => {
    assert.deepEqual(drawn(layers(0, 0)), placed(still(BIN, ...from, 77)));
  });

  test(`a box shoved ${dir} ends as the empty box lying and the pile it poured`, () => {
    assert.deepEqual(drawn(layers(end, 1)), [...placed(still(BIN_EMPTY, ...to, 77, dir)), ...pile(...pileAt, 1234)].sort());
  });
}
