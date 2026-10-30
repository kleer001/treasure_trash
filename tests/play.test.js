import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLevelPack, toState, parseLurd } from '../src/format.js';
import { explain, stateKey, MOVE } from '../src/rules.js';
import { createProgress } from '../src/progress.js';
import { createPlay } from '../src/play.js';

const LEVELS = parseLevelPack(readFileSync('levels/act1.tt', 'utf8')).levels;
const store = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; };
const fresh = () => createPlay({ levels: LEVELS, progress: createProgress(store()) });

/** An armed room, walked along its solution to the first action that is not a walk. */
function armedTear() {
  const i = LEVELS.findIndex(L => L.arm === true);
  const acts = parseLurd(LEVELS[i].solve, LEVELS[i].id);
  const k = acts.findIndex((a, j) => {
    let s = toState(LEVELS[i]);
    for (const b of acts.slice(0, j)) s = explain(s, b.dir).next;
    return explain(s, a.dir).kind !== MOVE;
  });
  return { i, before: acts.slice(0, k).map(a => a.dir), dir: acts[k].dir };
}

function refusedAtStart() {
  for (let i = 0; i < LEVELS.length; i++)
    for (const d of 'lrud') if (!explain(toState(LEVELS[i]), d).ok) return { i, dir: d };
  throw new Error('every room lets the raccoon go every way');
}

test('in an armed room the first press aims a tear and the second commits it', () => {
  const p = fresh(), { i, before, dir } = armedTear();
  p.load(i);
  for (const d of before) p.press(d, false);
  const n = p.moves, key = stateKey(p.state);
  assert.equal(p.press(dir, false).kind, 'armed');
  assert.equal(p.armed, dir);
  assert.equal(p.moves, n);
  assert.equal(stateKey(p.state), key);
  assert.equal(p.press(dir, false).kind, 'moved');
  assert.equal(p.armed, null);
  assert.equal(p.moves, n + 1);
});

test('a refused press turns him but is no move, so undo does not stop on it', () => {
  const p = fresh(), { i, dir } = refusedAtStart();
  p.load(i);
  const key = stateKey(p.state);
  assert.equal(p.press(dir, false).kind, 'refused');
  assert.notEqual(p.decor, null);
  assert.equal(p.moves, 0);
  assert.equal(stateKey(p.state), key);
  assert.equal(p.undo().kind, 'none');
});

test('undo puts back the board and which way things faced', () => {
  const p = fresh(), L = LEVELS[0];
  p.load(0);
  const [a] = parseLurd(L.solve, L.id);
  const decor = p.decor, key = stateKey(p.state);
  p.press(a.dir, false);
  assert.equal(p.undo().kind, 'undone');
  assert.equal(p.decor, decor);
  assert.equal(stateKey(p.state), key);
});

test('while a shove plays out, a press that is not a walk is turned away', () => {
  const p = fresh(), { i, before, dir } = armedTear();
  p.load(i);
  for (const d of before) p.press(d, false);
  const res = p.press(dir, true);
  assert.equal(res.kind, 'busy');
  assert.equal(p.armed, null);
});

test('a win is recorded as it lands, and the next press hands over the room', () => {
  const progress = createProgress(store()), p = createPlay({ levels: LEVELS, progress }), L = LEVELS[0];
  p.load(0);
  const acts = parseLurd(L.solve, L.id);
  let res;
  for (const a of acts) res = p.press(a.dir, false);
  assert.equal(res.won, true);
  assert.equal(p.won, true);
  assert.equal(progress.best(L.id), acts.length);
  assert.equal(p.press(acts[0].dir, false).kind, 'handover');
});

test('the path is the moves that made the board, and an undo takes the last one back', () => {
  const p = fresh(), L = LEVELS[0];
  p.load(0);
  const acts = parseLurd(L.solve, L.id).slice(0, 2);
  for (const a of acts) p.press(a.dir, false);
  assert.equal(p.path, acts.map(a => a.dir).join(''));
  p.undo();
  assert.equal(p.path, acts[0].dir);
});
