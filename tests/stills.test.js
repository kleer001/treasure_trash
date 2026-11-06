import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStills, lyingOf } from '../src/art/stills.js';
import { LIES } from '../src/stage.js';
import { C } from '../src/art/flight.js';

const J = JSON.parse(readFileSync(new URL('../src/art/jug.json', import.meta.url)));
const still = createStills({ J });
const THINGS = Object.entries(lyingOf(J)).map(([o, M]) => [Number(o), M]);

test('every kind the stage lays down has a lying drawing, and no other kind has one', () => {
  assert.deepEqual(new Set(THINGS.map(([o]) => o)), LIES);
});

const span = (s, i) => { const v = s.px.map(p => p[i] + (i ? s.y : s.x)); return [Math.min(...v), Math.max(...v)]; };
const pixels = s => s.px.map(p => p.join()).sort().join(' ');

test('a tipped thing lies on the floor it stood on, centred where it stood', () => {
  for (const [o] of THINGS) {
    const up = still(o, 2, 3), [ux0, ux1] = span(up, 0);
    for (const dir of 'udlr') {
      const s = still(o, 2, 3, 1, dir), [x0, x1] = span(s, 0);
      assert.equal(span(s, 1)[1], span(up, 1)[1], `${o} fallen ${dir}`);
      assert.equal(x0 + x1, ux0 + ux1, `${o} fallen ${dir}`);
    }
  }
});

test('a tipped thing has its own drawing for each way it fell', () => {
  for (const [o] of THINGS) {
    const drawings = [null, ...'udlr'].map(dir => pixels(still(o, 2, 3, 1, dir)));
    assert.equal(new Set(drawings).size, drawings.length, `${o}`);
  }
});

test('one that has not tipped stands upright', () => {
  for (const [o, M] of THINGS) {
    const s = still(o, 2, 3);
    assert.deepEqual([s.x, s.y], M.restAt(2, 3, C), `${o}`);
    assert.notDeepEqual(s.px, M.rest('d').px, `${o}`);
  }
});
