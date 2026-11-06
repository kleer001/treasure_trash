import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BARROW } from '../src/art/barrow.js';
import { SPONGE } from '../src/art/sponge.js';
import { CARDBOARD, wetCardboard } from '../src/art/cardboard.js';
import { GRATE } from '../src/art/grate.js';
import { ONEWAY } from '../src/art/oneway.js';
import { TYRE } from '../src/art/tyre.js';
import { CHAIR } from '../src/art/chair.js';
import { BROOM } from '../src/art/broom.js';
import { CABINET, CABINET_OPEN, CABINET_LOOK, cabinetViews } from '../src/art/cabinet.js';
import { RUG } from '../src/art/rug.js';
import { COUCH } from '../src/art/couch.js';
import { MAGNET } from '../src/art/magnet.js';
import { SKATEBOARD } from '../src/art/skateboard.js';
import { bicycle } from '../src/art/bicycle.js';
import { createRaccoon } from '../src/art/raccoon.js';

const A = JSON.parse(readFileSync(new URL('../src/art/assets.json', import.meta.url)));
const HEX = /^#[0-9a-f]{6}$/i;
const isSprite = v => Array.isArray(v?.px);
const spritesIn = (v, path) => isSprite(v) ? [[path, v]]
  : Object.entries(v).flatMap(([k, x]) => spritesIn(x, `${path}.${k}`));

function drawn(name, s) {
  assert.ok(s.px.length, `${name} draws nothing`);
  for (const [x, y, c] of s.px) {
    assert.ok(Number.isInteger(x) && Number.isInteger(y), `${name}: pixel ${x},${y}`);
    assert.match(c, HEX, `${name}: colour at ${x},${y}`);
    if (s.w !== undefined)
      assert.ok(x >= 0 && y >= 0 && x < s.w && y < s.h, `${name}: pixel ${x},${y} outside ${s.w}x${s.h}`);
  }
}

const STATICS = { BARROW, SPONGE, CARDBOARD, GRATE, ONEWAY, TYRE, CHAIR, BROOM, CABINET, CABINET_OPEN, RUG, COUCH,
  MAGNET, SKATEBOARD, BICYCLE: bicycle() };

for (const [name, v] of Object.entries(STATICS))
  test(`every view of ${name} is drawn`, () => {
    const views = spritesIn(v, name);
    assert.ok(views.length, `${name} has no view`);
    for (const [path, s] of views) drawn(path, s);
  });

test('wet cardboard is drawn, the same for the same seed', () => {
  for (const seed of [0, 1, 7, 99]) {
    drawn(`wet cardboard ${seed}`, wetCardboard(seed));
    assert.deepEqual(wetCardboard(seed), wetCardboard(seed));
    assert.deepEqual([wetCardboard(seed).w, wetCardboard(seed).h], [CARDBOARD.w, CARDBOARD.h]);
  }
});

test('the raccoon at rest is drawn in every facing', () => {
  const R = createRaccoon(A.raccoon);
  for (const dir of 'udlr') drawn(`raccoon ${dir}`, R.rest(dir));
});

test('an open cabinet keeps the rows above its drawer', () => {
  for (let outD = 13; outD <= 40; outD++) {
    const { open, closed } = cabinetViews({ ...CABINET_LOOK, outD });
    assert.deepEqual(open.d.rows.slice(0, 9), closed.d.rows.slice(0, 9), `outD ${outD}`);
  }
});

test('a drawer too short for its box is refused', () => {
  for (const outD of [0, 6, 12]) assert.throws(() => cabinetViews({ ...CABINET_LOOK, outD }), /drawer/, `outD ${outD}`);
});
