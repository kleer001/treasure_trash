import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JUG, JUG_EMPTY, DIRS } from '../src/rules.js';
import { createStills } from '../src/art/stills.js';
import { createJugTip, bakedJug } from '../src/art/jugTip.js';
import { puddle } from '../src/art/water.js';
import { SHADOW } from '../src/art/pile.js';
import { C } from '../src/art/flight.js';

const J = JSON.parse(readFileSync(new URL('../src/art/jug.json', import.meta.url)));
const still = createStills({ J });
const clip = createJugTip({ drawing: bakedJug(J).drawing, full: J.full, dy: J.dy });
const placed = s => s.px.map(([x, y, c]) => `${s.x + x},${s.y + y},${c}`).sort();
const drawn = layers => layers.flatMap(([, px]) => px.map(p => p.join())).sort();

for (const dir of 'udlr') {
  const [dx, dy] = DIRS[dir], from = [4, 4], to = [4 + dx, 4 + dy], wetAt = [4 + 2 * dx, 4 + 2 * dy];
  const { layers, ground, end } = clip({ dir, from, to, wetAt, moveFrames: 7 });

  test(`a jug shoved ${dir} starts as the full jug standing`, () => {
    assert.deepEqual(drawn(layers(0, 0)), placed(still(JUG, ...from)));
  });

  test(`a jug shoved ${dir} ends as the empty jug lying and the puddle it poured`, () => {
    assert.deepEqual(drawn(layers(end, 1)), placed(still(JUG_EMPTY, ...to, 1, dir)));
    const wet = (x, y) => x === wetAt[0] && y === wetAt[1];
    assert.deepEqual(ground(end).map(p => p.join()).sort(), puddle(...wetAt, C, wet).map(p => p.join()).sort());
  });
}

for (const dir of 'udlr') test(`the splash of a pour ${dir} flies over the cells it pours across and is down before the clip ends`, () => {
  const [dx, dy] = DIRS[dir], to = [4 + dx, 4 + dy], wetAt = [4 + 2 * dx, 4 + 2 * dy];
  const { layers, keys, end } = clip({ dir, from: [4, 4], to, wetAt, moveFrames: 7 });
  const besideTheJug = f => layers(f, 1).slice(1).flatMap(([, px]) => px);
  const flying = besideTheJug(keys.pour + 4);
  assert.ok(flying.some(([, , c]) => c === SHADOW), 'no drop is in the air');
  const cells = new Set(flying.map(([x, y]) => `${Math.floor(x / C)},${Math.floor(y / C)}`));
  assert.ok(cells.has(wetAt.join()), [...cells].join(' '));
  assert.deepEqual([...cells].filter(c => c !== to.join() && c !== wetAt.join()), []);
  assert.ok(keys.down <= end);
  assert.deepEqual(besideTheJug(keys.down), []);
});
