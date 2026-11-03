import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { explain, TRASH, DIRS } from '../src/rules.js';
import { toState } from '../src/format.js';
import { createPixelSprites } from '../src/pixel.js';
import { draw } from '../src/art/cartoon.js';
import { tearPress } from '../src/art/bagRip.js';

const art = Object.fromEntries(Object.entries({ A: 'assets', D: 'items', LOOK: 'look', O: 'objects', W: 'wheelie', J: 'jug' })
  .map(([k, f]) => [k, JSON.parse(readFileSync(new URL(`../src/art/${f}.json`, import.meta.url)))]));
const ctx = { out: [], fillStyle: '', fillRect(x, y, w, h) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.out.push([x + i, y + j, this.fillStyle]);
} };
const SP = createPixelSprites({ ctx, art });
/** What `paint` leaves on the screen, pixel by pixel. */
const screen = paint => {
  ctx.out = [];
  paint();
  return Object.fromEntries(ctx.out.map(([x, y, c]) => [`${x},${y}`, c]));
};

const N = 9;
for (const dir of 'udlr') {
  const [dx, dy] = DIRS[dir], bag = [4, 4];
  const rows = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => (x === 0 || y === 0 || x === N - 1 || y === N - 1 ? '#' : '-')));
  rows[0][0] = 'E'; rows[bag[1]][bag[0]] = '$'; rows[bag[1] - dy][bag[0] - dx] = '@';
  const r = explain(toState({ id: 'rip', grid: rows.map(row => row.join('')) }), dir, { trace: true });
  const cells = r.steps[0].spawned.filter(e => e.o === TRASH).map(e => e.cells[0]);
  const clip = SP.rip({ dir, bag, seed: 12345, cells });

  test(`every drawing of the drawn-out push ${dir} can be drawn`, () => {
    for (let push = 4; push <= 12; push++) for (const sg of tearPress(dir, push)) draw(sg.f);
  });

  test(`a bag torn ${dir} starts as the bag at rest`, () => {
    const [first] = clip.layers(-20);
    assert.deepEqual(screen(first.paint), screen(() => SP.bag(...bag)));
  });

  test(`a bag torn ${dir} ends as the piles at rest, each on its scraps`, () => {
    const piles = clip.layers(clip.end);
    assert.deepEqual(piles.map(l => l.kind), cells.map(() => 'pile'));
    piles.forEach((l, i) => assert.deepEqual(screen(l.paint), screen(() => SP.trash(...cells[i], clip.piles[i]))));
  });
}
