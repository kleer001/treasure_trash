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
import { run, cases, reachable, halfCabinets, meeting, corridor,
         landsWhereTheBoardSays } from '../tools/matrix.mjs';
import { toState } from '../src/format.js';

test('every piece meeting every lane and every other piece lands where it says it does', () => {
  const rows = run();
  const bad = rows.filter(r => r.verdict === 'DISAGREES');
  assert.deepEqual(bad.map(r => `${r.id}: ${r.why}`), []);
});

test('the matrix stages what it claims to stage', () => {
  // Counting passes was the first version of this guard, and a pass is exactly what a case that
  // staged nothing looks like — so it counted the number that was lying. What has to be counted
  // is MEETINGS: cases where the piece reached the thing under test.
  const rows = run();
  assert.ok(cases().length > 900, `only ${cases().length} cases`);
  const holes = rows.filter(r => r.verdict === 'NO-MEETING');
  assert.deepEqual(holes.map(r => r.id), [], 'these cases stage nothing');
  const mattered = rows.filter(r => r.mattered).length;
  assert.ok(mattered > 600, `only ${mattered} cases where the thing under test changed anything`);
});

test('every case gets a verdict, and staging nothing is one of them', () => {
  // The failure mode of a matrix is silence: a case that cannot be constructed, or that stages
  // no meeting, looks exactly like a case that passed. Both have names here.
  const rows = run();
  assert.equal(rows.length, cases().length, 'every case has a verdict');
  for (const r of rows) assert.ok(
    ['ok', 'refused', 'unbuildable', 'NO-MEETING', 'DISAGREES'].includes(r.verdict),
    `odd verdict ${r.verdict}`);
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

// --- the gate, checked against itself -------------------------------------------------------
// Everything above trusts this file to go red for the right reason. It did not: the first
// version put the thing under test a cell beyond where a one-cell shove could reach, so most
// cases played out in an empty corridor and every one of them passed. A gate nobody has watched
// fail is a gate nobody knows the shape of.

test('a case where the piece never reaches the thing under test is NOT a pass', () => {
  // The old geometry, written out: a bag at x=2 whose burst reaches x=3, and a canal at x=4.
  const outOfReach = {
    grid: ['###########', '#---------#', '#@$------E#', '#---------#', '###########'],
    water: ['-----------', '-----------', '----~------', '-----------', '-----------'],
  };
  assert.equal(meeting(outOfReach, [[4, 2]]).reached, false, 'nothing was staged here');

  // And the same case as the matrix builds it now, where the burst does reach the canal.
  const built = corridor({ left: '$', lane: '~' });
  assert.equal(meeting(built.room, built.at).reached, true);
  assert.equal(meeting(built.room, built.at).mattered, true, 'the canal takes the trash as a plank');
});

test('a step that forgets what moved is caught', () => {
  // The mistake this whole file exists to catch, put in front of it on purpose: a piece that
  // travels and is not named. Without the check, the board is right and the sprite is elsewhere.
  const { room } = corridor({ left: 'c', lane: '-' });
  const s = toState({ ...room, id: 'bend' });
  assert.equal(landsWhereTheBoardSays(s, 'r').ok, true, 'the honest run passes');
  const forgetful = landsWhereTheBoardSays(s, 'r', st => ({ ...st, moved: [] }));
  assert.equal(forgetful.ok, false, 'a step naming nothing has to be caught');
  assert.match(forgetful.why, /left over|never arrived/);
});

test('a step that moves a sprite to the wrong cell is caught', () => {
  const { room } = corridor({ left: 'c', lane: '-' });
  const s = toState({ ...room, id: 'bend' });
  const wrong = landsWhereTheBoardSays(s, 'r',
    st => ({ ...st, moved: st.moved.map(m => ({ ...m, to: [m.to[0], m.to[1] + 1] })) }));
  assert.equal(wrong.ok, false, 'a sprite sent to the wrong cell has to be caught');
});

test('a step that forgets a container emptied is caught', () => {
  // The swept-can bug, exactly: the board empties it, the step does not say so, and the sprite
  // keeps its old kind.
  const { room } = corridor({ left: 'C', lane: '-' });
  const s = toState({ ...room, id: 'bend' });
  assert.equal(landsWhereTheBoardSays(s, 'r').ok, true);
  const silent = landsWhereTheBoardSays(s, 'r', st => ({
    ...st, moved: st.moved.map(({ becomes, ...m }) => m),
  }));
  assert.equal(silent.ok, false, 'a container that sheds without saying what it becomes');
});
