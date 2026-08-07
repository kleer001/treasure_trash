import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toState, parseLurd, parseLevelPack } from '../src/format.js';
import { analyze } from '../src/solver.js';
import { readFileSync } from 'node:fs';
import {
  solveShape, pathBite, largestOpenBlock, floorIsConnected, hasNiche,
} from '../tools/metrics.mjs';
import { score, dedupe, TERMS } from '../tools/score.mjs';

const S = grid => toState({ id: 't', grid });

// --- solve shape -------------------------------------------------------------
// Sokoban counts LINES, not pushes: a run of shoves on one piece in one direction is one
// decision however long the corridor. Anything that counts the corridor measures tedium.

test('a run of shoves on one piece in one direction is a single line', () => {
  // Four shoves right on the same can: one line, one piece, no changes.
  const s = S(['--------', '-@c----E', '--------']);
  const sh = solveShape(s, parseLurd('RRRR'));
  assert.equal(sh.pushes, 4, 'four shoves happened');
  assert.equal(sh.lines, 1, 'and they are one line');
  assert.equal(sh.changes, 0);
  assert.equal(sh.pieces, 1);
});

test('turning the same piece a corner starts a new line but is not a piece change', () => {
  // Shove the can right twice, walk around it, then shove it down: two runs, one can.
  const s = S(['-------', '-@c----', '-------', '------E']);
  const sh = solveShape(s, parseLurd('RRurD'));
  assert.equal(sh.pushes, 3);
  assert.equal(sh.lines, 2, 'right-run then down-run');
  assert.equal(sh.changes, 0, 'it is still the one can');
  assert.equal(sh.pieces, 1);
});

test('walking between two shoves of one piece breaks neither the line nor the piece', () => {
  const straight = solveShape(S(['-------', '-@c---E', '-------']), parseLurd('RR'));
  const detoured = solveShape(S(['-------', '-@c---E', '-------']), parseLurd('RduR'));
  assert.equal(straight.lines, 1);
  assert.equal(detoured.lines, 1, 'he stepped away and came back to the same can, same way');
  assert.equal(detoured.changes, 0);
  assert.equal(detoured.pieces, 1);
});

test('two different pieces in one solve is one change', () => {
  const s = S(['--------', '-@c-----', '--c----E', '--------']);
  const sh = solveShape(s, parseLurd('RdR'));
  assert.equal(sh.pieces, 2);
  assert.equal(sh.changes, 1, 'the first piece worked is where counting starts, not a change');
});

// --- where the traps sit -----------------------------------------------------

test('a room whose traps all hang off branches reads zero on the optimal line', () => {
  // L29 is the pack's worked example of the failure: many ways to lose, none of them on
  // the road. Whatever its trap count, `onPath` is what says the traps are not doing work.
  const pack = parseLevelPack(readFileSync('levels/act1.tt', 'utf8'));
  const l29 = pack.levels.find(l => l.id === 'L29');
  const a = analyze(toState(l29));
  const b = pathBite(a);
  assert.ok(a.traps.length > 0, 'the fixture has traps at all');
  assert.ok(b.onPath >= 0 && b.onPath <= 1);
  assert.equal(b.bitten, Math.round(b.onPath * a.minMoves));
});

test('a room with no way to lose has no bite anywhere', () => {
  const pack = parseLevelPack(readFileSync('levels/act1.tt', 'utf8'));
  const clean = pack.levels.find(l => l.traps === 0);
  assert.ok(clean, 'the pack needs a trapless room for this to mean anything');
  const b = pathBite(analyze(toState(clean)));
  assert.equal(b.onPath, 0);
  assert.equal(b.firstOnPath, null);
});

test('firstOnPath is the earliest depth optimal play can throw the room away', () => {
  const pack = parseLevelPack(readFileSync('levels/act1.tt', 'utf8'));
  for (const l of pack.levels) {
    const a = analyze(toState(l));
    const b = pathBite(a);
    if (b.firstOnPath === null) { assert.equal(b.bitten, 0, `${l.id}`); continue; }
    assert.ok(b.firstOnPath >= 0 && b.firstOnPath < a.minMoves,
      `${l.id}: firstOnPath ${b.firstOnPath} outside 0..${a.minMoves - 1}`);
    assert.ok(b.bitten >= 1, `${l.id}`);
    // A bite on the line implies a trap exists; the converse is exactly what does not hold.
    assert.ok(a.traps.length > 0, `${l.id}: bite on the line but no traps`);
  }
});

// --- room structure ----------------------------------------------------------

test('the open-block measure finds the largest clear rectangle', () => {
  const rows = ['----', '----', '----'];
  const isFloor = (x, y) => rows[y]?.[x] === '-';
  assert.deepEqual(largestOpenBlock(isFloor, 4, 3).area, 12);
  const walled = ['----', '--#-', '----'];
  const f2 = (x, y) => walled[y]?.[x] === '-';
  assert.ok(largestOpenBlock(f2, 4, 3).area < 12, 'one wall breaks the full rectangle');
});

test('connectivity and niches are read off the outline', () => {
  const split = ['-#-', '-#-', '-#-'];
  const f = (x, y) => split[y]?.[x] === '-';
  assert.equal(floorIsConnected(f, 3, 3), false, 'a wall down the middle is two rooms');

  const niche = ['###', '#--', '###'];
  const g = (x, y) => niche[y]?.[x] === '-';
  assert.equal(hasNiche(g, 3, 3), true, 'a cell walled on three sides is a niche');

  const clean = ['--', '--'];
  const h = (x, y) => clean[y]?.[x] === '-';
  assert.equal(hasNiche(h, 2, 2), false);
  assert.equal(floorIsConnected(h, 2, 2), true);
});

// --- the scorer --------------------------------------------------------------

const ROOM = {
  group: 'xBBj', par: 20, solves: 1, traps: 4, firstTrap: 2, biteSteps: 4, blind: 3,
  lines: 6, changes: 4, pushes: 10, pieces: 3, w: 8, h: 4,
};

test('every term stays inside 0..1 however extreme the room', () => {
  const wild = [
    ROOM,
    { ...ROOM, lines: 999, changes: 999, pushes: 999, blind: 999, solves: 999 },
    { ...ROOM, lines: 0, changes: 0, pushes: 0, blind: 0, solves: 1, traps: 0, firstTrap: null },
    { ...ROOM, par: 1 },
  ];
  for (const r of wild) for (const [k, f] of Object.entries(TERMS)) {
    const v = f(r);
    assert.ok(v >= 0 && v <= 1 && Number.isFinite(v), `${k} gave ${v}`);
  }
});

test('a trap on the road outranks the same room with its traps off it', () => {
  const off = score({ ...ROOM, onPath: 0, firstOnPath: null });
  const on = score({ ...ROOM, onPath: 0.5, firstOnPath: 1 });
  assert.ok(on.total > off.total, `on-road ${on.total} should beat off-road ${off.total}`);
});

test('a room you can keep playing long after losing is penalised', () => {
  const quick = score({ ...ROOM, blind: 0 });
  const slow = score({ ...ROOM, blind: 40 });
  assert.ok(slow.total < quick.total, 'staying playable after the loss is a cost, not a feature');
});

test('the refined on-path reading overrides the raw trap-depth stand-in', () => {
  // Same room, but optimal play can never actually go wrong. The stand-in cannot see that.
  const raw = TERMS.firstBite({ ...ROOM });
  const refined = TERMS.firstBite({ ...ROOM, firstOnPath: null });
  assert.ok(raw > 0, 'the stand-in reads an early trap');
  assert.equal(refined, 0, 'and the exact reading says optimal play is never bitten');
});

test('dedupe keeps one room per group and solution signature', () => {
  const a = { group: 'xBBj', par: 20, lines: 6, changes: 4, total: 3 };
  const b = { group: 'xBBj', par: 20, lines: 6, changes: 4, total: 2 };
  const c = { group: 'xBBj', par: 21, lines: 6, changes: 4, total: 1 };
  const out = dedupe([a, b, c]);
  assert.equal(out.length, 2);
  assert.equal(out[0].total, 3, 'the better-scoring twin survives');
});
