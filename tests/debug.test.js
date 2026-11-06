import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, isWon } from '../src/rules.js';
import { toState } from '../src/format.js';
import { stageFrom } from '../src/stage.js';

// The probe reaches the page through these globals: it listens for errors and presses keys.
const heard = {};
globalThis.addEventListener = (type, fn) => (heard[type] ??= []).push(fn);
globalThis.KeyboardEvent = class { constructor(type, init) { Object.assign(this, { type }, init); } };
globalThis.requestAnimationFrame = fn => setImmediate(fn);
const DIR = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r' };
const { createProbe } = await import('../src/debug.js');

/** A game with no screen. */
function game(id = 'T') {
  const room = () => toState({ id, grid: ['@----E'] });
  const g = { id, state: room(), moves: 0, speaking: false, fails: false, arms: false, armed: null };
  globalThis.dispatchEvent = e => {
    if (g.fails) { g.fails = false; pageError('boom'); }
    if (g.speaking || !DIR[e.key]) return true;
    if (g.arms && g.armed !== DIR[e.key]) { g.armed = DIR[e.key]; return true; }
    g.armed = null;
    const r = explain(g.state, DIR[e.key]);
    if (r.ok) { g.state = r.next; g.moves++; }
    if (isWon(g.state)) { g.id += '+'; g.state = room(); g.moves = 0; }
    return true;
  };
  g.probe = createProbe({
    stage: () => stageFrom(g.state), refStage: () => stageFrom(g.state), idle: () => true,
    level: () => g.id, moves: () => g.moves, won: () => false, armed: () => g.armed, mute() {},
  });
  return g;
}
const pageError = message => heard.error.forEach(fn => fn({ message }));

test('a page error fails the walk it happens in, and no later walk', async () => {
  const g = game();
  g.fails = true;
  const first = await g.probe.walk('rr');
  assert.equal(first.length, 1);
  assert.deepEqual(first[0].errors, ['boom']);
  const second = await g.probe.walk('rr');
  assert.equal(second.length, 2);
  assert.deepEqual(second.flatMap(b => b.errors), []);
});

test('a key the game swallows is reported, and the walk stops on it', async () => {
  const g = game();
  g.speaking = true;
  const beats = await g.probe.walk('rr');
  assert.equal(beats.length, 1);
  assert.equal(beats[0].landed, false);
  g.speaking = false;
  assert.deepEqual((await g.probe.walk('r')).map(b => b.landed), [true]);
});

test('a key that arms a push lands, and so does the key that makes it', async () => {
  const g = game();
  g.arms = true;
  assert.deepEqual((await g.probe.walk('rr')).map(b => b.landed), [true, true]);
  assert.equal(g.moves, 1);
});

test('a key that wins the room lands, though the next room has started', async () => {
  const g = game();
  assert.deepEqual((await g.probe.walk('rrrrr')).map(b => b.landed), [true, true, true, true, true]);
});

test('a sweep counts the meetings of a swallowed key as missed', async () => {
  const g = game();
  g.speaking = true;
  const r = await g.probe.sweep([{ id: 'T', runs: [{ keys: 'rr', covers: [{ after: 1, had: ['a'] }, { after: 2, had: ['b'] }] }] }]);
  assert.equal(r.clean, false);
  assert.deepEqual(r.unmet, ['a', 'b']);
  assert.equal(r.meetings, 0);
});

test('a sweep counts the meetings of a room it cannot reach as missed', async () => {
  const { probe } = game('T');
  const r = await probe.sweep([{ id: 'X', runs: [
    { keys: 'r', covers: [{ after: 1, had: ['a'] }] },
    { keys: 'r', covers: [{ after: 1, had: ['b'] }] },
  ] }]);
  assert.equal(r.clean, false);
  assert.deepEqual(r.unmet, ['a', 'b']);
});
