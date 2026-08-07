import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choose, emit, refit } from '../tools/pick.mjs';
import { parseLevelPack, parseSolutionPack, toState } from '../src/format.js';
import { analyze } from '../src/solver.js';

const room = (over = {}) => ({
  group: 'xBBj', par: 20, solves: 1, traps: 4, firstTrap: 2, biteSteps: 4, blind: 3,
  onPath: 0.2, firstOnPath: 2, lines: 6, changes: 4, pushes: 10, pieces: 3,
  w: 8, h: 4, solve: 'RRUUlldd', grid: ['--------', '-@x----E', '--B-B---', '---j----'],
  total: 1, ...over,
});

// --- selection ---------------------------------------------------------------
// The whole reason this is not `sort().slice(20)`: ranking alone hands back whatever the
// metric loves, and an act of twenty rooms about one piece is one room twenty times.

test('the act is spread across par bands rather than heaped where the metric scores best', () => {
  // Twenty rooms, all high-scoring, but pars only at the two extremes.
  const scored = [];
  for (let i = 0; i < 40; i++)
    scored.push(room({ par: i % 2 ? 34 : 15, group: `g${i}`, total: 100 - i }));
  const { picked, byBand, short } = choose(scored, { want: 10, lo: 14, hi: 35, bands: 5 });
  assert.ok(byBand.every(n => n <= 2), `no band may exceed its quota, got ${byBand}`);
  assert.ok(byBand[0] > 0 && byBand[byBand.length - 1] > 0, 'both ends should be represented');
  // Three bands have nothing to offer, so the act is short by design and says which bands.
  assert.equal(picked.length, 4);
  assert.equal(short.length, 3);
});

test('no single piece may take over the act', () => {
  // Every room contains B. The cap has to bite, and the act comes up short rather than
  // quietly becoming twenty rooms about one piece.
  const scored = Array.from({ length: 40 }, (_, i) =>
    room({ group: 'BBBB', par: 14 + (i % 20), total: 100 - i }));
  const { picked, byPiece } = choose(scored, { want: 10, lo: 14, hi: 35, bands: 5, perGroup: 99 });
  assert.ok((byPiece.B ?? 0) <= 5, `B took ${byPiece.B} of a 10-room act`);
  assert.ok(picked.length <= 10);
});

test('one room per piece group, so the act is not variations on a single mixture', () => {
  const scored = Array.from({ length: 30 }, (_, i) =>
    room({ group: 'xBBj', par: 14 + (i % 20), total: 100 - i }));
  const { picked } = choose(scored, { want: 8, lo: 14, hi: 35, bands: 5 });
  assert.equal(picked.length, 1, 'every candidate draws the same group');
});

test('a band that cannot be filled is reported, never topped up from another', () => {
  // Nothing at all in the low bands: the act must come up short and say where.
  const scored = Array.from({ length: 30 }, (_, i) =>
    room({ group: `g${i}`, par: 33, total: 100 - i }));
  const { picked, short, byBand } = choose(scored, { want: 10, lo: 14, hi: 35, bands: 5 });
  assert.ok(short.length >= 1, 'the empty bands should be named');
  assert.ok(byBand.every(n => n <= 2), 'a full band must not absorb an empty one');
  assert.ok(picked.length < 10, 'coming up short is the honest outcome here');
});

test('picked rooms come back in par order, so the pack reads as a curve', () => {
  const scored = Array.from({ length: 30 }, (_, i) =>
    room({ group: `g${i}`, par: 14 + ((i * 7) % 21), total: 100 - i }));
  const { picked } = choose(scored, { want: 10, lo: 14, hi: 35, bands: 5 });
  for (let i = 1; i < picked.length; i++)
    assert.ok(picked[i].par >= picked[i - 1].par, 'pars should ascend');
});

// --- emit --------------------------------------------------------------------
// A room lives in three files. Present in two of them is a broken pack, and the verifier
// only catches that after someone has already pasted it in.

test('every picked room reaches all three files with one identity', () => {
  const picked = [room({ par: 16, solve: 'RRU' }), room({ par: 24, solve: 'LLD', group: 'CBFP' })];
  const { tt, sol, md } = emit(picked, { first: 31, pack: 'Test Act' });
  for (const id of ['L31', 'L32']) {
    assert.ok(tt.includes(`:level  ${id}`), `${id} missing from the level pack`);
    assert.ok(sol.includes(`:solution ${id}`), `${id} missing from the solution pack`);
    assert.ok(md.includes(`| ${id} |`), `${id} missing from the table`);
  }
  assert.ok(tt.includes(':solve  RRU') && sol.includes(':moves  RRU'));
});

test('what emit writes is what the parsers read back', () => {
  const picked = [room({ par: 16, solve: 'RRU' })];
  const { tt, sol } = emit(picked, { first: 31, pack: 'Test Act' });
  const pack = parseLevelPack(tt);
  assert.equal(pack.levels.length, 1);
  assert.equal(pack.levels[0].id, 'L31');
  assert.equal(pack.levels[0].par, 16);
  assert.ok(toState(pack.levels[0]), 'the grid should read as a legal board');
  const sols = parseSolutionPack(sol);
  assert.equal(sols.solutions[0].moves, pack.levels[0].solve,
    'the two files must not be able to disagree');
});

test('a cart room carries its mask into the pack', () => {
  const picked = [room({
    group: '$BPP', grid: ['-------', '-@----E', '--B----'], cart: ['-------', '--PP---', '-------'],
  })];
  const { tt } = emit(picked, { first: 40, pack: 'Test Act' });
  const l = parseLevelPack(tt).levels[0];
  assert.ok(l.cart, 'the cart mask should survive');
  assert.ok(toState(l), 'and the board should still read');
});

// --- refit -------------------------------------------------------------------

test('tightening preserves par and never loosens the room', () => {
  // A deliberately roomy board: tighten should wall off floor the solve never used.
  const row = {
    group: '$Bj', states: 99999,
    grid: ['--------', '-@-$----', '--------', 'E-------', '--------'],
  };
  const before = analyze(toState({ id: 'b', grid: row.grid }));
  const after = refit(row);
  if (after === null) return;                       // nothing to tighten is a legal outcome
  assert.equal(after.par, before.minMoves, 'tightening must not change what the room asks');
  assert.ok(after.solves <= before.shortestCount, 'and must not add solutions');
  assert.ok(after.states <= before.reachable, 'walls only ever remove options');
});
