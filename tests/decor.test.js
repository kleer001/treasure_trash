import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, BIN_EMPTY, CAN_EMPTY, SPONGE, COVERED } from '../src/rules.js';
import { toState } from '../src/format.js';
import { stageFrom, applyStep, settle, face, census, decorAfter, coverOf, RACCOON } from '../src/stage.js';

const S = (grid, cart, water) => toState({ id: 't', grid, cart, water });
/** Press each of `keys` from `s`, a refused press included. The board and the decoration after. */
function press(s, keys, decor = null) {
  for (const k of keys) {
    const r = explain(s, k, { trace: true });
    decor = decorAfter(s, decor, k, r);
    if (r.ok) s = r.next;
  }
  return { s, decor };
}
const worn = ({ s, decor }, kind) => {
  const sp = stageFrom(s, 1, decor).sprites.filter(p => p.kind === kind);
  assert.equal(sp.length, 1, `expected one ${String(kind)}, found ${sp.length}`);
  return sp[0];
};
const wearing = (after, kind) => { const sp = worn(after, kind); return { heading: sp.heading, lie: sp.lie }; };

const OPEN = ['-----', '-----', '@B---', '-----', '----E'];

test('the raccoon faces the viewer in a fresh room, then the way he was last pressed', () => {
  assert.equal(wearing({ s: S(OPEN) }, RACCOON).heading, 'd');
  assert.equal(wearing(press(S(OPEN), ['u', 'r']), RACCOON).heading, 'r');
});

test('a refused press turns the raccoon and nothing else', () => {
  const s = S(['#@--E']);
  assert.equal(explain(s, 'l').ok, false);
  const after = press(s, ['l']);
  assert.equal(after.s, s);
  assert.equal(wearing(after, RACCOON).heading, 'l');
  assert.equal(after.decor.size, 1);
});

test('a bin tipped by a shove lies the way it went, and keeps that lie when shoved again', () => {
  const tipped = press(S(OPEN), ['r']);
  assert.deepEqual(wearing(tipped, BIN_EMPTY), { heading: 'r', lie: 'r' });
  const shoved = press(tipped.s, ['d', 'r', 'u'], tipped.decor);
  assert.deepEqual(wearing(shoved, BIN_EMPTY), { heading: 'u', lie: 'r' });
  assert.equal(wearing(shoved, RACCOON).heading, 'u');
});

test('a full can a rolling deck carries and sets down lies behind it, the way its bag went', () => {
  const s = S(['@Cs-B---#', '--------E'], ['-PP------', '---------']);
  assert.deepEqual(wearing(press(s, ['r']), CAN_EMPTY), { heading: 'r', lie: 'l' });
});

test('an empty bin the room places stands, and goes on standing when shoved', () => {
  assert.deepEqual(wearing(press(S(['@b--E']), ['r']), BIN_EMPTY), { heading: 'r', lie: null });
});

test('the same presses give the same decoration', () => {
  const keys = ['r', 'd', 'r', 'u', 'l', 'l'];
  assert.deepEqual([...press(S(OPEN), keys).decor], [...press(S(OPEN), keys).decor]);
});

test('a sponge stays soaked with the water it soaked up when it is shoved on', () => {
  const s = S(['@s---E'], null, ['--~---']);
  assert.equal(worn({ s }, SPONGE).soaked, null);
  const soaked = press(s, ['r']);
  assert.equal(soaked.s.cells[0][2].water, false);
  assert.equal(worn(soaked, SPONGE).soaked, 'water');
  assert.equal(worn(press(soaked.s, ['r'], soaked.decor), SPONGE).soaked, 'water');
});

test('a sponge wears the last thing it soaked up or stood in', () => {
  const s = S(['@s----E'], null, ['--%T---']);
  assert.equal(worn(press(s, ['r']), SPONGE).soaked, 'grease');
  assert.equal(worn(press(s, ['r', 'r']), SPONGE).soaked, 'tar');
});

test('a sponge the room sets in water is soaked from the start', () => {
  assert.equal(worn({ s: S(['@-s--E'], null, ['--~---']) }, SPONGE).soaked, 'water');
});

test('a covered cell keeps what its sheet soaked up, and keeps it through later presses', () => {
  for (const [lay, kind] of [['--~---', 'water'], ['--T---', 'tar'], ['--*---', null]]) {
    const covered = press(S(['@d---E'], null, [lay]), ['r']);
    assert.equal(covered.s.cells[0][2].ter, COVERED, lay);
    assert.equal(coverOf(stageFrom(covered.s, 1, covered.decor), 2, 0), kind, lay);
    const on = press(covered.s, ['r'], covered.decor);
    assert.equal(coverOf(stageFrom(on.s, 1, on.decor), 2, 0), kind, lay);
  }
});

/** Presses `keys` from `s`, landing each step on a live stage, and checks it against a rebuild after each press. */
function liveMatchesRebuilt(s, keys) {
  let decor = null;
  const live = stageFrom(s, 1, decor);
  for (const k of keys) {
    const r = explain(s, k, { trace: true });
    decor = decorAfter(s, decor, k, r);
    face(live, k);
    if (!r.ok) continue;
    r.steps.forEach((step, i) => { applyStep(live, step, r.frames[i + 1].rac, r.frames[i]); settle(live); });
    s = r.next;
    assert.deepEqual(census(live), census(stageFrom(s, 1, decor)), `after ${k}`);
  }
}

test('a stage rebuilt from a board and its decoration is the stage the presses left', () => {
  liveMatchesRebuilt(S(OPEN), ['r', 'l', 'd', 'r', 'u']);
  liveMatchesRebuilt(S(['@s----E'], null, ['--~%T--']), ['r', 'r', 'r']);
});
