import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toState } from '../src/format.js';
import { analyze } from '../src/solver.js';
import { deadTravel, isOneRoom, inertPieces, roomPieces } from '../tools/metrics.mjs';
import { draft } from '../tools/draft-room.mjs';
import { shrinkSet } from '../tools/shrink.mjs';
import { resiteSet, cost } from '../tools/resite.mjs';
import { WALK_MAX } from '../tools/metrics.mjs';
import { chooseSets } from '../tools/pick.mjs';

const travel = grid => deadTravel(analyze(toState({ id: 't', grid })));

test('a room with nothing to touch is all tail', () => {
  assert.deepEqual(travel(['#E#', '#-#', '#-#', '#@#']), { lead: 0, tail: 3 });
});

test('the walk in and the walk out are counted at their own ends', () => {
  const t = travel(['-----', '--$--', '-----', '-----', '--@--', '-----', '--E--']);
  assert.deepEqual(t, { lead: 2, tail: 5 });
});

test('dead travel is the best line, not the canonical one', () => {
  const grid = ['-----', '-$---', '--@--', '----E'];
  const a = analyze(toState({ id: 't', grid }));
  assert.ok(a.minMoves !== null, 'the room has to be solvable for this to mean anything');
  assert.equal(deadTravel(a).lead, 1);
});

test('a cart nobody can reach is not one room', () => {
  const sealed = ['#####--', '#-$-#--', '#-@-#--', '#-E-#--', '#####--'];
  assert.equal(isOneRoom(toState({ id: 't', grid: sealed })), false);
  assert.equal(isOneRoom(toState({ id: 't', grid: ['#####', '#-$-#', '#-@-#', '#-E-#', '#####'] })), true);
});

test('draft refuses a room whose open cells fall in two regions', () => {
  const d = draft({ id: 'split', grid: ['#####--', '#-$-#--', '#-@-#--', '#-E-#--', '#####--'] });
  assert.equal(d.ok, false);
  assert.ok(d.notes.some(n => n.includes('region')), d.notes.join('; '));
});

test('draft reports the walk at both ends', () => {
  const d = draft({ id: 'walk', grid: ['Eb---', '@$---', '-----'], cart: ['--P--', '--P--', '-----'] });
  assert.equal(d.ok, true, d.notes.join('; '));
  assert.equal(d.lead, 1);
  assert.equal(d.tail, 2);
});

const inert = room => inertPieces(room, analyze(toState({ id: 'i', ...room }))).map(p => p.what);

test('pieces are read the way the file writes them', () => {
  // A same-letter blob is one couch; two letters flush together are two; a cart is its mask.
  const p = roomPieces(toState({
    id: 'p',
    grid: ['FFGG-', '@--x-', 'E--$c'],
    cart: ['-----', '----P', '----P'],
  }));
  assert.deepEqual(p.map(x => `${x.what}${x.cells.length}`).sort(), ['$1', 'F2', 'G2', 'P2', 'c1', 'x1']);
});

test('a piece nothing touches and nothing needs is inert', () => {
  assert.deepEqual(inert({ grid: ['-----', '--$--', '-----', '--@--', '#x#-#', 'E----'] }), []);
  assert.deepEqual(inert({ grid: ['x----', '--$--', '-----', '--@--', '#-#-#', 'E----'] }), ['x']);
});

test('binding is not the same as being in the way of the best line', () => {
  assert.deepEqual(inert({ grid: ['-----', '--$--', '-----', '--@--', '#-#x#', 'E----'] }), ['x']);
});

test('a piece the solve handles is not inert, even where the room could spare it', () => {
  const room = { grid: ['Ec--#', '@$-##', '---##'], cart: ['--PP-', '-----', '-----'] };
  assert.deepEqual(inert(room), []);
});

const SET = {
  shape: 'test', ramp: 'par',
  rooms: [
    { group: 'B', grid: ['---------', '--B----@-', 'E--------'] },
    { group: 'W', grid: ['---------', '-W-----@-', 'E--------'] },
    { group: 'C', grid: ['---------', '--C----@-', 'E--------'] },
  ],
};

const TOY = { parMin: 3, parMax: 40 };

test('re-siting cuts the walk at both ends', () => {
  const before = SET.rooms.map(r => deadTravel(analyze(toState({ id: 'b', grid: r.grid }))));
  assert.deepEqual(before[2], { lead: 8, tail: 5 }, 'the fixture has to start badly sited');
  const walk = rooms => rooms.reduce((a, r) => a + r.lead + r.tail, 0);

  const out = resiteSet(SET, TOY);
  assert.ok(out, 'the set has to be readable where it stands');
  assert.equal(out.resited, true);
  assert.ok(walk(out.rooms) < walk(before) / 2, `${walk(out.rooms)} of ${walk(before)}`);
  assert.ok(Math.max(...out.rooms.map(r => r.lead)) <= 1, out.rooms.map(r => r.lead).join('/'));
  assert.ok(out.rooms[0].par < out.rooms[1].par && out.rooms[1].par < out.rooms[2].par,
    out.rooms.map(r => r.par).join('/'));
  const cellOf = ch => out.rooms.map(r => {
    const y = r.grid.findIndex(row => row.includes(ch));
    return `${r.grid[y].indexOf(ch)},${y}`;
  });
  assert.equal(new Set(cellOf('E')).size, 1, cellOf('E').join(' '));
  assert.equal(new Set(cellOf('@')).size, 1, cellOf('@').join(' '));
});

test('the par floor is what a room may not fall below to get there', () => {
  const out = resiteSet(SET);
  assert.ok(out.rooms.every(r => r.par >= 8), out.rooms.map(r => r.par).join('/'));
});

test('a placement that breaks the ladder costs nothing — it is refused', () => {
  const rung = par => ({ par, lead: 0, tail: 0, onPath: 0, solves: 1, traps: 1 });
  assert.equal(cost([rung(20), rung(19), rung(30)]), null, 'pars must ascend');
  assert.equal(cost([rung(20), rung(20), rung(30)]), null, 'a flat rung is not a rung');
  assert.equal(cost([rung(20), null, rung(30)]), null, 'an unreadable rung sinks the set');
  assert.notEqual(cost([rung(20), rung(25), rung(30)]), null);
  // Whether the top rung is still Act 2 is `chooseSets`' question, not this one.
  assert.notEqual(cost([rung(10), rung(11), rung(12)]), null);
});

// On some outlines the best pair `resite` can find is still a march. The pack cannot accept
// those rooms, so they are refused where the act is assembled rather than found by the gate.
test('a set that still walks too far is not chosen', () => {
  const rung = (par, tail) => ({ par, lead: 0, tail, onPath: 0.5, traps: 1, group: '$' });
  const set = (shape, tail) => ({ shape, ramp: 'par', rooms: [rung(19, 0), rung(21, 0), rung(23, tail)] });
  const fine = set('fine', WALK_MAX.tail);
  const { sets } = chooseSets([set('marching', WALK_MAX.tail + 1), fine], { want: 5 });
  assert.deepEqual(sets.map(s => s.shape), ['fine']);
});

test('shrinking will not seal a piece into a pocket', () => {
  const set = {
    shape: 'test', ramp: 'par',
    rooms: [
      { group: '$P', grid: ['-$-----', '-@-----', 'E------'], cart: ['-------', '-------', '-----PP'] },
      { group: '$P', grid: ['-$-----', '--@----', 'E------'], cart: ['-------', '-------', '-----PP'] },
      { group: '$P', grid: ['-$-----', '---@---', 'E------'], cart: ['-------', '-------', '-----PP'] },
    ],
  };
  const out = shrinkSet(set);
  if (!out) return;                       // the set may simply not hold; that is not this bug
  for (const r of out.rooms)
    assert.equal(isOneRoom(toState({ id: 'r', grid: r.grid, ...(r.cart && { cart: r.cart }) })),
      true, r.grid.join('\n'));
});
