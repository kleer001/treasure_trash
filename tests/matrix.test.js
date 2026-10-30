// The interaction matrix, as a gate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, cases, reachable, meeting, corridor, sweepRooms,
         landsWhereTheBoardSays } from '../tools/matrix.mjs';
import { generatedRooms } from '../tools/conform.mjs';
import { actLevels } from '../tools/packs.mjs';
import { toState } from '../src/format.js';
import { handlesOf, laneOf, CART_LANE } from '../src/handles.js';
import { arrives, cell, pieceCells, isCabinetOpen, cabinetFace,
         carriedKind, DIRS } from '../src/rules.js';

test('every piece meeting every lane and every other piece lands where it says it does', () => {
  const rows = [...run()];
  const bad = rows.filter(r => r.verdict === 'DISAGREES');
  assert.deepEqual(bad.map(r => `${r.id}: ${r.why}`), []);
});

test('the matrix stages what it claims to stage', () => {
  const rows = [...run()];
  const all = [...cases()];
  assert.ok(all.length > 900, `only ${all.length} cases`);
  const holes = rows.filter(r => r.verdict === 'NO-MEETING');
  assert.deepEqual(holes.map(r => r.id), [], 'these cases stage nothing');
  const mattered = rows.filter(r => r.mattered).length;
  assert.ok(mattered > 600, `only ${mattered} cases where the thing under test changed anything`);
});

test('every case gets a verdict, and staging nothing is one of them', () => {
  // The failure mode of a matrix is silence: a case that cannot be constructed, or that stages
  // no meeting, looks exactly like a case that passed. Both have names here.
  const rows = [...run()];
  assert.equal(rows.length, [...cases()].length, 'every case has a verdict');
  for (const r of rows) assert.ok(
    ['ok', 'refused', 'unbuildable', 'NO-MEETING', 'DISAGREES'].includes(r.verdict),
    `odd verdict ${r.verdict}`);
});

test('an open cabinet is one piece wherever a room can get to', () => {
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

test('a case where the piece never reaches the thing under test is NOT a pass', () => {
  const outOfReach = {
    grid: ['###########', '#---------#', '#@$------E#', '#---------#', '###########'],
    water: ['-----------', '-----------', '----~------', '-----------', '-----------'],
  };
  assert.equal(meeting(outOfReach, [[4, 2]]).reached, false, 'nothing was staged here');

  const built = corridor({ left: '$', lane: '~' });
  assert.equal(meeting(built.room, built.at).reached, true);
  assert.equal(meeting(built.room, built.at).mattered, true, 'the canal takes the trash as a plank');
});

test('a step that forgets what moved is caught', () => {
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
    st => ({ ...st, moved: st.moved.map(m => ({ ...m, dy: m.dy + 1 })) }));
  assert.equal(wrong.ok, false, 'a sprite sent to the wrong cell has to be caught');
});

test('a step that forgets a container emptied is caught', () => {
  const { room } = corridor({ left: 'C', lane: '-' });
  const s = toState({ ...room, id: 'bend' });
  assert.equal(landsWhereTheBoardSays(s, 'r').ok, true);
  const silent = landsWhereTheBoardSays(s, 'r', st => ({
    ...st, moved: st.moved.map(m => ({ ...m, becomes: { ...m.becomes, o: m.o } })),
  }));
  assert.equal(silent.ok, false, 'a container that sheds without saying what it becomes');
});

// --- the handle invariant --------------------------------------------------------------------

test('a barrow riding in a barrow is three handles on one cell, not one', () => {
  const { room } = corridor({ left: { mask: 'r', cargo: '>', hold: 'C' } });
  const roll = handlesOf(toState({ ...room, id: 'stacked' }));
  const here = [...roll.values()].filter(d => d.at[0] === 2 && d.at[1] === 2);
  assert.deepEqual(here.map(d => d.handle).sort(), ['2,2/0', '2,2/1', '2,2/cart']);
  assert.equal(here.find(d => d.handle === '2,2/cart').ck,
    carriedKind(here.find(d => d.handle === '2,2/0').o),
    'the cart and its cargo are the same barrow, so the code cannot be what tells them apart');
});

test('the handle invariant holds over every board the act rooms reach', () => {
  assert.deepEqual(sweepRooms(actLevels().map(l => l.level)), []);
});

test('and over the generated batch, where the odd pairings are', () => {
  // The act rooms are a thin slice of the interaction space: a level author does not build
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
             moved: [{ ...a, cells: b.cells, handle: b.handle },
                     { ...b, cells: a.cells, handle: a.handle }, ...rest] };
  });
  assert.equal(swapped.ok, false, 'two entries pointing at each other has to be caught');
  assert.match(swapped.why, /the step names o \d+ at \d+,\d+\/\d+, which holds occupant o \d+/);
});

test('an entry naming the wrong handle is caught where no sprite comparison could', () => {
  const { room } = corridor({ left: 'W', right: { mask: 'PP' } });
  const s = toState({ ...room, id: 'misnamed' });
  assert.equal(landsWhereTheBoardSays(s, 'r').ok, true, 'the honest run passes');
  const misnamed = landsWhereTheBoardSays(s, 'r', st => ({
    ...st, moved: st.moved.map(m => (laneOf(m.handle) !== CART_LANE ? m
      : { ...m, cells: m.cells.map(([x, y]) => [x, y + 1]) })),
  }));
  assert.equal(misnamed.ok, false);
  assert.match(misnamed.why, /over [\d, ]+, where the cart there stands on [\d, ]+/);
});

test('a body entry that names a handle no board holds is caught', () => {
  const { room } = corridor({ left: 'W', right: { mask: 'PP' } });
  const s = toState({ ...room, id: 'unheld' });
  const adrift = landsWhereTheBoardSays(s, 'r', st => ({
    ...st, moved: st.moved.map(m => (laneOf(m.handle) !== CART_LANE ? m
      : { ...m, cells: m.cells.map(([x, y]) => [x, y + 1]),
          handle: `${m.cells[0][0]},${m.cells[0][1] + 1}/cart` })),
  }));
  assert.equal(adrift.ok, false);
  assert.match(adrift.why, /nothing answers to \d+,\d+\/cart/);
});

test('a removal that names what neither the board nor an arrival had is caught', () => {
  const { room } = corridor({ left: 'C', lane: 'O' });
  const s = toState({ ...room, id: 'disguise' });
  assert.equal(landsWhereTheBoardSays(s, 'r').ok, true, 'the honest run passes');
  const invented = landsWhereTheBoardSays(s, 'r', st => {
    const g = st.gone[0];
    return { ...st, gone: [{ ...g, o: g.o + 1 }],
             spawned: [...st.spawned, { ...g, o: g.o + 2 }] };
  });
  assert.equal(invented.ok, false, 'it took something that was never anywhere');
  assert.match(invented.why, /gone: the step names o \d+ at \d+,\d+\/\d+, which holds occupant/);
});
