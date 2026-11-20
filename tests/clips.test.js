import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { explain, OCCUPANTS, NONE, BAG, TRASH, CAN_FULL, CAN_EMPTY, BIN_EMPTY, JUG_EMPTY, WHEELIE_EMPTY, TIRE_H, TIRE_V, CHAIR, BROOM, SPONGE, CARDBOARD, CABC_U, MAG_R } from '../src/rules.js';
import { toState } from '../src/format.js';
import { stageFrom, applyStep, settle, timeline, CELL_MS } from '../src/stage.js';
import { createClips } from '../src/clips.js';
import { createPixelSprites, PIXEL_CELL } from '../src/pixel.js';
import { REST as REST_LOOK } from '../src/art/afloat.js';
import { drawOccupant } from '../src/sprites.js';

const POUR = toState({ id: 'pour', grid: ['#########', '#@j-----#', '#-------#', '#E#######'] });

const drawn = [];
const art = {
  wadeEnd: 0,
  dump: () => ({ end: 5, draw: f => drawn.push(f), ground: () => {} }),
  shedFor: (o, out) => SP.shedFor(o, out),
  rip: () => ({ end: 0, piles: [], layers: () => [] }),
  shatter: () => ({ end: 0, layers: () => [], ground: () => {} }),
  wade: () => {},
};
const clipsFor = (stage, pixel = true) =>
  createClips({ pixel, art, stage: () => stage, clock: () => 0, since: () => 0, frame: 1000 / 60 });

const itemsOf = (state, dir) => timeline(explain(state, dir, { trace: true }), CELL_MS).flatMap(seg => seg.items);

function playMove(clips, stage, state, dir) {
  for (const it of itemsOf(state, dir)) {
    applyStep(stage, it.step, it.racTo, it.board);
    clips.note(it.step, it.next, 0);
    settle(stage);
  }
}

const playPour = (clips, stage) => playMove(clips, stage, POUR, 'r');

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
      applyStep(stage, it.step, it.racTo, it.board);
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
  assert.equal(clips.paint(sp, () => drawOccupant(SP, OCCUPANTS, kind, sp.x, sp.y, {})), true);
  restCtx.out = [];
  REST.setBoard(state);
  drawOccupant(REST, OCCUPANTS, kind, 0, 0, {});
  const standing = new Set(restCtx.out.map(p => p[4]));
  assert.ok(ctx.out.some(p => standing.has(p[4])), 'the float paints the colours the thing stands in');
});

// Each thing a move can leave at rest in the water, drawn as the game draws it with its first cell at (x, y).
const AT_REST = {
  bag: (S, x, y) => S.bag(x, y), can: (S, x, y) => S.can(x, y, false), 'lying can': (S, x, y) => S.can(x, y, false, 'r'),
  'can lying toward': (S, x, y) => S.can(x, y, false, 'd'), 'can lying away': (S, x, y) => S.can(x, y, false, 'u'),
  bin: (S, x, y) => S.recycleBin(x, y, false), 'lying bin': (S, x, y) => S.recycleBin(x, y, false, 'l'),
  jug: (S, x, y) => S.jug(x, y, false), 'lying jug': (S, x, y) => S.jug(x, y, false, 'd'), pane: (S, x, y) => S.pane(x, y),
  wheelie: (S, x, y) => S.wheelie(x, y, true),
  tyre: (S, x, y) => S.tyre(x, y, true), 'tyre on its tread': (S, x, y) => S.tyre(x, y, false), chair: (S, x, y) => S.chair(x, y),
  broom: (S, x, y) => S.broom(x, y),
  magnet: (S, x, y) => S.magnet(x, y, 'r'), cabinet: (S, x, y) => S.cabinet(x, y, 'u'), 'open cabinet': (S, x, y) => S.cabinet(x, y, 'r', true),
  barrow: (S, x, y) => S.barrow(x, y, 'l'), couch: (S, x, y) => S.furniture([[x, y], [x + 1, y]]),
  'couch up the picture': (S, x, y) => S.furniture([[x, y], [x, y + 1]]),
  bicycle: (S, x, y) => S.bicycle([[x, y], [x + 1, y]]), 'bicycle up the picture': (S, x, y) => S.bicycle([[x, y], [x, y + 1]]),
  rug: (S, x, y) => S.rug([[x, y], [x + 1, y]]), 'rug up the picture': (S, x, y) => S.rug([[x, y], [x, y + 1]]),
  skateboard: (S, x, y) => S.skateboard([[x, y], [x + 1, y]]), 'skateboard up the picture': (S, x, y) => S.skateboard([[x, y], [x, y + 1]]),
};

const POND = room(['##########', '#~~~~----#', '#~~~~----#', '#~~~~----#', '#@------E#', '##########']);
const drawnAt = (draw, x, y) => { ctx.out = []; draw(SP, x, y); return ctx.out.map(([px, py, , , col]) => [px - x * PIXEL_CELL, py - y * PIXEL_CELL, col]); };

test('a soaked sponge or sheet on dry floor looks as it does standing in the water', () => {
  SP.setBoard(POND);
  for (const k of ['sponge', 'cardboard']) {
    const dryLook = drawnAt((S, x, y) => S[k](x, y), 6, 2), soaked = drawnAt((S, x, y) => S[k](x, y, 'water'), 6, 2);
    assert.notDeepEqual(soaked, dryLook, k);
    assert.deepEqual(soaked, drawnAt((S, x, y) => S[k](x, y), 2, 2), k);
  }
});
const top = px => Math.min(...px.map(p => p[1]));

for (const [name, draw] of Object.entries(AT_REST)) test(`a ${name} at rest in water sits as deep in it as the rest look says`, () => {
  SP.setBoard(POND);
  assert.equal(top(drawnAt(draw, 2, 2)) - top(drawnAt(draw, 6, 2)), REST_LOOK.sink);
});

const SOAKS = { sponge: (S, x, y) => S.sponge(x, y), cardboard: (S, x, y) => S.cardboard(x, y) };
for (const [name, draw] of Object.entries(SOAKS)) test(`a ${name} in water is drawn soaked, as deep as on the floor and with nothing on the water`, () => {
  SP.setBoard(POND);
  const wet = drawnAt(draw, 2, 2), dry = drawnAt(draw, 6, 2);
  assert.deepEqual(wet.map(([x, y]) => `${x},${y}`).sort(), dry.map(([x, y]) => `${x},${y}`).sort());
  assert.notDeepEqual(wet, dry);
});

test('a float clip hands the water every place the stage drew its thing, and the line between them for a skipped frame', () => {
  const state = room(['#######', '#E@o~##', '#######']), stage = stageFrom(state, 1, null);
  let now = 0;
  const calls = [], own = () => calls.push('own');
  const clips = createClips({ pixel: true, stage: () => stage, clock: () => 0, since: () => now * 1000 / 60, frame: 1000 / 60,
    art: { ...art, wadeEnd: 30, wade: (o, at, t, draw) => { calls.push([o, t, at(0), at(6), at(t)]); draw(); } } });
  const [it] = timeline(explain(state, 'r', { trace: true }), CELL_MS)[0].items;
  applyStep(stage, it.step, it.racTo, it.board);
  clips.note(it.step, it.next, 10);
  const sp = stage.sprites.find(s => s.kind === TIRE_H);
  for (const [f, x] of [[0, 3], [4, 3.5], [8, 4]]) { now = f; sp.x = x; assert.equal(clips.paint(sp, own), true); }
  assert.deepEqual(calls.at(-2), [TIRE_H, 8, { x: 3, y: 1 }, { x: 3.75, y: 1 }, { x: 4, y: 1 }]);
  assert.equal(calls.at(-1), 'own');
  now = 10 + 30;
  clips.prune();
  assert.equal(clips.anyLive(), false);
});

const CAN = toState({ id: 'can', grid: ['#######', '#@C---#', '#E#####'] });
const tips = m => m.o === CAN_FULL && m.becomes.o === CAN_EMPTY;

for (const [name, glyph] of [['a can', 'C'], ['a box', 'B']]) test(`${name} that empties starts a dump clip`, () => {
  const state = toState({ id: name, grid: ['#######', `#@${glyph}---#`, '#E#####'] }), stage = stageFrom(state, 1, null);
  const clips = createClips({ pixel: true, art: SP, stage: () => stage, clock: () => 0, since: () => 0, frame: 1000 / 60 });
  playMove(clips, stage, state, 'r');
  assert.equal(clips.anyLive(), true);
});

test('a container that sheds a kind its dump does not take fails loudly, and names the kind', () => {
  const it = itemsOf(CAN, 'r').find(({ step }) => step.moved.some(tips));
  const odd = structuredClone(it.step);
  odd.spawned.find(e => e.o === BAG).o = 99;
  assert.throws(() => clipsFor(stageFrom(CAN, 1, null)).note(odd, it.next, 0), /sheds 99\b/);
});

test('a container with no dump fails loudly, and names its kind', () => {
  const it = itemsOf(CAN, 'r').find(({ step }) => step.moved.some(tips));
  const odd = structuredClone(it.step);
  odd.moved.find(tips).becomes.o = 77;
  assert.throws(() => clipsFor(stageFrom(CAN, 1, null)).note(odd, it.next, 0), /kind 77\b/);
});

test('each dump takes the one kind it sheds', () => {
  assert.doesNotThrow(() => SP.shedFor(CAN_EMPTY, { o: BAG }));
  assert.doesNotThrow(() => SP.shedFor(BIN_EMPTY, { o: TRASH }));
  assert.doesNotThrow(() => SP.shedFor(JUG_EMPTY, { o: NONE, effect: 'pours' }));
  assert.doesNotThrow(() => SP.shedFor(WHEELIE_EMPTY, { o: BAG }));
  assert.throws(() => SP.shedFor(CAN_EMPTY, { o: TRASH }), /sheds 4\b/);
});
