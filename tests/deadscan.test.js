import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLevelPack, parseLurd, toState } from '../src/format.js';
import { analyze, deadScan } from '../src/solver.js';
import { explain, stateKey, isWon } from '../src/rules.js';

/** Drive the generator to completion the way the page does, a slice at a time. */
const run = (s, opts) => {
  const g = deadScan(s, opts);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
};

const PACK = parseLevelPack(readFileSync('levels/act1.tt', 'utf8'));

// The indicator is a SECOND path to a fact the verifier already proves with `analyze`. If the
// two ever disagree, one of them is lying to the player about whether the room is still alive.
test('deadScan agrees with analyze on every shipped room', () => {
  for (const l of PACK.levels) {
    const s = toState(l);
    const a = analyze(s);
    const dead = run(s);
    assert.equal(dead.size, a.dead.size, `${l.id}: ${dead.size} dead vs analyze's ${a.dead.size}`);
    for (const k of a.dead) assert.ok(dead.has(k), `${l.id}: analyze calls ${k} dead, deadScan does not`);
  }
});

test('the opening board of a solvable room is never dead', () => {
  for (const l of PACK.levels) {
    const s = toState(l);
    assert.ok(!run(s).has(stateKey(s)), `${l.id} is unwinnable from move one`);
  }
});

test('walking the declared solve never enters a dead board', () => {
  for (const l of PACK.levels) {
    const s = toState(l);
    const dead = run(s);
    let cur = s;
    for (const act of parseLurd(l.solve)) {
      cur = explain(cur, act.dir).next;
      assert.ok(!dead.has(stateKey(cur)), `${l.id}: par line passes through a dead board`);
    }
    assert.ok(isWon(cur), `${l.id}: the solve should end won`);
  }
});

// The player's first move is owed a responsive frame, so the scan has to be interruptible.
test('the scan yields while working and returns the set only when finished', () => {
  const l = PACK.levels.find(x => x.id === 'L11');       // the pack's largest state graph
  const g = deadScan(toState(l), { budget: 50 });
  let yields = 0, value = null;
  for (;;) {
    const r = g.next();
    if (r.done) { value = r.value; break; }
    yields++;
    assert.equal(typeof r.value.scanned, 'number', 'a yield reports progress');
  }
  assert.ok(yields > 5, `expected many slices, got ${yields}`);
  assert.ok(value instanceof Set);
});

test('a smaller budget changes only how often it pauses, never the answer', () => {
  const s = toState(PACK.levels.find(x => x.id === 'L9'));
  const coarse = run(s, { budget: 100000 });
  const fine = run(s, { budget: 7 });
  assert.equal(coarse.size, fine.size);
  for (const k of coarse) assert.ok(fine.has(k));
});

test('a room lost by a real mistake reports itself lost', () => {
  // L9's own note says the way to lose it is filling the gap you must come back through.
  const l = PACK.levels.find(x => x.id === 'L9');
  const s = toState(l);
  const a = analyze(s);
  const dead = run(s);
  assert.ok(a.traps.length > 0, 'the fixture needs a way to lose');

  // Replay the shortest losing line and check the indicator lights exactly at the end of it.
  const trap = a.traps[0];
  let cur = s;
  const acts = parseLurd(trap.lurd);
  acts.forEach((act, i) => {
    cur = explain(cur, act.dir).next;
    const isLast = i === acts.length - 1;
    assert.equal(dead.has(stateKey(cur)), isLast,
      `${l.id}: after ${i + 1} of ${acts.length} moves the verdict should be ${isLast}`);
  });
});
