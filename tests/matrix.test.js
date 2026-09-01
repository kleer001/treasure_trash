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
import { run, cases, reachable, meeting, corridor, sweepRooms,
         landsWhereTheBoardSays } from '../tools/matrix.mjs';
import { generatedRooms } from '../tools/conform.mjs';
import { actLevels } from '../tools/packs.mjs';
import { toState } from '../src/format.js';
import { handlesOf } from '../src/handles.js';
import { cell, pieceCells, isCabinetOpen, cabinetFace, carriedKind, DIRS } from '../src/rules.js';

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

test('an open cabinet is one piece wherever a room can get to', () => {
  // The two cells are one piece and nothing may take one of them — a broom sweeping the drawer
  // out, a magnet pulling the body away, a cart swallowing either. A piece id is what says so,
  // so the question is whether every cabinet cell a room reaches still belongs to a piece of
  // exactly two cells lying along its facing. Asked of every board these rooms reach, not of
  // one shove.
  for (const c of cases()) {
    if (!/cabinet/.test(c.id)) continue;
    let s;
    try { s = toState({ ...c.room, id: c.id }); } catch { continue; }
    for (const st of reachable(s, 400))
      for (let y = 0; y < st.rows; y++) for (let x = 0; x < st.cols; x++) {
        const cc = cell(st, x, y);
        if (!isCabinetOpen(cc.o)) continue;
        const own = pieceCells(st, cc.pid);
        assert.equal(own.length, 2, `${c.id}: an open cabinet of ${own.length} cells at ${x},${y}`);
        const f = DIRS[cabinetFace(cc.o)];
        const [a, b] = [...own].sort((p, q) => p[1] - q[1] || p[0] - q[0]);
        assert.ok(b[0] - a[0] === Math.abs(f[0]) && b[1] - a[1] === Math.abs(f[1]),
          `${c.id}: an open cabinet lying across its facing at ${x},${y}`);
      }
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
  assert.match(forgetful.why, /left over|never arrived|traces to nothing/);
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

// --- the handle invariant --------------------------------------------------------------------
// Three questions the census cannot ask, because the census compares a sorted SET of sprite
// shapes: two things that draw alike, told apart wrongly, leave that set untouched. These are
// put to the ACCOUNT against the boards either side of the step it ran on, so they hold however
// the stage reaches its answer.

test('a barrow riding in a barrow is three handles on one cell, not one', () => {
  // The case the depth lane exists for. The vehicle and the cargo standing in it are BOTH a
  // right-facing barrow — same kind, same cell — and what that cargo is itself carrying is on
  // the same cell again. Nothing but the lane separates them.
  const { room } = corridor({ left: { mask: 'r', cargo: '>', hold: 'C' } });
  const roll = handlesOf(toState({ ...room, id: 'stacked' }));
  const here = [...roll.values()].filter(d => d.at[0] === 2 && d.at[1] === 2);
  assert.deepEqual(here.map(d => d.handle).sort(), ['2,2/0', '2,2/1', '2,2/cart']);
  assert.equal(here.find(d => d.handle === '2,2/cart').ck,
    carriedKind(here.find(d => d.handle === '2,2/0').o),
    'the cart and its cargo are the same barrow, so the code cannot be what tells them apart');
});

test('the handle invariant holds over every board the shipped rooms reach', () => {
  assert.deepEqual(sweepRooms(actLevels().map(l => l.level)), []);
});

test('and over the generated batch, where the odd pairings are', () => {
  // The shipped rooms are a thin slice of the interaction space: a level author does not build
  // the pairings that break identity, because there is no reason to put them in a puzzle.
  assert.deepEqual(sweepRooms(generatedRooms(40, 7).map(g => g.level)), []);
});

test('two entries that swap the handles they name are caught', () => {
  const { room } = corridor({ left: 'C', right: { mask: 'r', cargo: '>', hold: 'C' } });
  const s = toState({ ...room, id: 'swap' });
  assert.equal(landsWhereTheBoardSays(s, 'r').ok, true, 'the honest run passes');
  const swapped = landsWhereTheBoardSays(s, 'r', st => {
    const [a, b, ...rest] = st.moved;
    return { ...st,
             moved: [{ ...a, from: b.from, handle: b.handle },
                     { ...b, from: a.from, handle: a.handle }, ...rest] };
  });
  assert.equal(swapped.ok, false, 'two entries pointing at each other has to be caught');
  assert.match(swapped.why, /the step names o \d+ at \d+,\d+\/\d+, which holds occupant o \d+/);
});

test('an entry naming the wrong handle is caught where no sprite comparison could', () => {
  // The stage resolves a body by the handle the entry carries and never reads its cells, so a
  // piece entry that names the wrong ones builds exactly the sprites it should. What reads those
  // cells is everything downstream that wants to know WHICH cells an action disturbed.
  const { room } = corridor({ left: 'W', right: { mask: 'PP' } });
  const s = toState({ ...room, id: 'misnamed' });
  assert.equal(landsWhereTheBoardSays(s, 'r').ok, true, 'the honest run passes');
  const misnamed = landsWhereTheBoardSays(s, 'r', st => ({
    ...st, piece: st.piece.map(p => ({ ...p, cells: p.cells.map(([x, y]) => [x, y + 1]) })),
  }));
  assert.equal(misnamed.ok, false);
  assert.match(misnamed.why, /whose cells anchor at \d+,\d+\/cart/);
});

test('a body entry that names a handle no board holds is caught', () => {
  // The stamp itself, bent: the cells stay honest and the handle moves off them. The board is
  // what answers, so a handle nothing on it holds is a fault however well the entry reads.
  const { room } = corridor({ left: 'W', right: { mask: 'PP' } });
  const s = toState({ ...room, id: 'unheld' });
  const adrift = landsWhereTheBoardSays(s, 'r', st => ({
    ...st, piece: st.piece.map(p => ({ ...p, cells: p.cells.map(([x, y]) => [x, y + 1]),
                                       handle: `${p.cells[0][0]},${p.cells[0][1] + 1}/cart` })),
  }));
  assert.equal(adrift.ok, false);
  assert.match(adrift.why, /nothing answers to \d+,\d+\/cart/);
});

test('a removal that lies about what it took cannot hide behind an arrival', () => {
  // A removal at a handle the board never held is asked of the entry that announced it, because
  // there is nothing else to ask. That reading must not extend to a handle the board DOES hold:
  // pairing a spawn onto one would let a removal agree with itself about a thing it never took.
  const { room } = corridor({ left: 'C', lane: 'O' });
  const s = toState({ ...room, id: 'disguise' });
  assert.equal(landsWhereTheBoardSays(s, 'r').ok, true, 'the honest run passes');
  const disguised = landsWhereTheBoardSays(s, 'r', st => {
    const g = st.gone.find(e => e.ref === undefined);
    const lie = { ...g, o: g.o + 1 };
    return { ...st, gone: st.gone.map(e => (e === g ? lie : e)),
             spawned: [...st.spawned,
                       { o: lie.o, cells: g.cells, handle: g.handle, depth: 0 }] };
  });
  assert.equal(disguised.ok, false);
  assert.match(disguised.why, /gone: the step names o \d+ at \d+,\d+\/\d+, which holds occupant/);
});
