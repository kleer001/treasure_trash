import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, BIN_EMPTY, CAN_EMPTY } from '../src/rules.js';
import { toState } from '../src/format.js';
import { stageFrom, applyStep, settle, face, census, decorAfter, RACCOON } from '../src/stage.js';

const S = (grid, cart) => toState({ id: 't', grid, cart });
/** Press each of `keys` from `s`, a refused press included. The board and the decoration after. */
function press(s, keys, decor = null) {
  for (const k of keys) {
    const r = explain(s, k, { trace: true });
    decor = decorAfter(s, decor, k, r);
    if (r.ok) s = r.next;
  }
  return { s, decor };
}
const wearing = ({ s, decor }, kind) => {
  const sp = stageFrom(s, 1, decor).sprites.filter(p => p.kind === kind);
  assert.equal(sp.length, 1, `expected one ${String(kind)}, found ${sp.length}`);
  return { heading: sp[0].heading, lie: sp[0].lie };
};

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

test('a stage rebuilt from a board and its decoration is the stage the presses left', () => {
  let s = S(OPEN), decor = null;
  const live = stageFrom(s, 1, decor);
  for (const k of ['r', 'l', 'd', 'r', 'u']) {
    const r = explain(s, k, { trace: true });
    decor = decorAfter(s, decor, k, r);
    face(live, k);
    if (!r.ok) continue;
    r.steps.forEach((step, i) => { applyStep(live, step, r.frames[i + 1].rac); settle(live); });
    s = r.next;
    assert.deepEqual(census(live), census(stageFrom(s, 1, decor)), `after ${k}`);
  }
});
