import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PANE, DIRS } from '../src/rules.js';
import { createStills } from '../src/art/stills.js';
import { createTrash } from '../src/art/pile.js';
import { readFileSync } from 'node:fs';
import { GLASS_LOOK, glassCell } from '../src/art/glass.js';
import { paneShatter } from '../src/art/paneShatter.js';
import { C } from '../src/art/flight.js';

const read = f => JSON.parse(readFileSync(new URL(`../src/art/${f}.json`, import.meta.url)));
const [A, D, LOOK, O, J] = ['assets', 'items', 'look', 'objects', 'jug'].map(read);
const still = createStills({ T: createTrash(D, { accents: LOOK.accents, diagonals: LOOK.diagonals }), A, O, LOOK, J });
const key = px => px.map(p => p.join()).sort();
const painted = px => key([...new Map(px.map(p => [`${p[0]},${p[1]}`, p])).values()]);

for (const dir of 'udlr') {
  const [dx, dy] = DIRS[dir], from = [4, 4], to = [4 + dx, 4 + dy];
  const has = (x, y) => x === to[0] && y === to[1];
  const { layers, ground, end } = paneShatter({ dir, from, to, has, look: GLASS_LOOK });

  test(`a pane shoved ${dir} starts as the pane standing, with no glass down`, () => {
    const s = still(PANE, ...from);
    assert.deepEqual(key(layers(0).flatMap(l => l.px)), key(s.px.map(([x, y, c]) => [s.x + x, s.y + y, c])));
    assert.equal(ground(0).length, 0);
  });

  test(`a pane shoved ${dir} ends as the glass of the cell it fell on`, () => {
    assert.equal(layers(end).length, 0);
    assert.deepEqual(painted(ground(end)), painted(glassCell(...to, has, GLASS_LOOK).map(([x, y, c]) => [to[0] * C + x, to[1] * C + y, c])));
  });
}
