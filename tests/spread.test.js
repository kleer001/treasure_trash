import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spreadPiles, pourPile } from '../src/art/spread.js';
import { createTrash } from '../src/art/pile.js';

const art = n => JSON.parse(readFileSync(new URL(`../src/art/${n}.json`, import.meta.url)));
const D = art('items'), LOOK = art('look');
const T = createTrash(D, { accents: LOOK.accents, diagonals: LOOK.diagonals });
const C = 24, spill = Math.round(LOOK.spill * 100);
const SETTINGS = {
  mound: { min: LOOK.min, max: LOOK.max, spill },
  flat: { min: LOOK.min, max: LOOK.max, spill, jitter: 100 },
  edges: { ...LOOK.spread.edges },
  field: { n: Math.round((LOOK.min + LOOK.max) / 2), spill, falloff: 15, rough: 4, jitter: 100 },
};
const CELLS = [[1, 1], [2, 1], [1, 2], [4, 3]];
const isTrash = (x, y) => CELLS.some(([a, b]) => a === x && b === y);
const lay = (method, seed = 0, o = SETTINGS[method]) =>
  spreadPiles(T, method, o, { C, W: 6, H: 5, cells: CELLS, isTrash, seed, hues: 'piece' });

/** Each pixel of every piece, in px on the board. */
const pixels = piles => [...piles].flatMap(([k, pile]) => {
  const [x, y] = k.split(',').map(Number);
  return pile.pieces.flatMap(p => T.sprite(p.name, p.alt, p.turn).px.map(([a, b]) => [x * C + p.x + a, y * C + p.y + b]));
});
/** How far px (X, Y) is from the nearest TRASH cell, 0 on one. */
const fromTrash = (X, Y) => Math.min(...CELLS.map(([x, y]) =>
  Math.max(x * C - X, X - x * C - C + 1, y * C - Y, Y - y * C - C + 1, 0)));

for (const method of Object.keys(SETTINGS)) {
  test(`the ${method} spread lays the same pieces for the same seed`, () => {
    const a = lay(method, 3);
    assert.ok([...a.values()].some(p => p.pieces.length), `${method} laid nothing`);
    assert.deepEqual(a, lay(method, 3));
    assert.notDeepEqual(a, lay(method, 4));
  });

  test(`the ${method} spread lays each pile on a TRASH cell`, () => {
    for (const k of lay(method).keys()) assert.ok(isTrash(...k.split(',').map(Number)), `${method} pile at ${k}`);
  });
}

test('the mound and flat spreads lay a count of pieces in their range on every cell', () => {
  for (const method of ['mound', 'flat']) {
    const piles = lay(method), { min, max } = SETTINGS[method];
    assert.equal(piles.size, CELLS.length);
    for (const [k, p] of piles) assert.ok(p.pieces.length >= min && p.pieces.length <= max, `${method} ${k}: ${p.pieces.length}`);
  }
});

test('no piece of the flat or edges spread reaches past the spill', () => {
  for (const method of ['flat', 'edges']) {
    const reach = Math.round(SETTINGS[method].spill / 100 * C);
    for (const [X, Y] of pixels(lay(method))) assert.ok(fromTrash(X, Y) <= reach, `${method} pixel at ${X},${Y}`);
  }
});

test('a pour lays every piece it is given, in the cell it is poured into', () => {
  const given = Object.keys(D.items).slice(0, 9).map(name => ({ name, alt: 0, turn: 0, size: 'bit', layer: 'bit' }));
  const pile = pourPile(T, SETTINGS.edges, { C, cell: [2, 2], given, isTrash: () => true, seed: 0, key: 5 });
  assert.deepEqual(pile.pieces.map(p => p.name).sort(), given.map(p => p.name).sort());
});

test('a spread setting that the method reads cannot be missing', () => {
  for (const [method, o] of Object.entries(SETTINGS)) for (const key of Object.keys(o)) {
    const { [key]: _, ...without } = o;
    assert.throws(() => lay(method, 0, without), new RegExp(key), `${method} without ${key}`);
  }
  const given = [{ name: Object.keys(D.items)[0], alt: 0, turn: 0, size: 'bit', layer: 'bit' }];
  for (const key of ['spill', 'knit', 'falloff', 'rough', 'jitter']) {
    const { [key]: _, ...without } = SETTINGS.edges;
    assert.throws(() => pourPile(T, without, { C, cell: [2, 2], given, isTrash: () => true, seed: 0, key: 5 }),
      new RegExp(key), `pour without ${key}`);
  }
});

test('a spread method that does not exist is refused', () => {
  assert.throws(() => lay('heap', 0, SETTINGS.field), /heap/);
});
