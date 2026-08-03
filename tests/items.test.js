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
  assert.deepEqual(after(['-----', '-----', '--b--', '--@--', 'E----'], 'u'),
                          ['--x--', '--b--', '--@--', '-----', 'E----']);
});

test('recycle bin is refused when its trash would land on the exit', () => {
  assert.equal(refused(['--E--', '-----', '--b--', '--@--', '-----'], 'u'), 'exit');
});

test('bag-on-can stack launches the bag two and slides the can one, still full', () => {
  assert.deepEqual(after(['-----', '-----', '--S--', '--@--', 'E----'], 'u'),
                          ['--$--', '--C--', '--@--', '-----', 'E----']);
});

test('a stack is worth two bags — the loose one and the one still in the can', () => {
  assert.equal(bagsLeft(S(['--S--', '--@--', 'E----'])), 2);
  assert.equal(bagsLeft(S(['--$--', '--C--', '--@--', 'E----'])), 2);
});

test('wheelie bin rolls until stopped, dumps out the back, raccoon stays put', () => {
  assert.deepEqual(after(['-----', '-----', '-----', '--W--', 'E-@--'], 'u'),
                          ['--w--', '--$--', '-----', '-----', 'E-@--']);
});

test('a one-cell roll drops the bag on the cell the bin just vacated', () => {
  assert.deepEqual(after(['--#--', '-----', '--W--', '--@--', 'E----'], 'u'),
                          ['--#--', '--w--', '--$--', '--@--', 'E----']);
});

test('an emptied wheelie bin still rolls', () => {
  assert.deepEqual(after(['-----', '-----', '--w--', '--@--', 'E----'], 'u'),
                          ['--w--', '-----', '-----', '--@--', 'E----']);
});

test('a wheelie bin with nowhere to roll is refused', () => {
  assert.equal(refused(['--#--', '--W--', '--@--', 'E----'], 'u'), 'canRoom');
});

test('a rolling bin stops short of the exit rather than occupying it', () => {
  assert.deepEqual(after(['--E--', '-----', '--w--', '--@--', '-----'], 'u'),
                          ['--E--', '--w--', '-----', '--@--', '-----']);
});

// WATER TAKES ANYTHING. What it refuses is the raccoon, and every other consequence in this
// section is that one fact plus "a push finishes with him standing where the thing was".
const CANAL = ['-----', '~~~~~', '-----', '-----', '-----'];

test('the raccoon will not step into open water', () => {
  assert.equal(refused(['-----', '-----', '--@--', 'E----'], 'u',
                       ['-----', '--~--', '-----', '-----']), 'water');
});

// A fan that reaches the canal FILLS it. The trash is spent doing that, so the cell comes
// out as floor — terrain, no occupant — which is what lets anything stand on it afterwards.
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

// The point of making a filled cell terrain rather than an occupant: there is room on it for
// something else. A bridge is floor, so a can rolls over it exactly as it would over floor.
test('an object can be shoved across a bridge, because a bridge is floor', () => {
  const w = ['-----', '~===~', '-----', '-----', '-----'];
  const g = ['-----', '-----', '--c--', '--@--', 'E----'];
  assert.deepEqual(after(g, 'u', w), ['-----', '--c--', '--@--', '-----', 'E----']);
  assert.deepEqual(afterWet(g, 'u', w), w);        // the crossing is unchanged under it
});

// And it cuts both ways: floor takes trash, so a later fan can re-block a crossing you made.
test('a fan can land on a bridge and wall your own crossing off again', () => {
  const w = ['-----', '~===~', '-----', '-----', '-----'];
  const s = act(['-----', '-----', '--$--', '--@--', 'E----'], 'u', w);
  assert.deepEqual(toGrid(s), ['-----', '-xxx-', '-x@x-', '-----', 'E----']);
  assert.deepEqual(toWater(s), w);                 // still a bridge underneath…
  assert.equal(explain(s, 'u').reason, 'trash');   // …and now unwalkable, like any floor
});

// He can shove things off the bank all day. What he cannot do is follow them, and a push
// puts him where the thing was — so one shove into the canal is the last shove it gets.
test('a can shoved at the canal goes in, and is then out of reach forever', () => {
  const g = ['-----', '-----', '--c--', '--@--', 'E----'];
  const w = ['-----', '--~--', '-----', '-----', '-----'];
  assert.deepEqual(after(g, 'u', w), ['-----', '--c--', '--@--', '-----', 'E----']);
  assert.equal(explain(act(g, 'u', w), 'u').reason, 'water');   // he will not wade in after it
});

test('a full can ejects its bag into the water, and that bag can never be opened', () => {
  const g = ['-----', '-----', '--C--', '--@--', 'E----'];
  const w = ['--~--', '-----', '-----', '-----', '-----'];
  const s = act(g, 'u', w);
  assert.deepEqual(toGrid(s), ['--$--', '--c--', '--@--', '-----', 'E----']);
  assert.equal(explain(s, 'u').reason, 'canRoom');   // the emptied can is in the way…
  assert.equal(bagsLeft(s), 1);                      // …and the bag still counts, so it is lost
});

test('the recycle bin bridges one cell — one spent for one gained', () => {
  const w = ['--~--', '-----', '-----', '-----', '-----'];
  const g = ['-----', '-----', '--b--', '--@--', 'E----'];
  assert.deepEqual(after(g, 'u', w), ['-----', '--b--', '--@--', '-----', 'E----']);
  assert.deepEqual(afterWet(g, 'u', w), ['--=--', '-----', '-----', '-----', '-----']);
});

// The corollary, and it rules out a whole class of room: the bin lands on the ONLY cell that
// approaches the bridge it just made, because a water cell's only dry neighbours are the two
// banks. So the recycle bin can never bridge a canal for the raccoon — only a bag can, since
// he ends a tear on the bag's cell, behind the fan. Letting objects into the water does not
// change this: whatever he shoves at a canal parks on the approach.
test('the bin parks itself on the far side of the bridge it just built', () => {
  const w = ['--~--', '-----', '-----', '-----', '-----'];
  const s = act(['-----', '-----', '--b--', '--@--', 'E----'], 'u', w);
  assert.equal(explain(s, 'u').reason, 'canRoom');   // the bin is in the way now
});

test('a wheelie bin rolls clean across a canal — he never follows it, so nothing stops it', () => {
  const w = ['-----', '--~--', '-----', '-----', '-----'];
  assert.deepEqual(after(['-----', '-----', '--w--', '--@--', 'E----'], 'u', w),
                          ['--w--', '-----', '-----', '--@--', 'E----']);
});

// The water jug: the recycle bin's mirror. Same two-cell shove, but what lands two ahead
// is terrain rather than an occupant — a hole instead of a wall. It never runs dry, for the
// same reason the bin never does: the interesting question is where you put the obstacle.
const JUGBOARD = ['-----', '-----', '--j--', '--@--', 'E----'];

test('water jug slides one and spills a cell of water directly ahead', () => {
  assert.deepEqual(after(JUGBOARD, 'u'), ['-----', '--j--', '--@--', '-----', 'E----']);
  assert.deepEqual(afterWet(JUGBOARD, 'u'), ['--~--', '-----', '-----', '-----', '-----']);
});

// The jug's own adjacency tax. It can be shoved a second time the same way — objects go in
// the canal like anything else — but it shoves itself INTO the puddle it just made, where
// nothing can reach it again. The refusal became a trap when water started taking objects,
// which is a fair trade: it is still a one-way decision, just a quieter one.
test('a jug shoved twice the same way drives itself into its own puddle', () => {
  const twice = explain(act(['-----', '-----', '-----', '--j--', '--@--', 'E----'], 'u'), 'u');
  assert.ok(twice.ok, 'the second shove is legal now — objects go in the canal');
  assert.deepEqual(toGrid(twice.next),
    ['-----', '--j--', '--@--', '-----', '-----', 'E----']);
  assert.deepEqual(toWater(twice.next),
    ['--~--', '--~--', '-----', '-----', '-----', '-----']);   // it is sitting in the lower one
  assert.equal(explain(twice.next, 'u').reason, 'water');      // and now nothing can reach it
});

// It never runs dry, for the same reason the recycle bin never does: the question the
// piece asks is where you put the obstacle, not how many you have left.
test('the jug never runs dry — walk round and it spills again', () => {
  let s = act(['-----', '-----', '-----', '--j--', '--@--', 'E----'], 'u');
  for (const d of ['l', 'u']) s = explain(s, d).next;
  s = explain(s, 'r').next;
  assert.deepEqual(toGrid(s), ['-----', '-----', '--@j-', '-----', '-----', 'E----']);
  assert.deepEqual(toWater(s), ['-----', '--~--', '----~', '-----', '-----', '-----']);
});

test('the jug is refused when its water would land on the exit', () => {
  assert.equal(refused(['--E--', '-----', '--j--', '--@--', '-----'], 'u'), 'exit');
});

// Water is the one load that needs DRY ground to land on: pouring into water changes
// nothing, and pouring onto trash would un-block a cell, which this game never does.
test('the jug will not pour into water it has already spilled', () => {
  assert.equal(refused(JUGBOARD, 'u', ['--~--', '-----', '-----', '-----', '-----']), 'water');
});

test('the jug will not pour onto spilled trash — nothing in this game un-blocks a cell', () => {
  assert.equal(refused(['--x--', '-----', '--j--', '--@--', 'E----'], 'u'), 'canRoom');
});

// The piece's whole point: the jug's obstacle is the only one in the game you can take
// back, because trash — which blocks everywhere else — is what makes water walkable.
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

// Furniture: the first piece that spans cells. A rigid polyomino, translate-only, and the
// clearance test covers only the ground it moves INTO — not the ground it moves out of.
test('a couch shoves as one unit and the raccoon takes the cell he pushed', () => {
  assert.deepEqual(after(['-----', '-FF--', '-@---', 'E----'], 'u'),
                          ['-FF--', '-@---', '-----', 'E----']);
});

// A three-long couch shoved along its own length asks for ONE new cell, not three — the two
// it is stepping out of are its own. That is the difference between clearing the translated
// footprint and clearing the leading edge, and it is what makes long pieces manoeuvrable.
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

// A long couch crosses a canal because it never lets go of the bank: shoved along its own
// length its front end goes in the water while its back end is still dry, so he always has
// somewhere to stand for the next shove. Nothing about that is a rule — it is the footprint.
test('a couch shoved along its length walks itself into the canal, one end at a time', () => {
  const g = ['-----', '-----', '--F--', '--F--', '--F--', '--@--', 'E----'];
  const w = ['-----', '--~--', '-----', '-----', '-----', '-----', '-----'];
  const s = act(g, 'u', w);
  assert.deepEqual(toGrid(s), ['-----', '--F--', '--F--', '--F--', '--@--', '-----', 'E----']);
  assert.equal(explain(s, 'u').ok, true, 'its back end is still on dry land');
});

test('once the end he is touching is afloat, the couch is beyond him', () => {
  const g = ['--F--', '--F--', '--@--', 'E----'];
  const w = ['--~--', '--~--', '-----', '-----'];
  assert.equal(refused(g, 'u', w), 'water');
});

// The two-couch problem, and the reason the glyphs are a pool rather than one letter.
test('two letters flush together are two couches, and shove independently', () => {
  const g = ['-----', '-FFGG', '-@---', 'E----'];
  assert.deepEqual(after(g, 'u'), ['-FF--', '-@-GG', '-----', 'E----']);
});

test('the same letter, touching, is one couch and shoves whole', () => {
  const g = ['-----', '-FFFF', '-@---', 'E----'];
  assert.deepEqual(after(g, 'u'), ['-FFFF', '-@---', '-----', 'E----']);
});

test('the same letter used twice, not touching, is two couches', () => {
  // Written with one letter; the writer hands out canonical letters, so it comes back F and G.
  assert.deepEqual(toGrid(S(['FF-FF', '--@--', 'E----'])), ['FF-GG', '--@--', 'E----']);
});

test('a one-cell couch is refused — that piece already exists, and it is the can', () => {
  assert.throws(() => S(['-F---', '-@---', 'E----']), /single cell/);
});

test('furniture blocks a fan, like anything else standing in one', () => {
  assert.equal(refused(['-----', 'FF---', '-$---', '-@---', 'E----'], 'u'), 'fan');
});

test('glyphs round-trip through the serialiser, water layer and all', () => {
  const g = ['Sb---', '-Wwj-', '--@--', 'E--x-', 'FFGGc'];
  const w = ['-----', '-----', '-----', '---~-', '----~'];   // a bridge, and a can afloat
  assert.deepEqual(toGrid(S(g, w)), g);
  assert.deepEqual(toWater(S(g, w)), w);
});
