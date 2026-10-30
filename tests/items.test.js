// Each new piece, checked against the row it has in the levels.md item table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, bagsLeft } from '../src/rules.js';
import { toState, toGrid, toWater } from '../src/format.js';

// Water is a layer over the occupant grid, not a glyph in it — so a board under test is a
// grid and, when it has a canal, a mask the same shape. See FORMATS.md.
const S = (grid, water) => toState({ id: 't', grid, water });
const act = (grid, dir, water) => {
  const r = explain(S(grid, water), dir);
  assert.ok(r.ok, `expected a legal action, got refused (${r.reason})`);
  return r.next;
};
const after = (grid, dir, water) => toGrid(act(grid, dir, water));
const afterWet = (grid, dir, water) => toWater(act(grid, dir, water));
const refused = (grid, dir, water) => {
  const r = explain(S(grid, water), dir);
  assert.ok(!r.ok, 'expected a refusal');
  return r.reason;
};

test('recycle bin slides one and drops one cell of trash directly ahead', () => {
  assert.deepEqual(after(['-----', '-----', '--B--', '--@--', 'E----'], 'u'),
                          ['--x--', '--b--', '--@--', '-----', 'E----']);
});

test('recycle bin is refused when its trash would land on the exit', () => {
  assert.equal(refused(['--E--', '-----', '--B--', '--@--', '-----'], 'u'), 'exit');
});

test('an emptied recycle bin slides like an empty can — it has nothing left to drop', () => {
  assert.deepEqual(after(['-----', '-----', '--b--', '--@--', 'E----'], 'u'),
                          ['-----', '--b--', '--@--', '-----', 'E----']);
});

test('a full recycle bin is worth a bag, and shoving it once spends it', () => {
  assert.equal(bagsLeft(S(['--B--', '--@--', 'E----'])), 1);
  assert.equal(bagsLeft(S(['--b--', '--@--', 'E----'])), 0);
  assert.equal(bagsLeft(act(['-----', '-----', '--B--', '--@--', 'E----'], 'u')), 0);
});

test('an emptied bin is not refused by the exit — there is no drop to land on it', () => {
  assert.equal(refused(['--E--', '-----', '--B--', '--@--', '-----'], 'u'), 'exit');
  assert.deepEqual(after(['--E--', '-----', '--b--', '--@--', '-----'], 'u'),
                          ['--E--', '--b--', '--@--', '-----', '-----']);
});

test('wheelie bin rolls until stopped, dumps out the back, and he takes the cell it left', () => {
  assert.deepEqual(after(['-----', '-----', '-----', '--W--', 'E-@--'], 'u'),
                          ['--w--', '--$--', '-----', '--@--', 'E----']);
});

test('a one-cell roll drops the bag on the cell the bin just vacated — so he cannot follow', () => {
  assert.deepEqual(after(['--#--', '-----', '--W--', '--@--', 'E----'], 'u'),
                          ['--#--', '--w--', '--$--', '--@--', 'E----']);
});

test('an emptied wheelie bin still rolls', () => {
  assert.deepEqual(after(['-----', '-----', '--w--', '--@--', 'E----'], 'u'),
                          ['--w--', '-----', '--@--', '-----', 'E----']);
});

test('a wheelie bin with nowhere to roll is refused', () => {
  assert.equal(refused(['--#--', '--W--', '--@--', 'E----'], 'u'), 'canRoom');
});

test('a rolling bin stops short of the exit rather than occupying it', () => {
  assert.deepEqual(after(['--E--', '-----', '--w--', '--@--', '-----'], 'u'),
                          ['--E--', '--w--', '--@--', '-----', '-----']);
});

// The shared canal board for the water cases below. See src/rules.js `isOccupiable`.
const CANAL = ['-----', '~~~~~', '-----', '-----', '-----'];

test('the raccoon will not step into open water', () => {
  assert.equal(refused(['-----', '-----', '--@--', 'E----'], 'u',
                       ['-----', '--~--', '-----', '-----']), 'water');
});

test('a fan fires into water and fills it — a filled cell is floor', () => {
  const g = ['-----', '-----', '--$--', '--@--', 'E----'];
  assert.deepEqual(after(g, 'u', CANAL), ['-----', '-----', '-x@x-', '-----', 'E----']);
  assert.deepEqual(afterWet(g, 'u', CANAL), ['-----', '~===~', '-----', '-----', '-----']);
});

test('a bridge is walkable, and stays walkable', () => {
  const w = ['-----', '~===~', '-----', '-----', '-----'];
  assert.deepEqual(after(['-----', '-----', '-x@x-', '-----', 'E----'], 'u', w),
                          ['-----', '--@--', '-x-x-', '-----', 'E----']);
});

test('an object can be shoved across a bridge, because a bridge is floor', () => {
  const w = ['-----', '~===~', '-----', '-----', '-----'];
  const g = ['-----', '-----', '--c--', '--@--', 'E----'];
  assert.deepEqual(after(g, 'u', w), ['-----', '--c--', '--@--', '-----', 'E----']);
  assert.deepEqual(afterWet(g, 'u', w), w);
});

test('a fan can land on a bridge and wall your own crossing off again', () => {
  const w = ['-----', '~===~', '-----', '-----', '-----'];
  const s = act(['-----', '-----', '--$--', '--@--', 'E----'], 'u', w);
  assert.deepEqual(toGrid(s), ['-----', '-xxx-', '-x@x-', '-----', 'E----']);
  assert.deepEqual(toWater(s), w);
  assert.equal(explain(s, 'u').reason, 'trash');
});

test('a can shoved at the canal goes in, and is then out of reach forever', () => {
  const g = ['-----', '-----', '--c--', '--@--', 'E----'];
  const w = ['-----', '--~--', '-----', '-----', '-----'];
  assert.deepEqual(after(g, 'u', w), ['-----', '--c--', '--@--', '-----', 'E----']);
  assert.equal(explain(act(g, 'u', w), 'u').reason, 'water');
});

test('a full can ejects its bag into the water, and that bag can never be opened', () => {
  const g = ['-----', '-----', '--C--', '--@--', 'E----'];
  const w = ['--~--', '-----', '-----', '-----', '-----'];
  const s = act(g, 'u', w);
  assert.deepEqual(toGrid(s), ['--$--', '--c--', '--@--', '-----', 'E----']);
  assert.equal(explain(s, 'u').reason, 'canRoom');
  assert.equal(bagsLeft(s), 1);
});

test('the recycle bin bridges one cell — one spent for one gained', () => {
  const w = ['--~--', '-----', '-----', '-----', '-----'];
  const g = ['-----', '-----', '--B--', '--@--', 'E----'];
  assert.deepEqual(after(g, 'u', w), ['-----', '--b--', '--@--', '-----', 'E----']);
  assert.deepEqual(afterWet(g, 'u', w), ['--=--', '-----', '-----', '-----', '-----']);
});

test('a spent bin steps aside onto the plank it laid', () => {
  const w = ['--~--', '-----', '-----', '-----', '-----'];
  const s = act(['-----', '-----', '--B--', '--@--', 'E----'], 'u', w);
  assert.deepEqual(toGrid(act(toGrid(s), 'u', toWater(s))),
                   ['--b--', '--@--', '-----', '-----', 'E----']);
});

test('a wheelie bin rolls clean across a canal, and he steps only into the cell it left', () => {
  const w = ['-----', '--~--', '-----', '-----', '-----'];
  assert.deepEqual(after(['-----', '-----', '--w--', '--@--', 'E----'], 'u', w),
                          ['--w--', '-----', '--@--', '-----', 'E----']);
});

const JUGBOARD = ['-----', '-----', '--j--', '--@--', 'E----'];

test('water jug slides one and spills a cell of water directly ahead', () => {
  assert.deepEqual(after(JUGBOARD, 'u'), ['-----', '--i--', '--@--', '-----', 'E----']);
  assert.deepEqual(afterWet(JUGBOARD, 'u'), ['--~--', '-----', '-----', '-----', '-----']);
});

test('a jug shoved twice the same way drives itself into its own puddle', () => {
  const twice = explain(act(['-----', '-----', '-----', '--j--', '--@--', 'E----'], 'u'), 'u');
  assert.ok(twice.ok, 'the second shove is legal now — objects go in the canal');
  assert.deepEqual(toGrid(twice.next),
    ['-----', '--i--', '--@--', '-----', '-----', 'E----']);
  assert.deepEqual(toWater(twice.next),
    ['-----', '--~--', '-----', '-----', '-----', '-----']);
  assert.equal(explain(twice.next, 'u').reason, 'water');
});

test('the jug pours once and is empty after', () => {
  let s = act(['-----', '-----', '-----', '--j--', '--@--', 'E----'], 'u');
  for (const d of ['l', 'u']) s = explain(s, d).next;
  s = explain(s, 'r').next;
  assert.deepEqual(toGrid(s), ['-----', '-----', '--@i-', '-----', '-----', 'E----']);
  assert.deepEqual(toWater(s), ['-----', '--~--', '-----', '-----', '-----', '-----'],
    'the second shove moved it and spilled nothing');
});

test('the jug is refused when its water would land on the exit', () => {
  assert.equal(refused(['--E--', '-----', '--j--', '--@--', '-----'], 'u'), 'exit');
});

test('the jug will not pour into water it has already spilled', () => {
  assert.equal(refused(JUGBOARD, 'u', ['--~--', '-----', '-----', '-----', '-----']), 'water');
});

test('the jug will not pour onto spilled trash — nothing in this game un-blocks a cell', () => {
  assert.equal(refused(['--x--', '-----', '--j--', '--@--', 'E----'], 'u'), 'canRoom');
});

test('a fan bridges water the jug poured, and the raccoon walks over it', () => {
  const w = ['-----', '-~---', '-----', '-----', '-----'];
  const bridged = act(['-----', '-----', '-$---', '-@---', 'E----'], 'u', w);
  assert.deepEqual(toGrid(bridged), ['-----', 'x-x--', 'x@x--', '-----', 'E----']);
  assert.deepEqual(toWater(bridged), ['-----', '-=---', '-----', '-----', '-----']);
  assert.deepEqual(toGrid(explain(bridged, 'u').next),
                          ['-----', 'x@x--', 'x-x--', '-----', 'E----']);
});

test('the jug will not pour on a bridge — nothing in this game reverses a fill', () => {
  assert.equal(refused(JUGBOARD, 'u', ['--=--', '-----', '-----', '-----', '-----']), 'canRoom');
});

test('a couch shoves as one unit and the raccoon takes the cell he pushed', () => {
  assert.deepEqual(after(['-----', '-FF--', '-@---', 'E----'], 'u'),
                          ['-FF--', '-@---', '-----', 'E----']);
});

test('a couch may slide along its own length — vacated cells are not blockers', () => {
  assert.deepEqual(after(['-----', '--F--', '--F--', '--F--', '--@--', 'E----'], 'u'),
                          ['--F--', '--F--', '--F--', '--@--', '-----', 'E----']);
});

test('one blocked cell of the leading edge refuses the whole shove', () => {
  assert.equal(refused(['-#---', '-FF--', '-@---', 'E----'], 'u'), 'canRoom');
});

test('a couch will not be shoved onto the exit', () => {
  assert.equal(refused(['-E---', '-FF--', '-@---', '-----'], 'u'), 'exit');
});


test('once the end he is touching is afloat, the couch is beyond him', () => {
  const g = ['--F--', '--F--', '--@--', 'E----'];
  const w = ['--~--', '--~--', '-----', '-----'];
  assert.equal(refused(g, 'u', w), 'water');
});

test('two letters flush together are two couches, and shove independently', () => {
  const g = ['-----', '-FFGG', '-@---', 'E----'];
  assert.deepEqual(after(g, 'u'), ['-FF--', '-@-GG', '-----', 'E----']);
});

test('the same letter, touching, is one couch and shoves whole', () => {
  const g = ['-----', '-FFFF', '-@---', 'E----'];
  assert.deepEqual(after(g, 'u'), ['-FFFF', '-@---', '-----', 'E----']);
});

test('the same letter used twice, not touching, is two couches', () => {
  assert.deepEqual(toGrid(S(['FF-FF', '--@--', 'E----'])), ['FF-GG', '--@--', 'E----']);
});

test('a one-cell couch is refused — that piece already exists, and it is the can', () => {
  assert.throws(() => S(['-F---', '-@---', 'E----']), /single cell/);
});

test('furniture blocks a fan, like anything else standing in one', () => {
  assert.equal(refused(['-----', 'FF---', '-$---', '-@---', 'E----'], 'u'), 'fan');
});

test('glyphs round-trip through the serialiser, water layer and all', () => {
  const g = ['Cb---', '-Wwj-', '--@--', 'E--x-', 'FFGGc'];
  const w = ['-----', '-----', '-----', '---~-', '----~'];
  assert.deepEqual(toGrid(S(g, w)), g);
  assert.deepEqual(toWater(S(g, w)), w);
});

test('a slider still travelling hands its motion on, and one that is not does not', () => {
  const skated = explain(toState({ id: 'a', grid: ['#########', '#@c--o-E#', '#########'],
                                   water: ['---------', '--%%%----', '---------'] }), 'r');
  assert.ok(skated.ok);
  assert.equal(toGrid(skated.next)[1], '#-@-c-oE#', 'the can stops where it stopped; the tyre rolls on');

  const rolled = explain(toState({ id: 'b', grid: ['#########', '#@o--o-E#', '#########'] }), 'r');
  assert.equal(toGrid(rolled.next)[1], '#-@-o-oE#', 'which is the shape a tyre hand-off already had');

  const shoved = explain(toState({ id: 'c', grid: ['#########', '#@co---E#', '#########'] }), 'r');
  assert.equal(shoved.ok, false, 'a standing shove has no momentum to hand on');
});
