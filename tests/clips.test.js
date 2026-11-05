import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { explain, JUG_EMPTY } from '../src/rules.js';
import { toState } from '../src/format.js';
import { stageFrom, applyStep, settle, timeline, CELL_MS } from '../src/stage.js';
import { createClips } from '../src/clips.js';
import { createPixelSprites } from '../src/pixel.js';

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
