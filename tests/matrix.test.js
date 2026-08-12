// The interaction matrix, as a gate.
//
// Every other spec in here names one behaviour and checks it. This one checks the thing no
// single spec can: that the pieces work TOGETHER — each against every terrain lane, and each
// against every other piece — and that what the rules REPORT about a move describes the board
// the move produced.
//
// The second half is the part a board comparison cannot make. `tools/conform.mjs` proves two
// engines land the same board; it says nothing about the account of what moved, and the stage
// animates from that account alone. A step that lands the right board while naming the wrong
// thing leaves a sprite behind, drops one, or asks the stage for one that does not exist.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, cases, reachable, halfCabinets } from '../tools/matrix.mjs';
import { toState } from '../src/format.js';

test('every piece meeting every lane and every other piece lands where it says it does', () => {
  const rows = run();
  const bad = rows.filter(r => r.verdict === 'DISAGREES');
  assert.deepEqual(bad.map(r => `${r.id}: ${r.why}`), []);
});

test('the matrix is not quietly empty', () => {
  // A gate that stopped generating cases would pass every run. The number is a floor, not a
  // fixture: adding a piece or a lane is expected to raise it.
  const rows = run();
  assert.ok(cases().length > 900, `only ${cases().length} cases`);
  assert.ok(rows.filter(r => r.verdict === 'ok').length > 900, 'too few cases actually acted');
});

test('a case that will not build is reported rather than skipped', () => {
  // The failure mode of a matrix is silence: a case that cannot be constructed looks exactly
  // like a case that passed. `run` gives every case a verdict, and `unbuildable` is one of them.
  const rows = run();
  assert.equal(rows.length, cases().length, 'every case has a verdict');
  for (const r of rows) assert.ok(
    ['ok', 'refused', 'unbuildable', 'DISAGREES'].includes(r.verdict), `odd verdict ${r.verdict}`);
});

test('nothing on the board can take half a cabinet', () => {
  // The two halves are one thing. Anything that shifts a single cell could take one of them —
  // a broom sweeping the drawer out, a magnet pulling the body away, a cart swallowing either —
  // and what is left is a board that cannot be written down and that every branch reading a
  // cabinet then reads wrong. Asked of every board these rooms can reach, not of one shove.
  for (const c of cases()) {
    if (!/cabinet|drawer/.test(c.id)) continue;
    let s;
    try { s = toState({ ...c.room, id: c.id }); } catch { continue; }
    for (const st of reachable(s, 400))
      assert.deepEqual(halfCabinets(st), [], `${c.id} reached a board with half a cabinet`);
  }
});
