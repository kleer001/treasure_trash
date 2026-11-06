import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { explain, OCCUPANTS, JUG_EMPTY, TIRE_H, TIRE_V, CHAIR, BROOM, SPONGE, CARDBOARD, CABC_U, MAG_R } from '../src/rules.js';
import { toState } from '../src/format.js';
import { stageFrom, applyStep, settle, timeline, CELL_MS } from '../src/stage.js';
import { createClips } from '../src/clips.js';
import { createPixelSprites } from '../src/pixel.js';
import { drawOccupant } from '../src/sprites.js';

const POUR = toState({ id: 'pour', grid: ['#########', '#@j-----#', '#-------#', '#E#######'] });

const drawn = [];
const art = {
  bobEnd: 0,
  dump: () => ({ end: 5, draw: f => drawn.push(f), ground: () => {} }),
  rip: () => ({ end: 0, piles: [], layers: () => [] }),
  shatter: () => ({ end: 0, layers: () => [], ground: () => {} }),
  bob: () => {},
};
const clipsFor = (stage, pixel = true) =>
  createClips({ pixel, art, stage: () => stage, clock: () => 0, since: () => 0, frame: 1000 / 60 });

function playPour(clips, stage) {
  for (const seg of timeline(explain(POUR, 'r', { trace: true }), CELL_MS))
    for (const it of seg.items) {
      applyStep(stage, it.step, it.racTo);
      clips.note(it.step, it.next, 0);
      settle(stage);
    }
}

test('a pour starts a clip, and reset ends it', () => {
  const stage = stageFrom(POUR, 1, null), clips = clipsFor(stage);
  playPour(clips, stage);
  assert.equal(clips.anyLive(), true);
  clips.reset();
  assert.equal(clips.anyLive(), false);
});

test('prune drops a clip once its container has left the stage', () => {
  const stage = stageFrom(POUR, 1, null), clips = clipsFor(stage);
  playPour(clips, stage);
  stage.sprites = [];
  clips.prune();
  assert.equal(clips.anyLive(), false);
});

test('paint draws the container through its live clip', () => {
  const stage = stageFrom(POUR, 1, null), clips = clipsFor(stage);
  playPour(clips, stage);
  drawn.length = 0;
  const jug = stage.sprites.find(sp => sp.kind === JUG_EMPTY);
  assert.equal(clips.paint(jug), true);
  assert.deepEqual(drawn, [0]);
});

test('with the pixel art off, a pour starts no clip', () => {
  const stage = stageFrom(POUR, 1, null), clips = clipsFor(stage, false);
  playPour(clips, stage);
  assert.equal(clips.anyLive(), false);
});

const names = ['A', 'D', 'LOOK', 'O', 'W', 'J'];
const files = ['assets', 'items', 'look', 'objects', 'wheelie', 'jug'];
const pixelArt = Object.fromEntries(names.map((k, i) => [k, JSON.parse(readFileSync(new URL(`../src/art/${files[i]}.json`, import.meta.url)))]));
const ctx = { out: [], fillStyle: '', fillRect(x, y, w, h) { this.out.push([x, y, w, h, this.fillStyle]); } };
const SP = createPixelSprites({ ctx, art: pixelArt });

test('a lone splash draws nothing', () => {
  ctx.out = [];
  SP.splash(3, 4);
  assert.deepEqual(ctx.out, []);
});

// The real pixel drawing, and a second one that records what a thing looks like standing.
const restCtx = { out: [], fillStyle: '', fillRect(x, y, w, h) { this.out.push([x, y, w, h, this.fillStyle]); } };
const REST = createPixelSprites({ ctx: restCtx, art: pixelArt });

// Each row is one line of a room. A `~` is water: the grid reads it as floor, the water mask as water.
const room = rows => toState({ id: 'float', grid: rows.map(r => r.replace(/~/g, '-')), water: rows.map(r => r.replace(/[^~]/g, '-')) });
const waterCell = rows => { for (const [y, r] of rows.entries()) if (r.includes('~')) return [r.indexOf('~'), y]; };

// Each thing the rules put on water with one key, and the room that does it.
const FLOATS = [
  ['a tyre rolls onto water', TIRE_H, 'r', ['#######', '#E@o~##', '#######']],
  ['a tyre rolls down onto water', TIRE_V, 'd', ['#####', '#E-##', '##@##', '##O##', '##~##', '#####']],
  ['a chair rolls onto water', CHAIR, 'r', ['#######', '#E@h~##', '#######']],
  ['a broom is swept onto water', BROOM, 'r', ['#######', '#E@r~##', '#######']],
  ['a sponge is swept onto water', SPONGE, 'r', ['#######', '#E@rs~#', '#######']],
  ['flattened cardboard is swept onto water', CARDBOARD, 'r', ['#######', '#E@rd~#', '#######']],
  ['a closed cabinet is pushed onto water', CABC_U, 'r', ['#######', '#E@a~##', '#######']],
  ['a magnet is pushed onto water', MAG_R, 'r', ['#######', '#E@q~##', '#######']],
];

for (const [name, kind, dir, rows] of FLOATS) test(`${name}: its float draws the thing`, () => {
  const state = room(rows), stage = stageFrom(state, 1, null);
  const clips = createClips({ pixel: true, art: SP, stage: () => stage, clock: () => 0, since: () => 0, frame: 1000 / 60 });
  let after = state;
  for (const seg of timeline(explain(state, dir, { trace: true }), CELL_MS))
    for (const it of seg.items) {
      applyStep(stage, it.step, it.racTo);
      clips.note(it.step, it.next, 0);
      settle(stage);
      after = it.next;
    }
  SP.setBoard(after);
  clips.prune();
  const [wx, wy] = waterCell(rows);
  const sp = stage.sprites.find(s => s.kind === kind && s.tx === wx && s.ty === wy);
  assert.ok(sp, `a ${kind} rests on the water`);
  ctx.out = [];
  assert.equal(clips.paint(sp), true);
  restCtx.out = [];
  drawOccupant(REST, OCCUPANTS, kind, 0, 0, {});
  const standing = new Set(restCtx.out.map(p => p[4]));
  assert.ok(ctx.out.some(p => standing.has(p[4])), 'the float paints the colours the thing stands in');
});
